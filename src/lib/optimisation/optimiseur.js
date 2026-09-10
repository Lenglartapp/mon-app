// src/lib/optimisation/optimiseur.js
// -----------------------------------------------------------------------------
// Optimiseur de métrage — PROPOSE, n'applique jamais.
//
// Quatre leviers, retenus avec l'atelier :
//   1. ampleur       — jusqu'à −5 % de la valeur saisie, au centième
//   2. marge de coupe — de 50 cm jusqu'à 25 cm
//   3. coefficient   — tel quel, supplément de moitié, ou supprimé
//   4. appiècement   — mutualiser les chutes de lés entre lignes du même tissu
//
// Les trois premiers sont des curseurs à valeurs discrètes : on essaie TOUTES les
// combinaisons (quelques centaines par ligne, instantané). Pas d'heuristique,
// donc chaque proposition est explicable exactement.
// Le quatrième joue entre les lignes et relève du remplissage de contenants.
// -----------------------------------------------------------------------------
import { metrageTissu1, metrageActuel, coefficientDe, estUni, toNum, MARGE_COUPE_DEFAUT } from './metrage';

// ── BORNES MÉTIER — les seules valeurs à ajuster si l'atelier change d'avis ───
export const BORNES = {
  /** L'ampleur ne descend jamais sous ce pourcentage de la valeur saisie. */
  AMPLEUR_BAISSE_MAX: 0.05,
  /** Pas de balayage de l'ampleur. */
  AMPLEUR_PAS: 0.01,
  /** Marge de coupe : plancher, en cm. */
  MARGE_COUPE_MIN: 25,
  /** Gain minimal (en m) en deçà duquel une proposition n'est pas remontée. */
  GAIN_MINIMAL_M: 0.5,
};

const arrondi2 = (v) => Math.round(v * 100) / 100;

/** Ampleurs candidates : de la valeur saisie jusqu'au plancher, au centième. */
export const candidatsAmpleur = (ampleur) => {
  const a = toNum(ampleur);
  if (a <= 0) return [];
  const plancher = arrondi2(a * (1 - BORNES.AMPLEUR_BAISSE_MAX));
  const out = [];
  for (let v = a; v >= plancher - 1e-9; v = arrondi2(v - BORNES.AMPLEUR_PAS)) out.push(v);
  return out;
};

/**
 * Coefficients candidats. La réduction porte sur le SUPPLÉMENT, pas sur le
 * coefficient : 1,10 → 1,05 (moitié) → 1,00 (supprimé).
 */
export const candidatsCoefficient = (coeff) => {
  const c = toNum(coeff) || 1;
  const sup = c - 1;
  return [...new Set([c, arrondi2(1 + sup / 2), 1])];
};

/** Marges de coupe candidates, du confort actuel jusqu'au plancher. */
export const candidatsMarge = () => {
  const out = [];
  for (let m = MARGE_COUPE_DEFAUT; m >= BORNES.MARGE_COUPE_MIN; m--) out.push(m);
  return out;
};

/**
 * Balaie les trois leviers de LIGNE et renvoie les combinaisons gagnantes,
 * de la plus économe à la moins économe, chacune avec son écart au réglage actuel.
 */
export const optimiserLigne = (row) => {
  const actuel = metrageActuel(row);
  if (!actuel) return null;

  const ampleurs = candidatsAmpleur(row.ampleur);
  const coeffs = candidatsCoefficient(coefficientDe(row));
  const marges = candidatsMarge();

  const ampleurInit = toNum(row.ampleur);
  const coeffInit = coefficientDe(row);

  // Écart au réglage d'origine, normalisé sur les trois leviers (0 = on ne touche
  // à rien). Sert à préférer, à résultat égal, la proposition la moins intrusive.
  const intrusion = (ampleur, coefficient, margeCoupe) =>
      (ampleurInit > 0 ? (ampleurInit - ampleur) / ampleurInit / BORNES.AMPLEUR_BAISSE_MAX : 0)
    + (coeffInit > 1 ? (coeffInit - coefficient) / (coeffInit - 1) : 0)
    + (MARGE_COUPE_DEFAUT - margeCoupe) / (MARGE_COUPE_DEFAUT - BORNES.MARGE_COUPE_MIN);

  const propositions = [];
  for (const ampleur of ampleurs) {
    for (const coefficient of coeffs) {
      for (const margeCoupe of marges) {
        const essai = metrageTissu1(row, { ampleur, coefficient, margeCoupe });
        if (!essai) continue;

        // ⚠️ On ne retient QUE les combinaisons qui font franchir un palier :
        // un lé de moins, ou le passage en couché. Sans ce filtre, l'optimiseur
        // proposerait de rogner la hauteur au plancher sur TOUTES les lignes —
        // en coupe verticale le métrage baisse continûment avec la marge, donc
        // le maximum est toujours au plancher. Ce n'est pas une optimisation,
        // c'est une décision d'atelier, et elle n'a pas à être automatisée.
        const gagneUnLe = essai.lesTotal < actuel.lesTotal;
        const passeCouche = essai.mode === 'couché' && actuel.mode === 'vertical';
        if (!gagneUnLe && !passeCouche) continue;

        const gain = actuel.ml - essai.ml;
        if (gain < BORNES.GAIN_MINIMAL_M) continue;
        propositions.push({
          intrusion: Math.round(intrusion(ampleur, coefficient, margeCoupe) * 1000) / 1000,
          ampleur, coefficient, margeCoupe,
          // Ce qui a réellement bougé par rapport au réglage actuel
          changements: [
            ampleur !== toNum(row.ampleur) ? `ampleur ${toNum(row.ampleur)} → ${ampleur}` : null,
            coefficient !== coefficientDe(row) ? `coefficient ${coefficientDe(row)} → ${coefficient}` : null,
            margeCoupe !== MARGE_COUPE_DEFAUT ? `marge de coupe ${MARGE_COUPE_DEFAUT} → ${margeCoupe} cm` : null,
          ].filter(Boolean),
          mode: essai.mode,
          lesTotal: essai.lesTotal,
          ml: essai.ml,
          gain: Math.round(gain * 100) / 100,
        });
      }
    }
  }

  // D'abord le meilleur résultat STRUCTUREL (le moins de lés, le couché),
  // puis — à structure égale — la proposition qui touche le moins au produit.
  // On ne classe pas par mètres gagnés : ce serait toujours le réglage le plus
  // agressif, alors qu'à nombre de lés identique l'atelier veut le moins de
  // modification possible.
  propositions.sort((a, b) =>
    a.lesTotal - b.lesTotal
    || a.intrusion - b.intrusion
    || a.changements.length - b.changements.length
  );

  return { actuel, propositions };
};

// ── LEVIER 4 : mutualisation des appiècements ────────────────────────────────
// Deux lignes ne partagent un lé que si : même tissu, même laize, tissus UNIS,
// et le lé est coupé à la hauteur de la PLUS GRANDE — les autres sont recoupées
// en dessous. Jamais l'inverse : aucune pièce ne peut se retrouver trop courte.
//
// Attention : regrouper deux hauteurs éloignées gaspille en hauteur ce qu'on
// gagne en largeur. On compare donc les MÈTRES, pas le nombre de lés.

const cleTissu = (row, m) => `${String(row.tissu_deco1 || '').trim()}|${m.laize}`;

export const grouperAppiecements = (rows) => {
  const groupes = new Map();

  for (const row of rows) {
    if (!estUni(row)) continue;                       // unis uniquement
    const m = metrageActuel(row);
    if (!m || m.mode !== 'vertical' || m.appiecement <= 0) continue;
    const cle = cleTissu(row, m);
    if (!groupes.has(cle)) groupes.set(cle, { tissu: String(row.tissu_deco1 || '').trim(), laize: m.laize, pieces: [] });
    // Un pan = une pièce. Une paire fournit DEUX appiècements distincts : les
    // regrouper en un seul bloc de largeur doublée pouvait dépasser la laize et
    // faire croire qu'ils tenaient dans un lé unique.
    for (let i = 0; i < m.pans; i++) {
      groupes.get(cle).pieces.push({ row, hauteur: m.hMotif, largeur: m.appiecement });
    }
  }

  const resultats = [];
  for (const [, g] of groupes) {
    if (g.pieces.length < 2) continue;

    // Coût actuel : chaque appiècement consomme un lé entier, à sa propre hauteur.
    const coutActuel = g.pieces.reduce((s, p) => s + p.hauteur / 100, 0);

    // Remplissage : hauteurs décroissantes, puis premier lé où la pièce entre.
    // La hauteur du lé est celle de sa première pièce, la plus grande du lé.
    const tri = [...g.pieces].sort((a, b) => b.hauteur - a.hauteur || b.largeur - a.largeur);
    const les = [];
    for (const p of tri) {
      const cible = les.find(l => l.reste >= p.largeur);
      if (cible) { cible.reste -= p.largeur; cible.pieces.push(p); }
      else les.push({ hauteur: p.hauteur, reste: g.laize - p.largeur, pieces: [p] });
    }
    const coutOptim = les.reduce((s, l) => s + l.hauteur / 100, 0);

    const gain = coutActuel - coutOptim;
    if (gain < BORNES.GAIN_MINIMAL_M) continue;

    resultats.push({
      tissu: g.tissu, laize: g.laize,
      nbLignes: new Set(g.pieces.map(p => p.row.id)).size,
      lesActuels: g.pieces.length,
      lesOptimises: les.length,
      coutActuel: Math.round(coutActuel * 100) / 100,
      coutOptim: Math.round(coutOptim * 100) / 100,
      gain: Math.round(gain * 100) / 100,
      les: les.map(l => ({
        hauteur: l.hauteur,
        utilise: g.laize - l.reste,
        pieces: l.pieces.map(p => ({ id: p.row.id, zone: p.row.zone, piece: p.row.piece, largeur: p.largeur, hauteur: p.hauteur })),
      })),
    });
  }
  return resultats.sort((a, b) => b.gain - a.gain);
};

/** Analyse complète d'une sélection de lignes. N'écrit rien. */
export const analyser = (rows) => {
  // On remonte TOUTES les lignes analysées, y compris celles sans levier
  // exploitable : masquer une ligne laisse croire qu'elle a été oubliée, alors
  // que « rien à gagner ici » est une réponse en soi.
  const lignes = [];
  let gainLignes = 0;
  for (const row of rows || []) {
    const r = optimiserLigne(row);
    if (!r) continue;

    // Une seule proposition par « palier » atteint : inutile de montrer dix
    // variantes qui aboutissent au même nombre de lés.
    const parPalier = new Map();
    for (const p of r.propositions) {
      const cle = `${p.mode}|${p.lesTotal}`;
      if (!parPalier.has(cle)) parPalier.set(cle, p);
    }
    const variantes = [...parPalier.values()];

    lignes.push({
      row,
      actuel: r.actuel,
      meilleure: variantes[0] || null,
      variantes: variantes.slice(0, 3),
    });
    if (variantes[0]) gainLignes += variantes[0].gain;
  }
  const groupes = grouperAppiecements(rows || []);
  const gainGroupes = groupes.reduce((s, g) => s + g.gain, 0);

  return {
    lignes,
    groupes,
    total: {
      metrageActuel: Math.round((rows || []).reduce((s, r) => s + (metrageActuel(r)?.ml || 0), 0) * 100) / 100,
      gainLignes: Math.round(gainLignes * 100) / 100,
      gainGroupes: Math.round(gainGroupes * 100) / 100,
    },
  };
};
