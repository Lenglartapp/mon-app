-- Opérateurs partagés (Inventaire + Logistique) et journal des actions de la Logistique.
-- Contexte : tablettes atelier sur un compte partagé → les actions sont tracées par le champ
-- « Opérateur », pas par le compte. À exécuter une fois dans l'éditeur SQL de Supabase.
-- Ne modifie aucune table existante.

-- 1. Liste des opérateurs proposés (liste de départ + noms saisis à la main, mémorisés).
--    Distincte de `profiles` : on n'y crée jamais de compte.
CREATE TABLE IF NOT EXISTS public.stock_operators (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL CHECK (btrim(name) <> ''),
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid DEFAULT auth.uid()
);
-- Pas de doublon (comparaison sans casse ni espaces superflus)
CREATE UNIQUE INDEX IF NOT EXISTS stock_operators_name_uniq
  ON public.stock_operators (lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));

ALTER TABLE public.stock_operators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stock_operators_select ON public.stock_operators;
CREATE POLICY stock_operators_select ON public.stock_operators FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS stock_operators_insert ON public.stock_operators;
CREATE POLICY stock_operators_insert ON public.stock_operators FOR INSERT TO authenticated WITH CHECK (true);
-- Ni modification ni suppression depuis l'appli.

INSERT INTO public.stock_operators (name, created_by) VALUES
  ('Alain Houdemont', NULL), ('Alison Gloaguen', NULL), ('Audry Papin', NULL), ('Catherine Bosse', NULL),
  ('David Vergel', NULL), ('Delphine Butez', NULL), ('Elisa Laprune', NULL), ('Emilie David', NULL),
  ('Florence Gobbe', NULL), ('Guillaume Mailly', NULL), ('Julie Rabin', NULL), ('Lucie Jaulin', NULL),
  ('Maelane Poulaud', NULL), ('Malcolm Jeantal', NULL), ('Samuel Blandin', NULL), ('Thierry Menant', NULL),
  ('Thomas Bonnet', NULL)
ON CONFLICT DO NOTHING;

-- 2. Journal des actions de la Logistique (qui a fait quoi, quand). Pas de clé étrangère :
--    la trace reste même si l'expédition est supprimée.
CREATE TABLE IF NOT EXISTS public.expedition_logs (
  id              bigserial PRIMARY KEY,
  expedition_id   uuid NOT NULL,
  reference       text,
  action          text NOT NULL,
  details         text,
  operateur       text NOT NULL CHECK (btrim(operateur) <> ''),
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid DEFAULT auth.uid()
);
CREATE INDEX IF NOT EXISTS expedition_logs_expedition_idx ON public.expedition_logs (expedition_id, created_at DESC);

ALTER TABLE public.expedition_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS expedition_logs_select ON public.expedition_logs;
CREATE POLICY expedition_logs_select ON public.expedition_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS expedition_logs_insert ON public.expedition_logs;
CREATE POLICY expedition_logs_insert ON public.expedition_logs FOR INSERT TO authenticated WITH CHECK (true);
-- Journal : ni modification ni suppression depuis l'appli.
