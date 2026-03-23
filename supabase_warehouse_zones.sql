-- ============================================================
-- TABLE WAREHOUSE_ZONES
-- Plan interactif de l'entrepôt
-- Basé sur le schéma Excel des emplacements
-- ============================================================

CREATE TABLE IF NOT EXISTS public.warehouse_zones (
  code         TEXT PRIMARY KEY,        -- Identifiant zone : 'A1', 'D3', 'K2'...
  allee        TEXT NOT NULL,           -- Lettre de l'allée : 'A', 'B', 'K'...
  niveau       INTEGER,                 -- 1=bas, 2, 3, 4=haut (null pour zones structurelles)
  niveau_label TEXT,                    -- 'bas', null, 'haut'
  type         TEXT NOT NULL,           -- 'rouleaux', 'palettes', 'consommable', 'reception', 'structure'
  section      TEXT,                    -- 'nord' (allées D-H) | 'sud' (allées A-C) | 'special'
  capacite     INTEGER,                 -- Capacité max (null pour zones structurelles)
  capacite_unite TEXT,                  -- 'rouleaux' | 'palettes'
  is_storage   BOOLEAN DEFAULT TRUE,    -- FALSE = zone structurelle (couloir, bureau, porte...)
  map_col      INTEGER,                 -- Position colonne dans le plan visuel (1-based)
  map_row      INTEGER,                 -- Position ligne dans le plan visuel (1-based)
  map_col_span INTEGER DEFAULT 1,       -- Nombre de colonnes occupées
  map_row_span INTEGER DEFAULT 1,       -- Nombre de lignes occupées
  color_hex    TEXT,                    -- Couleur de fond dans le plan
  label_carte  TEXT,                    -- Texte affiché sur la carte
  description  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.warehouse_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access Warehouse Zones" ON public.warehouse_zones FOR ALL USING (true);


-- ============================================================
-- INSERTION DES ZONES
-- Grille visuelle : 13 colonnes x 11 lignes
--
-- SECTION NORD (haut de l'entrepôt) — rangées D, E, F, G, H
--   Colonnes 1-5, lignes 1-4
--   niveau 4 (haut/palettes) = ligne 1
--   niveau 3               = ligne 2
--   niveau 2               = ligne 3
--   niveau 1 (bas/rouleaux)= ligne 4
--
-- SECTION SUD (bas de l'entrepôt) — rangées A, B, C
--   Colonnes 1-3, lignes 7-10
--   niveau 4 (haut/palettes) = ligne 7
--   niveau 3               = ligne 8
--   niveau 2               = ligne 9
--   niveau 1 (bas/rouleaux)= ligne 10
--
-- Ligne 5-6 = allée centrale (couloir)
-- Ligne 11  = marge basse
-- ============================================================

INSERT INTO public.warehouse_zones
  (code, allee, niveau, niveau_label, type, section, capacite, capacite_unite, is_storage, map_col, map_row, map_col_span, map_row_span, color_hex, label_carte, description)
VALUES

-- ── SECTION NORD — ALLÉE D ──────────────────────────────────
('D1', 'D', 1, 'bas',  'rouleaux', 'nord', 55, 'rouleaux', true, 1, 4, 1, 1, '#DBEAFE', 'D1', 'Allée D – Niveau 1 (bas) – 55 rouleaux'),
('D2', 'D', 2, null,   'rouleaux', 'nord', 10, 'rouleaux', true, 1, 3, 1, 1, '#BFDBFE', 'D2', 'Allée D – Niveau 2 – 10 rouleaux'),
('D3', 'D', 3, null,   'rouleaux', 'nord',  7, 'rouleaux', true, 1, 2, 1, 1, '#93C5FD', 'D3', 'Allée D – Niveau 3 – 7 rouleaux'),
('D4', 'D', 4, 'haut', 'palettes', 'nord',  2, 'palettes', true, 1, 1, 1, 1, '#60A5FA', 'D4', 'Allée D – Niveau 4 (haut) – 2 palettes'),

-- ── SECTION NORD — ALLÉE E ──────────────────────────────────
('E1', 'E', 1, 'bas',  'rouleaux', 'nord', 55, 'rouleaux', true, 2, 4, 1, 1, '#DBEAFE', 'E1', 'Allée E – Niveau 1 (bas) – 55 rouleaux'),
('E2', 'E', 2, null,   'rouleaux', 'nord', 10, 'rouleaux', true, 2, 3, 1, 1, '#BFDBFE', 'E2', 'Allée E – Niveau 2 – 10 rouleaux'),
('E3', 'E', 3, null,   'rouleaux', 'nord',  7, 'rouleaux', true, 2, 2, 1, 1, '#93C5FD', 'E3', 'Allée E – Niveau 3 – 7 rouleaux'),
('E4', 'E', 4, 'haut', 'palettes', 'nord',  3, 'palettes', true, 2, 1, 1, 1, '#60A5FA', 'E4', 'Allée E – Niveau 4 (haut) – 3 palettes'),

-- ── SECTION NORD — ALLÉE F ──────────────────────────────────
('F1', 'F', 1, 'bas',  'rouleaux', 'nord', 55, 'rouleaux', true, 3, 4, 1, 1, '#DBEAFE', 'F1', 'Allée F – Niveau 1 (bas) – 55 rouleaux'),
('F2', 'F', 2, null,   'rouleaux', 'nord', 10, 'rouleaux', true, 3, 3, 1, 1, '#BFDBFE', 'F2', 'Allée F – Niveau 2 – 10 rouleaux'),
('F3', 'F', 3, null,   'rouleaux', 'nord',  7, 'rouleaux', true, 3, 2, 1, 1, '#93C5FD', 'F3', 'Allée F – Niveau 3 – 7 rouleaux'),
('F4', 'F', 4, 'haut', 'palettes', 'nord',  2, 'palettes', true, 3, 1, 1, 1, '#60A5FA', 'F4', 'Allée F – Niveau 4 (haut) – 2 palettes'),

-- ── SECTION NORD — ALLÉE G ──────────────────────────────────
('G1', 'G', 1, 'bas',  'rouleaux', 'nord', 55, 'rouleaux', true, 4, 4, 1, 1, '#DBEAFE', 'G1', 'Allée G – Niveau 1 (bas) – 55 rouleaux'),
('G2', 'G', 2, null,   'rouleaux', 'nord', 10, 'rouleaux', true, 4, 3, 1, 1, '#BFDBFE', 'G2', 'Allée G – Niveau 2 – 10 rouleaux'),
('G3', 'G', 3, null,   'rouleaux', 'nord',  7, 'rouleaux', true, 4, 2, 1, 1, '#93C5FD', 'G3', 'Allée G – Niveau 3 – 7 rouleaux'),
('G4', 'G', 4, 'haut', 'palettes', 'nord',  3, 'palettes', true, 4, 1, 1, 1, '#60A5FA', 'G4', 'Allée G – Niveau 4 (haut) – 3 palettes'),

-- ── SECTION NORD — ALLÉE H ──────────────────────────────────
('H1', 'H', 1, 'bas',  'rouleaux', 'nord', 55, 'rouleaux', true, 5, 4, 1, 1, '#DBEAFE', 'H1', 'Allée H – Niveau 1 (bas) – 55 rouleaux'),
('H2', 'H', 2, null,   'rouleaux', 'nord', 10, 'rouleaux', true, 5, 3, 1, 1, '#BFDBFE', 'H2', 'Allée H – Niveau 2 – 10 rouleaux'),
('H3', 'H', 3, null,   'rouleaux', 'nord',  7, 'rouleaux', true, 5, 2, 1, 1, '#93C5FD', 'H3', 'Allée H – Niveau 3 – 7 rouleaux'),
('H4', 'H', 4, 'haut', 'palettes', 'nord',  3, 'palettes', true, 5, 1, 1, 1, '#60A5FA', 'H4', 'Allée H – Niveau 4 (haut) – 3 palettes'),

-- ── ZONE RÉCEPTIONS ─────────────────────────────────────────
('I1', 'I', 1, 'bas',  'reception', 'special', 14, 'rouleaux', true, 8, 1, 1, 2, '#D1FAE5', 'I1 – Réceptions', 'Zone réceptions – 14 rouleaux'),

-- ── ZONES J (grands lés / zone spéciale) ────────────────────
('J1', 'J', 1, 'bas',  'rouleaux', 'special', null, 'rouleaux', true, 11, 4, 1, 1, '#FCE7D6', 'J1', 'Zone J – Niveau 1 (bas)'),
('J2', 'J', 2, null,   'rouleaux', 'special', null, 'rouleaux', true, 12, 1, 1, 4, '#FCE7D6', 'J2', 'Zone J – Niveau 2'),
('J3', 'J', 3, 'haut', 'rouleaux', 'special', null, 'rouleaux', true, 13, 1, 1, 4, '#F9C6A8', 'J3', 'Zone J – Niveau 3 (haut)'),

-- ── SECTION SUD — ALLÉE C ───────────────────────────────────
('C1', 'C', 1, 'bas',  'rouleaux', 'sud', 47, 'rouleaux', true, 1, 10, 1, 1, '#EDE9FE', 'C1', 'Allée C – Niveau 1 (bas) – 47 rouleaux'),
('C2', 'C', 2, null,   'rouleaux', 'sud', 17, 'rouleaux', true, 1,  9, 1, 1, '#DDD6FE', 'C2', 'Allée C – Niveau 2 – 17 rouleaux'),
('C3', 'C', 3, null,   'rouleaux', 'sud',  8, 'rouleaux', true, 1,  8, 1, 1, '#C4B5FD', 'C3', 'Allée C – Niveau 3 – 8 rouleaux'),
('C4', 'C', 4, 'haut', 'palettes', 'sud',  2, 'palettes', true, 1,  7, 1, 1, '#A78BFA', 'C4', 'Allée C – Niveau 4 (haut) – 2 palettes'),

-- ── SECTION SUD — ALLÉE B ───────────────────────────────────
('B1', 'B', 1, 'bas',  'rouleaux', 'sud', 47, 'rouleaux', true, 2, 10, 1, 1, '#EDE9FE', 'B1', 'Allée B – Niveau 1 (bas) – 47 rouleaux'),
('B2', 'B', 2, null,   'rouleaux', 'sud', 17, 'rouleaux', true, 2,  9, 1, 1, '#DDD6FE', 'B2', 'Allée B – Niveau 2 – 17 rouleaux'),
('B3', 'B', 3, null,   'rouleaux', 'sud',  8, 'rouleaux', true, 2,  8, 1, 1, '#C4B5FD', 'B3', 'Allée B – Niveau 3 – 8 rouleaux'),
('B4', 'B', 4, 'haut', 'palettes', 'sud',  2, 'palettes', true, 2,  7, 1, 1, '#A78BFA', 'B4', 'Allée B – Niveau 4 (haut) – 2 palettes'),

-- ── SECTION SUD — ALLÉE A ───────────────────────────────────
('A1', 'A', 1, 'bas',  'rouleaux', 'sud', 47, 'rouleaux', true, 3, 10, 1, 1, '#EDE9FE', 'A1', 'Allée A – Niveau 1 (bas) – 47 rouleaux'),
('A2', 'A', 2, null,   'rouleaux', 'sud', 17, 'rouleaux', true, 3,  9, 1, 1, '#DDD6FE', 'A2', 'Allée A – Niveau 2 – 17 rouleaux'),
('A3', 'A', 3, null,   'rouleaux', 'sud',  8, 'rouleaux', true, 3,  8, 1, 1, '#C4B5FD', 'A3', 'Allée A – Niveau 3 – 8 rouleaux'),
('A4', 'A', 4, 'haut', 'palettes', 'sud',  3, 'palettes', true, 3,  7, 1, 1, '#A78BFA', 'A4', 'Allée A – Niveau 4 (haut) – 3 palettes'),

-- ── CONSOMMABLES — ALLÉE K ──────────────────────────────────
('K1', 'K', 1, 'bas',  'consommable', 'special', null, null, true, 9, 10, 1, 1, '#FEF3C7', 'K1', 'Consommables – Niveau 1 (bas)'),
('K2', 'K', 2, null,   'consommable', 'special', null, null, true, 9,  9, 1, 1, '#FDE68A', 'K2', 'Consommables – Niveau 2'),
('K3', 'K', 3, null,   'consommable', 'special', null, null, true, 9,  8, 1, 1, '#FCD34D', 'K3', 'Consommables – Niveau 3'),
('K4', 'K', 4, null,   'consommable', 'special', null, null, true, 9,  7, 1, 1, '#FBBF24', 'K4', 'Consommables – Niveau 4'),
('K5', 'K', 5, 'haut', 'consommable', 'special', null, null, true, 9,  6, 1, 1, '#F59E0B', 'K5', 'Consommables – Niveau 5 (haut)'),

-- ── ZONES STRUCTURELLES (non-stockage) ──────────────────────
('BUREAU',   'BUREAU',   null, null, 'structure', 'special', null, null, false, 6, 1, 1, 3, '#E5E7EB', 'Bureau',                    'Bureau'),
('PORT_EXT', 'PORT_EXT', null, null, 'structure', 'special', null, null, false, 9, 1, 2, 2, '#374151', 'Porte roulante extérieure',  'Entrée principale ext.'),
('PORT_PH',  'PORT_PH',  null, null, 'structure', 'special', null, null, false, 7, 1, 1, 1, '#6B7280', 'Petite porte',               'Petite porte nord'),
('RAILS',    'RAILS',    null, null, 'structure', 'special', null, null, false, 4, 7, 4, 4, '#1E3A5F', 'Rails',                      'Zone rails / atelier'),
('PORT_AT',  'PORT_AT',  null, null, 'structure', 'special', null, null, false, 4,11, 4, 1, '#374151', 'Porte roulante atelier',     'Accès atelier'),
('PORT_PS',  'PORT_PS',  null, null, 'structure', 'special', null, null, false,10,11, 1, 1, '#6B7280', 'Petite porte',               'Petite porte sud');


-- ============================================================
-- CONTRAINTE DE RÉFÉRENCE (optionnelle)
-- Lie inventory_items.location à warehouse_zones.code
-- À activer une fois les données nettoyées
-- ============================================================
-- ALTER TABLE public.inventory_items
--   ADD CONSTRAINT fk_location_zone
--   FOREIGN KEY (location) REFERENCES public.warehouse_zones(code);


-- ============================================================
-- INDEX pour performances
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_warehouse_zones_type    ON public.warehouse_zones(type);
CREATE INDEX IF NOT EXISTS idx_warehouse_zones_section ON public.warehouse_zones(section);
CREATE INDEX IF NOT EXISTS idx_warehouse_zones_allee   ON public.warehouse_zones(allee);
