-- ============================================================================
-- SÉCURITÉ — Fermer tout accès aux données sans connexion (rôle `anon`).
-- ============================================================================
-- Constat (2026-10-07) : avec la seule clé publique (présente dans le site publié),
-- sans aucun compte, on pouvait lire minutes, projects, events, profiles… Les
-- politiques d'origine (supabase_schema.sql, « Mode DEV - Tout ouvert ») étaient
-- `for all using (true)` sans rôle → ouvertes à TOUT LE MONDE, y compris en écriture.
--
-- Principe : ne RIEN changer pour un utilisateur connecté, tout fermer pour `anon`.
--   1. Toute politique ouverte à `public` / `anon` est réservée à `authenticated`
--      (même règle, même condition — seul le rôle change).
--   2. Toute table où la RLS était DÉSACTIVÉE (donc ouverte à tous) : RLS activée +
--      politique « accès complet » pour `authenticated` (= comportement actuel des connectés).
--   3. Deuxième barrière : `anon` perd tous ses droits SQL sur le schéma public
--      (tables, vues, séquences, fonctions), y compris pour les futures tables.
--   4. Même traitement pour les politiques du stockage (photos, pièces jointes).
--      Les URL publiques des buckets publics restent lisibles (elles ne passent pas par la RLS).
--
-- Idempotent : peut être rejoué sans risque.
-- Les fonctions serveur (cron Odoo) doivent utiliser la clé service_role (SUPABASE_SERVICE_KEY),
-- qui contourne la RLS — à vérifier dans Vercel AVANT d'appliquer.
-- ============================================================================

BEGIN;

-- 1 + 2. Tables du schéma public
DO $$
DECLARE
  t record;
  p record;
BEGIN
  FOR t IN
    SELECT c.relname AS tablename, c.relrowsecurity AS rls_on
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    IF NOT t.rls_on THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
      EXECUTE format('DROP POLICY IF EXISTS "Connectés : accès complet" ON public.%I', t.tablename);
      EXECUTE format(
        'CREATE POLICY "Connectés : accès complet" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        t.tablename
      );
      RAISE NOTICE 'RLS activée + accès connectés : %', t.tablename;
    END IF;

    FOR p IN
      SELECT policyname, roles FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t.tablename
        AND (roles @> ARRAY['public']::name[] OR roles @> ARRAY['anon']::name[])
    LOOP
      EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated', p.policyname, t.tablename);
      RAISE NOTICE 'Politique réservée aux connectés : %.%', t.tablename, p.policyname;
    END LOOP;
  END LOOP;
END $$;

-- 3. Retrait des droits SQL du rôle anon (deuxième barrière, couvre aussi les vues)
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, PUBLIC;
GRANT  EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT  EXECUTE ON FUNCTIONS TO authenticated, service_role;

-- 4. Stockage (storage.objects) : politiques ouvertes à public/anon → connectés
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname, roles FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (roles @> ARRAY['public']::name[] OR roles @> ARRAY['anon']::name[])
  LOOP
    EXECUTE format('ALTER POLICY %I ON storage.objects TO authenticated', p.policyname);
    RAISE NOTICE 'Stockage réservé aux connectés : %', p.policyname;
  END LOOP;
END $$;

COMMIT;

-- ----------------------------------------------------------------------------
-- CONTRÔLE (à lancer après) : les deux requêtes doivent renvoyer 0 ligne.
-- ----------------------------------------------------------------------------
-- Politiques encore ouvertes sans connexion :
--   SELECT schemaname, tablename, policyname, roles FROM pg_policies
--   WHERE schemaname IN ('public', 'storage')
--     AND (roles @> ARRAY['public']::name[] OR roles @> ARRAY['anon']::name[]);
-- Tables sans RLS :
--   SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity;
