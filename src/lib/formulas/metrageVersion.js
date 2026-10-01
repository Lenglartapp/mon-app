// Version des formules de métrage rideaux.
// v2 (L. Finie + 10 cm + 2,5 %, H. Coupe tête/OB, À plat par rideau, tissu 2 en saisie libre)
// ne s'applique qu'aux chiffrages et projets créés après sa mise en place :
//  - chiffrage : paramètre `formules_metrage` posé à la création (hérité par variantes) ;
//  - lignes    : champ `formules_metrage` porté par la ligne (posé par le chiffrage v2,
//                conservé à la mise en projet, posé sur les lignes des nouveaux projets).
// Les getters production ne voient que la ligne : c'est donc le marqueur de ligne qui fait foi.
export const FORMULES_METRAGE_V2 = 2;

export const isMetrageV2Row = (row) => Number(row?.formules_metrage) >= FORMULES_METRAGE_V2;

// L. Finie v2 (par rideau) — base : L/pan + 10 cm + 2,5 % × L/pan.
//  - Wave 60 / 80 : base arrondie pour un nombre pair de vagues :
//    ArrondiSupPair(base ÷ div) × div, div = 6 (Wave 60) ou 8 (Wave 80) ;
//  - paire : + croisement / 2 (toutes confections).
export function largeurFinieV2({ largeur, isOnePanel, croisement, typeConfection }) {
  const L = Number(largeur) || 0;
  const crois = Number(croisement) || 0;
  const lPan = isOnePanel ? L : L / 2;
  let base = lPan + 10 + 0.025 * lPan;
  const conf = String(typeConfection || "").toLowerCase();
  const div = conf.includes("wave 60") ? 6 : conf.includes("wave 80") ? 8 : 0;
  if (div) {
    const c = Math.ceil(base / div);
    base = (c % 2 === 0 ? c : c + 1) * div;
  }
  return base + (isOnePanel ? 0 : crois / 2);
}

// Hauteur tête : nombre en chiffrage, libellé « 8 cm » en production.
export const parseCm = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
