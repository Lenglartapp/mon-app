-- Entrepôt : capacités des emplacements + type de laize des zones (tableau de bord Inventaire,
-- vue entrepôt). Idempotent : peut être relancé sans risque.
--
-- Capacités en ROULEAUX (total 1 218). Niveau 4 (A4 à H4) : on garde le type « palettes »
-- avec 2 palettes ; l'appli convertit selon la laize de la zone (15 rouleaux par palette en
-- grande laize, 20 sinon) : 40 rouleaux en zone petite ou mixte, 30 en zone grande.
-- Ne touche ni au code, ni à l'allée, ni à la section, ni à is_storage.

-- 1. Type de laize d'une zone : grande, petite ou mixte (défaut).
ALTER TABLE public.warehouse_zones ADD COLUMN IF NOT EXISTS laize_type text NOT NULL DEFAULT 'mixte';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'warehouse_zones_laize_type_check') THEN
    ALTER TABLE public.warehouse_zones
      ADD CONSTRAINT warehouse_zones_laize_type_check CHECK (laize_type IN ('grande', 'petite', 'mixte'));
  END IF;
END $$;

-- 2. Capacités (rouleaux), niveaux 1 à 3 et réception
UPDATE public.warehouse_zones z SET capacite = v.cap, capacite_unite = 'rouleaux'
FROM (VALUES
  ('A1', 54), ('A2', 26), ('A3', 26),
  ('B1', 54), ('B2', 26), ('B3', 26),
  ('C1', 54), ('C2', 26), ('C3', 26),
  ('D1', 68), ('D2', 26), ('D3', 26),
  ('E1', 68), ('E2', 26), ('E3', 26),
  ('F1', 68), ('F2', 26), ('F3', 26),
  ('G1', 51), ('G2', 26), ('G3', 26),
  ('H1', 51), ('H2', 26), ('H3', 26),
  ('I1', 14)
) AS v(code, cap)
WHERE z.code = v.code;

-- Niveau 4 : 2 palettes (= 40 rouleaux en petite laize ou mixte, 30 en grande laize)
UPDATE public.warehouse_zones SET capacite = 2, capacite_unite = 'palettes'
WHERE code IN ('A4', 'B4', 'C4', 'D4', 'E4', 'F4', 'G4', 'H4') AND type = 'palettes';

-- 3. Typage initial (Audry peut le modifier ensuite dans la vue entrepôt)
UPDATE public.warehouse_zones SET laize_type = 'grande' WHERE code IN ('B1', 'B2', 'C1', 'C2');
UPDATE public.warehouse_zones SET laize_type = 'petite' WHERE code IN ('D1', 'D2', 'E1', 'E2', 'F1', 'F2', 'G1', 'G2');

-- 4. Droits : lecture pour les utilisateurs connectés, modification réservée aux admins
ALTER TABLE public.warehouse_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS warehouse_zones_select_auth ON public.warehouse_zones;
CREATE POLICY warehouse_zones_select_auth ON public.warehouse_zones FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS warehouse_zones_update_admin ON public.warehouse_zones;
CREATE POLICY warehouse_zones_update_admin ON public.warehouse_zones FOR UPDATE TO authenticated
  USING (public.df_my_role() = 'admin') WITH CHECK (public.df_my_role() = 'admin');

-- 5. Contrôle : total attendu 1 218 rouleaux (niveau 4 compté 20 rouleaux par palette, zones mixtes)
SELECT code, type, capacite, capacite_unite, laize_type FROM public.warehouse_zones
WHERE is_storage AND type IN ('rouleaux', 'reception', 'palettes') ORDER BY code;
SELECT sum(CASE WHEN type = 'palettes' THEN capacite * (CASE WHEN laize_type = 'grande' THEN 15 ELSE 20 END) ELSE capacite END) AS capacite_totale_rouleaux
FROM public.warehouse_zones WHERE is_storage AND type IN ('rouleaux', 'reception', 'palettes');
