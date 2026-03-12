-- Script SQL pour créer la table catalog_rail
-- À exécuter dans le SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS public.catalog_rail (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL, -- Nom généré (Fournisseur + Réf + Coloris)
  provider text, -- Fournisseur (ex: Somfy)
  reference text, -- Référence (ex: Glydea)
  color text, -- Coloris (ex: Blanc)
  category text DEFAULT 'Rail', -- Toujours 'Rail' par défaut ici
  buyPrice numeric DEFAULT 0, -- Prix d'achat (PA)
  coef numeric DEFAULT 2, -- Coefficient multiplicateur
  sellPrice numeric DEFAULT 0, -- Prix de vente (PV)
  unit text DEFAULT 'ml', -- Unité ('ml', 'pce', etc.)
  
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Activation de la sécurité (Row Level Security)
ALTER TABLE public.catalog_rail ENABLE ROW LEVEL SECURITY;

-- Politique d'accès (Mode dev/public pour l'instant, comme le reste du projet)
CREATE POLICY "Public Access Catalog Rail" ON public.catalog_rail FOR ALL USING (true);

-- Insertion des 3 rails par défaut
INSERT INTO public.catalog_rail (name, provider, reference, color, category, buyPrice, coef, sellPrice, unit)
VALUES 
  ('Somfy Glydea Ultra Blanc', 'Somfy', 'Glydea Ultra', 'Blanc', 'Rail', 150, 2, 300, 'ml'),
  ('Silent Gliss SG 6840 Alu', 'Silent Gliss', 'SG 6840', 'Alu', 'Rail', 45, 2, 90, 'ml'),
  ('Standard Tringle Déco ø20 Noir Mat', 'Standard', 'Tringle Déco ø20', 'Noir Mat', 'Rail', 30, 2, 60, 'ml');
