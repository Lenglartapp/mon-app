-- ============================================================================
-- À EXÉCUTER DANS L'ÉDITEUR SQL DE SUPABASE (dashboard).
-- Ne se déploie PAS via le code de l'app (clé anon = pas de DDL).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Colonnes `settings` et `matieres` manquantes sur `minutes`
--
-- Corrige l'erreur : « Could not find the 'settings' column of 'minutes' in the
-- schema cache » (400 / PGRST204), déclenchée à chaque modification des
-- Paramètres Globaux du chiffrage (taux horaire, prix nuit/repas, coef
-- sous-traitance) depuis la Bibliothèque d'Articles / CatalogManager.
--
-- Impact avant correctif : PostgREST rejette TOUTE la requête dès qu'une seule
-- colonne est inconnue. Le même payload transportait `params` (taux horaire) et
-- `catalog` (coefs tissus) — tout était perdu. Et comme l'écriture échouée était
-- remise en file et fusionnée avec les suivantes, la colonne fantôme
-- empoisonnait TOUTES les sauvegardes ultérieures du devis (boucle de 400).
--
-- `matieres` est écrite par ChiffrageScreen (onChangeMinute) et souffre du même
-- problème dès qu'elle est renseignée.
--
-- IF NOT EXISTS : sans risque si les colonnes existent déjà.
-- ----------------------------------------------------------------------------
ALTER TABLE public.minutes
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS matieres jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Recharge le cache de schéma PostgREST (sinon l'erreur peut persister un instant).
NOTIFY pgrst, 'reload schema';

-- Vérif (optionnel) :
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'minutes' AND column_name IN ('settings', 'matieres');
