-- Migration : Ajout du champ consumed_import sur les projets
-- Stocke les heures déjà consommées à l'import (projets repris en cours)
-- À exécuter dans l'éditeur SQL de Supabase

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS consumed_import jsonb DEFAULT '{"prepa":0,"conf":0,"pose":0}'::jsonb;
