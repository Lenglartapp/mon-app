-- =============================================================================
-- HISTORIQUE DE VERSIONS DES PROJETS (+ ménage de nuit des versions projets ET chiffrages)
-- =============================================================================
-- Même principe que les chiffrages (supabase_add_minutes_history.sql) :
--  • c'est la BASE qui garde les versions (déclencheur) : aucun bug de l'appli ne peut
--    l'empêcher ;
--  • on garde l'ANCIEN contenu des lignes (`rows`) juste avant une modification, au plus
--    une version toutes les 15 min, et seulement si les lignes changent ;
--  • chute brutale (≥ 30 % de lignes en moins) → version gardée immédiatement ;
--  • les photos ne sont pas recopiées : les lignes ne contiennent que leurs liens.
-- En plus : « changed_by » = la personne dont la modification a déclenché la version.
--
-- Ménage (job de nuit, fonction prune_versions_history) : tout sur 2 jours, puis 1 version
-- par jour jusqu'à 1 mois, puis 1 par semaine jusqu'à 6 mois, rien au-delà.
--
-- À exécuter UNE FOIS dans l'éditeur SQL de Supabase. Rollback en bas.
-- =============================================================================

-- 1) TABLE ---------------------------------------------------------------------
create table if not exists public.projects_history (
  id           uuid primary key default gen_random_uuid(),
  project_id   text not null,
  captured_at  timestamptz not null default now(),
  reason       text,          -- 'auto' | 'shrink-guard' | 'pre-restore'
  author       text,          -- restaurations faites depuis l'appli
  changed_by   text,          -- auteur de la modification qui a déclenché la version
  rows         jsonb,         -- lignes du projet (contenu restaurable)
  nb_lignes    int,
  name         text,
  status       text
);
create index if not exists idx_projects_history_project
  on public.projects_history (project_id, captured_at desc);

-- Règle de l'appli (2026-10-07) : rien avant la connexion. Lecture + ajout (version
-- « avant restauration ») pour les connectés ; aucune modification / suppression côté
-- appli (le ménage passe par la fonction de nuit, clé service).
alter table public.projects_history enable row level security;
drop policy if exists "projects_history lecture" on public.projects_history;
create policy "projects_history lecture" on public.projects_history for select to authenticated using (true);
drop policy if exists "projects_history ajout" on public.projects_history;
create policy "projects_history ajout" on public.projects_history for insert to authenticated with check (true);

-- 2) DÉCLENCHEUR -----------------------------------------------------------------
create or replace function public.projects_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_n int := case when jsonb_typeof(OLD.rows) = 'array' then jsonb_array_length(OLD.rows) else 0 end;
  new_n int := case when jsonb_typeof(NEW.rows) = 'array' then jsonb_array_length(NEW.rows) else 0 end;
  is_shrink boolean := old_n > 0 and new_n < (old_n * 0.7);
  last_at timestamptz;
  reason_txt text := 'auto';
  who text;
begin
  if OLD.rows is not distinct from NEW.rows then
    return NEW;
  end if;

  if is_shrink then
    reason_txt := 'shrink-guard';
  else
    select max(captured_at) into last_at from public.projects_history where project_id = OLD.id::text;
    if last_at is not null and last_at > (now() - interval '15 minutes') then
      return NEW;   -- une version récente existe déjà
    end if;
  end if;

  begin
    select nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '')
      into who from public.profiles where id = auth.uid();
  exception when others then who := null;
  end;

  insert into public.projects_history (project_id, reason, changed_by, rows, nb_lignes, name, status)
  values (OLD.id::text, reason_txt, who, OLD.rows, old_n, OLD.name, OLD.status);

  return NEW;   -- ne modifie jamais l'enregistrement en cours
end;
$$;

drop trigger if exists trg_projects_snapshot on public.projects;
create trigger trg_projects_snapshot
  before update on public.projects
  for each row execute function public.projects_snapshot();

-- 3) MÉNAGE DE NUIT (projets ET chiffrages) ---------------------------------------
create or replace function public.prune_versions_history()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_projects int := 0;
  n_minutes int := 0;
begin
  with ranked as (
    select id, captured_at,
           row_number() over (partition by project_id, date_trunc('day',  captured_at) order by captured_at desc) as rn_day,
           row_number() over (partition by project_id, date_trunc('week', captured_at) order by captured_at desc) as rn_week
    from public.projects_history
  ), doomed as (
    select id from ranked
    where captured_at < now() - interval '180 days'
       or (captured_at < now() - interval '30 days' and rn_week > 1)
       or (captured_at < now() - interval '2 days'  and rn_day  > 1)
  )
  delete from public.projects_history h using doomed d where h.id = d.id;
  get diagnostics n_projects = row_count;

  with ranked as (
    select id, captured_at,
           row_number() over (partition by minute_id, date_trunc('day',  captured_at) order by captured_at desc) as rn_day,
           row_number() over (partition by minute_id, date_trunc('week', captured_at) order by captured_at desc) as rn_week
    from public.minutes_history
  ), doomed as (
    select id from ranked
    where captured_at < now() - interval '180 days'
       or (captured_at < now() - interval '30 days' and rn_week > 1)
       or (captured_at < now() - interval '2 days'  and rn_day  > 1)
  )
  delete from public.minutes_history h using doomed d where h.id = d.id;
  get diagnostics n_minutes = row_count;

  return jsonb_build_object('projects_deleted', n_projects, 'minutes_deleted', n_minutes);
end;
$$;

-- Réservée au job de nuit (clé service), jamais appelable depuis l'appli.
revoke execute on function public.prune_versions_history() from public, anon, authenticated;
grant execute on function public.prune_versions_history() to service_role;

-- =============================================================================
-- CONTRÔLE (après exécution) : modifier un projet de test, puis
--   select captured_at, reason, changed_by, nb_lignes from public.projects_history
--   order by captured_at desc limit 5;
-- ROLLBACK :
--   drop trigger if exists trg_projects_snapshot on public.projects;
--   drop function if exists public.projects_snapshot();
--   drop function if exists public.prune_versions_history();
--   drop table if exists public.projects_history;
-- =============================================================================
