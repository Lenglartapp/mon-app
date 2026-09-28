-- ============================================================================
-- À EXÉCUTER DANS L'ÉDITEUR SQL DE SUPABASE (dashboard) — UNE SEULE FOIS.
--
-- PRÉREQUIS :
--   1. 2026-09-28_create_line_logs.sql déjà exécuté.
--   2. La nouvelle version de l'application est DÉPLOYÉE (elle sait relire
--      l'historique rangé dans `line_logs`). Sinon l'historique « Modif … »
--      disparaîtrait de l'affichage des versions précédentes de l'app.
--   3. Une SAUVEGARDE de la base est faite (Database → Backups).
--
-- CE QUE ÇA FAIT (ZÉRO PERTE) :
--   Pour chaque ligne de chiffrage (`minutes.lines`, `deplacements`, `extraDepenses`)
--   et de projet (`projects.rows`) :
--     a) copie les journaux automatiques « Modif … » (type 'log') dans `line_logs` ;
--     b) les retire de row.comments et pose le pointeur `__logArchive` ;
--   Les vrais commentaires (msg) et les photos (image) ne bougent pas.
--
-- SÉCURITÉ : tout est dans UNE transaction (bloc DO). Avant de valider, le script
-- vérifie que CHAQUE journal retiré se trouve bien dans `line_logs` ; sinon il
-- lève une erreur → RIEN n'est modifié.
-- Réexécutable sans risque (idempotent) : ce qui est déjà migré est ignoré.
-- ============================================================================

-- Fonctions temporaires (disparaissent à la fin de la session).
CREATE OR REPLACE FUNCTION pg_temp.ll_is_log(c jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(c) = 'object'
     AND coalesce(c->>'pending', '') <> 'true'
     AND (c->>'type' = 'log' OR (c->>'type' IS NULL AND coalesce(c->>'text', '') LIKE 'Modif%'))
$$;

-- Même identifiant que logIdOf() dans src/lib/lineLogs.js.
CREATE OR REPLACE FUNCTION pg_temp.ll_id(c jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(
    c->>'id',
    coalesce(nullif(c->>'createdAt', ''), c->>'date', '') || '|' ||
    coalesce(nullif(c->>'field', ''), c->>'text', '') || '|' ||
    coalesce(c->>'from', '') || '|' || coalesce(c->>'to', '')
  )
$$;

CREATE OR REPLACE FUNCTION pg_temp.ll_ts(c jsonb) RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF coalesce(c->>'createdAt', '') <> '' THEN RETURN (c->>'createdAt')::timestamptz; END IF;
  IF coalesce(c->>'date', '') ~ '^\d+(\.\d+)?$' THEN RETURN to_timestamp((c->>'date')::numeric / 1000); END IF;
  RETURN NULL;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.ll_arr(a jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN jsonb_typeof(a) = 'array' THEN a ELSE '[]'::jsonb END
$$;

CREATE OR REPLACE FUNCTION pg_temp.ll_row_has_logs(l jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT l->>'id' IS NOT NULL
     AND EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.ll_arr(l->'comments')) c WHERE pg_temp.ll_is_log(c))
$$;

CREATE OR REPLACE FUNCTION pg_temp.ll_has_logs(arr jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.ll_arr(arr)) l WHERE pg_temp.ll_row_has_logs(l))
$$;

-- Lignes sans journaux + pointeur (ordre des lignes et des commentaires conservé).
CREATE OR REPLACE FUNCTION pg_temp.ll_strip(parent text, arr jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(jsonb_agg(
    CASE WHEN pg_temp.ll_row_has_logs(l) THEN
      l
      || jsonb_build_object('comments', coalesce(
           (SELECT jsonb_agg(c ORDER BY o) FROM jsonb_array_elements(l->'comments') WITH ORDINALITY x(c, o)
             WHERE NOT pg_temp.ll_is_log(c)), '[]'::jsonb))
      || jsonb_build_object('__logArchive',
           coalesce((SELECT jsonb_agg(a) FROM jsonb_array_elements(pg_temp.ll_arr(l->'__logArchive')) a
                      WHERE NOT (a->>'p' = parent AND a->>'r' = l->>'id')), '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object(
                'p', parent,
                'r', l->>'id',
                'until', (SELECT coalesce(max(floor(extract(epoch FROM pg_temp.ll_ts(c)) * 1000)), 0)::bigint
                            FROM jsonb_array_elements(l->'comments') c WHERE pg_temp.ll_is_log(c)))))
    ELSE l END
    ORDER BY ord), '[]'::jsonb)
  FROM jsonb_array_elements(pg_temp.ll_arr(arr)) WITH ORDINALITY t(l, ord)
$$;

DO $migration$
DECLARE
  target record;
  n_logs_before bigint;
  n_missing bigint;
  n_left bigint;
  n_updated bigint;
BEGIN
  -- Colonnes JSONB à traiter (seulement celles qui existent réellement en base).
  FOR target IN
    SELECT c.table_name AS tbl, c.column_name AS col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.data_type = 'jsonb'
      AND ((c.table_name = 'minutes'  AND c.column_name IN ('lines', 'deplacements', 'extraDepenses'))
        OR (c.table_name = 'projects' AND c.column_name = 'rows'))
  LOOP
    -- a) Journaux présents avant migration.
    EXECUTE format($q$
      SELECT count(*) FROM public.%I t,
        jsonb_array_elements(pg_temp.ll_arr(t.%I)) l,
        jsonb_array_elements(pg_temp.ll_arr(l->'comments')) c
      WHERE l->>'id' IS NOT NULL AND pg_temp.ll_is_log(c)
    $q$, target.tbl, target.col) INTO n_logs_before;

    -- b) Copie dans line_logs (les déjà présents sont ignorés).
    EXECUTE format($q$
      INSERT INTO public.line_logs (parent_id, row_id, log_id, entry, created_at)
      SELECT t.id::text, l->>'id', pg_temp.ll_id(c), c, coalesce(pg_temp.ll_ts(c), now())
      FROM public.%I t,
        jsonb_array_elements(pg_temp.ll_arr(t.%I)) l,
        jsonb_array_elements(pg_temp.ll_arr(l->'comments')) c
      WHERE l->>'id' IS NOT NULL AND pg_temp.ll_is_log(c)
      ON CONFLICT DO NOTHING
    $q$, target.tbl, target.col);

    -- c) CONTRÔLE : chaque journal doit exister dans line_logs AVANT tout retrait.
    EXECUTE format($q$
      SELECT count(*) FROM public.%I t,
        jsonb_array_elements(pg_temp.ll_arr(t.%I)) l,
        jsonb_array_elements(pg_temp.ll_arr(l->'comments')) c
      WHERE l->>'id' IS NOT NULL AND pg_temp.ll_is_log(c)
        AND NOT EXISTS (SELECT 1 FROM public.line_logs g
                        WHERE g.parent_id = t.id::text AND g.row_id = l->>'id' AND g.log_id = pg_temp.ll_id(c))
    $q$, target.tbl, target.col) INTO n_missing;
    IF n_missing > 0 THEN
      RAISE EXCEPTION '%.%: % journaux non retrouvés dans line_logs — migration annulée, rien n''a été modifié.',
        target.tbl, target.col, n_missing;
    END IF;

    -- d) Retrait des journaux + pointeur.
    EXECUTE format($q$
      UPDATE public.%I t SET %I = pg_temp.ll_strip(t.id::text, t.%I)
      WHERE pg_temp.ll_has_logs(t.%I)
    $q$, target.tbl, target.col, target.col, target.col);
    GET DIAGNOSTICS n_updated = ROW_COUNT;

    -- e) CONTRÔLE : plus aucun journal dans les lignes.
    EXECUTE format($q$
      SELECT count(*) FROM public.%I t,
        jsonb_array_elements(pg_temp.ll_arr(t.%I)) l,
        jsonb_array_elements(pg_temp.ll_arr(l->'comments')) c
      WHERE l->>'id' IS NOT NULL AND pg_temp.ll_is_log(c)
    $q$, target.tbl, target.col) INTO n_left;
    IF n_left > 0 THEN
      RAISE EXCEPTION '%.%: % journaux encore présents après retrait — migration annulée.', target.tbl, target.col, n_left;
    END IF;

    RAISE NOTICE '%.% : % journaux archivés, % enregistrement(s) allégé(s).', target.tbl, target.col, n_logs_before, n_updated;
  END LOOP;
END
$migration$;

-- Vérification (optionnel) : poids réel des plus gros devis après migration.
-- SELECT name, pg_size_pretty(octet_length(lines::text)::bigint) AS taille_reelle
--   FROM public.minutes ORDER BY octet_length(lines::text) DESC LIMIT 10;
-- SELECT count(*) AS journaux_archives FROM public.line_logs;
