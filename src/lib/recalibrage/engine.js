// src/lib/recalibrage/engine.js
// -----------------------------------------------------------------------------
// Moteur de l'Assistant Recalibrage.
//
// Principe : on ne retouche plus les prix de vente après coup. On change les
// PARAMÈTRES qui les produisent, sur une copie de la minute, puis on relance les
// formules du chiffrage (recomputeRow) :
//   - coefficients de la bibliothèque d'achat, par famille (PV = PA × coef,
//     le même coef pour tous les articles de la famille) ;
//   - coefficient sous-traitance et taux horaire de la minute ;
//   - ampleur, par produit (colonne « Produit ») ;
//   - heures de préparation / confection / pose, en % par produit.
// Les prix restent donc cohérents (métrage, achat, heures) et chaque levier est
// traçable (valeur avant → après).
// -----------------------------------------------------------------------------

import { computeFormulas } from '../formulas/compute';
import { recomputeRow } from '../formulas/recomputeRow';
import { CHIFFRAGE_SCHEMA_DEP } from '../schemas/deplacement';
import { calculateProfitability } from '../financial/profitabilityCalculator';
import { DECOR_PRODUIT_RE as DECOR_RE } from '../constants/productRouting';

const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => Math.round(v * 100) / 100;

// Familles de la bibliothèque (même découpage que les onglets de CatalogManager).
export const FAMILIES = [
  { key: 'tissus', label: 'Tissus et doublures', categories: ['Tissu', 'Tissus', 'Doublure', 'Doublures', 'Inter', 'Confection'] },
  { key: 'passementerie', label: 'Passementeries', categories: ['Passementerie'] },
  { key: 'rails', label: 'Rails et mécanismes', categories: ['Rail', 'Rails', 'Tringle', 'Mecanisme', 'Mécanisme'] },
  { key: 'stores', label: 'Stores', categories: ['Store', 'Stores', 'Mecanisme Store'] },
];
const OTHER_FAMILY = { key: 'autres', label: 'Autres articles' };

export const familyOf = (item) => {
  const c = String(item?.category || '');
  return (FAMILIES.find((f) => f.categories.includes(c)) || OTHER_FAMILY).key;
};
export const familyLabel = (key) => (FAMILIES.find((f) => f.key === key) || OTHER_FAMILY).label;

export const POSTES = [
  { key: 'heures_prepa', label: 'Préparation' },
  { key: 'heures_confection', label: 'Confection' },
  { key: 'heures_pose', label: 'Pose' },
];

const isRideauRow = (r) => /rideau|voilage/i.test(String(r?.produit || ''));
const produitOf = (r) => String(r?.produit || '').trim() || 'Sans produit';

// Coefficient effectif d'un article : le coef saisi, sinon PV ÷ PA.
const itemCoef = (item) => {
  const c = num(item?.coef);
  if (c > 0) return c;
  const pa = num(item?.buyPrice ?? item?.pa);
  const pv = num(item?.sellPrice ?? item?.pv);
  return pa > 0 && pv > 0 ? pv / pa : null;
};

// Noms d'articles de la bibliothèque réellement utilisés par les lignes.
function usedItemNames(rows, catalog) {
  const names = new Set((catalog || []).map((i) => i?.name).filter(Boolean));
  const used = new Set();
  (rows || []).forEach((r) => {
    Object.values(r || {}).forEach((v) => {
      if (typeof v === 'string' && names.has(v)) used.add(v);
    });
  });
  return used;
}

// Champ article d'une ligne → ses colonnes PA / PV. Certains PV sont saisis à la main
// (mécanisme de store, tringle au ml…) : le coefficient réel se lit donc sur les LIGNES.
const ITEM_FIELDS = [
  ['tissu_deco1', 'pa_tissu1', 'pv_tissu1'], ['tissu_deco2', 'pa_tissu2', 'pv_tissu2'],
  ['doublure', 'pa_doublure', 'pv_doublure'], ['interdoublure', 'pa_interdoublure', 'pv_interdoublure'],
  ['passementerie1', 'pa_pass1', 'pv_pass1'], ['passementerie2', 'pa_pass2', 'pv_pass2'],
  ['modele_mecanisme', 'pa_mecanisme', 'pv_mecanisme'], ['mecanisme_bis', 'pa_mecanisme_bis', 'pv_mecanisme_bis'],
  ['embrasse', 'pa_embrasse', 'pv_embrasse'], ['toile_finition_1', 'pa_toile_finition_1', 'pv_toile_finition_1'],
  ['mecanisme_store', 'pa_mecanisme_store', 'pv_mecanisme_store'], ['mecanisme_fourniture', 'pa_mecanisme', 'pv_mecanisme'],
  ['tissu_1', 'pa_tissu_1', 'pv_tissu_1'], ['tissu_2', 'pa_tissu_2', 'pv_tissu_2'],
  ['passementerie_1', 'pa_pass_1', 'pv_pass_1'], ['passementerie_2', 'pa_pass_2', 'pv_pass_2'],
  ['type_interieur', 'pa_interieur', 'pv_interieur'], ['molleton', 'pa_molleton', 'pv_molleton'],
  ['baguette_1', 'pa_baguette_1', 'pv_baguette_1'], ['baguette_2', 'pa_baguette_2', 'pv_baguette_2'],
];

/** Pour chaque ligne, les postes article (famille, PA, PV) qu'elle porte. */
function lineItemParts(r, byName) {
  const out = [];
  ITEM_FIELDS.forEach(([nameKey, paKey, pvKey]) => {
    const item = byName.get(r?.[nameKey]);
    if (!item) return;
    out.push({ family: familyOf(item), paKey, pvKey, pa: num(r[paKey]), pv: num(r[pvKey]) });
  });
  return out;
}

/** Coefficient réellement pratiqué par famille, lu sur les lignes (PV ÷ PA, pondéré). */
function familyLineStats(rows, catalog) {
  const byName = new Map((catalog || []).filter((i) => i?.name).map((i) => [i.name, i]));
  const stats = {};
  (rows || []).forEach((r) => {
    lineItemParts(r, byName).forEach(({ family, pa, pv }) => {
      if (pa <= 0 || pv <= 0) return;
      if (!stats[family]) stats[family] = { pa: 0, pv: 0, ratios: [] };
      stats[family].pa += pa;
      stats[family].pv += pv;
      stats[family].ratios.push(pv / pa);
    });
  });
  return stats;
}

const minMax = (values) => {
  const v = values.filter((x) => Number.isFinite(x));
  if (!v.length) return null;
  return { min: Math.min(...v), max: Math.max(...v) };
};

/**
 * Photographie des leviers disponibles sur la minute : familles d'articles
 * utilisées (avec leur coef actuel), produits à ampleur, heures par produit.
 */
export function analyzeMinute({ rows, catalog, settings }) {
  const used = usedItemNames(rows, catalog);
  const famMap = {};
  (catalog || []).forEach((item) => {
    if (!item?.name || !used.has(item.name)) return;
    const key = familyOf(item);
    if (!famMap[key]) famMap[key] = { key, label: familyLabel(key), items: [] };
    famMap[key].items.push(item);
  });
  const order = [...FAMILIES.map((f) => f.key), OTHER_FAMILY.key];
  const lineStats = familyLineStats(rows, catalog);
  const families = order.filter((k) => famMap[k]).map((k) => {
    const st = lineStats[k];
    return {
      ...famMap[k],
      // Coef lu sur les lignes (PV saisis à la main compris), sinon celui de la bibliothèque.
      coef: st ? minMax(st.ratios) : minMax(famMap[k].items.map(itemCoef)),
      weighted: st ? st.pv / st.pa : null,
    };
  });

  const ampMap = {};
  const hoursMap = {};
  (rows || []).forEach((r) => {
    const p = produitOf(r);
    if (isRideauRow(r) && num(r.ampleur) > 0) {
      if (!ampMap[p]) ampMap[p] = { produit: p, values: [], lines: 0 };
      ampMap[p].values.push(num(r.ampleur));
      ampMap[p].lines += 1;
    }
    const q = Math.max(1, num(r.quantite));
    POSTES.forEach(({ key }) => {
      const h = num(r[key]) * q;
      if (h <= 0) return;
      if (!hoursMap[p]) hoursMap[p] = { produit: p, heures_prepa: 0, heures_confection: 0, heures_pose: 0 };
      hoursMap[p][key] += h;
    });
  });
  const ampleurs = Object.values(ampMap)
    .map((a) => ({ produit: a.produit, lines: a.lines, value: minMax(a.values) }))
    .sort((a, b) => a.produit.localeCompare(b.produit, 'fr'));
  const heures = Object.values(hoursMap).sort((a, b) => a.produit.localeCompare(b.produit, 'fr'));

  const legacyLines = (rows || []).filter((r) => (r.__pv_overrides && Object.keys(r.__pv_overrides).length)
    || (num(r.recal_coef) > 0 && Math.abs(num(r.recal_coef) - 1) > 1e-6)).length;

  return {
    families,
    ampleurs,
    heures,
    tauxHoraire: num(settings?.taux_horaire) || 135,
    coefST: num(settings?.coef_sous_traitance) || 2,
    hasST: (rows || []).some((r) => num(r.st_pose_pa) > 0 || num(r.st_conf_pa) > 0),
    legacyLines,
  };
}

const parseLever = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = num(v);
  return n > 0 ? n : null;
};

/**
 * Applique les leviers et recalcule. `levers` :
 *   { coefs: {famille: n}, tauxHoraire, coefST, ampleurs: {produit: n},
 *     heures: {produit: {heures_x: pct}}, clearLegacy }
 * Valeur vide = levier inchangé.
 */
export function applyLevers({ rows, depRows, extraRows, catalog, ctx, schema, commissionRate }, levers = {}) {
  const coefs = levers.coefs || {};

  // 1. Bibliothèque : même coef pour tous les articles de la famille (option A).
  let catalogChanged = false;
  const newCatalog = (catalog || []).map((item) => {
    const c = parseLever(coefs[familyOf(item)]);
    if (!c) return item;
    catalogChanged = true;
    const pa = num(item.buyPrice ?? item.pa);
    return { ...item, coef: c, ...(pa > 0 ? { sellPrice: round2(pa * c) } : {}) };
  });

  // 2. Réglages de la minute.
  const settings = { ...(ctx.settings || {}) };
  const th = parseLever(levers.tauxHoraire);
  const cst = parseLever(levers.coefST);
  if (th) settings.taux_horaire = th;
  if (cst) settings.coef_sous_traitance = cst;

  // 3. Lignes : ampleur et heures par produit, ancien recalibrage effacé si demandé.
  const amp = levers.ampleurs || {};
  const hrs = levers.heures || {};
  const byName = new Map((catalog || []).filter((i) => i?.name).map((i) => [i.name, i]));
  const lines = (rows || []).map((r) => {
    const p = produitOf(r);
    let next = r;
    const touch = () => { if (next === r) next = { ...r }; };
    // PV saisis à la main : ils suivent aussi le nouveau coef (PV = PA × coef). Les PV
    // tirés de la bibliothèque sont de toute façon recalculés par les formules.
    lineItemParts(r, byName).forEach(({ family, pvKey, pa }) => {
      const c = parseLever(coefs[family]);
      if (!c || pa <= 0) return;
      touch();
      next[pvKey] = round2(pa * c);
    });
    const a = parseLever(amp[p]);
    if (a && isRideauRow(r) && num(r.ampleur) > 0) { touch(); next.ampleur = a; }
    const pct = hrs[p] || {};
    POSTES.forEach(({ key }) => {
      const v = num(pct[key]);
      if (!v || num(r[key]) <= 0) return;
      touch();
      next[key] = round2(num(r[key]) * (1 - v / 100));
    });
    if (levers.clearLegacy && (r.__pv_overrides || r.recal_coef != null)) {
      touch();
      delete next.__pv_overrides;
      delete next.recal_coef;
    }
    return next;
  });
  const deps = (depRows || []).map((r) => {
    if (!levers.clearLegacy || r.recal_coef == null) return r;
    const { recal_coef, ...rest } = r; // eslint-disable-line no-unused-vars
    return rest;
  });

  const newCtx = { ...ctx, settings, catalog: newCatalog };
  const newRows = computeFormulas(lines, schema, newCtx);
  const newDeps = deps.map((r) => recomputeRow({ ...r, produit: r.produit || 'Déplacement' }, CHIFFRAGE_SCHEMA_DEP, newCtx));
  const profit = calculateProfitability(newRows, newDeps, extraRows || [], commissionRate);

  return { rows: newRows, depRows: newDeps, catalog: newCatalog, catalogChanged, settings, profit, kpis: { ...profit.kpis, metrage: metrageTissu(newRows) } };
}

// Mètres linéaires de tissu commandés (tissus, doublures, interdoublures, toiles).
const ML_KEYS = ['ml_tissu1', 'ml_tissu2', 'ml_doublure', 'ml_interdoublure', 'ml_tissu_1', 'ml_tissu_2', 'ml_toile_finition_1', 'ml_molleton'];
export function metrageTissu(rows) {
  return (rows || []).reduce((s, r) => {
    const q = DECOR_RE.test(String(r?.produit || '')) ? Math.max(1, num(r.quantite)) : 1;
    return s + ML_KEYS.reduce((a, k) => a + num(r?.[k]), 0) * q;
  }, 0);
}

export function currentKpis({ rows, depRows, extraRows, commissionRate }) {
  return { ...calculateProfitability(rows || [], depRows || [], extraRows || [], commissionRate).kpis, metrage: metrageTissu(rows) };
}

/**
 * Décomposition de l'écart : effet des marges, puis de l'ampleur, puis du temps
 * (leviers appliqués dans cet ordre, cumulés).
 */
export function attribution(input, levers, baseCa) {
  const step1 = applyLevers(input, { coefs: levers.coefs, tauxHoraire: levers.tauxHoraire, coefST: levers.coefST, clearLegacy: levers.clearLegacy }).kpis.ca_total;
  const step2 = applyLevers(input, { ...levers, heures: {} }).kpis.ca_total;
  const step3 = applyLevers(input, levers).kpis.ca_total;
  return { marges: step1 - baseCa, ampleur: step2 - step1, temps: step3 - step2 };
}

const fmtNum = (n, d = 2) => (n == null ? '—' : (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('fr-FR', { maximumFractionDigits: d }));
const fmtRange = (r, prefix = '') => (!r ? '—' : (Math.abs(r.max - r.min) < 0.005 ? `${prefix}${fmtNum(r.min)}` : `${prefix}${fmtNum(r.min)} à ${prefix}${fmtNum(r.max)}`));

/** Liste lisible des leviers modifiés (trace + historique). */
export function describeLevers(analysis, levers) {
  const out = [];
  analysis.families.forEach((f) => {
    const c = parseLever(levers.coefs?.[f.key]);
    if (c) out.push({ group: 'Coefficients', label: f.label, from: f.weighted ? `×${fmtNum(f.weighted)}` : fmtRange(f.coef, '×'), to: `×${fmtNum(c)}` });
  });
  const th = parseLever(levers.tauxHoraire);
  if (th && Math.abs(th - analysis.tauxHoraire) > 1e-6) out.push({ group: 'Coefficients', label: 'Taux horaire', from: `${fmtNum(analysis.tauxHoraire)} €`, to: `${fmtNum(th)} €` });
  const cst = parseLever(levers.coefST);
  if (cst && Math.abs(cst - analysis.coefST) > 1e-6) out.push({ group: 'Coefficients', label: 'Sous-traitance', from: `×${fmtNum(analysis.coefST)}`, to: `×${fmtNum(cst)}` });
  analysis.ampleurs.forEach((a) => {
    const v = parseLever(levers.ampleurs?.[a.produit]);
    if (v) out.push({ group: 'Ampleur', label: a.produit, from: fmtRange(a.value), to: fmtNum(v) });
  });
  analysis.heures.forEach((h) => {
    POSTES.forEach(({ key, label }) => {
      const v = num(levers.heures?.[h.produit]?.[key]);
      if (v && h[key] > 0) out.push({ group: 'Temps de production', pct: v, poste: label, hFrom: h[key], hTo: h[key] * (1 - v / 100), label: `${label} · ${h.produit}`, from: `${fmtNum(h[key], 1)} h`, to: `${fmtNum(h[key] * (1 - v / 100), 1)} h (−${fmtNum(v, 1)} %)` });
    });
  });
  if (levers.clearLegacy && analysis.legacyLines) out.push({ group: 'Ancien recalibrage', label: 'Prix figés effacés', from: `${analysis.legacyLines} ligne(s)`, to: 'recalculées' });
  return out;
}

/** Version courte pour la note : une seule ligne quand toutes les heures baissent du même %. */
export function summarizeForNote(changes) {
  const temps = changes.filter((c) => c.group === 'Temps de production');
  const others = changes.filter((c) => c.group !== 'Temps de production');
  const pcts = new Set(temps.map((c) => c.pct));
  if (temps.length > 1 && pcts.size === 1) {
    const hFrom = temps.reduce((a, c) => a + c.hFrom, 0);
    const hTo = temps.reduce((a, c) => a + c.hTo, 0);
    const postes = [...new Set(temps.map((c) => c.poste))];
    const label = postes.length === 1 ? `${postes[0]} · tous les produits` : postes.length === POSTES.length ? 'toutes les heures' : `${postes.join(' et ')} · tous les produits`;
    return [...others, { group: 'Temps de production', label, from: `${fmtNum(hFrom, 1)} h`, to: `${fmtNum(hTo, 1)} h (−${fmtNum(temps[0].pct, 1)} %)` }];
  }
  return changes;
}

// —————————————————————————————————————————————————————————————————————————————
// RECOMMANDATIONS — leviers choisis par l'utilisateur
// —————————————————————————————————————————————————————————————————————————————
// Chaque levier va de sa valeur actuelle vers une butée :
//   coefficient → ×1 (vente au prix d'achat), ampleur → 1,5, temps → −50 %.
// La recommandation « équilibrée » fait faire à chaque levier coché le MÊME effort
// (même fraction du chemin vers sa butée), calculé pour atteindre le prix cible.
export const AMPLEUR_MIN = 1.5;
export const TEMPS_MAX = 50;

const mean = (r) => (r ? (r.min + r.max) / 2 : null);

/** Leviers proposés pour CETTE minute (seulement ce qui existe dans le devis). */
export function listLevers(analysis) {
  const out = [];
  analysis.families.forEach((f) => out.push({ id: `coef:${f.key}`, group: 'Coefficients', kind: 'coef', family: f.key, label: f.label, cur: f.weighted || mean(f.coef) || 2 }));
  if (analysis.hasST) out.push({ id: 'st', group: 'Coefficients', kind: 'st', label: 'Sous-traitance', cur: analysis.coefST });
  analysis.ampleurs.forEach((a) => {
    if (a.value && a.value.max > AMPLEUR_MIN) out.push({ id: `amp:${a.produit}`, group: 'Ampleur', kind: 'amp', produit: a.produit, label: a.produit, cur: a.value.max });
  });
  POSTES.forEach(({ key, label }) => {
    if (analysis.heures.some((h) => h[key] > 0)) out.push({ id: `temps:${key}`, group: 'Temps de production', kind: 'temps', poste: key, label });
  });
  return out;
}

const roundTo = (v, step) => Math.round(v / step) * step;

/** Valeurs des leviers choisis pour un effort `t` (0 = rien, 1 = butée). */
export function leversAt(base, chosen, analysis, t) {
  const lv = {
    ...base,
    coefs: { ...(base.coefs || {}) },
    ampleurs: { ...(base.ampleurs || {}) },
    heures: Object.fromEntries(Object.entries(base.heures || {}).map(([p, v]) => [p, { ...v }])),
  };
  chosen.forEach((l) => {
    if (l.kind === 'coef') lv.coefs[l.family] = roundTo(l.cur - t * (l.cur - 1), 0.01);
    else if (l.kind === 'st') lv.coefST = roundTo(l.cur - t * (l.cur - 1), 0.01);
    else if (l.kind === 'amp') lv.ampleurs[l.produit] = roundTo(l.cur - t * (l.cur - AMPLEUR_MIN), 0.05);
    else if (l.kind === 'temps') {
      const pct = roundTo(t * TEMPS_MAX, 0.5);
      analysis.heures.forEach((h) => {
        if (h[l.poste] > 0) lv.heures[h.produit] = { ...(lv.heures[h.produit] || {}), [l.poste]: pct };
      });
    }
  });
  return lv;
}

/** Leviers de base : ceux réglés à la main, sauf ceux que la recommandation va piloter. */
export function stripChosen(levers, chosen) {
  const base = {
    ...levers,
    coefs: { ...(levers.coefs || {}) },
    ampleurs: { ...(levers.ampleurs || {}) },
    heures: Object.fromEntries(Object.entries(levers.heures || {}).map(([p, v]) => [p, { ...v }])),
  };
  chosen.forEach((l) => {
    if (l.kind === 'coef') delete base.coefs[l.family];
    else if (l.kind === 'st') base.coefST = '';
    else if (l.kind === 'amp') delete base.ampleurs[l.produit];
    else if (l.kind === 'temps') Object.values(base.heures).forEach((h) => { delete h[l.poste]; });
  });
  return base;
}

/**
 * Effort commun `t` qui amène le prix au plus près de `target` (dichotomie, le
 * prix baisse quand l'effort monte). Renvoie les leviers, le prix obtenu et t.
 */
export function solveBalanced(input, levers, chosen, analysis, target) {
  if (!chosen.length) return { ok: false, reason: 'none' };
  const base = stripChosen(levers, chosen);
  const caAt = (t) => applyLevers(input, leversAt(base, chosen, analysis, t)).kpis.ca_total;
  const ca0 = applyLevers(input, base).kpis.ca_total;
  const ca1 = caAt(1);
  if (target >= ca0) return { ok: false, reason: 'high', ca0 };
  if (target < ca1) return { ok: false, reason: 'low', min: ca1 };
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (caAt(mid) > target) lo = mid; else hi = mid;
  }
  const lv = leversAt(base, chosen, analysis, hi);
  return { ok: true, t: hi, levers: lv, ca: applyLevers(input, lv).kpis.ca_total };
}
