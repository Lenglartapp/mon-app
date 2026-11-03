// src/lib/inventory/stockStatus.js
// -----------------------------------------------------------------------------
// Statut d'un article de stock d'après le dossier affecté (colonne Statut de l'inventaire)
// et regroupement en 4 familles pour la Ventilation du stock du tableau de bord :
//   - Réservé    : dossier pas encore commencé (on attend dessus) ;
//   - En cours   : dossier en production (on travaille dessus) ;
//   - Reliquat   : dossier terminé ou en SAV — l'étape avant le stock mort ;
//   - Stock mort : stock libre, dossier archivé, affectation inconnue (« ? »).
// Un admin peut FORCER le statut d'un article (colonne stock_status) : il passe alors avant le
// statut déduit du dossier, et reste même si l'affectation change (retour « Automatique » = vide).
// -----------------------------------------------------------------------------

// Une pastille du nuancier bleu, du plus engagé (réservé, bleu nuit) au plus libre (bleu ciel).
export const STOCK_STATUS = {
    TODO: { label: 'Réservé', tone: 0 },
    IN_PROGRESS: { label: 'En cours', tone: 1 },
    DONE: { label: 'Reliquat', tone: 2 },
    SAV: { label: 'SAV', tone: 3 },
    ARCHIVED: { label: 'Stock mort', tone: 4 },
    LIBRE: { label: 'Libre', tone: 5 },
};
const STATUS_FROM_LABEL = { 'à commencer': 'TODO', 'réservé': 'TODO', 'en cours': 'IN_PROGRESS', 'terminé': 'DONE', 'reliquat': 'DONE', 'sav': 'SAV', 'archivé': 'ARCHIVED', 'stock mort': 'ARCHIVED' };

/** Code du statut ('' si le dossier affecté est introuvable ou son statut inconnu). override = statut forcé. */
export function stockStatusCodeOf(projectName, projects = [], override = null) {
    if (override && STOCK_STATUS[override]) return override;
    if (!projectName) return 'LIBRE';
    const proj = projects.find(p => p.name === projectName);
    if (!proj) return '';
    return STOCK_STATUS[proj.status] ? proj.status : (STATUS_FROM_LABEL[String(proj.status || '').toLowerCase()] || '');
}

/** Pastille { label, tone } affichée dans la colonne Statut. */
export function stockStatusOf(projectName, projects = [], override = null) {
    if (override && STOCK_STATUS[override]) return STOCK_STATUS[override];
    if (!projectName) return STOCK_STATUS.LIBRE;
    const proj = projects.find(p => p.name === projectName);
    if (!proj) return { label: '?', tone: 4 };
    return STOCK_STATUS[stockStatusCodeOf(projectName, projects)] || { label: proj.status || '?', tone: 4 };
}

// Familles de la Ventilation du stock, dans l'ordre d'affichage.
export const STOCK_GROUPS = [
    { key: 'reserved', label: 'Réservé', hint: 'Dossiers pas encore commencés' },
    { key: 'active', label: 'En cours', hint: 'Dossiers en production' },
    { key: 'remnant', label: 'Reliquat', hint: 'Dossiers terminés ou en SAV' },
    { key: 'dead', label: 'Stock mort', hint: 'Stock libre, dossiers archivés ou inconnus' },
];
const GROUP_OF_CODE = { TODO: 'reserved', IN_PROGRESS: 'active', DONE: 'remnant', SAV: 'remnant' };

/** Famille (reserved | active | remnant | dead) d'un article (statut forcé compris). */
export const stockGroupOf = (projectName, projects = [], override = null) => GROUP_OF_CODE[stockStatusCodeOf(projectName, projects, override)] || 'dead';

/** Statut d'un article de stock : tient compte du statut forcé par un admin. */
export const itemStatusOf = (item, projects = []) => stockStatusOf(item?.project, projects, item?.stock_status);
export const itemStatusCodeOf = (item, projects = []) => stockStatusCodeOf(item?.project, projects, item?.stock_status);
export const itemGroupOf = (item, projects = []) => stockGroupOf(item?.project, projects, item?.stock_status);
