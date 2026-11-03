// src/lib/inventory/stockStatus.js
// -----------------------------------------------------------------------------
// Statut d'un article de stock d'après le dossier affecté (colonne Statut de l'inventaire)
// et regroupement en 3 familles pour la Ventilation du stock du tableau de bord :
//   - Réservé  : dossier pas encore commencé (on attend dessus) ;
//   - En cours : dossier en production / SAV (on travaille dessus) ;
//   - Stock mort : tout le reste — stock libre, dossier archivé ou terminé (reliquat),
//                  affectation inconnue (« ? »).
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

/** Code du statut ('' si le dossier affecté est introuvable ou son statut inconnu). */
export function stockStatusCodeOf(projectName, projects = []) {
    if (!projectName) return 'LIBRE';
    const proj = projects.find(p => p.name === projectName);
    if (!proj) return '';
    return STOCK_STATUS[proj.status] ? proj.status : (STATUS_FROM_LABEL[String(proj.status || '').toLowerCase()] || '');
}

/** Pastille { label, tone } affichée dans la colonne Statut. */
export function stockStatusOf(projectName, projects = []) {
    if (!projectName) return STOCK_STATUS.LIBRE;
    const proj = projects.find(p => p.name === projectName);
    if (!proj) return { label: '?', tone: 4 };
    return STOCK_STATUS[stockStatusCodeOf(projectName, projects)] || { label: proj.status || '?', tone: 4 };
}

// Familles de la Ventilation du stock, dans l'ordre d'affichage.
export const STOCK_GROUPS = [
    { key: 'reserved', label: 'Réservé', hint: 'Dossiers pas encore commencés' },
    { key: 'active', label: 'En cours', hint: 'Dossiers en production ou SAV' },
    { key: 'dead', label: 'Stock mort', hint: 'Stock libre, reliquats, dossiers archivés ou inconnus' },
];
const GROUP_OF_CODE = { TODO: 'reserved', IN_PROGRESS: 'active', SAV: 'active' };

/** Famille (reserved | active | dead) d'un article d'après son dossier affecté. */
export const stockGroupOf = (projectName, projects = []) => GROUP_OF_CODE[stockStatusCodeOf(projectName, projects)] || 'dead';
