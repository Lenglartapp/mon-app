-- ============================================================================
-- À EXÉCUTER DANS L'ÉDITEUR SQL DE SUPABASE (dashboard).
-- Ne se déploie PAS via le code de l'app (clé anon = pas de DDL).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SUJET 1 — Colonnes contrat manquantes sur `profiles`
-- Corrige l'erreur : « Could not find the 'contract_start_date' column of
-- 'profiles' in the schema cache » à la création d'un employé (CDI/CDD/Intérim).
-- Le code (PlanningScreen.jsx) insère / met à jour ces 4 colonnes.
-- IF NOT EXISTS : sans risque si certaines existent déjà.
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contract_type        text,
  ADD COLUMN IF NOT EXISTS contract_start_date  date,
  ADD COLUMN IF NOT EXISTS contract_end_date    date,
  ADD COLUMN IF NOT EXISTS archived_at          timestamptz;

-- Recharge le cache de schéma PostgREST (sinon l'erreur peut persister un instant).
NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- SUJET 2 — Arrêter les intérimaires par défaut (Interimpose1/2/3) au
-- vendredi dernier, EN GARDANT l'historique déjà planifié.
--
-- On NE supprime PAS les profils : on les ARCHIVE à la date du dernier vendredi.
--   • Semaines passées : créneaux conservés → historique visible.
--   • Cette semaine et après : contrat terminé → ils disparaissent de la grille.
--   • Panneau « Gérer l'équipe » : archived_at les retire de la liste active.
--
-- Date de coupure = vendredi dernier. Aujourd'hui = mardi 30/06/2026, donc
-- vendredi dernier = 2026-06-26. ⚠️ ADAPTE cette date si tu exécutes un autre jour.
-- ----------------------------------------------------------------------------
-- Couvre les intérimaires par défaut de la POSE (Interimpose*) ET de la
-- CONFECTION (Interimconf*). Rejouer sur des profils déjà archivés est sans effet.
UPDATE public.profiles
   SET archived_at        = '2026-06-26',   -- archivage = retiré du roster, coupure grille
       contract_end_date  = '2026-06-26'    -- fin de contrat explicite (affichage)
 WHERE first_name ILIKE 'Interim%';

-- Supprime UNIQUEMENT leurs créneaux FUTURS (après la coupure), sinon le
-- planning continuerait de les afficher sur les semaines à venir.
-- Les créneaux <= 2026-06-26 (historique) sont conservés.
-- NB : la table `events` n'a pas de colonne `date` ; on filtre sur `start_time`
-- (timestamptz). `start_time::date > '2026-06-26'` conserve le 26/06 et avant.
-- events.resource_id est de type text et profiles.id est uuid → on caste id::text.
DELETE FROM public.events
 WHERE resource_id IN (
   SELECT id::text FROM public.profiles
    WHERE first_name ILIKE 'Interim%'
 )
   AND start_time::date > '2026-06-26';

-- Vérifs (optionnel) :
-- SELECT first_name, archived_at, contract_end_date FROM public.profiles WHERE first_name ILIKE 'Interim%';
-- SELECT count(*) FROM public.events e JOIN public.profiles p ON p.id::text = e.resource_id
--   WHERE p.first_name ILIKE 'Interim%' AND e.start_time::date > '2026-06-26';  -- doit être 0
