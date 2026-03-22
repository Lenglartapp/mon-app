-- Migration : Ajout de la relation parent-enfant sur les minutes (variantes)
-- À exécuter dans l'éditeur SQL de Supabase

ALTER TABLE public.minutes
ADD COLUMN IF NOT EXISTS parent_id text references public.minutes(id) on delete set null;

-- Index pour accélérer les requêtes "donne-moi tous les enfants de X"
CREATE INDEX IF NOT EXISTS idx_minutes_parent_id ON public.minutes(parent_id);
