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

// ── STORES CLASSIQUES (négoce) ───────────────────────────────────────────────
// Le préfixe « Store » est CONSERVÉ dans chaque libellé, à la fois pour la lecture
// des tableaux et parce que c'est lui que testent les 11 points de routage de
// l'app (/store/i). Le retirer rendrait ces lignes invisibles et non chiffrées.
export const STORES_CLASSIQUES_PRODUITS = [
  'Store Enrouleur Bois',
  'Store Enrouleur Toile',
  'Store Vénitien Bois',
  'Store Vénitien Alu',
  'Store Bande Verticale',
  'Store Canishade',
  'Store Coffre',
];

/** Produit posé par défaut sur une nouvelle ligne de store classique. */
export const STORE_CLASSIQUE_DEFAUT = 'Store Enrouleur Toile';

// Produits de NÉGOCE : achetés finis, donc pas de saisie tissu (Toile, Doublure,
// laizes, ML, PA, PV verrouillés). « Store Coffre » en est volontairement EXCLU :
// un coffre prend du tissu. Les anciens libellés restent listés — 97 lignes
// « Store Enrouleur » et 6 « Store Vénitien » existent en base et doivent garder
// exactement le même comportement.
export const STORE_NEGOCE_PRODUITS = [
  'Store Enrouleur Bois',
  'Store Enrouleur Toile',
  'Store Vénitien Bois',
  'Store Vénitien Alu',
  'Store Bande Verticale',
  'Store Canishade',
  // ↓ anciens libellés (compatibilité des lignes déjà saisies)
  'Store Enrouleur',
  'Store Vénitien',
];

/** Vénitiens (anciens et nouveaux libellés) — seuls concernés par « Tailles lames ». */
export const VENITIEN_RE = /v[ée]nitien/i;

/** Produits « décor » : prix tissus lus au catalogue via ml_tissu_N saisi à la main. */
export const DECOR_PRODUIT_RE = /coussin|plaid|cache-sommier|tenture|t[êe]te|mobilier|si[èe]ge|cantonni[èe]re/i;
