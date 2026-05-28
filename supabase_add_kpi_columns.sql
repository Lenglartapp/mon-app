-- Ajout des colonnes KPI précalculées sur la table minutes.
-- À exécuter une seule fois dans l'éditeur SQL de Supabase.
-- Ces colonnes sont mises à jour automatiquement à chaque sauvegarde depuis ChiffrageScreen.

ALTER TABLE public.minutes
  ADD COLUMN IF NOT EXISTS marge_eur  numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS marge_pct  numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS renta_hh   numeric DEFAULT 0;

-- Index optionnel pour les filtres avancés (contribution %, horaire)
CREATE INDEX IF NOT EXISTS idx_minutes_marge_pct ON public.minutes (marge_pct);
CREATE INDEX IF NOT EXISTS idx_minutes_renta_hh  ON public.minutes (renta_hh);
