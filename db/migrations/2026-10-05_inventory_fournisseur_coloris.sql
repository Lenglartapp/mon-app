-- ============================================================================
-- À EXÉCUTER DANS L'ÉDITEUR SQL DE SUPABASE (dashboard).
-- Ne se déploie PAS via le code de l'app (clé anon = pas de DDL).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Inventaire : fournisseur / référence / coloris / laize en vraies colonnes
-- + complétion des réceptions Odoo dans le stock.
--
-- Avant : le produit valait « référence — coloris », le fournisseur et la laize
-- n'existaient que dans le texte du motif du journal (« Réception Odoo — DEDAR —
-- laize 300 »). On isole chaque information, dans le stock ET dans le journal.
--
-- `qty_recue` = métrage reçu (réception Odoo), pour comparer au total des pièces
-- saisies ensuite. Emplacement « À COMPLÉTER » = réception Odoo pas encore rangée.
-- Idempotent : peut être relancé sans risque.
-- ----------------------------------------------------------------------------

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS fournisseur text,
  ADD COLUMN IF NOT EXISTS coloris     text,
  ADD COLUMN IF NOT EXISTS qty_recue   numeric;

ALTER TABLE public.inventory_logs
  ADD COLUMN IF NOT EXISTS ref         text,
  ADD COLUMN IF NOT EXISTS coloris     text,
  ADD COLUMN IF NOT EXISTS laize       text,
  ADD COLUMN IF NOT EXISTS fournisseur text;

-- ----------------------------------------------------------------------------
-- Rattrapage des réceptions Odoo déjà basculées.
-- Motif historique : « Réception Odoo — <fournisseur>[ — laize <laize>] »
-- Produit historique : « <référence> — <coloris> »
-- ----------------------------------------------------------------------------

-- 1. Journal : fournisseur + laize depuis le motif ; référence + coloris depuis le produit.
UPDATE public.inventory_logs
SET
  fournisseur = COALESCE(fournisseur, NULLIF(split_part(reason, ' — ', 2), '')),
  laize       = COALESCE(laize, NULLIF(substring(reason from 'laize (.*)$'), '')),
  ref         = COALESCE(ref, NULLIF(split_part(product, ' — ', 1), '')),
  coloris     = COALESCE(coloris, NULLIF(split_part(product, ' — ', 2), ''))
WHERE user_name = 'Synchro Odoo' AND type = 'IN';

-- 2. Stock : coloris depuis le produit (« ref — coloris »).
UPDATE public.inventory_items
SET coloris = NULLIF(substring(product from length(ref) + 4), '')
WHERE coloris IS NULL
  AND ref IS NOT NULL
  AND product LIKE ref || ' — %';

-- 3. Stock : fournisseur (+ laize si absente) repris de la ligne de journal Odoo correspondante.
UPDATE public.inventory_items i
SET
  fournisseur = COALESCE(i.fournisseur, l.fournisseur),
  laize       = COALESCE(i.laize, l.laize)
FROM public.inventory_logs l
WHERE l.user_name = 'Synchro Odoo' AND l.type = 'IN'
  AND l.product = i.product
  AND COALESCE(l.project, '') = COALESCE(i.project, '')
  AND (i.fournisseur IS NULL OR i.laize IS NULL);

-- 4. Réceptions Odoo jamais rangées (emplacement vide, aucune pièce) → « À COMPLÉTER ».
UPDATE public.inventory_items i
SET
  location  = 'À COMPLÉTER',
  qty_recue = COALESCE(i.qty_recue, i.qty)
WHERE COALESCE(i.location, '') = ''
  AND (i.pieces IS NULL OR i.pieces = '[]'::jsonb)
  AND EXISTS (
    SELECT 1 FROM public.inventory_logs l
    WHERE l.user_name = 'Synchro Odoo' AND l.type = 'IN'
      AND l.product = i.product
      AND COALESCE(l.project, '') = COALESCE(i.project, '')
  );

-- Recharge le cache de schéma PostgREST (sinon 400 PGRST204 quelques minutes).
NOTIFY pgrst, 'reload schema';
