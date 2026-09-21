-- Type de produit d'une ligne de course Odoo (tissu / rail / mecanisme / store / consommable / autre).
-- Sert à l'affichage (pastille) et à ne basculer en stock QUE les tissus pour l'instant.
-- À exécuter une fois dans l'éditeur SQL de Supabase.

ALTER TABLE public.odoo_course_lines
  ADD COLUMN IF NOT EXISTS type_produit text;
