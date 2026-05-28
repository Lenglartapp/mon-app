-- Migration : Ajout du CA total précalculé sur les minutes
-- À exécuter dans l'éditeur SQL de Supabase
-- Permet à la liste des chiffrages de lire directement le total sans recalculer

ALTER TABLE public.minutes
ADD COLUMN IF NOT EXISTS ca_total numeric DEFAULT 0;
