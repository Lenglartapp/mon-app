-- ============================================================================
-- À EXÉCUTER DANS L'ÉDITEUR SQL DE SUPABASE (dashboard).
-- Ne se déploie PAS via le code de l'app (clé anon = pas de DDL).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- « Mise à disposition » : demandes de l'atelier à la logistique pour sortir des
-- pièces de tissu du stock et les déposer à l'atelier.
--  - une demande (stock_requests) = un demandeur, une date souhaitée, un commentaire ;
--  - une ligne (stock_request_lines) = un article du stock + les pièces demandées
--    (ou un métrage si l'article n'est pas détaillé en pièces). Chaque ligne se
--    confirme séparément : confirmer = les pièces passent à l'emplacement ATELIER.
-- Les infos article (fournisseur, réf, coloris…) sont recopiées sur la ligne pour
-- garder un historique lisible même si l'article évolue ensuite.
-- Idempotent : peut être relancé sans risque.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.stock_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  num            bigint GENERATED ALWAYS AS IDENTITY,   -- n° lisible : MAD-<num>
  project        text,                                  -- dossier (si demande faite depuis un dossier)
  requested_by   text NOT NULL,
  requested_for  date,                                  -- date de mise à disposition souhaitée
  comment        text,
  status         text NOT NULL DEFAULT 'open',          -- open | done | cancelled
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_request_lines (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     uuid NOT NULL REFERENCES public.stock_requests(id) ON DELETE CASCADE,
  item_id        uuid,                                  -- article inventory_items (pas de FK : l'article peut disparaître)
  product        text,
  ref            text,
  coloris        text,
  laize          text,
  fournisseur    text,
  unit           text,
  project        text,
  from_location  text,                                  -- emplacement au moment de la demande
  pieces         jsonb NOT NULL DEFAULT '[]'::jsonb,    -- pièces demandées [{id, name, qty}]
  qty            numeric,                               -- métrage demandé (= somme des pièces)
  status         text NOT NULL DEFAULT 'pending',       -- pending | done | cancelled
  done_by        text,
  done_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_request_lines_request ON public.stock_request_lines (request_id);
CREATE INDEX IF NOT EXISTS idx_stock_requests_project ON public.stock_requests (project);

ALTER TABLE public.stock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_request_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated all stock_requests" ON public.stock_requests;
CREATE POLICY "Authenticated all stock_requests" ON public.stock_requests
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated all stock_request_lines" ON public.stock_request_lines;
CREATE POLICY "Authenticated all stock_request_lines" ON public.stock_request_lines
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Emplacement de destination des mises à disposition.
INSERT INTO public.warehouse_zones (code, allee, type, section, is_storage, label_carte, description)
VALUES ('ATELIER', 'ATELIER', 'structure', 'special', false, 'Atelier', 'Mis à disposition en atelier (production)')
ON CONFLICT (code) DO NOTHING;

-- Recharge le cache de schéma PostgREST.
NOTIFY pgrst, 'reload schema';
