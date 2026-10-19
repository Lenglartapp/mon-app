// Import / export Excel de l'inventaire.
//
//  • AJOUT d'ancien stock : modèle Excel téléchargeable (listes déroulantes, mode
//    d'emploi), lu par le TITRE des colonnes, contrôlé ligne par ligne avant création
//    d'articles en stock libre (aucun dossier).
//  • MISE À JOUR du stock : fichier exporté depuis l'inventaire, colonnes jaunes
//    modifiées puis réimportées (quantité / emplacement), aussi lu par titre et contrôlé.
//
// Module sans React : lecture, contrôles, construction des fichiers.
import { LOC_A_COMPLETER, splitLocations } from './stockFields';

export const IMPORT_CATEGORIES = ['Tissu', 'Rail', 'Mécanisme', 'Consommable', 'Divers'];
export const IMPORT_UNITS = ['ml', 'm2', 'u', 'kg'];
export const ANCIEN_STOCK_REASON = 'Reprise ancien stock (import Excel)';
const MAX_ROWS = 2000;

// ——— Outils ————————————————————————————————————————————————————————————————

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const norm = (v) => clean(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/** Nombre tapé à la française (« 12,5 », « 1 200 ») ; null si vide, NaN si illisible. */
export function parseNumber(v) {
    if (v === null || v === undefined || clean(v) === '') return null;
    if (typeof v === 'number') return v;
    const n = Number(clean(v).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
}

const round2 = (n) => Math.round(Number(n) * 100) / 100;

/** Tri « naturel » des emplacements : A1, A2, A10, B1… */
export const compareLocations = (a, b) => String(a || '').localeCompare(String(b || ''), 'fr', { numeric: true, sensitivity: 'base' });

/**
 * Clé de tri de la liste du stock : « À compléter » d'abord, puis par emplacement
 * (le plus petit code de l'article), les articles sans emplacement à la fin.
 */
export function stockSortCompare(a, b) {
    const la = splitLocations(a.location), lb = splitLocations(b.location);
    const ta = la.includes(LOC_A_COMPLETER), tb = lb.includes(LOC_A_COMPLETER);
    if (ta !== tb) return ta ? -1 : 1;
    const fa = la.filter(l => l !== LOC_A_COMPLETER).sort(compareLocations)[0];
    const fb = lb.filter(l => l !== LOC_A_COMPLETER).sort(compareLocations)[0];
    if (!fa !== !fb) return fa ? -1 : 1;
    const c = compareLocations(fa, fb);
    if (c) return c;
    return String(a.product || '').localeCompare(String(b.product || ''), 'fr', { sensitivity: 'base' });
}

const CATEGORY_ALIASES = {
    tissu: 'Tissu', tissus: 'Tissu', doublure: 'Tissu', voilage: 'Tissu', passementerie: 'Tissu',
    rail: 'Rail', rails: 'Rail', tringle: 'Rail',
    mecanisme: 'Mécanisme', mecanismes: 'Mécanisme', meca: 'Mécanisme', store: 'Mécanisme',
    consommable: 'Consommable', consommables: 'Consommable', fourniture: 'Consommable',
    divers: 'Divers', autre: 'Divers', autres: 'Divers',
};
const UNIT_ALIASES = { ml: 'ml', m: 'ml', metre: 'ml', metres: 'ml', metrelineaire: 'ml', m2: 'm2', mcarre: 'm2', u: 'u', unite: 'u', unites: 'u', pce: 'u', piece: 'u', pieces: 'u', units: 'u', unit: 'u', kg: 'kg', kilo: 'kg', kilos: 'kg' };

// ——— Fichier d'AJOUT (ancien stock) ————————————————————————————————————————

// Colonnes du modèle : clé interne, titre, largeur, aide.
export const TEMPLATE_COLUMNS = [
    { key: 'category', title: 'Catégorie *', width: 14, help: 'Tissu, Rail, Mécanisme, Consommable ou Divers (liste déroulante).' },
    { key: 'fournisseur', title: 'Fournisseur', width: 20, help: 'Ex. DEDAR, HOULES. Laisser vide si inconnu.' },
    { key: 'ref', title: 'Référence *', width: 26, help: 'Nom / référence de l’article (obligatoire).' },
    { key: 'coloris', title: 'Coloris', width: 18, help: 'Ex. 104 AVORIO.' },
    { key: 'laize', title: 'Laize (cm)', width: 11, help: 'Tissus : largeur du rouleau en cm (fortement conseillé).' },
    { key: 'qty', title: 'Quantité *', width: 11, help: 'Quantité en stock (virgule acceptée : 12,5).' },
    { key: 'unit', title: 'Unité *', width: 9, help: 'ml, m2, u ou kg. Tissu = toujours ml.' },
    { key: 'location', title: 'Emplacement *', width: 16, help: 'Code de rangement (A1, B3…). Plusieurs : « B3, C1 ». Voir l’onglet Emplacements.' },
    { key: 'pieces', title: 'Pièces (métrages)', width: 20, help: 'Facultatif — tissus en plusieurs coupons : métrage de chaque pièce séparé par « ; » (ex. 12 ; 8,5 ; 3).' },
    { key: 'comment', title: 'Commentaire', width: 30, help: 'Facultatif — origine, ancien dossier, état… (noté au journal).' },
];

const TEMPLATE_HEADER_KEYS = new Map(TEMPLATE_COLUMNS.map(c => [norm(c.title.replace('*', '')), c.key]));
// Titres tolérés en plus (fichier fait à la main)
[['categorie', 'category'], ['type', 'category'], ['famille', 'category'], ['reference', 'ref'], ['ref', 'ref'], ['produit', 'ref'], ['article', 'ref'],
 ['couleur', 'coloris'], ['laize', 'laize'], ['largeur', 'laize'], ['quantite', 'qty'], ['qte', 'qty'], ['stock', 'qty'], ['unite', 'unit'],
 ['emplacement', 'location'], ['rangement', 'location'], ['pieces', 'pieces'], ['coupons', 'pieces'], ['commentaire', 'comment'], ['note', 'comment'], ['notes', 'comment'],
].forEach(([k, v]) => { if (!TEMPLATE_HEADER_KEYS.has(k)) TEMPLATE_HEADER_KEYS.set(k, v); });

// Titres propres au fichier de MISE À JOUR (exporté depuis l'inventaire)
const UPDATE_HEADER_KEYS = new Map([
    ['id', 'id'], ['quantiteactuelle', 'oldQty'], ['nouvellequantite', 'newQty'], ['emplacementactuel', 'oldLocation'], ['nouvelemplacement', 'newLocation'],
    ['produit', 'product'], ['unite', 'unit'],
    // Feuille de comptage : « Quantité attendue » / « COMPTÉ »
    ['quantiteattendue', 'oldQty'], ['compte', 'newQty'], ['emplacement', 'oldLocation'],
]);

/** Repère la ligne de titres (dans les 10 premières lignes) et associe chaque colonne à une clé. */
function mapHeaders(rows, keys) {
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
        const map = {};
        (rows[r] || []).forEach((cell, i) => {
            const k = keys.get(norm(String(cell ?? '').replace('*', '').replace(/\(.*?\)/g, '')));
            if (k && map[k] === undefined) map[k] = i;
        });
        if (Object.keys(map).length >= 3) return { headerRow: r, map };
    }
    return null;
}

/** Type de fichier d'après ses titres : 'add' (modèle ancien stock), 'update' (export), ou null. */
export function detectFileKind(rows) {
    const upd = mapHeaders(rows, UPDATE_HEADER_KEYS);
    if (upd && upd.map.id !== undefined && upd.map.newQty !== undefined) return 'update';
    const add = mapHeaders(rows, TEMPLATE_HEADER_KEYS);
    if (add && add.map.ref !== undefined && add.map.qty !== undefined) return 'add';
    return null;
}

/**
 * Lit et contrôle un fichier d'ajout d'ancien stock.
 * @param {Array<Array>} rows      lignes brutes (read-excel-file)
 * @param {object} ctx             { zones: string[] codes connus, inventory: articles existants }
 * @returns {{ lines: Array, fatal: string|null }}
 *   ligne : { row (n° Excel), data (article prêt), errors: [], warnings: [] }
 */
export function analyzeAddFile(rows, { zones = [], inventory = [] } = {}) {
    const head = mapHeaders(rows, TEMPLATE_HEADER_KEYS);
    if (!head || head.map.ref === undefined || head.map.qty === undefined) {
        return { lines: [], fatal: "Colonnes « Référence » et « Quantité » introuvables : utilisez le modèle téléchargeable." };
    }
    const knownZones = new Set(zones.map(z => clean(z).toUpperCase()));
    const existing = new Set(inventory.filter(i => Number(i.qty) > 0).map(i => norm([i.fournisseur, i.ref || i.product, i.coloris].join('|'))));
    const seen = new Map();
    const get = (r, k) => (head.map[k] === undefined ? null : r[head.map[k]]);
    const lines = [];

    for (let i = head.headerRow + 1; i < rows.length; i++) {
        const r = rows[i] || [];
        if (r.every(c => clean(c) === '')) continue; // ligne vide
        if (lines.length >= MAX_ROWS) {
            return { lines, fatal: `Fichier trop long : ${MAX_ROWS} lignes maximum par import (découpez-le).` };
        }
        const errors = [], warnings = [];
        const ref = clean(get(r, 'ref'));
        const fournisseur = clean(get(r, 'fournisseur')).toUpperCase();
        const coloris = clean(get(r, 'coloris'));
        const comment = clean(get(r, 'comment'));

        const rawCat = clean(get(r, 'category'));
        let category = CATEGORY_ALIASES[norm(rawCat)] || null;
        if (!rawCat) { category = 'Divers'; warnings.push('Catégorie vide → « Divers ».'); }
        else if (!category) { category = 'Divers'; warnings.push(`Catégorie « ${rawCat} » inconnue → « Divers ».`); }

        const qty = parseNumber(get(r, 'qty'));
        if (!ref) errors.push('Référence manquante.');
        if (qty === null) errors.push('Quantité manquante.');
        else if (Number.isNaN(qty)) errors.push(`Quantité illisible (« ${clean(get(r, 'qty'))} »).`);
        else if (qty <= 0) errors.push('Quantité nulle ou négative.');

        const rawUnit = clean(get(r, 'unit'));
        let unit = UNIT_ALIASES[norm(rawUnit)] || null;
        if (category === 'Tissu') {
            if (unit && unit !== 'ml') warnings.push(`Tissu en « ${rawUnit} » → passé en ml (règle Droitfil : tissu toujours en ml).`);
            unit = 'ml';
        } else if (!rawUnit) { unit = 'u'; warnings.push('Unité vide → « u ».'); }
        else if (!unit) errors.push(`Unité « ${rawUnit} » inconnue (ml, m2, u ou kg).`);

        let laize = null;
        const rawLaize = get(r, 'laize');
        if (clean(rawLaize)) {
            const l = parseNumber(rawLaize);
            if (Number.isNaN(l) || l <= 0) warnings.push(`Laize illisible (« ${clean(rawLaize)} ») → ignorée.`);
            else laize = l;
        }
        if (category === 'Tissu' && !laize) warnings.push('Tissu sans laize : le métrage ne pourra pas être calculé avec.');

        const locs = splitLocations(clean(get(r, 'location')).toUpperCase());
        if (!locs.length) errors.push('Emplacement manquant.');
        const unknown = knownZones.size ? locs.filter(l => !knownZones.has(l)) : [];
        if (unknown.length) warnings.push(`Emplacement ${unknown.join(', ')} absent du plan de l'entrepôt.`);

        // Pièces : métrages séparés par « ; » (ou « + », « / »). La somme fait foi (règle stock).
        let pieces = [];
        const rawPieces = clean(get(r, 'pieces'));
        if (rawPieces) {
            const parts = rawPieces.split(/[;+/|]/).map(s => parseNumber(s)).filter(n => n !== null);
            if (parts.some(n => Number.isNaN(n) || n <= 0)) errors.push(`Pièces illisibles (« ${rawPieces} »).`);
            else {
                pieces = parts.map((q, idx) => ({ qty: round2(q), name: `Pièce ${idx + 1}` }));
                const sum = round2(parts.reduce((s, n) => s + n, 0));
                if (qty > 0 && Math.abs(sum - qty) > 0.01) warnings.push(`Pièces = ${sum} ≠ quantité ${qty} : la somme des pièces sera retenue.`);
            }
        }

        const key = norm([fournisseur, ref, coloris].join('|'));
        if (ref && existing.has(key)) warnings.push('Article déjà présent dans le stock : une nouvelle entrée sera ajoutée à côté.');
        if (ref && seen.has(key + '#' + locs.join(','))) warnings.push(`Doublon de la ligne ${seen.get(key + '#' + locs.join(','))} (même article, même emplacement).`);
        if (ref) seen.set(key + '#' + locs.join(','), i + 1);

        const finalQty = pieces.length ? round2(pieces.reduce((s, p) => s + p.qty, 0)) : (Number.isFinite(qty) ? round2(qty) : null);
        lines.push({
            row: i + 1,
            errors,
            warnings,
            data: {
                category, fournisseur: fournisseur || null, ref: ref || null, coloris: coloris || null, laize,
                // Libellé du stock : « référence — coloris » (comme une entrée manuelle)
                product: [ref, coloris].filter(Boolean).join(' — ') || fournisseur,
                qty: finalQty, unit, location: locs.join(', '), pieces, comment,
            },
        });
    }
    return { lines, fatal: lines.length ? null : 'Aucune ligne à importer dans ce fichier.' };
}

/** Modèle Excel d'ajout d'ancien stock (listes déroulantes + mode d'emploi + emplacements). */
export async function downloadAddTemplate(zones = []) {
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Stock à importer', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = TEMPLATE_COLUMNS.map(c => ({ header: c.title, key: c.key, width: c.width }));
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.height = 22;
    head.eachCell((cell, col) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2447' } };
        cell.alignment = { vertical: 'middle' };
        cell.note = TEMPLATE_COLUMNS[col - 1].help;
    });

    // Emplacements de l'entrepôt (onglet dédié, sert aussi à la liste déroulante)
    const zs = wb.addWorksheet('Emplacements');
    zs.columns = [{ header: 'Code', key: 'code', width: 12 }, { header: 'Description', key: 'desc', width: 40 }];
    zs.getRow(1).font = { bold: true };
    const codes = [...new Set(zones.map(z => clean(z.code || z)).filter(Boolean))].sort(compareLocations);
    codes.forEach(code => {
        const z = zones.find(x => clean(x.code || x) === code) || {};
        zs.addRow({ code, desc: clean(z.label_carte || z.description || [z.allee && `Allée ${z.allee}`, z.niveau_label].filter(Boolean).join(' · ')) });
    });

    const N = 1000; // lignes préparées
    const list = (arr) => `"${arr.join(',')}"`;
    const col = (key) => String.fromCharCode(65 + TEMPLATE_COLUMNS.findIndex(c => c.key === key));
    for (let r = 2; r <= N + 1; r++) {
        ws.getCell(`${col('category')}${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [list(IMPORT_CATEGORIES)], showErrorMessage: true, errorTitle: 'Catégorie', error: 'Choisissez dans la liste.' };
        ws.getCell(`${col('unit')}${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [list(IMPORT_UNITS)], showErrorMessage: true, errorTitle: 'Unité', error: 'ml, m2, u ou kg.' };
        if (codes.length) {
            // Liste des emplacements, sans bloquer (plusieurs codes « B3, C1 » restent possibles)
            ws.getCell(`${col('location')}${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`Emplacements!$A$2:$A$${codes.length + 1}`], showErrorMessage: false };
        }
        ws.getCell(`${col('qty')}${r}`).numFmt = '0.##';
        ws.getCell(`${col('laize')}${r}`).numFmt = '0';
    }

    // Mode d'emploi
    const help = wb.addWorksheet('Mode d’emploi');
    help.getColumn(1).width = 24;
    help.getColumn(2).width = 90;
    const lines = [
        ['Import d’ancien stock — Droitfil', ''],
        ['', ''],
        ['À quoi ça sert', 'Ajouter en une fois des articles déjà en stock, qui ne sont rattachés à aucun dossier Droitfil (stock libre).'],
        ['Comment faire', '1. Remplissez l’onglet « Stock à importer », une ligne par article (et par emplacement).'],
        ['', '2. Dans Droitfil › Inventaire › Importer › Ajouter de l’ancien stock, déposez ce fichier.'],
        ['', '3. Vérifiez l’aperçu (erreurs en rouge, avertissements en orange), puis importez.'],
        ['Colonnes obligatoires', 'Catégorie, Référence, Quantité, Unité, Emplacement (marquées d’un *).'],
        ['', ''],
        ...TEMPLATE_COLUMNS.map(c => [c.title.replace(' *', ''), c.help]),
        ['', ''],
        ['Bon à savoir', 'Ne modifiez pas les titres de la première ligne. Une ligne vide est ignorée.'],
        ['', 'Les articles importés apparaissent dans le journal avec le motif « Reprise ancien stock ».'],
    ];
    lines.forEach((l, i) => {
        const row = help.addRow(l);
        if (i === 0) row.font = { bold: true, size: 14 };
        else row.getCell(1).font = { bold: true };
        row.getCell(2).alignment = { wrapText: true };
    });

    saveWorkbook(wb, `Modele_import_stock_Droitfil.xlsx`);
}

// ——— Fichier de MISE À JOUR (export → réimport) ———————————————————————————

// ——— EXPORT paramétrable ———————————————————————————————————————————————————

/** Allée d'un emplacement (lettres du 1er code : « B3 » → « B ») ; repères pour le reste. */
export const AISLE_TO_COMPLETE = 'À compléter';
export const AISLE_NONE = 'Sans emplacement';
export function aisleOf(location) {
    const locs = splitLocations(location);
    if (locs.includes(LOC_A_COMPLETER)) return AISLE_TO_COMPLETE;
    const first = locs.sort(compareLocations)[0];
    if (!first) return AISLE_NONE;
    const m = first.match(/^[A-Za-zÀ-ÿ]+/);
    return m ? (m[0].length > 2 ? first.toUpperCase() : m[0].toUpperCase()) : first;
}

// Colonnes disponibles à l'export (jamais de prix d'achat).
export const EXPORT_COLUMNS = [
    { key: 'location', label: 'Emplacement', width: 16, get: (i) => i.location || '' },
    { key: 'category', label: 'Type', width: 12, get: (i) => i.category || 'Divers' },
    { key: 'fournisseur', label: 'Fournisseur', width: 18, get: (i) => i.fournisseur || '' },
    { key: 'ref', label: 'Référence', width: 24, get: (i) => i.ref || '' },
    { key: 'coloris', label: 'Coloris', width: 16, get: (i) => i.coloris || '' },
    { key: 'laize', label: 'Laize', width: 8, get: (i) => (i.laize ? Number(i.laize) || i.laize : '') },
    { key: 'product', label: 'Produit', width: 30, get: (i) => i.product || '' },
    { key: 'project', label: 'Affectation', width: 24, get: (i) => i.project || 'Stock libre' },
    { key: 'status', label: 'Statut', width: 12, get: (i, ctx) => ctx.statusOf?.(i) || '' },
    { key: 'qty', label: 'Quantité', width: 11, get: (i) => Number(i.qty) || 0 },
    { key: 'unit', label: 'Unité', width: 7, get: (i) => i.unit || '' },
    { key: 'pieces', label: 'Pièces', width: 22, get: (i) => (Array.isArray(i.pieces) && i.pieces.length ? i.pieces.map(p => fmtNum(p.qty)).join(' ; ') : '') },
];

// Usages de l'export : colonnes cochées par défaut, colonnes imposées.
export const EXPORT_USAGES = {
    update: {
        label: 'Mettre à jour / réimporter',
        hint: 'Colonnes jaunes à remplir (nouvelle quantité, nouvel emplacement), puis Importer › Mettre à jour le stock.',
        defaults: ['location', 'category', 'fournisseur', 'ref', 'coloris', 'laize', 'project', 'qty', 'unit'],
    },
    count: {
        label: 'Feuille de comptage (sur site)',
        hint: 'Triée par emplacement, une colonne « COMPTÉ » à remplir. Imprimable, et réimportable : le compté devient la nouvelle quantité.',
        defaults: ['location', 'fournisseur', 'ref', 'coloris', 'laize', 'qty', 'unit'],
    },
    view: {
        label: 'Consulter / envoyer',
        hint: 'État du stock lisible, sans colonne technique : à transmettre ou archiver.',
        defaults: ['location', 'category', 'fournisseur', 'ref', 'coloris', 'laize', 'project', 'status', 'qty', 'unit'],
    },
};

const fmtNum = (n) => String(round2(n)).replace('.', ',');
const YELLOW = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
const GREY = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F4' } };

/** Regroupe les entrées d'un même article (produit + référence), comme l'écran du stock. */
export function groupByArticle(items) {
    const groups = new Map();
    items.forEach(it => {
        const key = `${it.product}-${it.ref || ''}`;
        const g = groups.get(key);
        if (!g) groups.set(key, { ...it, qty: Number(it.qty) || 0, _locs: new Set(splitLocations(it.location)), _projects: new Set([it.project].filter(Boolean)), pieces: [...(it.pieces || [])] });
        else {
            g.qty = round2(g.qty + (Number(it.qty) || 0));
            splitLocations(it.location).forEach(l => g._locs.add(l));
            if (it.project) g._projects.add(it.project);
            g.pieces = [...g.pieces, ...(it.pieces || [])];
        }
    });
    return [...groups.values()].map(g => ({ ...g, location: [...g._locs].sort(compareLocations).join(', '), project: [...g._projects].sort().join(', ') }));
}

/**
 * Export Excel paramétrable.
 * @param {object} opts
 *   items       entrées à exporter (déjà filtrées)
 *   usage       'update' | 'count' | 'view'
 *   columns     clés de EXPORT_COLUMNS cochées
 *   splitAisles une feuille par allée
 *   groupItems  (consulter) une ligne par article
 *   statusOf    (item) → libellé du statut
 *   title       titre du fichier (périmètre)
 */
export async function exportStock({ items, usage = 'update', columns, splitAisles = false, groupItems = false, statusOf, title = '' }) {
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ctx = { statusOf };
    const cols = EXPORT_COLUMNS.filter(c => columns.includes(c.key));
    const rows = (usage === 'view' && groupItems ? groupByArticle(items) : [...items]).sort(stockSortCompare);
    const date = new Date().toLocaleDateString('fr-FR');

    // Colonnes de la feuille selon l'usage (ID et colonnes à remplir imposés pour réimporter)
    const sheetColumns = [];
    if (usage !== 'view') sheetColumns.push({ header: 'ID', key: 'id', width: 8 });
    cols.forEach(c => {
        const header = usage === 'update' && c.key === 'qty' ? 'Quantité actuelle'
            : usage === 'update' && c.key === 'location' ? 'Emplacement actuel'
            : usage === 'count' && c.key === 'qty' ? 'Quantité attendue'
            : c.label;
        sheetColumns.push({ header, key: c.key, width: c.width });
    });
    if (usage === 'update') {
        sheetColumns.push({ header: 'NOUVELLE QUANTITÉ', key: '_newQty', width: 20 }, { header: 'NOUVEL EMPLACEMENT', key: '_newLoc', width: 22 });
    } else if (usage === 'count') {
        sheetColumns.push({ header: 'COMPTÉ', key: '_newQty', width: 12 }, { header: 'NOUVEL EMPLACEMENT', key: '_newLoc', width: 20 }, { header: 'Remarque', key: '_note', width: 28 });
    }

    const groups = splitAisles ? groupBy(rows, r => aisleOf(r.location)) : [[usage === 'count' ? 'Comptage' : 'Stock', rows]];
    groups.forEach(([name, list]) => {
        const ws = wb.addWorksheet(sheetName(name), {
            views: [{ state: 'frozen', ySplit: 1 }],
            pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, printTitlesRow: '1:1' },
            headerFooter: { oddHeader: `&L${usage === 'count' ? 'Comptage du stock' : 'Stock'}${title ? ' — ' + title : ''}&R${date}`, oddFooter: '&RPage &P / &N' },
        });
        ws.columns = sheetColumns;
        const head = ws.getRow(1);
        head.font = { bold: true };
        head.eachCell((cell, i) => { cell.fill = /^(NOUVELLE|NOUVEL|COMPTÉ)/.test(sheetColumns[i - 1].header) ? YELLOW : GREY; });
        list.forEach(it => {
            const data = { id: it.id };
            cols.forEach(c => { data[c.key] = c.get(it, ctx); });
            const row = ws.addRow(data);
            if (usage !== 'view') {
                row.getCell('_newQty').fill = YELLOW;
                row.getCell('_newLoc').fill = YELLOW;
                row.getCell('id').font = { color: { argb: 'FF9CA3AF' }, size: 8 };
            }
            if (usage === 'count') row.height = 22; // place pour écrire à la main
        });
        if (usage === 'count') ws.eachRow(r => r.eachCell({ includeEmpty: true }, c => { c.border = { bottom: { style: 'thin', color: { argb: 'FFE0DED9' } } }; }));
    });

    const notes = wb.addWorksheet('Mode d\u2019emploi');
    notes.getColumn(1).width = 100;
    const guide = usage === 'update' ? [
        'Mise à jour du stock — Droitfil',
        '',
        '• Remplissez UNIQUEMENT les colonnes jaunes, et seulement pour les articles qui changent.',
        '• Case vide = pas de changement. « 0 » = l’article est épuisé (sortie totale).',
        '• Nouvelle quantité plus basse = sortie de stock ; plus haute = ajustement d’inventaire (+).',
        '• Nouvel emplacement : code(s) de rangement (A1, B3…), plusieurs séparés par une virgule.',
        '• Ne modifiez pas la colonne ID ni les titres.',
        '• Réimport : Droitfil › Inventaire › Importer › Mettre à jour le stock. Un aperçu s’affiche avant d’appliquer.',
        '• Si le stock a bougé entre l’export et l’import, seul l’écart saisi est appliqué.',
    ] : usage === 'count' ? [
        'Comptage du stock — Droitfil',
        '',
        '• Comptez sur place et notez la quantité réelle dans « COMPTÉ » (case vide = pas compté, aucun changement).',
        '• Article rangé ailleurs : notez le bon code dans « NOUVEL EMPLACEMENT ».',
        '• Article trouvé mais absent de la liste : à ajouter avec Importer › Ajouter de l’ancien stock.',
        '• Réimport : Droitfil › Inventaire › Importer › Mettre à jour le stock (toutes les feuilles sont lues).',
        '• L’écart COMPTÉ − attendu est appliqué : sortie si moins, ajustement si plus.',
        '• Ne modifiez pas la colonne ID ni les titres.',
    ] : [
        `État du stock — Droitfil${title ? ' — ' + title : ''}`,
        `Exporté le ${date}.`,
    ];
    guide.forEach((t, i) => { const r = notes.addRow([t]); if (i === 0) r.font = { bold: true, size: 14 }; });

    const kind = usage === 'update' ? 'MAJ' : usage === 'count' ? 'Comptage' : 'Etat';
    saveWorkbook(wb, `Stock_${kind}_Droitfil_${date.replace(/\//g, '-')}.xlsx`);
}

/** Export rapide « mise à jour » (toutes les colonnes utiles). */
export const exportStockForUpdate = (items) => exportStock({ items, usage: 'update', columns: EXPORT_USAGES.update.defaults });

const groupBy = (list, fn) => {
    const m = new Map();
    list.forEach(x => { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); });
    return [...m.entries()].sort((a, b) => {
        const rank = (k) => (k === AISLE_TO_COMPLETE ? 0 : k === AISLE_NONE ? 2 : 1);
        return rank(a[0]) - rank(b[0]) || compareLocations(a[0], b[0]);
    });
};
// Nom de feuille Excel : 31 caractères, sans / \\ ? * [ ]
const sheetName = (n) => String(n).replace(/[\\/?*[\]:]/g, '-').slice(0, 31) || 'Stock';

/**
 * Lit et contrôle un fichier de mise à jour.
 * Écart appliqué = (quantité exportée → nouvelle quantité) ; si le stock a bougé depuis
 * l'export, on applique cet écart au stock ACTUEL plutôt que d'écraser.
 * @returns {{ lines: Array, fatal: string|null }}
 *   ligne : { row, item, newQty, delta, newLocation, locChanged, errors, warnings }
 */
export function analyzeUpdateFile(rows, { inventory = [], zones = [] } = {}) {
    const head = mapHeaders(rows, UPDATE_HEADER_KEYS);
    if (!head || head.map.id === undefined || head.map.newQty === undefined) {
        return { lines: [], fatal: "Ce fichier n'est pas un export de l'inventaire (colonnes « ID » et « NOUVELLE QUANTITÉ » introuvables)." };
    }
    const byId = new Map(inventory.map(i => [String(i.id), i]));
    const knownZones = new Set(zones.map(z => clean(z).toUpperCase()));
    const get = (r, k) => (head.map[k] === undefined ? null : r[head.map[k]]);
    const lines = [];

    for (let i = head.headerRow + 1; i < rows.length; i++) {
        const r = rows[i] || [];
        const id = clean(get(r, 'id'));
        if (!id) continue;
        const rawNew = get(r, 'newQty');
        const rawLoc = clean(get(r, 'newLocation'));
        const newQtyIn = parseNumber(rawNew);
        // Ancien format (avant ce module) : nouvelle quantité pré-remplie = quantité actuelle → pas de changement
        if (newQtyIn === null && !rawLoc) continue;

        const errors = [], warnings = [];
        const item = byId.get(id);
        if (!item) {
            lines.push({ row: i + 1, item: { id, product: clean(get(r, 'product')) }, errors: ['Article introuvable dans le stock (supprimé ou fichier d’un autre stock).'], warnings, delta: 0, locChanged: false });
            continue;
        }
        const current = Number(item.qty) || 0;
        const exported = parseNumber(get(r, 'oldQty'));
        let newQty = null, delta = 0;
        if (newQtyIn !== null) {
            if (Number.isNaN(newQtyIn)) errors.push(`Nouvelle quantité illisible (« ${clean(rawNew)} »).`);
            else if (newQtyIn < 0) errors.push('Nouvelle quantité négative.');
            else {
                const base = Number.isFinite(exported) ? exported : current;
                delta = round2(newQtyIn - base);
                newQty = round2(Math.max(0, current + delta));
                if (Number.isFinite(exported) && Math.abs(exported - current) > 0.001) {
                    warnings.push(`Stock modifié depuis l'export (${exported} → ${current} ${item.unit || ''}) : seul l'écart saisi (${delta > 0 ? '+' : ''}${delta}) est appliqué.`);
                }
                // Article détaillé en pièces : sa quantité est la somme des pièces, recalculée au
                // prochain mouvement → un changement de quantité par Excel serait perdu.
                if (Array.isArray(item.pieces) && item.pieces.length > 0 && delta !== 0) {
                    errors.push(`Article détaillé en ${item.pieces.length} pièce(s) : changez sa quantité dans l'appli (Sortie / édition des pièces), pas par Excel.`);
                }
            }
        }
        const newLocation = rawLoc ? splitLocations(rawLoc.toUpperCase()).join(', ') : null;
        const locChanged = !!newLocation && newLocation !== splitLocations(item.location).join(', ');
        if (locChanged && knownZones.size) {
            const unknown = splitLocations(newLocation).filter(l => !knownZones.has(l));
            if (unknown.length) warnings.push(`Emplacement ${unknown.join(', ')} absent du plan de l'entrepôt.`);
        }
        if (!errors.length && delta === 0 && !locChanged) continue; // rien ne change
        lines.push({ row: i + 1, item, newQty, delta, newLocation, locChanged, errors, warnings });
    }
    return { lines, fatal: null };
}

/** Toutes les feuilles d'un fichier : [{ name, rows }] (feuille de comptage par allée). */
export async function readAllSheets(file) {
    const { default: readXlsxFile, readSheetNames } = await import('read-excel-file');
    const names = await readSheetNames(file);
    const out = [];
    for (const name of names) out.push({ name, rows: await readXlsxFile(file, { sheet: name }) });
    return out;
}

/** Lecture brute d'un fichier Excel (1re feuille par défaut). */
export async function readExcelRows(file, sheet) {
    const { default: readXlsxFile } = await import('read-excel-file');
    return sheet ? readXlsxFile(file, { sheet }) : readXlsxFile(file);
}

async function saveWorkbook(wb, filename) {
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}
