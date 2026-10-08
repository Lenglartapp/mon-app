// Métrages des rideaux pour les besoins du dossier : calculés avec les formules du BPF
// (getters de production), et non plus lus sur la ligne — le métrage enregistré est celui
// du chiffrage, recalculé à la mise en projet avec d'anciennes formules.
//
// Ligne dont les cotes de pose sont prises (une HSPF au moins) : formules du BPF sur ces cotes.
// Sinon : mêmes formules sur les cotes du PLAN (Hauteur du chiffrage → HSPF = Hauteur +
// déduction rail), ce qui redonne le métrage du chiffrage (à l'arrondi 0,5 m près).

import { RIDEAUX_PROD_SCHEMA } from '../schemas/production/rideaux.js';
import { storeMetrage } from '../schemas/production/stores_bateaux.js';
import { isStoresMetrageRow } from '../formulas/storesBateauxMetrage.js';

const getterOf = (key) => RIDEAUX_PROD_SCHEMA.find((c) => c.key === key)?.valueGetter || null;
const toNum = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

// Champ ML des besoins → colonne calculée du BPF.
const BPF_ML = {
    ml_tissu1: 'ml_tissu1',
    ml_tissu2: 'ml_tissu2',
    ml_doublure: 'ml_doublure',
    ml_inter_doublure: 'ml_inter_doublure',
    ml_interdoublure: 'ml_inter_doublure',
};

export const isRideauRow = (row) => /rideau|voilage/i.test(String(row?.produit || ''));

/** Store bateau / velum au nouveau métrage : ML de la toile et de la doublure calculés. */
export const isStoreCalcRow = (row) => isStoresMetrageRow(row) && /bateau|velum|vélum/i.test(String(row?.produit || ''));

/**
 * ML exact (non arrondi) d'un store au nouveau métrage pour un champ de besoin, ou `null`.
 * L'arrondi au demi-mètre se fait une fois par tissu, dans les besoins.
 */
export function storeMl(row, mlField) {
    if (!isStoreCalcRow(row)) return null;
    if (mlField === 'ml_toile_finition_1') return row.toile_finition_1 ? storeMetrage(row).ml : 0;
    if (mlField === 'ml_doublure') return String(row.doublure || '').trim() ? storeMetrage(row, 'doublure').ml : 0;
    return null;
}

/** Cotes de pose prises sur la ligne (au moins une HSPF renseignée). */
export const hasPoseCotes = (row) => [row?.hspf_droite, row?.hspf_milieu, row?.hspf_gauche].some((v) => toNum(v) > 0);

/** Cotes validées par le chef de projet. */
export const isCoteValidated = (row) => row?.statut_cotes === 'Validé par chef de projet';

// Ligne vue par les formules du BPF : noms de champs d'interdoublure du chiffrage acceptés,
// et cotes du plan quand celles de pose manquent.
function bpfRow(row) {
    const r = {
        ...row,
        inter_doublure: row.inter_doublure || row.interdoublure,
        laize_inter: row.laize_inter || row.laize_interdoublure,
    };
    if (hasPoseCotes(row)) return r;
    const hspf = toNum(row.hauteur) + toNum(row.valeur_deduction || row.val_ded_rail);
    return { ...r, hspf_droite: hspf, hspf_milieu: hspf, hspf_gauche: hspf };
}

/**
 * ML d'un rideau pour un champ de besoin (ml_tissu1, ml_doublure…), d'après le BPF.
 * Renvoie `null` si le champ n'a pas de formule BPF (passementerie, autres produits) :
 * on garde alors la valeur de la ligne.
 */
export function bpfMl(row, mlField) {
    const key = BPF_ML[mlField];
    if (!key || !isRideauRow(row)) return null;
    const get = getterOf(key);
    if (!get) return null;
    const v = Number(get(undefined, bpfRow(row)));
    return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

/**
 * État des cotes des rideaux du dossier, pour la note des besoins :
 * 'validated' (toutes validées), 'complete' (toutes prises), 'partial', 'plan' (aucune), ou null (pas de rideau).
 */
export function cotesBasis(rows = []) {
    const rideaux = rows.filter((r) => r && isRideauRow(r));
    if (!rideaux.length) return { state: null, total: 0, withCotes: 0, validated: 0 };
    const withCotes = rideaux.filter(hasPoseCotes).length;
    const validated = rideaux.filter(isCoteValidated).length;
    const state = validated === rideaux.length ? 'validated'
        : withCotes === rideaux.length ? 'complete'
            : withCotes === 0 ? 'plan' : 'partial';
    return { state, total: rideaux.length, withCotes, validated };
}
