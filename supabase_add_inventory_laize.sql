-- Ajoute la laize aux articles de stock (tissu). Aujourd'hui elle n'est stockée nulle part
-- (saisie mais jamais persistée) → on en fait une vraie colonne, éditable.
-- À exécuter une fois dans l'éditeur SQL de Supabase.

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS laize text;
