-- ============================================================================
-- À EXÉCUTER DANS L'ÉDITEUR SQL DE SUPABASE (dashboard).
-- Ne se déploie PAS via le code de l'app (clé anon = pas de DDL).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Réglages de grille PERSONNELS (filtres de lignes, tri, regroupement).
--
-- La table `grid_views` existante reste la MISE EN PAGE PARTAGÉE (colonnes
-- masquées, ordre, épinglage, largeurs) : tout le monde voit la même structure.
-- Ce qui filtre ou réordonne les LIGNES est en revanche strictement personnel :
-- un filtre partagé ferait disparaître des lignes pour tout l'atelier, et un
-- collègue en conclurait que la ligne n'existe pas.
--
-- Une ligne par (grille, utilisateur). RLS : chacun ne lit et n'écrit que la
-- sienne.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.grid_views_user (
  grid_key   text        NOT NULL,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (grid_key, user_id)
);

ALTER TABLE public.grid_views_user ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "grid_views_user_own_rows" ON public.grid_views_user;
CREATE POLICY "grid_views_user_own_rows"
  ON public.grid_views_user
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Recharge le cache de schéma PostgREST.
NOTIFY pgrst, 'reload schema';

-- Vérif (optionnel) :
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'grid_views_user';
