// src/lib/constants/productRouting.js
// -----------------------------------------------------------------------------
// Le champ `produit` d'une ligne est ce qui décide de TOUT : dans quel tableau la
// ligne s'affiche, quel schéma sert au recalcul, et dans quel poste de CA elle
// tombe. Ce routage se fait par expression régulière sur le libellé, à plusieurs
// endroits du code — un produit ajouté au select sans être ajouté ici serait
// saisissable mais n'apparaîtrait dans AUCUN tableau.
// D'où cette source unique.
// -----------------------------------------------------------------------------

/** Produits regroupés dans le tableau « Mobilier » (options du select `produit`). */
export const MOBILIER_PRODUITS = ['Tête de Lit', 'Siège', 'Cantonnière'];

/**
 * Reconnaît un produit du tableau Mobilier, quelles que soient la casse et les
 * accents saisis (import Excel, anciennes lignes, « mobilier » générique).
 * Sans drapeau /g : `.test()` est sans état, la constante est donc partageable.
 */
export const MOBILIER_PRODUIT_RE = /t[êe]te|mobilier|si[èe]ge|cantonni[èe]re/i;

/** Produits « décor » : prix tissus lus au catalogue via ml_tissu_N saisi à la main. */
export const DECOR_PRODUIT_RE = /coussin|plaid|cache-sommier|tenture|t[êe]te|mobilier|si[èe]ge|cantonni[èe]re/i;
