// Modale « Stock » du dossier — logique pure (aucun appel réseau) :
//  1. besoins du projet : total ML par tissu calculé avec les formules du BPF (rideaux,
//     cf. bpfMetrage.js : cotes de pose, ou cotes du plan tant qu'elles ne sont pas prises) ;
//  2. rapprochement besoins ↔ liste de courses Odoo (noms tapés différemment) ;
//  3. comparatif besoin / commandé / reçu avec un statut par tissu.

// Champs textiles des lignes de production : [champ nom, champ(s) ML, rôle affiché].
// Les rideaux ont leurs propres noms de champs, les autres produits la forme `tissu_1`.
import { bpfMl, storeMl, isRideauRow, hasPoseCotes } from './bpfMetrage.js';

export const TEXTILE_FIELDS = [
    ['tissu_deco1', ['ml_tissu1'], 'Tissu 1'],
    ['tissu_deco2', ['ml_tissu2'], 'Tissu 2'],
    ['tissu_1', ['ml_tissu_1'], 'Tissu 1'],
    ['tissu_2', ['ml_tissu_2'], 'Tissu 2'],
    ['doublure', ['ml_doublure'], 'Doublure'],
    ['inter_doublure', ['ml_inter_doublure', 'ml_interdoublure'], 'Interdoublure'],
    ['interdoublure', ['ml_interdoublure', 'ml_inter_doublure'], 'Interdoublure'],
    ['passementerie1', ['ml_pass1'], 'Passementerie 1'],
    ['passementerie2', ['ml_pass2'], 'Passementerie 2'],
    ['passementerie_1', ['ml_pass_1'], 'Passementerie 1'],
    ['passementerie_2', ['ml_pass_2'], 'Passementerie 2'],
    ['molleton', ['ml_molleton'], 'Molleton'],
    ['toile_finition_1', ['ml_toile_finition_1'], 'Toile'],
];

// Statuts Odoo comptés comme « commandé » : tout sauf « problème » (choix du user).
export const isOrdered = (line) => line.statut !== 'probleme' && !line.removed_from_odoo;
// Reçu d'une ligne de courses : quantité réellement reçue d'après Odoo (réception partielle comprise)
// si elle est dans la même unité que la ligne ; sinon toute la ligne une fois « Réceptionné ».
const sameUnit = (a, b) => !a || !b || String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
export const receivedQty = (l) => (Number(l.quantite_commandee) > 0 && sameUnit(l.unite, l.purchase_uom)
    ? num(l.quantite_recue)
    : (l.statut === 'receptionne' ? num(l.quantite) : 0));
export const IGNORE_MATCH = '__ignore__';
export const JUSTE_MARGIN = 0.05; // ±5 % autour du besoin = « Juste »

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const num = (v) => {
    const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
    return Number.isFinite(n) ? n : 0;
};
export const needKey = (name) => String(name || '').trim().replace(/\s+/g, ' ').toUpperCase();

/** Libellé d'une ligne BPF pour le détail « généré par ». */
const rowLabel = (row, index) => [row.piece, row.produit].filter(Boolean).join(' · ') || `Ligne ${index + 1}`;

/**
 * Besoins du projet : un total ML par tissu, avec le détail des lignes qui le génèrent.
 * @returns {Array<{key, name, total, inMaterials, material, sources:[{rowId, label, zone, role, ml}]}>}
 */
export function computeNeeds(rows = [], materials = []) {
    const matByKey = new Map(materials.map((m) => [needKey(m.name), m]));
    const needs = new Map();
    rows.forEach((row, index) => {
        if (!row) return;
        const seen = new Set(); // inter_doublure / interdoublure : ne compter qu'une fois
        TEXTILE_FIELDS.forEach(([nameField, mlFields, role]) => {
            const name = row[nameField];
            if (!name || typeof name !== 'string' || !name.trim()) return;
            if (seen.has(role)) return;
            // Rideaux : formules du BPF ; stores au nouveau métrage : calcul du store (ML exact) ;
            // sinon (passementerie, autres produits) : métrage saisi.
            const fromStore = storeMl(row, mlFields[0]);
            const fromBpf = fromStore != null ? null : bpfMl(row, mlFields[0]);
            const ml = fromStore != null ? fromStore : fromBpf != null ? fromBpf : num(mlFields.map((f) => row[f]).find((v) => v != null && v !== ''));
            const basis = fromStore != null ? 'store' : fromBpf == null ? 'saisie' : hasPoseCotes(row) ? 'cotes' : 'plan';
            if (!(ml > 0)) return;
            seen.add(role);
            const key = needKey(name);
            if (!needs.has(key)) {
                const material = matByKey.get(key) || null;
                needs.set(key, { key, name: material?.name || name.trim(), total: 0, storesMl: 0, inMaterials: !!material, material, sources: [] });
            }
            const n = needs.get(key);
            if (fromStore != null) n.storesMl += ml;
            else n.total = round2(n.total + ml);
            n.sources.push({ rowId: row.id, label: rowLabel(row, index), zone: row.zone || '', role, ml: round2(ml), basis, rideau: isRideauRow(row) });
        });
    });
    // Stores : leur métrage exact est arrondi au demi-mètre supérieur une seule fois par tissu.
    needs.forEach((n) => {
        if (n.storesMl > 0) {
            n.total = round2(n.total + Math.ceil(n.storesMl * 2 - 1e-9) / 2);
            n.arrondiStores = true;
        }
        delete n.storesMl;
    });
    return [...needs.values()].sort((a, b) => b.total - a.total);
}

// --- Rapprochement des noms -------------------------------------------------

// Mots sans valeur d'identification (annotations de saisie, mots de liaison).
const NOISE = new Set(['VOIR', 'CMD', 'COMMANDE', 'ROLL', 'OUT', 'CONFIRMER', 'PAR', 'AM', 'N', 'NO', 'A', 'DE', 'DU', 'LA', 'LE', 'LES', 'ET', 'SAS', 'SA', 'SPA', 'SALES', 'NV', 'GMBH', 'SRL', 'COL', 'COLORIS', 'REF']);

export const tokens = (s) => String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t && !NOISE.has(t));

// Un code (contient un chiffre) identifie bien plus qu'un mot.
const weight = (t) => (/\d/.test(t) ? 3 : 1);
const weightOf = (set) => [...set].reduce((s, t) => s + weight(t), 0);

/** Similarité 0..1 (Dice pondéré) entre un besoin et une ligne de courses. */
export function matchScore(need, line) {
    const a = new Set(tokens(need.name));
    const b = new Set(tokens([line.fournisseur, line.reference, line.coloris].filter(Boolean).join(' ')));
    if (!a.size || !b.size) return 0;
    let common = 0;
    a.forEach((t) => { if (b.has(t)) common += weight(t); });
    let score = (2 * common) / (weightOf(a) + weightOf(b));
    // Même laize : léger bonus pour départager deux candidats proches.
    const laize = num(need.material?.width);
    if (laize > 0 && num(line.laize) === laize) score += 0.05;
    return Math.min(1, score);
}

export const MATCH_THRESHOLD = 0.35;

/**
 * Associe chaque ligne de courses à un besoin : le choix manuel (`besoin_match`) prime,
 * sinon le besoin le plus ressemblant au-dessus du seuil. Plusieurs lignes peuvent
 * alimenter un même besoin (un tissu commandé en plusieurs fois).
 * @returns {Map<odoo_id, {needKey|null, score, mode:'manual'|'auto'|'ignored'|'none'}>}
 */
export function matchCourseLines(needs, courseLines) {
    const byKey = new Map(needs.map((n) => [n.key, n]));
    const out = new Map();
    courseLines.forEach((line) => {
        const manual = line.besoin_match;
        if (manual === IGNORE_MATCH) return out.set(line.odoo_id, { needKey: null, score: 0, mode: 'ignored' });
        if (manual && byKey.has(manual)) return out.set(line.odoo_id, { needKey: manual, score: 1, mode: 'manual' });
        let best = null;
        needs.forEach((n) => {
            const s = matchScore(n, line);
            if (!best || s > best.score) best = { needKey: n.key, score: s };
        });
        if (best && best.score >= MATCH_THRESHOLD) out.set(line.odoo_id, { ...best, mode: 'auto' });
        else out.set(line.odoo_id, { needKey: null, score: best?.score || 0, mode: 'none' });
    });
    return out;
}

/** Statut d'un tissu à partir du besoin et du commandé. */
export function comparisonStatus(need, ordered) {
    if (!(need > 0)) return ordered > 0 ? 'extra' : 'none';
    if (!(ordered > 0)) return 'missing';
    const diff = ordered - need;
    if (Math.abs(diff) <= need * JUSTE_MARGIN) return 'juste';
    return diff > 0 ? 'ok' : 'short';
}

/**
 * Comparatif : une ligne par besoin (+ les lignes de courses non rattachées).
 * @returns {{ rows: Array, unmatched: Array, matches: Map }}
 */
export function buildComparison(needs, courseLines) {
    // Tissus uniquement (doublures, passementeries… sont typés « tissu » dans Odoo).
    const lines = courseLines.filter((l) => !l.removed_from_odoo && l.type_produit === 'tissu');
    const matches = matchCourseLines(needs, lines);
    const rows = needs.map((n) => {
        const linked = lines.filter((l) => matches.get(l.odoo_id)?.needKey === n.key);
        const counted = linked.filter(isOrdered);
        const ordered = round2(counted.reduce((s, l) => s + num(l.quantite), 0));
        const toOrder = round2(counted.filter((l) => l.statut === 'a_commander' || l.statut === 'verifier_stock').reduce((s, l) => s + num(l.quantite), 0));
        const received = round2(linked.reduce((s, l) => s + receivedQty(l), 0));
        return { need: n, linked, ordered, toOrder, received, diff: round2(ordered - n.total), status: comparisonStatus(n.total, ordered) };
    });
    const unmatched = lines.filter((l) => !matches.get(l.odoo_id)?.needKey);
    return { rows, unmatched, matches };
}
