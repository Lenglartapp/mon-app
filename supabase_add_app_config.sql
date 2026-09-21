-- Config applicative simple (clé/valeur) — sert au job de nuit à connaître la « date de bascule »
-- (odoo_cutoff_date) côté serveur, indépendamment du localStorage du navigateur.
-- À exécuter une fois dans l'éditeur SQL de Supabase.

create table if not exists public.app_config (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

alter table public.app_config enable row level security;

-- Même modèle d'accès public que les autres tables de l'app (pas de secret côté client).
drop policy if exists "app_config read" on public.app_config;
create policy "app_config read" on public.app_config for select using (true);

drop policy if exists "app_config write" on public.app_config;
create policy "app_config write" on public.app_config for all using (true) with check (true);

-- Graine : date de bascule = aujourd'hui (À AJUSTER selon la vraie date de bascule voulue,
-- ou via le sélecteur « Date de bascule » de l'écran Odoo qui écrit cette valeur).
insert into public.app_config (key, value)
values ('odoo_cutoff_date', to_char(current_date, 'YYYY-MM-DD'))
on conflict (key) do nothing;
