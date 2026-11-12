// Occupation de l'entrepôt, en nombre de rouleaux (même règle que le tableau de bord du
// stock) : un tissu compte une pièce = un rouleau, ou un rouleau s'il n'est pas détaillé ;
// un niveau « palettes » se convertit en rouleaux selon la laize de la zone.
import { LOC_A_COMPLETER, splitLocations } from '../inventory/stockFields';

// ── Laizes ───────────────────────────────────────────────────────────────────
/** Grande laize à partir de 250 cm (règle unique, reprise par la tablette stock). */
export const GRANDE_LAIZE_CM = 250;
/** Contenu d'une palette : 15 rouleaux en grande laize, 20 en petite (ou laize inconnue / zone mixte). */
export const PALETTE_ROULEAUX_GRANDE_LAIZE = 15;
export const PALETTE_ROULEAUX_PETITE_LAIZE = 20;

/** Types de laize d'une zone (warehouse_zones.laize_type). Zone mixte : capacité non ventilée. */
export const ZONE_LAIZE_TYPES = [
    { key: 'grande', label: 'Grandes laizes', short: 'GL' },
    { key: 'petite', label: 'Petites laizes', short: 'PL' },
    { key: 'mixte', label: 'Mixte', short: null },
];
const ZONE_LAIZE_KEYS = new Set(ZONE_LAIZE_TYPES.map(t => t.key));
/** Type de laize d'une zone ; « mixte » par défaut (colonne absente ou vide). */
export const zoneLaizeType = (zone) => (ZONE_LAIZE_KEYS.has(zone?.laize_type) ? zone.laize_type : 'mixte');

/** Laize en cm d'un article (« 300 », « 300 cm », 280) ; null si inconnue. */
export function laizeCm(v) {
    if (v === null || v === undefined || v === '') return null;
    const m = /(\d+(?:[.,]\d+)?)/.exec(String(v));
    const n = m ? Number(m[1].replace(',', '.')) : NaN;
    return n > 0 ? n : null;
}
/** Classe de laize d'un article : 'grande', 'petite' ou null (inconnue). */
export function laizeClassOf(item) {
    const cm = laizeCm(item?.laize);
    return cm === null ? null : cm >= GRANDE_LAIZE_CM ? 'grande' : 'petite';
}

/** Rouleaux d'un article de stock (0 si épuisé ou si ce n'est pas un tissu). */
export function rollsOf(item) {
    if (!item || item.category !== 'Tissu' || !(Number(item.qty) > 0)) return 0;
    return Array.isArray(item.pieces) && item.pieces.length > 0 ? item.pieces.length : 1;
}

/** Emplacements hors entrepôt : ce qui y est n'occupe pas les rayonnages. */
export const OUTSIDE_WAREHOUSE = new Set(['ATELIER']);

/**
 * Rouleaux d'un article qui occupent l'entrepôt : un article à l'atelier ne compte pas ;
 * réparti (« ATELIER, B3 »), seule la part hors atelier compte. Sans emplacement
 * (ou « À COMPLÉTER »), il est supposé dans l'entrepôt.
 */
export function warehouseRollsOf(item) {
    const rolls = rollsOf(item);
    if (!rolls) return 0;
    const locs = splitLocations(item.location);
    if (!locs.length) return rolls;
    const inside = locs.filter(l => !OUTSIDE_WAREHOUSE.has(l.toUpperCase())).length;
    return rolls * inside / locs.length;
}

/** Rouleaux en stock DANS l'entrepôt (tissus non épuisés, hors atelier). */
export const countRouleaux = (inventory = []) =>
    Math.round(inventory.reduce((acc, it) => acc + warehouseRollsOf(it), 0) * 10) / 10;

/** Capacité d'un emplacement en rouleaux (palettes converties), null si non définie. */
export function capacityInRolls(zone) {
    if (!zone?.capacite) return null;
    if (zone.type === 'palettes') {
        const perPalette = zoneLaizeType(zone) === 'grande' ? PALETTE_ROULEAUX_GRANDE_LAIZE : PALETTE_ROULEAUX_PETITE_LAIZE;
        return zone.capacite * perPalette;
    }
    if (zone.type === 'rouleaux' || zone.type === 'reception') return zone.capacite;
    return null;
}

/** Capacité totale de l'entrepôt en rouleaux. */
export const totalCapacity = (zones = []) => zones.reduce((acc, z) => acc + (capacityInRolls(z) || 0), 0);

/**
 * Occupation par emplacement.
 * Un article rangé à plusieurs endroits (« B3, C1 ») est réparti à parts égales.
 * @returns {Map<string, { code, rolls, items: Array, capacity, pct, zone }>}
 */
export function occupancyByCode(inventory = [], zones = []) {
    const byCode = new Map();
    const zoneOf = new Map(zones.map(z => [z.code, z]));
    const get = (code) => {
        if (!byCode.has(code)) {
            const zone = zoneOf.get(code) || null;
            byCode.set(code, { code, rolls: 0, items: [], capacity: capacityInRolls(zone), pct: 0, zone });
        }
        return byCode.get(code);
    };
    zones.forEach(z => { if (z.is_storage !== false) get(z.code); });
    inventory.forEach(it => {
        if (!(Number(it.qty) > 0)) return;
        const locs = splitLocations(it.location);
        if (!locs.length) return;
        const share = rollsOf(it) / locs.length;
        locs.forEach(code => {
            const o = get(code);
            o.rolls += share;
            o.items.push(it);
        });
    });
    byCode.forEach(o => {
        o.rolls = Math.round(o.rolls * 10) / 10;
        o.pct = o.capacity ? Math.min(1, o.rolls / o.capacity) : (o.items.length ? 0.5 : 0);
    });
    return byCode;
}

export const TO_COMPLETE = LOC_A_COMPLETER;

/**
 * Capacité et occupation de l'entrepôt par type de zone : grandes laizes, petites laizes,
 * « non ventilé » (zones mixtes, emplacements inconnus, articles sans emplacement).
 * Même comptage que countRouleaux (atelier exclu, article réparti à parts égales) :
 * la somme des trois lignes égale le total.
 * @returns {{ rows: [{ key, label, rolls, capacity, pct }], total: { rolls, capacity, pct } }}
 */
export function laizeBreakdown(inventory = [], zones = []) {
    const zoneOf = new Map(zones.map(z => [z.code, z]));
    const rows = {
        grande: { key: 'grande', label: 'Grandes laizes', rolls: 0, capacity: 0 },
        petite: { key: 'petite', label: 'Petites laizes', rolls: 0, capacity: 0 },
        none: { key: 'none', label: 'Non ventilé', rolls: 0, capacity: 0 },
    };
    const bucketOfZone = (z) => { const t = zoneLaizeType(z); return t === 'mixte' ? 'none' : t; };
    zones.forEach(z => { const c = capacityInRolls(z); if (c) rows[bucketOfZone(z)].capacity += c; });
    inventory.forEach(it => {
        const rolls = rollsOf(it);
        if (!rolls) return;
        const locs = splitLocations(it.location);
        if (!locs.length) { rows.none.rolls += rolls; return; }
        const share = rolls / locs.length;
        locs.forEach(code => {
            if (OUTSIDE_WAREHOUSE.has(code.toUpperCase())) return;
            const z = zoneOf.get(code);
            rows[z ? bucketOfZone(z) : 'none'].rolls += share;
        });
    });
    const r1 = (n) => Math.round(n * 10) / 10;
    const out = Object.values(rows).map(r => ({ ...r, rolls: r1(r.rolls), pct: r.capacity ? r.rolls / r.capacity : null }));
    const rolls = r1(out.reduce((s, r) => s + r.rolls, 0));
    const capacity = out.reduce((s, r) => s + r.capacity, 0);
    return { rows: out, total: { rolls, capacity, pct: capacity ? rolls / capacity : null } };
}

/**
 * Alerte de rangement (information, rien n'est bloqué) : tissus de grande laize rangés dans une
 * zone « petite », et inversement. Laize inconnue ou zone mixte : pas d'alerte.
 * @returns {{ entries: [{ item, code, laize, zoneType, rolls }], rolls, grandeInPetite, petiteInGrande }}
 */
export function misplacedRolls(inventory = [], zones = []) {
    const zoneOf = new Map(zones.map(z => [z.code, z]));
    const entries = [];
    inventory.forEach(it => {
        const rolls = rollsOf(it);
        const cls = laizeClassOf(it);
        if (!rolls || !cls) return;
        const locs = splitLocations(it.location);
        locs.forEach(code => {
            const z = zoneOf.get(code);
            const t = z ? zoneLaizeType(z) : 'mixte';
            if (t === 'mixte' || t === cls) return;
            entries.push({ item: it, code, laize: laizeCm(it.laize), itemClass: cls, zoneType: t, rolls: rolls / locs.length });
        });
    });
    const sum = (f) => Math.round(entries.filter(f).reduce((s, e) => s + e.rolls, 0) * 10) / 10;
    return {
        entries: entries.sort((a, b) => a.code.localeCompare(b.code) || String(a.item.product).localeCompare(String(b.item.product))),
        rolls: sum(() => true),
        grandeInPetite: sum(e => e.itemClass === 'grande'),
        petiteInGrande: sum(e => e.itemClass === 'petite'),
    };
}

/** Couleur d'occupation : bleu ciel (vide) → bleu nuit (plein), nuancier Droitfil. */
const STOPS = [[0, [238, 244, 253]], [0.35, [168, 194, 236]], [0.65, [91, 127, 196]], [0.85, [52, 80, 143]], [1, [30, 36, 71]]];
export function occupancyColor(pct) {
    const p = Math.max(0, Math.min(1, pct || 0));
    for (let i = 1; i < STOPS.length; i++) {
        if (p <= STOPS[i][0]) {
            const [p0, c0] = STOPS[i - 1], [p1, c1] = STOPS[i];
            const t = (p - p0) / (p1 - p0 || 1);
            const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
            return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
        }
    }
    return 'rgb(30, 36, 71)';
}
