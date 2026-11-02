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

// ── PRÉPARATION (avancement par typologie) ───────────────────────────────────
/** Produits SANS prépa ni pose (confection seule) : Statut Prépa / Pose grisés,
 *  hors des avancements. Les chemins de lit sont des plaids. */
export const SANS_PREPA_NI_POSE_RE = /coussin|plaid|chemin.de.lit|cache.sommier/i;

// Une typologie par tableau de production, dans l'ordre d'affichage de la tuile
// « Préparation ». Mêmes tests que le routage des tableaux (ProductionProjectScreen).
// « Autres » recueille un produit vide ou inconnu : il compte déjà dans le taux
// global, le détail doit donc retomber sur le même total.
export const PREPA_TYPOLOGIES = [
  { key: 'rideaux',           label: 'Rideaux',                 test: (p) => /rideau|voilage/i.test(p) },
  { key: 'stores_bateaux',    label: 'Stores bateaux',          test: (p) => /store (bateau|velum)/i.test(p) },
  { key: 'stores_classiques', label: 'Stores classiques',       test: (p) => /store/i.test(p) },
  { key: 'tenture_murale',    label: 'Tentures murales',        test: (p) => /tenture/i.test(p) },
  { key: 'mobilier',          label: 'Mobilier',                test: (p) => MOBILIER_PRODUIT_RE.test(p) },
  { key: 'autres',            label: 'Autres',                  test: () => true },
];

/**
 * Typologie de préparation d'une ligne : { key, label }, ou null si la ligne ne
 * compte pas dans la prépa (produit sans prépa, ou enfant de paire décentrée :
 * c'est le parent, le rail, qui porte la prépa).
 */
export function getPrepaTypology(row) {
  if (row?.pair_role === 'left' || row?.pair_role === 'right') return null;
  const produit = String(row?.produit || '');
  if (SANS_PREPA_NI_POSE_RE.test(produit)) return null;
  const t = PREPA_TYPOLOGIES.find((x) => x.test(produit));
  return { key: t.key, label: t.label };
}
