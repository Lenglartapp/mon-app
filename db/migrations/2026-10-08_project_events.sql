-- Historique du DOSSIER (projet) : création (projet vierge / import manuel / commande Odoo)
-- et événements venus d'Odoo (commande annulée, devis supprimé, projet Odoo archivé…).
-- Table en ajout seul : l'appli (connectés) ajoute la création, le serveur (clé service,
-- api/odoo/order-event.js) ajoute les événements Odoo. Lu par la fenêtre « Historique » du projet.
create table if not exists public.project_events (
  id          uuid primary key default gen_random_uuid(),
  project_id  text not null,
  type        text not null,          -- created | odoo_linked | archived | restored
  label       text not null,          -- phrase affichée telle quelle
  detail      jsonb,                  -- { origin, minuteId, minuteName, orderName, odooEvent… }
  user_name   text,
  created_at  timestamptz not null default now()
);
create index if not exists project_events_project_idx on public.project_events (project_id, created_at);

-- Même règle que le reste de l'appli (2026-10-07) : rien avant la connexion.
alter table public.project_events enable row level security;
drop policy if exists "project_events lecture" on public.project_events;
create policy "project_events lecture" on public.project_events for select to authenticated using (true);
drop policy if exists "project_events ajout" on public.project_events;
create policy "project_events ajout" on public.project_events for insert to authenticated with check (true);
