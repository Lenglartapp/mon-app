-- Ajout du champ "mis à jour par" sur les entrées de performance
ALTER TABLE performance_entries ADD COLUMN IF NOT EXISTS updated_by text DEFAULT '';
