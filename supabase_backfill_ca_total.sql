-- Backfill : calcule ca_total pour les minutes existantes
-- à partir des prix_total déjà stockés dans les colonnes JSONB lines et deplacements.
-- À exécuter une seule fois dans l'éditeur SQL de Supabase.

UPDATE public.minutes
SET ca_total = (
  -- Somme des lignes de production
  COALESCE((
    SELECT SUM(
      CASE
        WHEN (item->>'prix_total') ~ '^-?[0-9]+\.?[0-9]*$'
        THEN (item->>'prix_total')::numeric
        ELSE 0
      END
    )
    FROM jsonb_array_elements(COALESCE(lines, '[]'::jsonb)) AS item
  ), 0)
  +
  -- Somme des déplacements
  COALESCE((
    SELECT SUM(
      CASE
        WHEN (item->>'prix_total') ~ '^-?[0-9]+\.?[0-9]*$'
        THEN (item->>'prix_total')::numeric
        ELSE 0
      END
    )
    FROM jsonb_array_elements(COALESCE(deplacements, '[]'::jsonb)) AS item
  ), 0)
)
WHERE ca_total = 0 OR ca_total IS NULL;
