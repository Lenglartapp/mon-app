-- =============================================================================
-- HISTORIQUE DE VERSIONS DES CHIFFRAGES — Phase 1 (filet de sécurité, backend seul)
-- =============================================================================
-- Objectif : garder automatiquement, par chiffrage, des snapshots restaurables du
-- contenu (lines / deplacements / extraDepenses), au niveau BASE (trigger Postgres),
-- pour qu'AUCUN bug applicatif ne puisse contourner la sauvegarde.
--
-- Léger : coalescence 15 min + version « allégée » (on n'archive PAS les croquis/photos
-- pour le chiffrage) + shrink-guard qui force un snapshot avant toute chute suspecte.
-- L'éclaircissement (escalier jour→semaine) sera fait par le job de nuit (Phase 3).
--
-- Rien ne change côté app tant que la Phase 2 (UI « Versions ») n'est pas livrée :
-- ce script ne fait qu'accumuler l'historique en tâche de fond.
--
-- À exécuter UNE FOIS dans l'éditeur SQL de Supabase.
-- Rollback éventuel : voir le bloc commenté tout en bas.
-- =============================================================================

-- 1) TABLE ---------------------------------------------------------------------
create table if not exists public.minutes_history (
  id             uuid primary key default gen_random_uuid(),
  minute_id      text not null references public.minutes(id) on delete cascade,
  captured_at    timestamptz not null default now(),
  reason         text,        -- 'auto' | 'shrink-guard' | 'pre-restore'
  author         text,        -- renseigné pour les restaurations (app) ; null pour l'auto
  -- contenu restaurable (allégé : sans croquis/photos pour le chiffrage)
  lines          jsonb,
  deplacements   jsonb,
  extra_depenses jsonb,
  -- aperçu pour lister sans charger le gros JSONB
  nb_lignes      int,
  ca_total       numeric,
  name           text,
  status         text
);

create index if not exists idx_minutes_history_minute
  on public.minutes_history (minute_id, captured_at desc);

-- RLS : même modèle public que les autres tables de l'app.
alter table public.minutes_history enable row level security;
drop policy if exists "minutes_history read" on public.minutes_history;
create policy "minutes_history read" on public.minutes_history for select using (true);
drop policy if exists "minutes_history write" on public.minutes_history;
create policy "minutes_history write" on public.minutes_history for all using (true) with check (true);

-- 2) HELPER : retire des champs "lourds" (croquis/photos) de chaque ligne -------
-- Configurable via le paramètre `heavy` → pour les PROJETS plus tard, on pourra
-- appeler sans rien retirer (croquis/photos indispensables) ou avec une autre liste.
create or replace function public.strip_heavy_fields(arr jsonb, heavy text[])
returns jsonb
language plpgsql
immutable
as $$
declare result jsonb;
begin
  if arr is null or jsonb_typeof(arr) <> 'array' then
    return coalesce(arr, '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(stripped order by ord), '[]'::jsonb)
    into result
  from (
    select ord,
           coalesce((
             select jsonb_object_agg(k, v)
             from jsonb_each(elem) as e(k, v)
             where not (k = any(heavy))
           ), '{}'::jsonb) as stripped
    from jsonb_array_elements(arr) with ordinality as t(elem, ord)
    where jsonb_typeof(elem) = 'object'
  ) s;
  return result;
end;
$$;

-- 3) TRIGGER : capture l'ANCIEN contenu avant modification ----------------------
-- Conditions : le contenu change ET (chute suspecte OU pas de version depuis 15 min).
create or replace function public.minutes_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  heavy text[] := array['croquis','schema_photo','photos_sur_site','schema_principe',
                        'croquis_intervalle','schema_dessin','photos','photo'];
  old_n int := case when jsonb_typeof(OLD.lines) = 'array' then jsonb_array_length(OLD.lines) else 0 end;
  new_n int := case when jsonb_typeof(NEW.lines) = 'array' then jsonb_array_length(NEW.lines) else 0 end;
  content_changed boolean := (OLD.lines          is distinct from NEW.lines)
                          or (OLD.deplacements   is distinct from NEW.deplacements)
                          or (OLD."extraDepenses" is distinct from NEW."extraDepenses");
  last_at timestamptz;
  is_shrink boolean := old_n > 0 and new_n < (old_n * 0.7);  -- chute >= 30 %
  reason_txt text := 'auto';
begin
  if not content_changed then
    return NEW;
  end if;

  if is_shrink then
    reason_txt := 'shrink-guard';   -- on force le snapshot (protège contre un vidage)
  else
    select max(captured_at) into last_at
    from public.minutes_history where minute_id = OLD.id;
    if last_at is not null and last_at > (now() - interval '15 minutes') then
      return NEW;                   -- coalescence : une version récente existe déjà
    end if;
  end if;

  insert into public.minutes_history
    (minute_id, reason, lines, deplacements, extra_depenses, nb_lignes, ca_total, name, status)
  values
    (OLD.id, reason_txt,
     public.strip_heavy_fields(OLD.lines,          heavy),
     public.strip_heavy_fields(OLD.deplacements,   heavy),
     public.strip_heavy_fields(OLD."extraDepenses", heavy),
     old_n, OLD.ca_total, OLD.name, OLD.status);

  return NEW;   -- ne modifie jamais l'update en cours
end;
$$;

drop trigger if exists trg_minutes_snapshot on public.minutes;
create trigger trg_minutes_snapshot
  before update on public.minutes
  for each row execute function public.minutes_snapshot();

-- =============================================================================
-- ROLLBACK (si besoin) :
--   drop trigger if exists trg_minutes_snapshot on public.minutes;
--   drop function if exists public.minutes_snapshot();
--   drop function if exists public.strip_heavy_fields(jsonb, text[]);
--   drop table if exists public.minutes_history;
-- =============================================================================
