// Import Excel des minutes (chiffrage), en trois temps :
//   1. on choisit les produits et les colonnes à saisir ;
//   2. on télécharge le modèle Excel correspondant (listes déroulantes, bibliothèque) ;
//   3. on dépose le fichier rempli : aperçu ligne par ligne, puis ajout à la suite.
// Les anciens fichiers (un onglet par produit, en-têtes = libellés des colonnes) restent
// acceptés : la lecture se fait par nom d'onglet et par libellé, comme avant.
import { STORE_CLASSIQUE_DEFAUT } from '../constants/productRouting';
import { LEGACY_HEADER_ALIASES } from '../constants/rideauxFields';
import { RIDEAUX_SCHEMA, RIDEAUX_LINE_DEFAULTS } from '../schemas/chiffrage/rideaux';
import { STORES_CLASSIQUES_SCHEMA } from '../schemas/chiffrage/stores_classiques';
import { STORES_BATEAUX_SCHEMA } from '../schemas/chiffrage/stores_bateaux';
import { COUSSINS_SCHEMA } from '../schemas/chiffrage/coussins';
import { CACHE_SOMMIER_SCHEMA } from '../schemas/chiffrage/cache_sommier';
import { PLAID_SCHEMA } from '../schemas/chiffrage/plaid';
import { TENTURE_MURALE_SCHEMA } from '../schemas/chiffrage/tenture_murale';
import { MOBILIER_SCHEMA } from '../schemas/chiffrage/mobilier';
import { uid } from '../utils/uid';
import { recomputeRow } from '../formulas/recomputeRow';

// Produits proposés (= onglets du modèle). `produit` : valeur par défaut d'une ligne.
export const MINUTE_PRODUCTS = [
    { key: 'Rideaux', label: 'Rideaux / voilages', schema: RIDEAUX_SCHEMA, produit: 'Rideau', defaults: RIDEAUX_LINE_DEFAULTS },
    { key: 'Stores', label: 'Stores', schema: STORES_CLASSIQUES_SCHEMA, produit: STORE_CLASSIQUE_DEFAUT },
    { key: 'Stores Bateaux', label: 'Stores bateaux / velums', schema: STORES_BATEAUX_SCHEMA, produit: 'Store Bateau' },
    { key: 'Coussins', label: 'Coussins', schema: COUSSINS_SCHEMA, produit: 'Coussins' },
    { key: 'Cache-Sommier', label: 'Cache-sommiers', schema: CACHE_SOMMIER_SCHEMA, produit: 'Cache-Sommier' },
    { key: 'Plaid', label: 'Plaids / chemins de lit', schema: PLAID_SCHEMA, produit: 'Plaid' },
    { key: 'Tenture Murale', label: 'Tentures murales', schema: TENTURE_MURALE_SCHEMA, produit: 'Tenture Murale' },
    { key: 'Mobilier', label: 'Mobilier (têtes de lit, sièges…)', schema: MOBILIER_SCHEMA, produit: 'Tête de Lit' },
];

// Noms d'onglets historiques encore acceptés à l'import.
const SHEET_ALIASES = {
    'tete de lit': { product: 'Mobilier', produit: 'Tête de Lit' },
    siege: { product: 'Mobilier', produit: 'Siège' },
    cantonniere: { product: 'Mobilier', produit: 'Cantonnière' },
};

/** Colonnes toujours présentes dans le modèle (choix du user : le reste au choix). */
export const REQUIRED_KEYS = ['zone', 'piece', 'produit'];

const norm = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const SAISIE_TYPES = ['text', 'select', 'singleSelect', 'number', 'catalog_item'];
// Deux formes de schéma coexistent : { label, readOnly } (rideaux, stores) et
// { headerName, editable: false } (coussins, plaids, mobilier…).
const labelOf = (c) => c.label || c.headerName || c.key;
const isComputed = (c) => !!c.readOnly || c.editable === false;

const optionsOf = (col) => (Array.isArray(col.options) ? col.options : Array.isArray(col.valueOptions) ? col.valueOptions : null)
    ?.map(o => (typeof o === 'object' ? (o.value ?? o.label) : o)).filter(o => o !== '' && o !== null && o !== undefined);

/**
 * Colonnes à SAISIR d'un tableau : ni calculées (lecture seule), ni masquées, ni prix de
 * vente (toujours recalculés). Ordre du tableau.
 */
export function importableColumns(schema) {
    return (schema || []).filter(c => c && c.key && SAISIE_TYPES.includes(c.type) && !isComputed(c) && !c.hidden
        && c.key !== 'detail' && !/^pv_/.test(c.key))
        .map(c => ({ key: c.key, label: labelOf(c), type: c.type, options: optionsOf(c), category: c.category || null }));
}

/** Articles de la bibliothèque proposés pour une colonne « article » (même filtre que le tableau). */
export function catalogNamesFor(col, catalog = []) {
    let list = catalog;
    if (col.category) {
        const cats = col.category.split(',').map(c => c.trim().toLowerCase());
        list = catalog.filter(i => i.category && cats.includes(i.category.trim().toLowerCase()));
    } else if (/tissu|doublure/.test(col.key)) list = catalog.filter(i => ['Tissu', 'Confection'].includes(i.category));
    else if (/passementerie/.test(col.key)) list = catalog.filter(i => i.category === 'Passementerie');
    return [...new Set(list.map(i => clean(i.name)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
}

// ——— Modèle ———————————————————————————————————————————————————————————————

/**
 * Modèle Excel : un onglet par produit choisi, les colonnes choisies, listes déroulantes
 * (choix fixes + articles de la bibliothèque du chiffrage), mode d'emploi.
 * @param {Array<{ key, columns: string[] }>} selection
 */
export async function downloadMinuteTemplate(selection, { catalog = [], minuteName = '' } = {}) {
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    // Valeurs des listes déroulantes : rangées dans un onglet caché « Listes » (ajouté en
    // dernier, pour que le fichier s'ouvre sur le premier produit).
    const listColumns = [];
    const listRange = (values) => {
        listColumns.push(values);
        const letter = colLetter(listColumns.length);
        return `Listes!$${letter}$1:$${letter}$${values.length}`;
    };

    selection.forEach(({ key, columns }) => {
        const product = MINUTE_PRODUCTS.find(p => p.key === key);
        if (!product) return;
        const all = importableColumns(product.schema);
        const cols = all.filter(c => REQUIRED_KEYS.includes(c.key) || columns.includes(c.key));
        const ws = wb.addWorksheet(product.key, { views: [{ state: 'frozen', ySplit: 1 }] });
        ws.columns = cols.map(c => ({ header: c.label, key: c.key, width: Math.max(12, Math.min(30, c.label.length + 6)) }));
        const head = ws.getRow(1);
        head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        head.height = 22;
        head.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2447' } }; cell.alignment = { vertical: 'middle' }; });

        cols.forEach((c, idx) => {
            const letter = colLetter(idx + 1);
            const values = c.type === 'catalog_item' ? catalogNamesFor(c, catalog)
                : (c.type === 'select' || c.type === 'singleSelect') ? (c.options || []) : null;
            let validation = null;
            if (values && values.length) {
                validation = { type: 'list', allowBlank: true, formulae: [listRange(values)], showErrorMessage: c.type !== 'catalog_item', errorTitle: c.label, error: 'Choisissez dans la liste.' };
                head.getCell(idx + 1).note = c.type === 'catalog_item' ? 'Liste = bibliothèque du chiffrage (autre nom accepté, signalé à l’import).' : 'Choisissez dans la liste.';
            } else if (c.type === 'number') {
                validation = { type: 'decimal', allowBlank: true, operator: 'greaterThanOrEqual', formulae: [0], showErrorMessage: true, errorTitle: c.label, error: 'Nombre attendu (virgule acceptée).' };
            }
            if (validation) for (let r = 2; r <= 301; r++) ws.getCell(`${letter}${r}`).dataValidation = validation;
        });
        // Produit laissé vide = produit de l'onglet, posé à l'import.
    });

    const help = wb.addWorksheet('Mode d’emploi');
    help.getColumn(1).width = 110;
    [
        `Import de lignes — ${minuteName || 'chiffrage'} — Droitfil`,
        '',
        '1. Un onglet par produit : une ligne Excel = une ligne du chiffrage.',
        '2. Zone et Pièce : repères de la ligne. Produit : laissé vide = produit de l’onglet (ex. Rideau).',
        '3. Les listes déroulantes reprennent les choix du tableau et les articles de la bibliothèque de ce chiffrage.',
        '   Un article absent de la bibliothèque est accepté mais signalé : ajoutez-le ensuite à la bibliothèque pour qu’il soit chiffré.',
        '4. Nombres : virgule acceptée (12,5). Les colonnes calculées (métrages, prix de vente…) ne sont pas à remplir : Droitfil les calcule.',
        '5. Dans Droitfil › Chiffrage › Importer Excel, déposez ce fichier : un aperçu s’affiche, puis les lignes s’ajoutent à la suite.',
        '',
        'Ne modifiez pas les titres de la première ligne ni le nom des onglets. Les lignes vides sont ignorées.',
    ].forEach((t, i) => { const r = help.addRow([t]); if (i === 0) r.font = { bold: true, size: 14 }; });
    const lists = wb.addWorksheet('Listes', { state: 'hidden' });
    listColumns.forEach((values, i) => values.forEach((v, r) => { lists.getCell(r + 1, i + 1).value = v; }));

    const date = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');
    const safe = String(minuteName || 'chiffrage').replace(/[^\w\- ]+/g, '').trim().slice(0, 40) || 'chiffrage';
    await save(wb, `Import_${safe}_${date}.xlsx`);
}

// ——— Lecture du fichier rempli ——————————————————————————————————————————————

/**
 * Lit et contrôle le fichier. Rien n'est ajouté ici.
 * @returns {{ lines: Array, ignored: string[], fatal: string|null }}
 *   ligne : { key, sheet, row, product (clé MINUTE_PRODUCTS), raw (valeurs saisies), warnings: [] }
 */
export async function analyzeMinuteFile(file, catalog = []) {
    const { default: readXlsxFile, readSheetNames } = await import('read-excel-file');
    const names = await readSheetNames(file);
    const byName = new Map(catalog.map(i => [norm(i.name), clean(i.name)]));
    const lines = [], ignored = [];

    for (const sheetName of names) {
        const n = norm(sheetName);
        if (n === 'listes' || n.startsWith('mode d')) continue;
        const product = MINUTE_PRODUCTS.find(p => norm(p.key) === n) || (SHEET_ALIASES[n] && MINUTE_PRODUCTS.find(p => p.key === SHEET_ALIASES[n].product));
        if (!product) { ignored.push(`Onglet « ${sheetName} » non reconnu (ignoré).`); continue; }
        const defaultProduit = SHEET_ALIASES[n]?.produit || product.produit;
        const rows = await readXlsxFile(file, { sheet: sheetName });
        if (!rows || rows.length < 2) continue;

        // En-têtes → clés : libellé courant, puis anciens libellés (fichiers déjà remplis)
        const labelToCol = new Map();
        product.schema.forEach(c => { if (c?.key) labelToCol.set(norm(labelOf(c)), c); });
        product.schema.forEach(c => { (LEGACY_HEADER_ALIASES[c?.key] || []).forEach(a => { if (!labelToCol.has(norm(a))) labelToCol.set(norm(a), c); }); });
        const header = rows[0].map(h => labelToCol.get(norm(h)) || null);
        rows[0].forEach((h, i) => {
            if (clean(h) && !header[i]) ignored.push(`Onglet « ${sheetName} » : colonne « ${clean(h)} » non reconnue (ignorée).`);
            else if (header[i] && isComputed(header[i])) ignored.push(`Onglet « ${sheetName} » : colonne « ${clean(h)} » calculée par Droitfil (ignorée).`);
        });

        for (let r = 1; r < rows.length; r++) {
            const cells = rows[r] || [];
            if (cells.every(v => clean(v) === '')) continue; // ligne vide
            const raw = {};
            const warnings = [];
            header.forEach((col, i) => {
                if (!col || isComputed(col)) return;
                const v = cells[i];
                if (v === null || v === undefined || clean(v) === '') return;
                if (col.type === 'number') {
                    const num = typeof v === 'number' ? v : Number(clean(v).replace(/\s/g, '').replace(',', '.'));
                    if (Number.isFinite(num)) raw[col.key] = num;
                    else warnings.push(`${labelOf(col)} : « ${clean(v)} » n’est pas un nombre (ignoré).`);
                } else if (col.type === 'catalog_item') {
                    const exact = byName.get(norm(v));
                    raw[col.key] = exact || clean(v);
                    if (!exact) warnings.push(`${labelOf(col)} : « ${clean(v)} » absent de la bibliothèque (pas chiffré tant qu’il n’y est pas).`);
                } else if (col.type === 'select' || col.type === 'singleSelect') {
                    const opts = optionsOf(col) || [];
                    const hit = opts.find(o => norm(o) === norm(v));
                    if (hit !== undefined) raw[col.key] = hit;
                    else if (opts.length) { raw[col.key] = clean(v); warnings.push(`${labelOf(col)} : « ${clean(v)} » hors liste.`); }
                    else raw[col.key] = clean(v);
                } else {
                    raw[col.key] = typeof v === 'string' ? clean(v) : v;
                }
            });
            if (!raw.produit) raw.produit = defaultProduit;
            if (!raw.zone && !raw.piece) warnings.push('Ni zone ni pièce : ligne difficile à retrouver.');
            lines.push({ key: `${sheetName}#${r + 1}`, sheet: sheetName, row: r + 1, product: product.key, raw, warnings });
        }
    }
    const fatal = lines.length ? null
        : ignored.length ? 'Aucune ligne reconnue : utilisez le modèle téléchargé à l’étape 2 (onglets et titres de colonnes).'
        : 'Aucune ligne à importer dans ce fichier.';
    return { lines, ignored, fatal };
}

/** Lignes prêtes à ajouter au chiffrage (valeurs par défaut d'une nouvelle ligne + calculs). */
export function buildMinuteRows(lines, ctx) {
    return lines.map(l => {
        const product = MINUTE_PRODUCTS.find(p => p.key === l.product);
        const base = { id: uid(), quantite: 1, largeur: 0, hauteur: 0, ...(product?.defaults || {}) };
        return recomputeRow({ ...base, ...l.raw }, product.schema, ctx);
    });
}

const colLetter = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

async function save(wb, filename) {
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}
