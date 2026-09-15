-- Intégration Odoo — lien manuel projet Droitfil -> projet Odoo.
-- Une seule case « ID projet Odoo » sur le dossier ; l'utilisateur y colle l'id du projet Odoo.
-- À exécuter une fois dans l'éditeur SQL de Supabase.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS id_projet_odoo integer;

-- (facultatif) index si un jour on filtre les projets reliés
CREATE INDEX IF NOT EXISTS idx_projects_id_projet_odoo
  ON public.projects (id_projet_odoo);
