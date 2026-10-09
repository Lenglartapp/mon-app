-- Stock rattaché au dossier par son IDENTIFIANT (et plus seulement par son nom) :
-- renommer un dossier ne décroche plus ses tissus, son journal ni ses demandes de MAD.
-- Les anciennes lignes gardent leur rattachement par nom (project_id reste vide).
-- À exécuter une fois dans l'éditeur SQL de Supabase.

ALTER TABLE public.inventory_items     ADD COLUMN IF NOT EXISTS project_id text;
ALTER TABLE public.inventory_logs      ADD COLUMN IF NOT EXISTS project_id text;
ALTER TABLE public.stock_requests      ADD COLUMN IF NOT EXISTS project_id text;
ALTER TABLE public.stock_request_lines ADD COLUMN IF NOT EXISTS project_id text;

CREATE INDEX IF NOT EXISTS inventory_items_project_id_idx ON public.inventory_items (project_id);

-- Recharge le cache de colonnes de l'API (sinon « column not found » quelques minutes).
NOTIFY pgrst, 'reload schema';
