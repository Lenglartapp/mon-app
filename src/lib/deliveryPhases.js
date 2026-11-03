// src/lib/deliveryPhases.js
// -----------------------------------------------------------------------------
// Phasage livraison d'un dossier de production (projects.delivery_phases).
//
// Une phase = { id, label, date, color, rules, row_ids, excluded_ids } :
//   - rules        : critères combinés { zone?, piece?, fenetre?, produit? } (listes de
//                    valeurs). Un ouvrage ajouté plus tard au bon endroit entre tout seul.
//   - row_ids      : ouvrages ajoutés un par un (exceptions), prioritaires sur tout critère.
//   - excluded_ids : ouvrages retirés de CETTE phase alors qu'un de ses critères les vise.
// Les anciennes phases { id, label, date } restent valides (aucun ouvrage rattaché).
//
// Priorité : ajouté un par un > critère le plus précis (le plus de critères renseignés).
// Égalité entre deux phases = conflit (signalé, la première phase de la liste l'emporte).
// Un ouvrage sans phase part à la date de livraison globale (projects.deadline).
//
// Paire décentrée : un seul ouvrage (le parent, qui porte zone / pièce / produit) ; ses
// heures sont la somme de la paire (le parent porte prépa / pose, les enfants la conf).
// -----------------------------------------------------------------------------

export const CRITERIA = [
  { key: 'zone', label: 'Zone' },
  { key: 'piece', label: 'Pièce' },
  { key: 'fenetre', label: 'Fenêtre' },
  { key: 'produit', label: 'Produit' },
];

export const GLOBAL = 'global';

// Couleurs au choix = palette de la DA Lenglart (7 teintes) + Noir + 2 bleus intermédiaires
// (Bleu Horizon, Bleu Brume) pour échelonner du Bleu Héritage au Voile de Lin.
// Valeurs fixes : une pastille garde sa teinte en mode sombre ; elle est cerclée à
// l'affichage pour que les teintes très claires restent visibles.
// La phase garde la CLÉ (`color`) ; une phase sans couleur connue prend celle de sa position.
export const PHASE_COLORS = [
  { key: 'bleu_heritage', label: 'Bleu Héritage', css: '#1E2447' },
  { key: 'bleu_majorelle', label: 'Bleu Majorelle', css: '#1B3269' },
  { key: 'bleu_horizon', label: 'Bleu Horizon', css: '#4A6DB0' },
  { key: 'bleu_brume', label: 'Bleu Brume', css: '#A9C0E6' },
  { key: 'voile_de_lin', label: 'Voile de Lin', css: '#E9F0FA' },
  { key: 'terre_de_cuivre', label: 'Terre de Cuivre', css: '#BB7051' },
  { key: 'sable_atelier', label: "Sable d'Atelier", css: '#CEAB95' },
  { key: 'toile_de_coton', label: 'Toile de Coton', css: '#FAF5EE' },
  { key: 'gainsboro', label: 'Gainsboro', css: '#EFEFEF' },
  { key: 'noir', label: 'Noir', css: '#191919' },
];
// Ordre d'attribution automatique : les teintes les plus éloignées d'abord.
const AUTO_ORDER = ['bleu_heritage', 'terre_de_cuivre', 'bleu_horizon', 'sable_atelier', 'noir', 'bleu_brume', 'bleu_majorelle', 'gainsboro', 'voile_de_lin', 'toile_de_coton'];
const byKey = (k) => PHASE_COLORS.find((c) => c.key === k);

export function phaseColor(phase, index = 0) {
  return (byKey(phase?.color) || byKey(AUTO_ORDER[index % AUTO_ORDER.length])).css;
}
/** Première couleur pas encore prise, dans l'ordre d'attribution (sinon on recommence). */
export function nextColor(phases) {
  const used = new Set(phases.map((p, i) => (byKey(p.color) ? p.color : AUTO_ORDER[i % AUTO_ORDER.length])));
  return AUTO_ORDER.find((k) => !used.has(k)) || AUTO_ORDER[phases.length % AUTO_ORDER.length];
}

const PLURAL = {
  'Rideau': 'Rideaux', 'Voilage': 'Voilages', 'Store Bateau': 'Stores bateaux',
  'Store Enrouleur': 'Stores enrouleurs', 'Store Vénitien': 'Stores vénitiens',
  'Coussin': 'Coussins', 'Plaid': 'Plaids', 'Tenture Murale': 'Tentures murales',
};

const clean = (v) => String(v ?? '').trim();
const num = (v) => parseFloat(v) || 0;

/** Phase complétée des champs du phasage (compatibilité des phases nom + date). */
export function normalizePhase(p) {
  return {
    ...p,
    label: p?.label ?? '',
    date: p?.date ?? '',
    rules: Array.isArray(p?.rules) ? p.rules : [],
    row_ids: Array.isArray(p?.row_ids) ? p.row_ids : [],
    excluded_ids: Array.isArray(p?.excluded_ids) ? p.excluded_ids : [],
  };
}
export const normalizePhases = (phases) => (Array.isArray(phases) ? phases : []).map(normalizePhase);

/** Ouvrages du dossier : une entrée par ligne, une seule par paire décentrée. */
export function buildOuvrages(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const pairMembers = {};
  for (const r of list) if (r?.pair_role && r.pair_id) (pairMembers[r.pair_id] ||= []).push(r);
  const out = [];
  for (const r of list) {
    if (!r || r.pair_role === 'left' || r.pair_role === 'right') continue;
    const members = r.pair_role === 'parent' && r.pair_id ? pairMembers[r.pair_id] : [r];
    out.push({
      id: r.id,
      zone: clean(r.zone), piece: clean(r.piece), fenetre: clean(r.fenetre), produit: clean(r.produit),
      largeur: r.largeur ?? null, hauteur: r.hauteur ?? null,
      prepa: members.reduce((a, m) => a + num(m.heures_prepa), 0),
      conf: members.reduce((a, m) => a + num(m.heures_confection), 0),
      pose: members.reduce((a, m) => a + num(m.heures_pose), 0),
    });
  }
  return out;
}

export const ruleScore = (rule) => CRITERIA.filter(({ key }) => rule?.[key]?.length).length;
export const ruleMatches = (rule, o) =>
  CRITERIA.every(({ key }) => !rule?.[key]?.length || rule[key].map(clean).includes(o[key]));

/**
 * Phase d'un ouvrage : { phaseId, source: 'manual' | 'rule' | null, ruleIndex, conflict }.
 * `conflict` liste les phases à égalité quand il y en a plusieurs.
 */
export function resolveOuvrage(o, phases) {
  const manual = phases.find((p) => p.row_ids.includes(o.id));
  if (manual) return { phaseId: manual.id, source: 'manual', ruleIndex: -1, conflict: null };
  let best = 0, hits = [], ruleIndex = -1;
  for (const p of phases) {
    if (p.excluded_ids.includes(o.id)) continue;
    p.rules.forEach((r, i) => {
      const s = ruleScore(r);
      if (!s || !ruleMatches(r, o)) return;
      if (s > best) { best = s; hits = [p.id]; ruleIndex = i; }
      else if (s === best && !hits.includes(p.id)) hits.push(p.id);
    });
  }
  if (!hits.length) return { phaseId: GLOBAL, source: null, ruleIndex: -1, conflict: null };
  return { phaseId: hits[0], source: 'rule', ruleIndex, conflict: hits.length > 1 ? hits : null };
}

/** Map id d'ouvrage → résolution. */
export const resolveAll = (ouvrages, phases) =>
  Object.fromEntries(ouvrages.map((o) => [o.id, resolveOuvrage(o, phases)]));

export const sumHours = (ouvrages) => ouvrages.reduce(
  (a, o) => ({ prepa: a.prepa + o.prepa, conf: a.conf + o.conf, pose: a.pose + o.pose }),
  { prepa: 0, conf: 0, pose: 0 },
);

/** Libellé lisible d'un critère : « Rideaux, Voilages · APT05 », « APT02, APT04 ». */
export function ruleLabel(rule) {
  const prod = (rule?.produit || []).map((p) => PLURAL[p] || p).join(', ');
  const place = ['zone', 'piece', 'fenetre']
    .filter((k) => rule?.[k]?.length)
    .map((k) => (k === 'fenetre' ? 'fenêtre ' : '') + rule[k].join(', '))
    .join(' · ');
  return [prod, place].filter(Boolean).join(' · ') || '—';
}

/** Contenu d'une phase, regroupé comme il a été défini : un groupe par critère + « un par un ». */
export function phaseGroups(phase, ouvrages, resolved) {
  const mine = ouvrages.filter((o) => resolved[o.id]?.phaseId === phase.id);
  const groups = phase.rules.map((r, i) => ({
    key: `r${i}`, label: ruleLabel(r),
    ouvrages: mine.filter((o) => resolved[o.id].source === 'rule' && resolved[o.id].ruleIndex === i),
  }));
  const manual = mine.filter((o) => resolved[o.id].source === 'manual');
  if (manual.length) groups.push({ key: 'manual', label: 'Ajoutés un par un', ouvrages: manual });
  return { ouvrages: mine, groups };
}

// ── Modifications (fonctions pures : renvoient une nouvelle liste de phases) ──
const update = (phases, id, fn) => phases.map((p) => (p.id === id ? fn(p) : p));
const without = (list, ids) => list.filter((x) => !ids.includes(x));

export const addRule = (phases, id, rule) => update(phases, id, (p) => ({ ...p, rules: [...p.rules, rule] }));
export const removeRule = (phases, id, index) => update(phases, id, (p) => ({ ...p, rules: p.rules.filter((_, i) => i !== index) }));

/** Ajoute des ouvrages un par un à une phase (ils quittent toute autre phase). */
export const addOuvrages = (phases, id, ids) => phases.map((p) => (p.id === id
  ? { ...p, row_ids: [...without(p.row_ids, ids), ...ids], excluded_ids: without(p.excluded_ids, ids) }
  : { ...p, row_ids: without(p.row_ids, ids) }));

/** Retire des ouvrages d'une phase : retrait de l'ajout un par un, et exclusion s'ils restent visés par un critère. */
export const removeOuvrages = (phases, id, ids, ouvrages) => update(phases, id, (p) => {
  const stillMatched = ids.filter((oid) => {
    const o = ouvrages.find((x) => x.id === oid);
    return o && p.rules.some((r) => ruleScore(r) && ruleMatches(r, o));
  });
  return { ...p, row_ids: without(p.row_ids, ids), excluded_ids: [...without(p.excluded_ids, stillMatched), ...stillMatched] };
});

/** Rend des ouvrages aux seuls critères (annule ajouts et retraits faits un par un, toutes phases). */
export const resetOuvrages = (phases, ids) => phases.map((p) => ({
  ...p, row_ids: without(p.row_ids, ids), excluded_ids: without(p.excluded_ids, ids),
}));
