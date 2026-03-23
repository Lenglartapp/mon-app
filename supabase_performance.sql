-- ============================================================
-- MODULE PERFORMANCE
-- ============================================================

-- Table 1 : Saisies de performance par projet + par service
CREATE TABLE IF NOT EXISTS performance_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  service     text NOT NULL CHECK (service IN ('conf', 'prepa', 'pose')),
  raisons     text[] DEFAULT '{}',
  commentaire text DEFAULT '',
  has_sav     boolean DEFAULT false,
  heures_sav  numeric DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (project_id, service)
);

-- Table 2 : Fiches d'action
CREATE TABLE IF NOT EXISTS performance_actions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titre           text NOT NULL,
  description     text DEFAULT '',
  linked_project_id text REFERENCES projects(id) ON DELETE SET NULL,
  linked_raison   text DEFAULT '',
  responsable     text DEFAULT '',
  statut          text DEFAULT 'A_FAIRE' CHECK (statut IN ('A_FAIRE', 'EN_COURS', 'TERMINE')),
  date_cible      date,
  notes           text DEFAULT '',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE performance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read performance_entries"
  ON performance_entries FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert performance_entries"
  ON performance_entries FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update performance_entries"
  ON performance_entries FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete performance_entries"
  ON performance_entries FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read performance_actions"
  ON performance_actions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert performance_actions"
  ON performance_actions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update performance_actions"
  ON performance_actions FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete performance_actions"
  ON performance_actions FOR DELETE USING (auth.role() = 'authenticated');
