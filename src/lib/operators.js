// src/lib/operators.js
// -----------------------------------------------------------------------------
// Opérateurs (Inventaire + Logistique) : qui a fait l'action. Les tablettes atelier partagent
// un compte, la trace passe donc par ce champ.
//   - À l'ouverture du champ : la liste partagée (table stock_operators).
//   - À la frappe : aussi les comptes actifs de l'équipe (profiles, lecture seule).
//   - Nom inconnu : accepté tel quel, puis mémorisé dans la liste à l'enregistrement.
// Comparaisons sans casse, sans accents et sans espaces superflus.
// -----------------------------------------------------------------------------

/** Clé de comparaison : « Émilie  david » → « emilie david ». */
export const operatorKey = (name) => String(name ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim().replace(/\s+/g, ' ').toLowerCase();

/** Nom propre à enregistrer (espaces superflus retirés). */
export const cleanOperatorName = (name) => String(name ?? '').trim().replace(/\s+/g, ' ');

/** Noms sans doublon (le premier rencontré l'emporte), triés. */
export function uniqueOperatorNames(names) {
    const seen = new Map();
    names.forEach((n) => {
        const clean = cleanOperatorName(n);
        const k = operatorKey(clean);
        if (k && !seen.has(k)) seen.set(k, clean);
    });
    return [...seen.values()].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
}

/**
 * Suggestions du champ Opérateur.
 * @param text      texte tapé ('' = champ ouvert sans frappe)
 * @param listNames liste partagée (stock_operators)
 * @param teamNames comptes actifs de l'équipe (proposés seulement à la frappe)
 */
export function operatorSuggestions(text, listNames = [], teamNames = []) {
    const q = operatorKey(text);
    if (!q) return uniqueOperatorNames(listNames);
    return uniqueOperatorNames([...listNames, ...teamNames]).filter((n) => operatorKey(n).includes(q));
}

/** Le nom est-il déjà dans la liste partagée ? */
export const isKnownOperator = (name, listNames = []) => {
    const k = operatorKey(name);
    return !!k && listNames.some((n) => operatorKey(n) === k);
};

export const OPERATOR_REQUIRED_MESSAGE = "Indiquez l'opérateur pour enregistrer";
