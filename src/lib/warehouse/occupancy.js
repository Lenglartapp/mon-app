// Occupation de l'entrepôt, en nombre de rouleaux (même règle que le tableau de bord du
// stock) : un tissu compte une pièce = un rouleau, ou un rouleau s'il n'est pas détaillé ;
// un niveau « palettes » vaut 10 rouleaux par palette.
import { LOC_A_COMPLETER, splitLocations } from '../inventory/stockFields';

export const PALETTE_TO_ROULEAUX = 10;

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
    if (zone.type === 'palettes') return zone.capacite * PALETTE_TO_ROULEAUX;
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
