-- ============================================================================
-- À EXÉCUTER DANS L'ÉDITEUR SQL DE SUPABASE (dashboard).
-- Ne se déploie PAS via le code de l'app (clé anon = pas de DDL).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Colonne `pinned_ids` manquante sur `projects`
-- Corrige l'erreur : « Could not find the 'pinnedIds' column of 'projects' in
-- the schema cache » (code 400 / PGRST204) au moment d'épingler un élément du
-- fil d'activité. Cette erreur faisait rejeter TOUTE la sauvegarde du projet
-- (y compris la colonne `rows`) → perte de lignes (ex. voilage).
--
-- Le code (ProductionProjectScreen → useSupabase.updateProject) écrit désormais
-- la liste des épingles dans `pinned_ids` (jsonb, tableau d'IDs).
-- IF NOT EXISTS : sans risque si la colonne existe déjà.
-- ----------------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS pinned_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Recharge le cache de schéma PostgREST (sinon l'erreur peut persister un instant).
NOTIFY pgrst, 'reload schema';

-- Vérif (optionnel) :
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'projects' AND column_name = 'pinned_ids';
