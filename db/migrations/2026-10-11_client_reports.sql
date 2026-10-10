-- Rapport client (Suivi de projet) : historique des rapports émis + réglages.
-- À exécuter une fois dans l'éditeur SQL de Supabase.

-- 1. Rapports archivés : copie figée de ce qui a été envoyé au client (lignes, textes,
--    réglages), numérotée par projet (Rapport n° 1, 2, 3…).
create table if not exists public.client_reports (
  id               uuid primary key default gen_random_uuid(),
  project_id       text not null,
  number           integer not null,
  author           text,
  comment          text,                 -- note interne libre (colonne « Commentaire » de l'historique)
  row_count        integer not null default 0,
  levels           jsonb not null default '[]'::jsonb,   -- structure (regroupements)
  settings         jsonb not null default '{}'::jsonb,   -- photos, statuts, couverture, annexe…
  texts            jsonb not null default '{}'::jsonb,   -- introduction, notes, commentaires, mentions
  project_snapshot jsonb not null default '{}'::jsonb,   -- nom, adresse, chargé d'affaires à la date du rapport
  rows             jsonb not null default '[]'::jsonb,   -- ouvrages figés (zone, pièce, produit, statut, photos…)
  created_at       timestamptz not null default now(),
  unique (project_id, number)
);
create index if not exists client_reports_project_idx on public.client_reports (project_id, number desc);

-- 2. Réglages : libellés client des statuts (clé « global ») et photo de couverture
--    propre à chaque projet (clé = id du projet).
create table if not exists public.client_report_settings (
  key            text primary key,
  cover_url      text,
  status_labels  jsonb,
  updated_at     timestamptz not null default now()
);

-- Même règle que le reste de l'appli (2026-10-07) : rien avant la connexion.
alter table public.client_reports enable row level security;
drop policy if exists "client_reports connectés" on public.client_reports;
create policy "client_reports connectés" on public.client_reports for all to authenticated using (true) with check (true);

alter table public.client_report_settings enable row level security;
drop policy if exists "client_report_settings connectés" on public.client_report_settings;
create policy "client_report_settings connectés" on public.client_report_settings for all to authenticated using (true) with check (true);

revoke all on public.client_reports, public.client_report_settings from anon;
grant select, insert, update, delete on public.client_reports, public.client_report_settings to authenticated;

notify pgrst, 'reload schema';
