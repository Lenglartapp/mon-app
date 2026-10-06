// Construit l'aperçu d'un devis Odoo (sections + lignes) à partir des lignes d'une minute.
// Fonction PURE (aucun appel réseau) : partagée par l'aperçu navigateur et, plus tard,
// par l'endpoint qui créera réellement le devis dans Odoo.
//
// Principe : le prix d'une ligne de minute = somme de ses colonnes PV (+ livraison),
// cf. recomputeRow.js §12. On ventile chaque colonne vers un article Odoo, puis on
// regroupe par section (zone / pièce / produit…). Deux colonnes envoyées vers le même
// article dans la même section fusionnent en une seule ligne (ex. méca + méca bis).

import { DECOR_PRODUIT_RE } from '../constants/productRouting';

const toNum = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const qtyOf = (r) => Math.max(1, toNum(r?.quantite));
const round2 = (n) => Math.round(n * 100) / 100;
const round3 = (n) => Math.round(n * 1000) / 1000;
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ─── Colonnes de prix de la minute ─────────────────────────────────────────────
// family : regroupe l'affichage ; mlKey/refKey : pour les lignes au mètre ;
// hoursKey : heures vendues portées par la ligne Odoo ; paKey : coût d'achat (→ champ
// « Coût » purchase_price d'Odoo). Convention de coût = celle de lib/purchases/chapters.js
// (PA × quantité). Main-d'œuvre interne et livraison : pas de coût d'achat dans la minute.
export const COMPONENTS = [
  { key: 'pv_tissu1', paKey: 'pa_tissu1', label: 'Tissu 1', family: 'Tissus', mlKey: 'ml_tissu1', refKey: 'tissu_deco1', laizeKey: 'laize_tissu1', defaultProduct: 'Tissu' },
  { key: 'pv_tissu2', paKey: 'pa_tissu2', label: 'Tissu 2', family: 'Tissus', mlKey: 'ml_tissu2', refKey: 'tissu_deco2', laizeKey: 'laize_tissu2', defaultProduct: 'Tissu' },
  { key: 'pv_tissu_1', paKey: 'pa_tissu_1', label: 'Tissu 1 (déco)', family: 'Tissus', mlKey: 'ml_tissu_1', refKey: 'tissu_1', defaultProduct: 'Tissu' },
  { key: 'pv_tissu_2', paKey: 'pa_tissu_2', label: 'Tissu 2 (déco)', family: 'Tissus', mlKey: 'ml_tissu_2', refKey: 'tissu_2', defaultProduct: 'Tissu' },
  { key: 'pv_doublure', paKey: 'pa_doublure', label: 'Doublure', family: 'Tissus', mlKey: 'ml_doublure', refKey: 'doublure', laizeKey: 'laize_doublure', defaultProduct: 'Doublure' },
  { key: 'pv_interdoublure', paKey: 'pa_interdoublure', label: 'Interdoublure', family: 'Tissus', mlKey: 'ml_interdoublure', refKey: 'interdoublure', laizeKey: 'laize_interdoublure', defaultProduct: 'Interdoublure' },
  { key: 'pv_molleton', paKey: 'pa_molleton', label: 'Molleton', family: 'Tissus', defaultProduct: 'Article Générique UNITÉS' },
  { key: 'pv_pass1', paKey: 'pa_pass1', label: 'Passementerie 1', family: 'Passementerie', mlKey: 'ml_pass1', refKey: 'passementerie1', defaultProduct: 'Article Générique ML' },
  { key: 'pv_pass2', paKey: 'pa_pass2', label: 'Passementerie 2', family: 'Passementerie', mlKey: 'ml_pass2', refKey: 'passementerie2', defaultProduct: 'Article Générique ML' },
  { key: 'pv_pass_1', paKey: 'pa_pass_1', label: 'Passementerie 1 (déco)', family: 'Passementerie', mlKey: 'ml_pass_1', refKey: 'pass_1', defaultProduct: 'Article Générique ML' },
  { key: 'pv_pass_2', paKey: 'pa_pass_2', label: 'Passementerie 2 (déco)', family: 'Passementerie', mlKey: 'ml_pass_2', refKey: 'pass_2', defaultProduct: 'Article Générique ML' },
  { key: 'pv_embrasse', paKey: 'pa_embrasse', label: 'Embrasse', family: 'Passementerie', defaultProduct: 'Accessoire' },
  { key: 'pv_mecanisme', paKey: 'pa_mecanisme', label: 'Mécanisme', family: 'Mécanismes', refKey: 'modele_mecanisme', defaultProduct: '@meca' },
  { key: 'pv_mecanisme_bis', paKey: 'pa_mecanisme_bis', label: 'Mécanisme bis', family: 'Mécanismes', refKey: 'mecanisme_bis', defaultProduct: '@meca' },
  { key: 'pv_mecanisme_store', paKey: 'pa_mecanisme_store', label: 'Mécanisme store', family: 'Mécanismes', defaultProduct: '@meca' },
  { key: 'pv_interieur', paKey: 'pa_interieur', label: 'Intérieur', family: 'Autres fournitures', defaultProduct: 'Article Générique UNITÉS' },
  { key: 'pv_toile_finition_1', paKey: 'pa_toile_finition_1', label: 'Toile de finition', family: 'Autres fournitures', defaultProduct: 'Article Générique UNITÉS' },
  { key: 'pv_baguette_1', paKey: 'pa_baguette_1', label: 'Baguette 1', family: 'Autres fournitures', defaultProduct: 'Article Générique UNITÉS' },
  { key: 'pv_baguette_2', paKey: 'pa_baguette_2', label: 'Baguette 2', family: 'Autres fournitures', defaultProduct: 'Article Générique UNITÉS' },
  { key: 'pv_confection', label: 'Confection', family: "Main-d'œuvre", hoursKey: 'heures_confection', bucket: 'conf', defaultProduct: '@confection' },
  { key: 'st_conf_pv', paKey: 'st_conf_pa', label: 'Sous-traitance confection', family: 'Sous-traitance', defaultProduct: '@manufacture' },
  { key: 'pv_prepa', label: 'Préparation', family: "Main-d'œuvre", hoursKey: 'heures_prepa', bucket: 'prepa', defaultProduct: 'Préparation et équipement' },
  { key: 'pv_pose', label: 'Pose', family: "Main-d'œuvre", hoursKey: 'heures_pose', bucket: 'pose', defaultProduct: 'Pose' },
  { key: 'st_pose_pv', paKey: 'st_pose_pa', label: 'Sous-traitance pose', family: 'Sous-traitance', defaultProduct: 'Installation' },
  { key: 'livraison', label: 'Livraison', family: 'Logistique', defaultProduct: 'Livraison' },
  { key: '__deplacement', label: 'Déplacements / prise de cotes', family: 'Logistique', bucket: 'depl', defaultProduct: '@deplacement' },
];

// Articles « intelligents » : choisis ligne par ligne selon le contenu de la minute.
export const AUTO_PRODUCTS = {
  '@confection': 'Auto — Confection selon le produit',
  '@manufacture': 'Auto — Manufacture (sous-traitance) selon le produit',
  '@meca': 'Auto — Rail / mécanisme selon le modèle',
  '@deplacement': 'Auto — Prise de cotes / Frais de déplacement',
};

export const GROUP_BY_OPTIONS = [
  { value: 'none', label: 'Une seule section' },
  { value: 'zone', label: 'Par zone' },
  { value: 'piece', label: 'Par pièce' },
  { value: 'produit', label: 'Par produit' },
  { value: 'zone_produit', label: 'Zone › Produit' },
  { value: 'zone_piece', label: 'Zone › Pièce' },
];

// Ordre vertical par défaut dans une section = celui des devis Lenglart actuels
// (CV26-1231/1232/1234) : Pose, Livraison, Rail, Préparation, Confection, Tissu…
export const DEFAULT_ORDER = [
  'pv_pose', 'st_pose_pv', 'livraison',
  'pv_mecanisme', 'pv_mecanisme_bis', 'pv_mecanisme_store',
  'pv_prepa', 'pv_confection', 'st_conf_pv',
  'pv_tissu1', 'pv_tissu2', 'pv_tissu_1', 'pv_tissu_2', 'pv_doublure', 'pv_interdoublure', 'pv_molleton',
  'pv_pass1', 'pv_pass2', 'pv_pass_1', 'pv_pass_2', 'pv_embrasse',
  'pv_interieur', 'pv_toile_finition_1', 'pv_baguette_1', 'pv_baguette_2',
  '__deplacement',
];

export function defaultConfig() {
  const mapping = {};
  for (const c of COMPONENTS) {
    mapping[c.key] = {
      product: c.defaultProduct,
      placement: c.defaultPlacement || 'section',
      unit: c.mlKey ? 'ml' : 'forfait',
    };
  }
  // overrides : { [`${groupBy}|${titreSection}`]: { [componentKey]: article } }
  // charges : { [chargeKey]: hôte } — absent = hôte par défaut (defaultChargeHost)
  return { groupBy: 'zone', mapping, order: [...DEFAULT_ORDER], overrides: {}, charges: {} };
}

/** Complète un réglage sauvegardé avec les nouveautés (colonnes ajoutées depuis). */
export function normalizeConfig(saved) {
  const base = defaultConfig();
  if (!saved) return base;
  const order = (saved.order || []).filter((k) => base.order.includes(k));
  for (const k of base.order) if (!order.includes(k)) order.push(k);
  return { ...base, ...saved, mapping: { ...base.mapping, ...(saved.mapping || {}) }, order, overrides: saved.overrides || {}, charges: saved.charges || {} };
}

export const overrideKey = (groupBy, title) => `${groupBy}|${title}`;

// ─── Charges annexes (coût sans prix de vente) ─────────────────────────────────
// « Autres dépenses » de la minute. Règle : chaque coût doit être porté par un article
// dont l'étiquette analytique Odoo correspond à sa nature (c'est l'article qui décide de
// la case du contrôle de gestion Odoo : Transport sur ventes = coût des lignes Livraison,
// Location / outillage = article Location, ST Conf = Manufacture…, etc.).
// La commission partenaire n'est PAS un coût de ligne : Odoo la calcule depuis le champ
// `commission_partenaire_taux` (% du CA HT) du devis. La commission commerciale interne
// est calculée par Odoo lui-même → jamais reportée.
// Hôte = un article (nom ou id), '@manufacture', '@commission' ou 'none'.
export const CHARGE_SPECIAL_HOSTS = {
  '@commission': 'Commission partenaire (taux % du devis Odoo)',
  '@manufacture': 'Manufacture (sous-traitance) selon le produit',
  none: 'Ne pas reporter',
};
const DEFAULT_CHARGE_HOST = {
  'Transport Vente': 'Livraison',
  'Transport Sous-Traitance': 'Livraison',
  Location: 'Location',
  'Intérim': 'Pose',
  'Aide ST Pose': 'Installation',
  'Aide ST Conf': '@manufacture',
  'Commission Partenaire': '@commission',
};
export const defaultChargeHost = (key) => DEFAULT_CHARGE_HOST[key] || 'none';

/** Charges annexes d'une minute (autres dépenses regroupées) : [{ key, label, amount, details }]. */
export function collectCharges({ extraRows = [] }) {
  const byCat = new Map();
  for (const r of extraRows) {
    const amount = toNum(r.montant_eur ?? r.prix_total);
    if (!amount) continue;
    let cat = (r.categorie || '').trim() || 'Autres dépenses';
    if (/location|outillage/i.test(`${cat} ${r.libelle || ''}`) && !/commission/i.test(cat)) cat = 'Location';
    const c = byCat.get(cat) || { key: cat, label: cat, amount: 0, details: [] };
    c.amount += amount;
    if (r.libelle) c.details.push(r.libelle);
    byCat.set(cat, c);
  }
  return [...byCat.values()].map((c) => ({ ...c, amount: round2(c.amount) }));
}

// ─── Résolution des articles Odoo ──────────────────────────────────────────────
function makeResolver(products) {
  const byName = new Map(products.map((p) => [norm(p.name), p]));
  const byId = new Map(products.map((p) => [String(p.id), p]));
  const named = (n) => byName.get(norm(n)) || null;

  const confectionFor = (row) => {
    const p = norm(row.produit);
    const rules = [
      [/voilage/, 'Confection Voilages'],
      [/rideau/, 'Confection Rideaux'],
      [/coussin/, 'Confection Coussins'],
      [/plaid/, 'Confection Plaid'],
      [/cache.?sommier/, 'Confection Cache-sommier'],
      [/bateau/, 'Confection Store Bateau - Amistar'],
      [/velum/, 'Confection Store Velum - Amistar Garden'],
    ];
    for (const [re, name] of rules) if (re.test(p) && named(name)) return named(name);
    return named('Confection');
  };

  const manufactureFor = (row) => {
    const p = norm(row?.produit);
    const rules = [
      [/voilage/, 'Manufacture Voilage'],
      [/rideau/, 'Manufacture Rideau'],
      [/coussin/, 'Manufacture Coussins'],
      [/plaid/, 'Manufacture Plaids'],
      [/cache.?sommier/, 'Manufacture Cache-sommier'],
      [/t[eê]te/, 'Manufacture Tête de Lit'],
      [/bateau/, 'Manufacture Store Bateau'],
      [/velum/, 'Manufacture Store Velum'],
    ];
    for (const [re, name] of rules) if (re.test(p) && named(name)) return named(name);
    return named('Manufacture');
  };

  // Rails / mécanismes : on cherche l'article dont le mot distinctif apparaît dans le
  // modèle saisi (« FOREST KS (Kontrakt) Blanc » → Rail Kontrakt), motorisé si besoin.
  const STOP = new Set(['rail', 'rails', 'motorise', 'voies', 'diametre', 'store', 'stores', 'mecanisme', 'amistar', 'garden', 'amishade', '20mm', '28mm']);
  const mecaCandidates = products
    .filter((p) => /^(rail|store|mecanisme|stores)\b/.test(norm(p.name)))
    .map((p) => ({
      p,
      motor: /motoris/.test(norm(p.name)),
      words: norm(p.name).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w)),
    }))
    .filter((c) => c.words.length);
  const mecaFor = (row, refKey) => {
    const model = norm([row[refKey], row.modele_mecanisme, row.type_mecanisme].filter(Boolean).join(' '));
    const wantMotor = /motor|moteur/.test(model);
    const hits = mecaCandidates.filter((c) => c.words.every((w) => model.includes(w)));
    const best = hits.find((c) => c.motor === wantMotor) || hits[0];
    if (best) return best.p;
    return named(wantMotor ? 'Mécanisme Motorisé' : 'Mécanisme');
  };

  return (choice, row, comp) => {
    if (choice === '@confection') return confectionFor(row);
    if (choice === '@manufacture') return manufactureFor(row);
    if (choice === '@meca') return mecaFor(row, comp.refKey);
    if (choice === '@deplacement') return named(/cotes/i.test(row.type_deplacement || '') ? 'Prise de cotes' : 'Frais de déplacement');
    return byId.get(String(choice)) || named(choice);
  };
}

// ─── Sections ──────────────────────────────────────────────────────────────────
function sectionKeyOf(row, groupBy) {
  const z = (row.zone || '').trim();
  const pc = (row.piece || '').trim();
  const pr = (row.produit || '').trim();
  switch (groupBy) {
    case 'none': return '';
    case 'zone': return z || 'Sans zone';
    case 'piece': return pc || 'Sans pièce';
    case 'produit': return pr || 'Sans produit';
    case 'zone_produit': return [z, pr].filter(Boolean).join(' — ') || 'Divers';
    case 'zone_piece': return [z, pc].filter(Boolean).join(' — ') || 'Divers';
    default: return '';
  }
}

// ─── Textes des lignes (style des devis Lenglart actuels) ──────────────────────
const plural = (n, word) => {
  const w = String(word || 'élément').toLowerCase();
  if (n <= 1 || /[sxz]$/.test(w)) return w;
  return /(eau|au|eu)$/.test(w) ? `${w}x` : `${w}s`;
};
const fmtNum = (n) => String(round2(n)).replace('.', ',');

function dimsList(sources, { withMeca = false } = {}) {
  const groups = new Map();
  for (const { row } of sources) {
    const L = withMeca ? toNum(row.largeur_mecanisme) || toNum(row.largeur) : toNum(row.largeur);
    const H = toNum(row.hauteur);
    const k = `${row.produit}|${L}|${H}`;
    const g = groups.get(k) || { produit: row.produit, L, H, n: 0 };
    g.n += qtyOf(row);
    groups.set(k, g);
  }
  return [...groups.values()].map((g) => {
    if (withMeca) return `${g.n} ${plural(g.n, 'rail')} de Longueur ${fmtNum(g.L)} cm`;
    const dims = [g.L && `Largeur ${fmtNum(g.L)} cm`, g.H && `Hauteur ${fmtNum(g.H)} cm`].filter(Boolean).join(' sur ');
    return `${g.n} ${plural(g.n, g.produit)}${dims ? ` de ${dims}` : ''}`;
  });
}
const distinct = (sources, key) => [...new Set(sources.map((s) => (s.row[key] ?? '').toString().trim()).filter(Boolean))];

function describe(line) {
  const { product, comp, sources } = line;
  const out = [product?.name || comp.label];
  const fam = comp.family;
  if (comp.key === '__deplacement') {
    out.push(...distinct(sources, 'libelle'));
  } else if (fam === 'Tissus' || fam === 'Passementerie') {
    for (const ref of distinct(sources, comp.refKey)) out.push(`Réalisé en notre référence ${ref}`);
    if (comp.laizeKey) for (const lz of distinct(sources, comp.laizeKey)) out.push(`Laize : ${lz} cm`);
  } else if (fam === 'Mécanismes') {
    out.push(...distinct(sources, comp.refKey || 'modele_mecanisme'));
    out.push('Soit :', ...dimsList(sources, { withMeca: true }));
  } else if (comp.bucket === 'conf') {
    out.push(...distinct(sources, 'type_confection').map((p) => (/^pli/i.test(p) ? p : `Plis ${p}`)));
    out.push(...distinct(sources, 'ampleur').map((a) => `Ampleur ${String(a).replace('.', ',')}`));
    out.push(...distinct(sources, 'finition_bas').map((f) => `Finition bas : ${f}`));
    out.push('Soit :', ...dimsList(sources));
  } else if (comp.bucket === 'prepa') {
    out.push('pour :', ...dimsList(sources, { withMeca: true }));
  } else if (comp.bucket === 'pose') {
    out.push(...distinct(sources, 'type_pose').map((t) => `Pose ${t.toLowerCase()}`));
    out.push('Soit :', ...dimsList(sources));
  }
  return out.join('\n');
}

// ─── Construction ──────────────────────────────────────────────────────────────
/**
 * @param {object} p
 * @param {Array} p.rows      lignes de la minute (déjà recalculées, cf. ChiffrageScreen)
 * @param {Array} p.depRows   déplacements
 * @param {object} p.config   cf. defaultConfig()
 * @param {Array} p.extraRows « Autres dépenses » (charges sans prix de vente)
 * @param {Array} p.products  articles Odoo [{ id, name, uom }]
 */
export function buildQuote({ rows = [], depRows = [], extraRows = [], config, products = [] }) {
  const resolve = makeResolver(products);
  const compByKey = new Map(COMPONENTS.map((c) => [c.key, c]));
  const sections = new Map(); // titre → { title, order, lines: Map }
  const warnings = [];
  let minuteTotal = 0;
  let minuteCost = 0;

  const sectionFor = (title, order) => {
    if (!sections.has(title)) sections.set(title, { title, order, lines: new Map() });
    return sections.get(title);
  };

  const order = config.order || DEFAULT_ORDER;
  const rank = (key) => { const i = order.indexOf(key); return i < 0 ? 999 : i; };

  const isolate = config.logistique === 'isole';
  const LOGI_TITLE = 'DÉPLACEMENT & TRANSPORT';
  const isLogi = (key) => key === 'livraison' || key === '__deplacement';

  const push = ({ row, comp, amount, cost, ml, hours, sectionTitle, sectionOrder, product: forced }) => {
    const m = config.mapping[comp.key] || {};
    // Livraison / déplacement : leur place dépend de l'option « logistique », pas de « à part ».
    const toLogi = isolate && isLogi(comp.key);
    const apartPlacement = !isLogi(comp.key) && m.placement === 'apart';
    const ov = !apartPlacement && !toLogi && config.overrides?.[overrideKey(config.groupBy, sectionTitle)]?.[comp.key];
    const product = forced || resolve(ov || m.product, row, comp);
    if (!product) warnings.push(`Aucun article Odoo pour « ${comp.label} » (${row.produit || row.libelle || 'ligne'}).`);
    const title = toLogi ? LOGI_TITLE : apartPlacement ? (comp.apartTitle || comp.label).toUpperCase() : sectionTitle;
    const sec = sectionFor(title, toLogi ? 2e6 : apartPlacement ? 1e6 + rank(comp.key) : sectionOrder);
    const byMl = m.unit === 'ml' && comp.mlKey;
    const ref = byMl ? norm(row[comp.refKey]) : '';
    const lineKey = `${product?.id ?? comp.key}|${byMl ? 'ml' : 'f'}|${ref}`;
    const line = sec.lines.get(lineKey) || { key: lineKey, product, comp, byMl, amount: 0, cost: 0, ml: 0, hours: 0, sources: [], comps: new Map(), charges: [] };
    line.amount += amount;
    line.cost += cost || 0;
    line.ml += ml || 0;
    line.hours += hours || 0;
    line.sources.push({ row });
    line.comps.set(comp.key, comp.label);
    sec.lines.set(lineKey, line);
  };

  // 1. Lignes de minute → une contribution par colonne de prix non nulle.
  rows.forEach((row, idx) => {
    const total = toNum(row.prix_total ?? row.total_price);
    minuteTotal += total;
    const q = qtyOf(row);
    const decor = DECOR_PRODUIT_RE.test(String(row.produit || ''));
    const costOf = (c) => {
      if (!c.paKey) return 0;
      // pa_meca : champ legacy des vieilles lignes, rattaché au mécanisme principal (cf. chapters.js).
      const pa = toNum(row[c.paKey]) + (c.key === 'pv_mecanisme' ? toNum(row.pa_meca) : 0);
      return pa * q;
    };
    // Une colonne compte si elle a un prix de vente OU un coût (un coût sans prix ne doit
    // pas disparaître : il part sur une ligne à 0 € pour que la marge Odoo reste juste).
    const parts = COMPONENTS.filter((c) => c.key !== '__deplacement')
      .map((c) => ({ c, raw: toNum(row[c.key]) * (decor ? q : 1), cost: costOf(c) }))
      .filter((x) => x.raw !== 0 || x.cost !== 0);
    const sum = parts.reduce((a, x) => a + x.raw, 0);
    if (!sum) {
      if (total) warnings.push(`Ligne « ${row.produit || '?'} ${row.piece || ''} » : total sans détail de prix, ignorée.`);
      return;
    }
    // Coefficient de recalibrage éventuel : on le répartit au prorata sur toutes les colonnes.
    const k = total ? total / sum : 1;
    const sectionTitle = sectionKeyOf(row, config.groupBy);
    const sectionOrder = [...sections.keys()].indexOf(sectionTitle) >= 0 ? sections.get(sectionTitle).order : idx;
    for (const { c, raw, cost } of parts) {
      minuteCost += cost;
      push({
        row, comp: c, amount: raw * k, cost,
        ml: c.mlKey ? toNum(row[c.mlKey]) * (decor ? q : 1) : 0,
        hours: c.hoursKey ? toNum(row[c.hoursKey]) * q : 0,
        sectionTitle, sectionOrder,
      });
    }
  });

  // Poids de chaque section « normale » (hors à part / logistique), pour répartir.
  const weights = () => {
    const secs = [...sections.values()].filter((sec) => sec.order < 1e6);
    const amt = secs.map((sec) => [...sec.lines.values()].reduce((a, l) => a + l.amount, 0));
    const tot = amt.reduce((a, x) => a + x, 0);
    return secs.map((sec, i) => ({ sec, w: tot > 0 ? amt[i] / tot : 1 / secs.length }));
  };

  // 2. Déplacements. Une ligne de déplacement = main-d'œuvre (heures facturées) + frais
  //    (nuits + repas + billets, revendus à prix coûtant). On les sépare pour l'analytique :
  //    la main-d'œuvre va sur l'article auto (Prise de cotes → étiquette Pose, sinon Frais de
  //    déplacement), les frais TOUJOURS sur « Frais de déplacement » (étiquette Frais de
  //    Déplacement). Isolés → section logistique ; fondus → répartis au prorata des sections.
  const depComp = compByKey.get('__deplacement');
  const fraisProduct = resolve('Frais de déplacement', {}, {});
  const ws = weights();
  depRows.forEach((row) => {
    const total = toNum(row.prix_total ?? row.total_price);
    const frais = toNum(row.cout_nuits) + toNum(row.cout_repas) + toNum(row.cout_billet_total);
    if (!total && !frais) return;
    minuteTotal += total;
    minuteCost += frais;
    const hours = toNum(row.heures_facturees);
    const mo = total - frais;
    const dest = isolate || !ws.length ? [{ sec: { title: LOGI_TITLE, order: 2e6 }, w: 1 }] : ws;
    for (const { sec, w } of dest) {
      if (mo || hours) push({ row, comp: depComp, amount: mo * w, cost: 0, hours: hours * w, sectionTitle: sec.title, sectionOrder: sec.order });
      if (frais) push({ row, comp: depComp, amount: frais * w, cost: frais * w, hours: 0, sectionTitle: sec.title, sectionOrder: sec.order, product: fraisProduct });
    }
  });

  // 3. Charges annexes → coût des lignes de l'article hôte (même étiquette analytique).
  let commissionPartenaire = 0;
  const charges = collectCharges({ extraRows }).map((ch) => {
    const host = config.charges?.[ch.key] || defaultChargeHost(ch.key);
    minuteCost += ch.amount; // une charge non reportée apparaît en écart dans le contrôle (voulu)
    if (host === 'none') return { ...ch, host, applied: false };
    if (host === '@commission') { commissionPartenaire += ch.amount; return { ...ch, host, applied: true }; }

    const isManuf = host === '@manufacture';
    const hostProduct = isManuf ? null : resolve(host, {}, {});
    if (!isManuf && !hostProduct) {
      warnings.push(`« ${ch.label} » : article « ${host} » introuvable dans Odoo, coût non reporté.`);
      return { ...ch, host, applied: false };
    }
    const matches = (l) => (isManuf ? /^manufacture/i.test(l.product?.name || '') : String(l.product?.id) === String(hostProduct.id));
    const targets = [...sections.values()].flatMap((sec) => [...sec.lines.values()]).filter(matches);
    const addTo = (l, amount) => { l.cost += amount; l.charges.push({ label: ch.label, amount }); };

    if (targets.length) {
      const base = targets.reduce((a, l) => a + Math.max(0, l.amount), 0);
      for (const l of targets) addTo(l, base > 0 ? (Math.max(0, l.amount) / base) * ch.amount : ch.amount / targets.length);
    } else {
      // Aucune ligne de cet article : on crée des lignes « coût seul » (0 €) — dans la
      // section logistique si isolée et que c'est un coût logistique, sinon une par section.
      const chComp = { key: `__charge:${ch.key}`, label: ch.label, family: 'Charges' };
      const logiHost = !isManuf && /^(livraison|location|frais de deplacement)$/.test(norm(hostProduct.name));
      const dest = (isolate && logiHost) || !ws.length ? [{ sec: { title: LOGI_TITLE, order: 2e6 }, w: 1 }] : ws;
      for (const { sec, w } of dest) {
        const row = isManuf ? ([...(sections.get(sec.title)?.lines.values() || [])][0]?.sources[0]?.row || {}) : {};
        const product = isManuf ? resolve('@manufacture', row, chComp) : hostProduct;
        const s2 = sectionFor(sec.title, sec.order);
        const key = `${product?.id ?? chComp.key}|f|`;
        const l = s2.lines.get(key) || { key, product, comp: chComp, byMl: false, amount: 0, cost: 0, ml: 0, hours: 0, sources: [], comps: new Map([[chComp.key, chComp.label]]), charges: [], costOnly: true };
        s2.lines.set(key, l);
        addTo(l, ch.amount * w);
      }
    }
    return { ...ch, host, applied: true };
  });

  // 4. Mise en forme : PU / quantités, textes, heures par catégorie.
  const hours = { conf: 0, prepa: 0, pose: 0, depl: 0 };
  // Lignes « coût seul » créées pour une charge : rangées juste après la livraison.
  const rankOf = (k) => (k.startsWith('__charge:') ? rank('livraison') + 0.5 : rank(k));
  let quoteTotal = 0;
  let quoteCost = 0;
  const outSections = [...sections.values()]
    .sort((a, b) => a.order - b.order)
    .map((sec) => {
      const lines = [...sec.lines.values()]
        .map((l) => ({ ...l, rank: Math.min(...[...l.comps.keys()].map(rankOf)) }))
        .sort((a, b) => a.rank - b.rank)
        .map((l) => {
          const subtotal = round2(l.amount);
          let qty = 1, uom = 'forfait', priceUnit = subtotal;
          if (l.byMl && l.ml > 0) {
            qty = round2(l.ml);
            uom = 'ml';
            priceUnit = round3(subtotal / qty);
          }
          const odooSubtotal = round2(qty * priceUnit);
          quoteTotal += odooSubtotal;
          // Coût Odoo = coût unitaire (purchase_price) ; Odoo recalcule coût × quantité.
          const costUnit = qty ? round3(l.cost / qty) : 0;
          const cost = round2(costUnit * qty);
          quoteCost += cost;
          if (l.comp.bucket) hours[l.comp.bucket] += l.hours;
          return {
            key: l.key,
            productId: l.product?.id ?? null,
            productName: l.product?.name ?? '— article manquant —',
            description: describe(l),
            qty, uom, priceUnit,
            subtotal: odooSubtotal,
            costUnit, cost,
            hours: round2(l.hours),
            bucket: l.comp.bucket || null,
            charges: (l.charges || []).map((c) => ({ label: c.label, amount: round2(c.amount) })),
            costOnly: !!l.costOnly,
            from: [...l.comps.values()],
            compKeys: [...l.comps.keys()],
            nbRows: l.sources.length,
          };
        });
      return {
        title: sec.title,
        apart: sec.order >= 1e6,
        lines,
        total: round2(lines.reduce((a, l) => a + l.subtotal, 0)),
        cost: round2(lines.reduce((a, l) => a + l.cost, 0)),
      };
    });

  return {
    sections: outSections,
    total: round2(quoteTotal),
    minuteTotal: round2(minuteTotal),
    diff: round2(quoteTotal - minuteTotal),
    cost: round2(quoteCost),
    minuteCost: round2(minuteCost),
    // Contrôle : coûts des lignes + commission partenaire (portée par le taux du devis).
    costDiff: round2(quoteCost + commissionPartenaire - minuteCost),
    charges,
    commissionPartenaire: {
      amount: round2(commissionPartenaire),
      rate: quoteTotal > 0 ? Math.round((commissionPartenaire / quoteTotal) * 1e6) / 1e4 : 0,
    },
    hours: { conf: round2(hours.conf), prepa: round2(hours.prepa), pose: round2(hours.pose), depl: round2(hours.depl) },
    warnings: [...new Set(warnings)],
  };
}
