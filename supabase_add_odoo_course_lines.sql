-- Intégration Odoo — miroir de la « liste de courses » (project.course.line) par projet.
-- Odoo est maître ; Droitfil copie/affiche. La clé stable = l'id Odoo de la ligne.
-- Règle : une ligne supprimée dans Odoo n'est PAS supprimée ici (removed_from_odoo = true),
-- retrait manuel côté Droitfil. Marqueur stock_created = déjà basculé en entrée d'inventaire.
-- À exécuter une fois dans l'éditeur SQL de Supabase.

CREATE TABLE IF NOT EXISTS public.odoo_course_lines (
  odoo_id                integer PRIMARY KEY,          -- id de la ligne côté Odoo (stable)
  droitfil_project_id    text NOT NULL,                -- projet Droitfil
  odoo_project_id        integer,                      -- projet Odoo
  sequence               integer,
  reference              text,
  coloris                text,
  laize                  text,
  quantite               numeric,
  unite                  text,
  fournisseur            text,
  prix_indicatif         numeric,
  purchase_order         text,
  statut                 text,
  date_livraison_estimee date,
  date_reception         date,
  write_date             timestamptz,
  removed_from_odoo      boolean DEFAULT false,        -- disparue d'Odoo mais gardée ici
  stock_created          boolean DEFAULT false,        -- déjà basculée en entrée d'inventaire (phase C)
  synced_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_odoo_course_lines_project
  ON public.odoo_course_lines (droitfil_project_id);

ALTER TABLE public.odoo_course_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read odoo_course_lines"
  ON public.odoo_course_lines FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated insert odoo_course_lines"
  ON public.odoo_course_lines FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated update odoo_course_lines"
  ON public.odoo_course_lines FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated delete odoo_course_lines"
  ON public.odoo_course_lines FOR DELETE USING (auth.role() = 'authenticated');
