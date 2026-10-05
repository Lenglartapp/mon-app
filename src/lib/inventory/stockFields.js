// Champs « article » de l'inventaire, communs au stock et au journal, + sentinelle
// d'emplacement des réceptions Odoo pas encore rangées. Module pur (client + job de nuit).

/** Emplacement d'une réception Odoo à compléter (pièces + emplacement à saisir dans le stock). */
export const LOC_A_COMPLETER = 'À COMPLÉTER';

/** Découpe un emplacement multiple (« B3, C1 ») en codes. */
export const splitLocations = (loc) =>
  String(loc || '').split(',').map((s) => s.trim()).filter(Boolean);

/** Fournisseur / référence / coloris / laize d'un article ou d'un mouvement (null si vide). */
export const pickItemMeta = (src = {}) => ({
  ref: src.ref || null,
  coloris: src.coloris || null,
  laize: src.laize || null,
  fournisseur: src.fournisseur || null,
});
