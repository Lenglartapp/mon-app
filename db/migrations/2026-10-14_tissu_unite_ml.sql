-- Tissus en stock : unité harmonisée en « ml » (mètre linéaire).
-- Règle Droitfil ↔ Odoo du 2026-10-14 : un tissu se compte toujours en ml.
-- Seul le LIBELLÉ de l'unité change (« m », « ML », « mètre »… = mètre linéaire) :
-- aucune quantité n'est convertie. À exécuter une fois dans l'éditeur SQL de Supabase.

-- 1. Aperçu (à lancer d'abord) : unités actuelles des tissus et nombre d'articles.
-- SELECT unit, count(*) FROM public.inventory_items WHERE category = 'Tissu' GROUP BY unit ORDER BY 2 DESC;

-- 2. Harmonisation : articles de stock tissu dont l'unité est un mètre (ou vide).
UPDATE public.inventory_items
SET unit = 'ml'
WHERE category = 'Tissu'
  AND (unit IS NULL OR trim(unit) = '' OR lower(trim(unit)) IN ('m', 'ml', 'm.l.', 'mètre', 'mètres', 'metre', 'metres', 'mètre linéaire', 'mètres linéaires'))
  AND unit IS DISTINCT FROM 'ml';

-- 3. Journal : mêmes libellés pour les mouvements de tissus (affichage cohérent de l'historique).
UPDATE public.inventory_logs l
SET unit = 'ml'
WHERE lower(trim(coalesce(l.unit, ''))) IN ('m', 'm.l.', 'mètre', 'mètres', 'metre', 'metres', 'mètre linéaire', 'mètres linéaires')
  AND EXISTS (SELECT 1 FROM public.inventory_items i WHERE i.category = 'Tissu' AND i.product = l.product);
