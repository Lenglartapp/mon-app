-- 1. TABLE MINUTES (Chiffrage / Devis)
create table if not exists public.minutes (
  id text primary key, -- On garde l'ID textuel généré par uid() localement pour simplifier la migration
  name text not null default 'Nouveau Devis',
  client text,
  status text default 'DRAFT', -- 'DRAFT', 'PENDING_APPROVAL', 'VALIDATED', 'REJECTED'
  version int default 1,
  notes text,
  
  -- Données Principales (JSONB)
  lines jsonb default '[]'::jsonb, -- Lignes produits (Rideaux, Stores...)
  deplacements jsonb default '[]'::jsonb, -- Frais de déplacement / Logistique
  params jsonb default '[]'::jsonb, -- Paramètres globaux (Coefficients, Taux horaires)
  extras jsonb default '[]'::jsonb, -- Autres dépenses
  
  -- Totaux (Calculés pour requêtes rapides)
  total_ht numeric default 0,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. TABLE INVENTORY_ITEMS (Stock)
create table if not exists public.inventory_items (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  category text default 'General',
  
  stock_quantity numeric default 0,
  unit text default 'unité', -- 'm', 'pcs', 'kg'
  min_threshold numeric default 0, -- Seuil alerte
  
  location text, -- Emplacement physique
  supplier text, -- Fournisseur principal
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. TABLE INVENTORY_LOGS (Historique Mouvements)
create table if not exists public.inventory_logs (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid references public.inventory_items(id) on delete cascade,
  
  type text not null, -- 'IN', 'OUT', 'ADJUST'
  quantity numeric not null,
  reason text, -- 'Commande', 'Perte', 'Production', 'Inventaire'
  user_name text, -- Qui a fait l'action
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. TABLE ACTIVITY (Journal global)
create table if not exists public.activity (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  type text not null, -- 'comment', 'change'
  content text,
  field text,
  val_from text,
  val_to text,
  user_name text,
  row_id text,
  project_id text
);

-- SÉCURITÉ (RLS)
alter table public.minutes enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_logs enable row level security;
alter table public.activity enable row level security;

-- POLITIQUES (Mode DEV - Tout ouvert)
create policy "Public Access Minutes" on public.minutes for all using (true);
create policy "Public Access Inventory Items" on public.inventory_items for all using (true);
create policy "Public Access Inventory Logs" on public.inventory_logs for all using (true);
create policy "Public Access Activity" on public.activity for all using (true);
