// src/lib/utils/matiereClear.js
// Règle « retirer un tissu vide ses informations » (tous les tableaux, production et chiffrage).
// Quand le NOM d'une matière est vidé, ses informations SAISIES (laize, raccords, métrage tapé
// à la main, PA / PV…) sont vidées dans la même ligne. Les champs CALCULÉS ne sont pas touchés :
// ils retombent d'eux-mêmes à vide ou à 0 sans la matière.
import { ALL_MATIERE_GROUPS } from '../constants/matiereGroups';

// Jamais vidés : « H. Coupe T1 » dépend du rideau (hauteur, tête, ourlets) et la doublure la reprend.
const KEEP = new Set(['hauteur_coupe']);

// Nom de matière → informations liées (union des groupes qui commencent par ce nom).
const LINKED = new Map();
for (const g of ALL_MATIERE_GROUPS) {
    const [name, ...rest] = g.fields;
    const set = LINKED.get(name) || new Set();
    rest.forEach(f => set.add(f));
    LINKED.set(name, set);
}

export const isMatiereNameKey = (key) => LINKED.has(key);

const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';

// Colonne saisissable pour cette ligne (mêmes règles que schemaToGridCols).
function isInputCol(col, row) {
    if (!col || col.type === 'formula') return false;
    if (typeof col.readOnly === 'function') return !col.readOnly(row || {});
    if (col.editable !== undefined) {
        return typeof col.editable === 'function' ? !!col.editable({ row: row || {} }) : !!col.editable;
    }
    return !col.readOnly;
}

/** Champs à vider quand `nameKey` passe de rempli à vide. [] si rien à faire. */
export function fieldsToClearOnRemove(nameKey, oldVal, newVal, schema, row) {
    if (!LINKED.has(nameKey) || isEmpty(oldVal) || !isEmpty(newVal)) return [];
    const byKey = new Map((schema || []).map(c => [c.key, c]));
    return [...LINKED.get(nameKey)].filter(k => !KEEP.has(k) && isInputCol(byKey.get(k), row));
}

/** Applique la règle sur `row` (copie) : champs vidés + surcharges de formule retirées. */
export function clearRemovedMatiere(row, nameKey, oldVal, newVal, schema) {
    const keys = fieldsToClearOnRemove(nameKey, oldVal, newVal, schema, row);
    if (!keys.length) return { row, cleared: [] };
    const next = { ...row };
    keys.forEach(k => { next[k] = null; });
    if (next.__cellFormulas) {
        const fx = { ...next.__cellFormulas };
        keys.forEach(k => { delete fx[k]; });
        next.__cellFormulas = fx;
    }
    return { row: next, cleared: keys };
}
