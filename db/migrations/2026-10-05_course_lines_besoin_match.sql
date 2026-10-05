-- ============================================================================
-- À EXÉCUTER DANS L'ÉDITEUR SQL DE SUPABASE (dashboard).
-- ============================================================================

-- Comparatif « besoins du projet / liste de courses » (modale Stock du dossier).
-- Le rapprochement entre une ligne de courses Odoo et un tissu du BPF est
-- automatique (ressemblance des noms) ; quand l'utilisateur le corrige, son choix
-- est mémorisé ici :
--   NULL           → rapprochement automatique
--   '<NOM TISSU>'  → rattachée à ce tissu (nom du besoin, en majuscules)
--   '__ignore__'   → ne pas compter cette ligne
-- La synchro Odoo n'écrase pas cette colonne (elle n'est pas dans ses champs).
ALTER TABLE public.odoo_course_lines
  ADD COLUMN IF NOT EXISTS besoin_match text;

NOTIFY pgrst, 'reload schema';
