// src/lib/optimisation/metrage.js
// -----------------------------------------------------------------------------
// Moteur de métrage ISOLÉ, au service de l'optimiseur.
//
// Il ne réimplémente rien : il appelle les getters du schéma production, en leur
// passant des paramètres. C'est essentiel — une copie de la formule divergerait
// tôt ou tard de l'originale, et c'est exactement la maladie qu'on soigne.
//
// Il ne modifie JAMAIS la ligne reçue : chaque essai passe par `opts`, jamais par
// une écriture. L'optimiseur est donc structurellement incapable d'altérer un
// dossier.
// -----------------------------------------------------------------------------
import { RIDEAUX_GETTERS as G, calcML, pansOf, MARGE_COUPE_DEFAUT } from '../schemas/production/rideaux';

export const toNum = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Métrage du tissu principal d'une ligne, sous un jeu de paramètres donné.
 * @param {object} row
 * @param {{ampleur?:number, coefficient?:number, margeCoupe?:number}} opts
 */
export const metrageTissu1 = (row, opts = {}) => {
  const laize = toNum(row.laize_tissu1);
  const aPlat = G.a_plat(row, opts);
  const hCoupe = G.hauteur_coupe(row, opts);
  const hMotif = G.hauteur_coupe_motif(row, opts);
  const pans = pansOf(row);

  if (laize <= 0 || aPlat <= 0) return null;

  const couche = laize >= hCoupe;
  const lesParPan = couche ? 0 : Math.ceil(aPlat / laize);
  // Appiècement : la fraction du dernier lé qui reste inutilisée, en cm de laize.
  // C'est elle que le regroupement cherche à mutualiser entre lignes.
  const fraction = couche ? 0 : (aPlat / laize) - Math.floor(aPlat / laize);
  return {
    mode: couche ? 'couché' : 'vertical',
    aPlat, hCoupe, hMotif, laize, pans,
    lesParPan,
    lesTotal: lesParPan * pans,
    appiecement: fraction > 0 ? Math.round(fraction * laize) : 0,
    ml: calcML(aPlat, laize, hCoupe, hMotif, pans),
  };
};

/** Métrage de référence : la ligne telle qu'elle est saisie aujourd'hui. */
export const metrageActuel = (row) => metrageTissu1(row, {});

/** Coefficient effectivement appliqué à une ligne (avant toute optimisation). */
export const coefficientDe = (row) => {
  const L = toNum(row.largeur);
  const conf = String(row.type_confection || '').toLowerCase();
  const isWave = conf.includes('wave 60') || conf.includes('wave 80');
  return isWave ? (L <= 200 ? 1.10 : 1.06) : (L >= 200 ? 1.06 : 1.10);
};

/** Un tissu « uni » : aucun raccord. Seuls ceux-là acceptent l'appiècement. */
export const estUni = (row) =>
  toNum(row.raccord_v_tissu1) === 0 && toNum(row.raccord_h_tissu1) === 0;

export { MARGE_COUPE_DEFAUT };
