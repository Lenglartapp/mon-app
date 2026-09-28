-- ============================================================================
-- À EXÉCUTER DANS L'ÉDITEUR SQL DE SUPABASE (dashboard).
-- Ne se déploie PAS via le code de l'app (clé anon = pas de DDL).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table `line_logs` : historique des modifications de lignes (« Modif … »),
-- rangé HORS des gros JSONB `minutes.lines` / `projects.rows`.
--
-- Pourquoi : ces journaux représentaient ~72 % du poids des gros devis (PANTHER :
-- 3,8 Mo sur 5 Mo) et voyageaient à CHAQUE chargement et CHAQUE sauvegarde.
-- Ils sont désormais chargés uniquement à l'ouverture du panneau détail, de
-- l'« Historique complet » ou du fil d'activité projet. Aucune entrée supprimée.
--
-- Une ligne de table = une entrée de journal. Clé (parent_id, row_id, log_id) :
-- l'archivage est idempotent (un même journal n'est jamais stocké deux fois).
--   parent_id : id du chiffrage (minutes.id) ou du projet (projects.id)
--   row_id    : id de la ligne dans lines/rows
--   entry     : l'entrée de journal telle qu'elle était dans row.comments
-- Sans risque si déjà exécuté (IF NOT EXISTS).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.line_logs (
  parent_id  text        NOT NULL,
  row_id     text        NOT NULL,
  log_id     text        NOT NULL,
  entry      jsonb       NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (parent_id, row_id, log_id)
);

CREATE INDEX IF NOT EXISTS line_logs_parent_idx ON public.line_logs (parent_id);

ALTER TABLE public.line_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read line_logs" ON public.line_logs;
CREATE POLICY "Authenticated read line_logs"
  ON public.line_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert line_logs" ON public.line_logs;
CREATE POLICY "Authenticated insert line_logs"
  ON public.line_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Pas de politique UPDATE / DELETE : l'historique n'est jamais modifié ni effacé
-- depuis l'application.

NOTIFY pgrst, 'reload schema';

-- Vérif (optionnel) :
-- SELECT count(*) FROM public.line_logs;
