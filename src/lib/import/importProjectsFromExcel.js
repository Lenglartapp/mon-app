// src/lib/import/importProjectsFromExcel.js
import readXlsxFile from 'read-excel-file';
import { uid } from '../utils/uid';

// Prénoms autorisés dans le dropdown responsable
const ALLOWED_FIRST_NAMES = ['Angelina', 'Aristide', 'Adrien', 'Thomas', 'Alison', 'Emmanuel', 'Muriel'];

// Fallback si les users ne sont pas passés
const RESPONSABLES_FALLBACK = ALLOWED_FIRST_NAMES;

const STATUTS = ['À commencer', 'En cours', 'Terminé', 'SAV', 'Archivé'];

const STATUS_MAP = {
  'à commencer': 'TODO',
  'todo': 'TODO',
  'en cours': 'IN_PROGRESS',
  'in_progress': 'IN_PROGRESS',
  'terminé': 'DONE',
  'termine': 'DONE',
  'done': 'DONE',
  'sav': 'SAV',
  'archivé': 'ARCHIVED',
  'archive': 'ARCHIVED',
};

const TYPES_INTERVENTION = ['Livraison', 'Installation'];

// Modules : une colonne par module — valeur Oui/Non
const MODULES = [
  { col: 'Rideau', produit: 'Rideau' },
  { col: 'Voilage', produit: 'Voilage' },
  { col: 'Store Bateau', produit: 'Store Bateau' },
  { col: 'Store Classique', produit: 'Store' },
  { col: 'Tenture Murale', produit: 'Tenture Murale' },
  { col: 'Cache-Sommier', produit: 'Cache-Sommier' },
  { col: 'Coussin', produit: 'Coussin' },
  { col: 'Plaid', produit: 'Plaid' },
  { col: 'Tête de lit', produit: 'Tête de lit' },
];

const BASE_COLUMNS = [
  'Nom projet',
  'Responsable',
  'Statut',
  'Type',
  'Date livraison',
  'H. Prépa allouées',
  'H. Conf allouées',
  'H. Pose allouées',
  'H. Prépa consommées',
  'H. Conf consommées',
  'H. Pose consommées',
  'Lieu',
];

const ALL_COLUMNS = [...BASE_COLUMNS, ...MODULES.map(m => m.col)];

function parseStatus(raw) {
  if (!raw) return 'TODO';
  return STATUS_MAP[(raw + '').toLowerCase().trim()] || 'TODO';
}

function parseType(raw) {
  if (!raw) return null;
  const s = (raw + '').toLowerCase().trim();
  if (s === 'installation') return 'installation';
  if (s === 'livraison') return 'livraison';
  return null;
}

function isOui(raw) {
  if (!raw) return false;
  const s = (raw + '').toLowerCase().trim();
  return s === 'oui' || s === 'yes' || s === 'x' || s === '1' || s === 'true';
}

function parseDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  const s = (raw + '').trim();
  if (!s) return null;
  const match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return s;
}

function parseHours(raw) {
  const n = parseFloat(raw);
  return isNaN(n) ? 0 : Math.max(0, n);
}

export async function parseProjectsFromExcel(file) {
  const rows = await readXlsxFile(file);
  if (!rows || rows.length < 2) return [];

  const headerRow = rows[0].map(h => (h == null ? '' : h.toString().trim()));
  const colIndex = {};
  ALL_COLUMNS.forEach(col => {
    const idx = headerRow.findIndex(h => h.toLowerCase() === col.toLowerCase());
    colIndex[col] = idx;
  });

  const projects = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const get = (col) => {
      const idx = colIndex[col];
      return idx >= 0 ? row[idx] : null;
    };

    const name = (get('Nom projet') || '').toString().trim();
    if (!name) continue;

    const rows_data = MODULES
      .filter(m => isOui(get(m.col)))
      .map(m => ({ id: uid(), produit: m.produit, zone: '', piece: '', quantite: 1 }));

    projects.push({
      id: uid(),
      name,
      manager: (get('Responsable') || '').toString().trim(),
      status: parseStatus(get('Statut')),
      intervention_type: parseType(get('Type')),
      due: parseDate(get('Date livraison')),
      location: (get('Lieu') || '').toString().trim(),
      budget: {
        prepa: parseHours(get('H. Prépa allouées')),
        conf:  parseHours(get('H. Conf allouées')),
        pose:  parseHours(get('H. Pose allouées')),
      },
      consumed_import: {
        prepa: parseHours(get('H. Prépa consommées')),
        conf:  parseHours(get('H. Conf consommées')),
        pose:  parseHours(get('H. Pose consommées')),
      },
      rows: rows_data,
      created_at: new Date().toISOString(),
    });
  }

  return projects;
}

// Applique une validation liste sur une plage de cellules
function addDropdown(ws, colLetter, fromRow, toRow, values) {
  for (let r = fromRow; r <= toRow; r++) {
    ws.getCell(`${colLetter}${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${values.join(',')}"`],
      showErrorMessage: true,
      errorTitle: 'Valeur invalide',
      error: `Choisir parmi : ${values.join(', ')}`,
    };
  }
}

export async function downloadProjectsTemplate(users = []) {
  const { default: ExcelJS } = await import('exceljs');
  const responsables = users.length > 0
    ? users
        .filter(u => u.first_name && ALLOWED_FIRST_NAMES.includes(u.first_name))
        .map(u => u.name)
        .filter(Boolean)
    : RESPONSABLES_FALLBACK;
  const finalResponsables = responsables.length > 0 ? responsables : RESPONSABLES_FALLBACK;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Projets');

  // Colonnes de base
  const baseColDefs = BASE_COLUMNS.map(col => ({ header: col, key: col, width: Math.max(col.length + 6, 14) }));
  // Colonnes modules
  const moduleColDefs = MODULES.map(m => ({ header: m.col, key: m.col, width: Math.max(m.col.length + 4, 12) }));

  ws.columns = [...baseColDefs, ...moduleColDefs];

  // Style header
  ws.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2447' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  ws.getRow(1).height = 22;

  // Colorer les en-têtes modules différemment
  const moduleStartIdx = BASE_COLUMNS.length + 1; // 1-based
  for (let c = moduleStartIdx; c < moduleStartIdx + MODULES.length; c++) {
    const cell = ws.getRow(1).getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D4A6B' } };
  }

  // Ligne d'exemple
  const exampleRow = {
    'Nom projet': 'Appartement Martin',
    'Responsable': finalResponsables[0] || '',
    'Statut': 'En cours',
    'Type': 'Livraison',
    'Date livraison': '30/06/2025',
    'H. Prépa allouées': 8,
    'H. Conf allouées': 40,
    'H. Pose allouées': 6,
    'H. Prépa consommées': 4,
    'H. Conf consommées': 32,
    'H. Pose consommées': 6,
    'Lieu': 'Paris 8e',
    'Rideau': 'Oui',
    'Voilage': 'Non',
    'Store Bateau': 'Oui',
    'Store Classique': 'Non',
    'Tenture Murale': 'Non',
    'Cache-Sommier': 'Non',
    'Coussin': 'Non',
    'Plaid': 'Non',
    'Tête de lit': 'Non',
  };
  ws.addRow(exampleRow);

  // Colonnes lettre helper (A=1, B=2, ...)
  const colLetter = (n) => {
    let s = '';
    while (n > 0) { s = String.fromCharCode(65 + ((n - 1) % 26)) + s; n = Math.floor((n - 1) / 26); }
    return s;
  };

  const MAX_ROWS = 100; // plage des validations

  // Dropdowns colonne Responsable (col 2)
  addDropdown(ws, colLetter(2), 2, MAX_ROWS, finalResponsables);

  // Dropdowns colonne Statut (col 3)
  addDropdown(ws, colLetter(3), 2, MAX_ROWS, STATUTS);

  // Dropdowns colonne Type (col 4)
  addDropdown(ws, colLetter(4), 2, MAX_ROWS, TYPES_INTERVENTION);

  // Dropdowns Oui/Non pour chaque colonne module
  for (let i = 0; i < MODULES.length; i++) {
    addDropdown(ws, colLetter(moduleStartIdx + i), 2, MAX_ROWS, ['Oui', 'Non']);
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'template_import_projets.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}
