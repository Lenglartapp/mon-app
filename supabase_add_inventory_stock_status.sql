-- Statut du stock forcé à la main par un admin (fiche article, double-clic dans l'inventaire).
-- Vide (NULL) = automatique : le statut est déduit du dossier affecté, comme avant.
-- Valeurs : TODO (Réservé), IN_PROGRESS (En cours), DONE (Reliquat), SAV, ARCHIVED (Stock mort), LIBRE.
-- À exécuter une fois dans l'éditeur SQL de Supabase. Ne modifie aucune ligne existante.

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS stock_status text
  CHECK (stock_status IS NULL OR stock_status IN ('TODO', 'IN_PROGRESS', 'DONE', 'SAV', 'ARCHIVED', 'LIBRE'));
