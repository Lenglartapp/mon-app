// Où chaque article d'une bibliothèque (chiffrage) ou d'une matériauthèque (projet)
// est utilisé dans les lignes : colonne « Utilisé » + liste dépliable.

export const lineLabel = (r) => [r.zone, r.piece, r.produit].filter(Boolean).join(' · ') || 'Ligne sans repère';

/**
 * @param {object[]} rows       lignes du chiffrage / du projet
 * @param {Set<string>} names   noms des articles
 * @param {(key: string) => string} fieldLabel  libellé d'une colonne (« Tissu 1 »…)
 * @returns {Map<string, Array<{ id, label, fields: string[] }>>} nom d'article → lignes
 */
export function buildUsage(rows, names, fieldLabel = (k) => k) {
    const out = new Map();
    (rows || []).forEach((r) => {
        if (!r || typeof r !== 'object') return;
        const hits = new Map();
        Object.entries(r).forEach(([k, v]) => {
            if (typeof v !== 'string' || !names.has(v)) return;
            if (!hits.has(v)) hits.set(v, []);
            hits.get(v).push(fieldLabel(k));
        });
        hits.forEach((fields, name) => {
            if (!out.has(name)) out.set(name, []);
            out.get(name).push({ id: r.id, label: lineLabel(r), fields });
        });
    });
    return out;
}
