-- Module « Devis Odoo » : réglages et lien du devis, PAR MINUTE.
-- À exécuter une fois dans l'éditeur SQL de Supabase.
--
-- minutes.odoo_quote (jsonb) :
--   settings : structure choisie pour cette minute (sections, sous-sections, déplacement fondu ou
--              à part, articles remplacés « ici seulement »)
--   texts    : descriptions retouchées à la main dans l'aperçu
--   link     : devis créé dans Odoo (id, numéro CVxx-xxxx, lien, opportunité, date, auteur, montant)
--
-- Pas de nouvelle politique : la colonne hérite de la sécurité de la table `minutes`
-- (accès réservé aux utilisateurs connectés, cf. 2026-10-07_securite_rls_acces_connectes.sql).
-- Non chargée par la liste des chiffrages (colonnes légères) : lue seulement à l'ouverture d'une minute.

alter table public.minutes add column if not exists odoo_quote jsonb;

comment on column public.minutes.odoo_quote is
  'Module Devis Odoo : { settings, texts, link } — réglages de structure, retouches de texte et devis Odoo lié.';
