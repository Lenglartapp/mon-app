// Construit l'aperçu d'un devis Odoo (sections + lignes) à partir des lignes d'une minute.
// Fonction PURE (aucun appel réseau) : partagée par l'aperçu navigateur et, plus tard,
// par l'endpoint qui créera réellement le devis dans Odoo.
//
// Principe : le prix d'une ligne de minute = somme de ses colonnes PV (+ livraison),
// cf. recomputeRow.js §12. Chaque TYPE DE PRODUIT (rideau, store bateau, coussins…) a une
// RECETTE : la liste ordonnée des lignes Odoo qui le composent, chacune alimentée par une
// ou plusieurs colonnes de la minute (ex. « Rail » = méca + méca bis). Dans une section
// qui contient plusieurs produits, on empile la recette de chacun ; une ligne de recette
// sans montant n'apparaît pas.

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
// mlKey/refKey/laizeKey : lignes au mètre ; hoursKey : heures vendues portées par la
// ligne Odoo ; paKey : coût d'achat (→ champ « Coût » purchase_price d'Odoo). Convention
// de coût = celle de lib/purchases/chapters.js (PA × quantité).
export const COMPONENTS = [
  { key: 'pv_tissu1', paKey: 'pa_tissu1', label: 'Tissu 1', family: 'Tissus', mlKey: 'ml_tissu1', refKey: 'tissu_deco1', laizeKey: 'laize_tissu1' },
  { key: 'pv_tissu2', paKey: 'pa_tissu2', label: 'Tissu 2', family: 'Tissus', mlKey: 'ml_tissu2', refKey: 'tissu_deco2', laizeKey: 'laize_tissu2' },
  { key: 'pv_tissu_1', paKey: 'pa_tissu_1', label: 'Tissu 1 (déco)', family: 'Tissus', mlKey: 'ml_tissu_1', refKey: 'tissu_1', laizeKey: 'laize_tissu_1' },
  { key: 'pv_tissu_2', paKey: 'pa_tissu_2', label: 'Tissu 2 (déco)', family: 'Tissus', mlKey: 'ml_tissu_2', refKey: 'tissu_2', laizeKey: 'laize_tissu_2' },
  { key: 'pv_toile_finition_1', paKey: 'pa_toile_finition_1', label: 'Toile de finition', family: 'Tissus', mlKey: 'ml_toile_finition_1', refKey: 'toile_finition_1', laizeKey: 'laize_toile_finition_1' },
  { key: 'pv_doublure', paKey: 'pa_doublure', label: 'Doublure', family: 'Tissus', mlKey: 'ml_doublure', refKey: 'doublure', laizeKey: 'laize_doublure' },
  { key: 'pv_interdoublure', paKey: 'pa_interdoublure', label: 'Interdoublure', family: 'Tissus', mlKey: 'ml_interdoublure', refKey: 'interdoublure', laizeKey: 'laize_interdoublure' },
  { key: 'pv_molleton', paKey: 'pa_molleton', label: 'Molleton', family: 'Tissus', mlKey: 'ml_molleton', refKey: 'molleton' },
  { key: 'pv_pass1', paKey: 'pa_pass1', label: 'Passementerie 1', family: 'Passementerie', mlKey: 'ml_pass1', refKey: 'passementerie1' },
  { key: 'pv_pass2', paKey: 'pa_pass2', label: 'Passementerie 2', family: 'Passementerie', mlKey: 'ml_pass2', refKey: 'passementerie2' },
  { key: 'pv_pass_1', paKey: 'pa_pass_1', label: 'Passementerie 1 (déco)', family: 'Passementerie', mlKey: 'ml_pass_1', refKey: 'pass_1' },
  { key: 'pv_pass_2', paKey: 'pa_pass_2', label: 'Passementerie 2 (déco)', family: 'Passementerie', mlKey: 'ml_pass_2', refKey: 'pass_2' },
  { key: 'pv_embrasse', paKey: 'pa_embrasse', label: 'Embrasse', family: 'Passementerie', refKey: 'embrasse' },
  { key: 'pv_mecanisme', paKey: 'pa_mecanisme', label: 'Mécanisme', family: 'Mécanismes', refKey: 'modele_mecanisme' },
  { key: 'pv_mecanisme_bis', paKey: 'pa_mecanisme_bis', label: 'Mécanisme bis', family: 'Mécanismes', refKey: 'mecanisme_bis' },
  { key: 'pv_mecanisme_store', paKey: 'pa_mecanisme_store', label: 'Mécanisme store', family: 'Mécanismes', refKey: 'mecanisme_store' },
  { key: 'pv_baguette_1', paKey: 'pa_baguette_1', label: 'Baguette 1', family: 'Mécanismes', refKey: 'baguette_1' },
  { key: 'pv_baguette_2', paKey: 'pa_baguette_2', label: 'Baguette 2', family: 'Mécanismes', refKey: 'baguette_2' },
  { key: 'pv_interieur', paKey: 'pa_interieur', label: 'Intérieur (garnissage)', family: 'Autres fournitures', refKey: 'type_interieur' },
  { key: 'pv_confection', label: 'Confection', family: "Main-d'œuvre", hoursKey: 'heures_confection', bucket: 'conf' },
  { key: 'st_conf_pv', paKey: 'st_conf_pa', label: 'Sous-traitance confection', family: 'Sous-traitance' },
  { key: 'pv_prepa', label: 'Préparation', family: "Main-d'œuvre", hoursKey: 'heures_prepa', bucket: 'prepa' },
  { key: 'pv_pose', label: 'Pose', family: "Main-d'œuvre", hoursKey: 'heures_pose', bucket: 'pose' },
  { key: 'st_pose_pv', paKey: 'st_pose_pa', label: 'Sous-traitance pose', family: 'Sous-traitance' },
  { key: 'livraison', label: 'Livraison', family: 'Logistique' },
];
export const COMPONENT_BY_KEY = new Map(COMPONENTS.map((c) => [c.key, c]));
const DEP_COMP = { key: '__deplacement', label: 'Déplacements / prise de cotes', family: 'Logistique', bucket: 'depl' };

// Articles « intelligents » : choisis ligne par ligne selon le contenu de la minute.
export const AUTO_PRODUCTS = {
  '@col': 'Auto — selon la colonne (Pose / Installation, Confection / Manufacture…)',
  '@confection': 'Auto — Confection selon le produit',
  '@manufacture': 'Auto — Manufacture (sous-traitance) selon le produit',
  '@meca': 'Auto — Rail / mécanisme / store selon le modèle',
};

export const SUB_GROUP_BY_OPTIONS = [
  { value: 'none', label: 'Pas de sous-section' },
  { value: 'zone', label: 'Zone' },
  { value: 'piece', label: 'Pièce' },
  { value: 'produit', label: 'Produit' },
];

export const GROUP_BY_OPTIONS = [
  { value: 'none', label: 'Une seule section' },
  { value: 'zone', label: 'Par zone' },
  { value: 'piece', label: 'Par pièce' },
  { value: 'produit', label: 'Par produit' },
  { value: 'zone_produit', label: 'Zone › Produit' },
  { value: 'zone_piece', label: 'Zone › Pièce' },
];

// ─── Recettes par type de produit ──────────────────────────────────────────────
// Recettes validées par l'utilisateur (tableau du 2026-10-06). « Pose / Installation » et
// « Conf / Manufacture » sont UNE position mais DEUX articles selon la colonne ('@col') :
// notre pose → Pose, la sous-traitance → Installation ; notre atelier → Confection, la
// sous-traitance → Manufacture (étiquettes analytiques différentes dans Odoo).
// Location et Déplacement sont des coûts de niveau SECTION (pas d'une ligne de minute) :
// ils s'ajoutent en bas de section, après les recettes.
const L = (id, label, cols, product, extra = {}) => ({ id, label, cols, product, ...extra });
const S = {
  pose: () => L('pose', 'Pose / Installation', ['pv_pose', 'st_pose_pv'], '@col'),
  rail: () => L('rail', 'Rail', ['pv_mecanisme', 'pv_mecanisme_bis', 'pv_baguette_1', 'pv_baguette_2'], '@meca'),
  meca: () => L('meca', 'Mécanismes', ['pv_mecanisme_store', 'pv_mecanisme', 'pv_mecanisme_bis', 'pv_baguette_1', 'pv_baguette_2'], '@meca'),
  prepa: () => L('prepa', 'Prépa', ['pv_prepa'], 'Préparation et équipement'),
  conf: () => L('conf', 'Conf / Manufacture', ['pv_confection', 'st_conf_pv'], '@col'),
  tissu1: () => L('tissu1', 'Tissu 1', ['pv_tissu1', 'pv_tissu_1', 'pv_toile_finition_1'], 'Tissu', { unit: 'ml' }),
  tissu2: () => L('tissu2', 'Tissu 2', ['pv_tissu2', 'pv_tissu_2'], 'Tissu', { unit: 'ml' }),
  doublure: () => L('doublure', 'Doublure', ['pv_doublure'], 'Doublure', { unit: 'ml' }),
  interdoublure: () => L('interdoublure', 'Interdoublure', ['pv_interdoublure', 'pv_molleton'], 'Interdoublure', { unit: 'ml' }),
  // Passementerie, embrasses, intérieurs : article « Tissu » (étiquette CG Tissu). Les articles
  // génériques (Article Générique ML/UNITÉS, Accessoire) n'ont AUCUNE étiquette de contrôle de
  // gestion : leur coût ne serait compté nulle part (réponse ERP du 2026-10-06).
  pass1: () => L('pass1', 'Passementerie 1', ['pv_pass1', 'pv_pass_1'], 'xml:product_passementerie', { unit: 'ml' }),
  pass2: () => L('pass2', 'Passementerie 2', ['pv_pass2', 'pv_pass_2'], 'xml:product_passementerie', { unit: 'ml' }),
  embrasse: () => L('embrasse', 'Embrasse', ['pv_embrasse'], 'xml:product_embrasse'),
  // Intérieurs : ligne à part seulement pour un coussin confectionné chez nous ; s'il est
  // sous-traité, ils rejoignent la ligne Manufacture (cf. buildQuote).
  interieur: () => L('interieur', 'Intérieurs (confection Lenglart)', ['pv_interieur'], 'xml:product_interieur_coussin'),
  livraison: () => L('livraison', 'Livraison', ['livraison'], 'Livraison'),
};
const recipe = (...ids) => ids.map((id) => S[id]());

export const PRODUCT_TYPES = [
  { key: 'rideau', label: 'Rideaux', match: /rideau/, recipe: () => recipe('pose', 'rail', 'prepa', 'conf', 'tissu1', 'tissu2', 'doublure', 'interdoublure', 'pass1', 'pass2', 'embrasse', 'livraison') },
  { key: 'voilage', label: 'Voilages', match: /voilage/, recipe: () => recipe('pose', 'rail', 'prepa', 'conf', 'tissu1', 'tissu2', 'doublure', 'interdoublure', 'pass1', 'pass2', 'embrasse', 'livraison') },
  { key: 'store_bateau', label: 'Store bateau / velum', match: /bateau|velum/, recipe: () => recipe('pose', 'meca', 'prepa', 'conf', 'tissu1', 'tissu2', 'doublure', 'interdoublure', 'pass1', 'pass2', 'livraison') },
  { key: 'store', label: 'Store négoce', match: /store/, recipe: () => recipe('pose', 'prepa', 'meca', 'livraison') },
  { key: 'deco', label: 'Cache-sommier, coussins, plaids', match: /coussin|plaid|sommier/, recipe: () => recipe('livraison', 'conf', 'tissu1', 'tissu2', 'doublure', 'interdoublure', 'pass1', 'pass2', 'interieur') },
  { key: 'mobilier', label: 'Mobilier (tête de lit, cantonnière, siège…)', match: /t[eê]te|mobilier|si[eè]ge|cantonni/, recipe: () => recipe('pose', 'meca', 'prepa', 'conf', 'tissu1', 'tissu2', 'doublure', 'interdoublure', 'pass1', 'pass2', 'livraison') },
  { key: 'tenture', label: 'Tenture murale', match: /tenture/, recipe: () => {
    const r = recipe('pose', 'meca', 'prepa', 'conf', 'tissu1', 'doublure', 'pass1', 'pass2', 'livraison');
    r.find((sl) => sl.id === 'doublure').cols.push('pv_molleton'); // molleton : 56 % des tentures
    return r;
  } },
  { key: 'autre', label: 'Autre produit', match: /.*/, recipe: () => recipe('pose', 'meca', 'prepa', 'conf', 'tissu1', 'tissu2', 'doublure', 'interdoublure', 'pass1', 'pass2', 'embrasse', 'interieur', 'livraison') },
];
export const typeOfRow = (row) => {
  const p = norm(row?.produit);
  return PRODUCT_TYPES.find((t) => t.match.test(p)) || PRODUCT_TYPES[PRODUCT_TYPES.length - 1];
};

// ─── Réglages ──────────────────────────────────────────────────────────────────
export function defaultConfig() {
  return {
    // Sections et sous-sections : regroupement des lignes de la minute (zone, pièce, produit…).
    groupBy: 'zone',
    subGroupBy: 'none',
    // recipes : { [typeKey]: [ { id, label, cols, product, unit } ] } — absent = recette par défaut
    recipes: {},
    // overrides : { [`${groupBy}|${section}`]: { [`${typeKey}:${slotId}`]: article } }
    overrides: {},
    // charges : { [chargeKey]: { host, place } } — absent = défaut (defaultCharge)
    charges: {},
    // logistique : 'fondu' (déplacement réparti dans chaque section, livraison par section)
    //            | 'isole' (une section « DÉPLACEMENT & TRANSPORT » qui porte tout)
    logistique: 'fondu',
  };
}
export const recipeOf = (config, typeKey) =>
  config.recipes?.[typeKey] || PRODUCT_TYPES.find((t) => t.key === typeKey).recipe();

/** Complète un réglage sauvegardé (et ignore les anciens formats). */
export function normalizeConfig(saved) {
  const base = defaultConfig();
  if (!saved || !('logistique' in saved)) return base; // ancien format → on repart propre
  const rest = { ...saved };
  delete rest.placement; // « à part » par colonne : abandonné (2026-10-08)
  return { ...base, ...rest };
}

export const overrideKey = (groupBy, title) => `${groupBy}|${title}`;

// ─── Charges annexes (coût sans prix de vente) ─────────────────────────────────
// « Autres dépenses » de la minute. Chaque coût est porté par un article dont l'étiquette
// analytique Odoo correspond à sa nature (c'est l'article qui décide de la case du contrôle
// de gestion Odoo : Transport sur ventes = coût des lignes Livraison, Location / outillage
// = article Location, ST Conf = Manufacture…). La commission partenaire n'est PAS un coût
// de ligne : Odoo la calcule depuis `commission_partenaire_taux` (% du CA HT) du devis. La
// commission commerciale interne est calculée par Odoo lui-même → jamais reportée.
// host  : un article (nom ou id), '@manufacture', '@commission' ou 'none'.
// place : 'lignes' (sur les lignes existantes de l'article, au prorata ; à défaut → 'auto')
//       | 'auto'   (suit le choix « Déplacement, transport et location » de l'étape Structure :
//                   une ligne dans chaque section si fondus, sinon dans la section à part)
export const CHARGE_SPECIAL_HOSTS = {
  '@commission': 'Commission partenaire (taux % du devis Odoo)',
  '@manufacture': 'Manufacture (sous-traitance) selon le produit',
  none: 'Ne pas reporter',
};
const DEFAULT_CHARGES = {
  'Transport Vente': { host: 'Livraison', place: 'lignes' },
  'Transport Sous-Traitance': { host: 'Livraison', place: 'lignes' },
  Location: { host: 'Location', place: 'auto' },
  'Intérim': { host: 'Pose', place: 'lignes' },
  'Aide ST Pose': { host: 'Installation', place: 'lignes' },
  'Aide ST Conf': { host: '@manufacture', place: 'lignes' },
  'Commission Partenaire': { host: '@commission', place: 'lignes' },
};
export const defaultCharge = (key) => DEFAULT_CHARGES[key] || { host: 'none', place: 'auto' };
export const chargeSetting = (config, key) => {
  const v = config.charges?.[key];
  if (!v) return defaultCharge(key);
  return typeof v === 'string' ? { ...defaultCharge(key), host: v } : { ...defaultCharge(key), ...v };
};

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
const MOTOR_RE = /motor|moteur|elec|rts|filaire|somfy|lutron/;

export const XML_PRODUCTS = {
  'xml:product_passementerie': 'Passementerie',
  'xml:product_embrasse': 'Embrasse',
  'xml:product_interieur_coussin': 'Intérieur de coussin',
};

export function makeResolver(products, missingXml = new Set()) {
  const byName = new Map(products.map((p) => [norm(p.name), p]));
  const byId = new Map(products.map((p) => [String(p.id), p]));
  const named = (...names) => names.map((n) => byName.get(norm(n))).find(Boolean) || null;

  const confectionFor = (row) => {
    const p = norm(row?.produit);
    const rules = [
      [/voilage/, 'Confection Voilages'],
      [/rideau/, 'Confection Rideaux'],
      [/coussin/, 'Confection Coussins'],
      [/plaid/, 'Confection Plaid'],
      [/sommier/, 'Confection Cache-sommier'],
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
      [/sommier/, 'Manufacture Cache-sommier'],
      [/t[eê]te/, 'Manufacture Tête de Lit'],
      [/bateau/, 'Manufacture Store Bateau'],
      [/velum/, 'Manufacture Store Velum'],
    ];
    for (const [re, name] of rules) if (re.test(p) && named(name)) return named(name);
    return named('Manufacture');
  };

  // Stores : article choisi selon le produit (bateau, velum, vénitien, enrouleur…) et la
  // motorisation lue dans le modèle. Rails : article dont le mot distinctif apparaît dans
  // le modèle saisi (« FOREST KS (Kontrakt) Blanc » → Rail Kontrakt).
  const STOP = new Set(['rail', 'rails', 'motorise', 'voies', 'diametre', 'store', 'stores', 'mecanisme', 'amistar', 'garden', 'amishade', '20mm', '28mm']);
  const railCandidates = products
    .filter((p) => /^rail\b/.test(norm(p.name)))
    .map((p) => ({
      p,
      motor: /motoris/.test(norm(p.name)),
      words: norm(p.name).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w)),
    }))
    .filter((c) => c.words.length);
  const mecaFor = (row) => {
    const produit = norm(row?.produit);
    const model = norm([row?.mecanisme_store, row?.modele_mecanisme, row?.mecanisme_bis, row?.type_mecanisme, row?.produit].filter(Boolean).join(' '));
    const motor = MOTOR_RE.test(model);
    if (/bateau/.test(produit)) return named(motor ? 'Mécanisme Store Bateau Motorisé - Amistar' : 'Mécanisme Store Bateau - Amistar');
    if (/velum/.test(produit)) return named(motor ? 'Mécanisme Store Velum Motorisé - Amistar Garden' : 'Mécanisme Store Velum - Amistar Garden');
    if (/venitien/.test(produit)) return named(/alu/.test(model) ? 'Stores Vénitien Aluminium - Amishade' : 'Stores Vénitien Bois - Amishade');
    if (/store/.test(produit)) {
      const coffre = /coffre/.test(model);
      return named(`Store Enrouleur${coffre ? ' Coffre' : ''}${motor ? ' Motorisé' : ''}`, 'Store Enrouleur', 'Store');
    }
    const hits = railCandidates.filter((c) => c.words.every((w) => model.includes(w)));
    const best = hits.find((c) => c.motor === motor) || hits[0];
    if (best) return best.p;
    return named(motor ? 'Mécanisme Motorisé' : 'Mécanisme');
  };

  // '@col' : article par défaut de la COLONNE (Pose / Installation, Confection / Manufacture…).
  const COL_DEFAULT = {
    pv_pose: 'Pose', st_pose_pv: 'Installation',
    pv_confection: '@confection', st_conf_pv: '@manufacture',
    pv_prepa: 'Préparation et équipement', livraison: 'Livraison',
    pv_mecanisme: '@meca', pv_mecanisme_bis: '@meca', pv_mecanisme_store: '@meca', pv_baguette_1: '@meca', pv_baguette_2: '@meca',
    pv_doublure: 'Doublure', pv_interdoublure: 'Interdoublure', pv_embrasse: 'xml:product_embrasse', pv_interieur: 'xml:product_interieur_coussin',
    pv_pass1: 'xml:product_passementerie', pv_pass2: 'xml:product_passementerie', pv_pass_1: 'xml:product_passementerie', pv_pass_2: 'xml:product_passementerie',
  };
  // 'xml:<nom>' : article créé par le module ERP lenglart_controle_gestion (Passementerie, Embrasse,
  // Intérieur de coussin), résolu par identifiant XML car son id change d'une base à l'autre. Absent
  // de la base branchée (préprod antérieure) → repli sur « Tissu » (même étiquette CG Tissu).
  const byXml = new Map(products.filter((p) => p.xmlId).map((p) => [p.xmlId, p]));
  const resolve = (choice, row, comp) => {
    if (typeof choice === 'string' && choice.startsWith('xml:')) {
      const p = byXml.get(choice.slice(4));
      if (p) return p;
      missingXml.add(choice.slice(4));
      return named('Tissu');
    }
    if (choice === '@col') return resolve(COL_DEFAULT[comp?.key] || 'Tissu', row, comp);
    if (choice === '@confection') return confectionFor(row);
    if (choice === '@manufacture') return manufactureFor(row);
    if (choice === '@meca') return mecaFor(row);
    if (choice === '@deplacement') return named(/cotes/i.test(row?.type_deplacement || '') ? 'Prise de cotes' : 'Frais de déplacement');
    return byId.get(String(choice)) || named(choice);
  };
  return resolve;
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
    const Lg = withMeca ? toNum(row.largeur_mecanisme) || toNum(row.largeur) : toNum(row.largeur);
    const H = toNum(row.hauteur);
    const k = `${row.produit}|${Lg}|${H}`;
    const g = groups.get(k) || { produit: row.produit, L: Lg, H, n: 0 };
    g.n += qtyOf(row);
    groups.set(k, g);
  }
  return [...groups.values()].map((g) => {
    if (withMeca) return `${g.n} ${plural(g.n, 'rail')} de Longueur ${fmtNum(g.L)} cm`;
    const dims = [g.L && `Largeur ${fmtNum(g.L)} cm`, g.H && `Hauteur ${fmtNum(g.H)} cm`].filter(Boolean).join(' sur ');
    return `${g.n} ${plural(g.n, g.produit)}${dims ? ` de ${dims}` : ''}`;
  });
}
const distinct = (sources, key) => [...new Set(sources.map((s) => (s.row?.[key] ?? '').toString().trim()).filter(Boolean))];

function describe(line) {
  const { product, comp, sources, type } = line;
  const out = [product?.name || comp.label];
  if (line.costOnly) return out.join('\n');
  const fam = comp.family;
  const isStore = type && /store/.test(type);
  if (comp.key === '__deplacement') {
    out.push(...distinct(sources, 'libelle'));
  } else if (fam === 'Tissus' || fam === 'Passementerie') {
    for (const ref of distinct(sources, comp.refKey)) out.push(`Réalisé en notre référence ${ref}`);
    if (comp.laizeKey) for (const lz of distinct(sources, comp.laizeKey)) out.push(`Laize : ${lz} cm`);
  } else if (fam === 'Mécanismes') {
    out.push(...distinct(sources, comp.refKey || 'modele_mecanisme'));
    out.push('Soit :', ...dimsList(sources, { withMeca: !isStore }));
  } else if (comp.bucket === 'conf' || comp.key === 'st_conf_pv') {
    out.push(...distinct(sources, 'type_confection').map((p) => (/^pli/i.test(p) ? p : `Plis ${p}`)));
    out.push(...distinct(sources, 'ampleur').map((a) => `Ampleur ${String(a).replace('.', ',')}`));
    out.push(...distinct(sources, 'finition_bas').map((f) => `Finition bas : ${f}`));
    out.push('Soit :', ...dimsList(sources));
  } else if (comp.bucket === 'prepa') {
    out.push('pour :', ...dimsList(sources, { withMeca: !isStore }));
  } else if (comp.bucket === 'pose' || comp.key === 'st_pose_pv') {
    out.push(...distinct(sources, 'type_pose').map((t) => `Pose ${t.toLowerCase()}`));
    out.push('Soit :', ...dimsList(sources));
  }
  return out.join('\n');
}

// ─── Contrôle de gestion Odoo ──────────────────────────────────────────────────
// Étiquettes d'ARTICLE (product.tag) → champ du contrôle de gestion du devis.
export const CG_COST_FIELD = {
  Tissu: 'cg_montant_tissu',
  'Mécanisme': 'cg_montant_meca',
  Store: 'cg_montant_store',
  'Location / outillage': 'cg_montant_location',
  'Frais déplacement': 'cg_frais_deplacement',
  'Transport sur ventes': 'cg_transport',
  'ST Conf': 'cg_st_conf',
  'ST Pose': 'cg_st_pose',
};
const HOUR_TAGS = new Set(['Pose', 'Conf', 'Prépa']);

const odooLine = (l) => ({
  ref: l.key,
  product_id: l.productId,
  name: l.description,
  quantity: l.qty,
  price_unit: l.priceUnit,
  cost: l.costUnit, // coût UNITAIRE → purchase_price
  ...(l.hours ? { heures_vendues: l.hours } : {}),
});
// Blocs (section, sous-section) → sections Odoo. Les sous-sections partent pour l'instant en
// ligne de note (« ▸ R+2 ») : support natif line_subsection demandé à l'agent ERP (2026-10-08).
function groupForOdoo(blocks, fallbackName) {
  const out = [];
  for (const b of blocks) {
    if (!b.lines.length) continue;
    const name = b.title || fallbackName;
    let sec = out[out.length - 1];
    if (!sec || sec.name !== name) { sec = { name, lines: [] }; out.push(sec); }
    if (b.sub) sec.lines.push({ note: `▸ ${b.sub}` });
    sec.lines.push(...b.lines.map(odooLine));
  }
  return out;
}

/**
 * Payload de `sale.order.droitfil_upsert_devis` (méthode Odoo, module lenglart_controle_gestion).
 * dest : { mode: 'existing'|'new', opportunity, newName, teamId, userId, sectorTag, typeTag, partner }
 */
export function toOdooPayload({ quote, dest, minute }) {
  const tagIds = [dest.sectorTag, dest.typeTag].filter(Boolean);
  return {
    minute_id: minute.id,
    partner: { id: dest.partner.id },
    ...(dest.mode === 'existing' && dest.opportunity
      ? { opportunity: { id: dest.opportunity.id } }
      : {
        opportunity: {
          create: {
            name: dest.newName || minute.name,
            ...(dest.teamId ? { team_id: dest.teamId } : {}),
            ...(dest.userId ? { user_id: dest.userId } : {}),
            ...(tagIds.length ? { tag_ids: tagIds } : {}),
          },
        },
      }),
    ...(dest.mode === 'new' && dest.userId ? { user_id: dest.userId } : {}),
    objet: minute.name,
    commission_partenaire_taux: Math.round((quote.commissionPartenaire.rate / 100) * 1e6) / 1e6, // fraction
    sections: groupForOdoo(quote.sections, minute.name),
  };
}

// ─── Construction ──────────────────────────────────────────────────────────────
const LOGI_TITLE = 'DÉPLACEMENT, TRANSPORT & LOCATION';
const ORDER_LOGI = 3e6;

/**
 * @param {object} p
 * @param {Array} p.rows      lignes de la minute (déjà recalculées, cf. ChiffrageScreen)
 * @param {Array} p.depRows   déplacements
 * @param {Array} p.extraRows « Autres dépenses » (charges sans prix de vente)
 * @param {object} p.config   cf. defaultConfig()
 * @param {Array} p.products  articles Odoo [{ id, name, uom, tag }]
 */
export function buildQuote({ rows = [], depRows = [], extraRows = [], config, products = [] }) {
  const missingXml = new Set();
  const resolve = makeResolver(products, missingXml);
  const isolate = config.logistique === 'isole';
  // Bloc = (section, sous-section). key = titre␟sous-titre.
  const sections = new Map(); // key → { key, title, sub, order, subOrder, blocks: Map(typeKey → rang), lines: Map }
  const sectionOrder = new Map(); // titre → rang d'apparition
  const warnings = [];
  const typesUsed = new Map(); // typeKey → { type, rows }
  let minuteTotal = 0;
  let minuteCost = 0;

  const sectionFor = (title, order, sub = '') => {
    const key = `${title}\u241F${sub}`;
    if (!sections.has(key)) {
      if (!sectionOrder.has(title)) sectionOrder.set(title, order);
      sections.set(key, { key, title, sub, order: sectionOrder.get(title), subOrder: sections.size, blocks: new Map(), lines: new Map(), samples: new Map() });
    }
    return sections.get(key);
  };

  // Une contribution (colonne × ligne de minute) → ligne Odoo de la section.
  // rank = [rang du bloc produit dans la section, rang de la ligne dans la recette]
  const push = ({ sec, typeKey, slot, slotIdx, comp, row, product, amount, cost, ml, hours, byMl }) => {
    if (!sec.blocks.has(typeKey)) sec.blocks.set(typeKey, sec.blocks.size);
    if (row && !sec.samples.has(typeKey)) sec.samples.set(typeKey, row);
    const ref = byMl ? norm(row?.[comp.refKey]) : '';
    const key = `${typeKey}|${slot.id}|${product?.id ?? slot.id}|${byMl ? 'ml' : 'f'}|${ref}`;
    const line = sec.lines.get(key) || {
      key, typeKey, type: typeKey, slot, slotIdx, product, comp, byMl,
      amount: 0, cost: 0, ml: 0, hours: 0, sources: [], comps: new Map(), charges: [],
    };
    line.amount += amount;
    line.cost += cost || 0;
    line.ml += ml || 0;
    line.hours += hours || 0;
    if (row) line.sources.push({ row });
    line.comps.set(comp.key, comp.label);
    sec.lines.set(key, line);
    return line;
  };

  // 1. Lignes de minute → recette de leur type de produit.
  rows.forEach((row, idx) => {
    const total = toNum(row.prix_total ?? row.total_price);
    minuteTotal += total;
    const q = qtyOf(row);
    const decor = DECOR_PRODUIT_RE.test(String(row.produit || ''));
    const type = typeOfRow(row);
    const slots = recipeOf(config, type.key);
    const costOf = (c) => {
      if (!c.paKey) return 0;
      // pa_meca : champ legacy des vieilles lignes, rattaché au mécanisme principal (cf. chapters.js).
      return (toNum(row[c.paKey]) + (c.key === 'pv_mecanisme' ? toNum(row.pa_meca) : 0)) * q;
    };
    // Une colonne compte si elle a un prix de vente OU un coût (un coût sans prix ne doit pas
    // disparaître : il part sur une ligne à 0 € pour que la marge Odoo reste juste).
    const parts = COMPONENTS
      .map((c) => ({ c, raw: toNum(row[c.key]) * (decor ? q : 1), cost: costOf(c) }))
      .filter((x) => x.raw !== 0 || x.cost !== 0);
    const sum = parts.reduce((a, x) => a + x.raw, 0);
    if (!parts.length) {
      if (total) warnings.push(`Ligne « ${row.produit || '?'} ${row.piece || ''} » : total sans détail de prix, ignorée.`);
      return;
    }
    if (!sum && total) warnings.push(`Ligne « ${row.produit || '?'} ${row.piece || ''} » : total sans détail de prix (seuls ses coûts sont repris).`);
    // Coefficient de recalibrage éventuel : réparti au prorata sur toutes les colonnes.
    const k = sum ? (total ? total / sum : 1) : 0;
    const sectionTitle = sectionKeyOf(row, config.groupBy);
    let subTitle = config.subGroupBy && config.subGroupBy !== 'none' ? sectionKeyOf(row, config.subGroupBy) : '';
    if (subTitle === sectionTitle) subTitle = '';
    const sec0 = sectionFor(sectionTitle, idx, subTitle);
    const tu = typesUsed.get(type.key) || { type, rows: 0 };
    tu.rows += 1;
    typesUsed.set(type.key, tu);

    for (const { c, raw, cost } of parts) {
      minuteCost += cost;
      // Ligne de recette qui reçoit cette colonne (sinon ligne de secours en fin de recette).
      // Intérieurs d'un produit SOUS-TRAITÉ (ST conf, pas d'heures de confection chez nous) :
      // ils suivent la ligne Manufacture (le sous-traitant les fournit) au lieu d'une ligne à part.
      const subcontracted = toNum(row.st_conf_pv) !== 0 && !toNum(row.heures_confection);
      const followsManuf = c.key === 'pv_interieur' && subcontracted;
      let slotIdx = followsManuf
        ? slots.findIndex((sl) => sl.cols.includes('st_conf_pv'))
        : slots.findIndex((sl) => sl.cols.includes(c.key));
      let slot = slots[slotIdx];
      if (!slot) {
        slot = { id: `extra_${c.key}`, label: c.label, cols: [c.key], product: null };
        slotIdx = 900 + COMPONENTS.indexOf(c);
        warnings.push(`« ${c.label} » n'est dans aucune ligne de la recette « ${type.label} » : ajoutée en fin de recette.`);
      }
      // Placement : livraison → logistique si isolée ; colonne « à part » → section dédiée.
      let sec = sec0;
      if (c.key === 'livraison' && isolate) sec = sectionFor(LOGI_TITLE, ORDER_LOGI);
      // Article : remplacement « ici seulement » (par colonne, puis par ligne) › article de la colonne
      // dans la recette (lignes « X / Y ») › article de la ligne de recette.
      const ovs = config.overrides?.[overrideKey(config.groupBy, sec.key)] || {};
      const ov = ovs[`${type.key}:${slot.id}:${c.key}`] || ovs[`${type.key}:${slot.id}`] || slot.colProducts?.[c.key];
      const product = followsManuf && slot
        ? resolve(ov || '@manufacture', row, c)
        : resolve(ov || slot.product || '@col', row, c);
      if (!product) warnings.push(`Aucun article Odoo pour « ${slot.label} » (${type.label}).`);
      const byMl = (slot.unit || 'forfait') === 'ml' && !!c.mlKey;
      push({
        sec, typeKey: type.key, slot, slotIdx, comp: c, row, product,
        amount: raw * k, cost,
        ml: byMl ? toNum(row[c.mlKey]) * (decor ? q : 1) : 0,
        hours: c.hoursKey ? toNum(row[c.hoursKey]) * q : 0,
        byMl,
      });
    }
  });

  // Poids de chaque bloc « normal » (hors section logistique), pour répartir.
  const normalSections = () => [...sections.values()].filter((sec) => sec.order < ORDER_LOGI);
  const weights = () => {
    const secs = normalSections();
    const amt = secs.map((sec) => [...sec.lines.values()].reduce((a, l) => a + l.amount, 0));
    const tot = amt.reduce((a, x) => a + x, 0);
    return secs.map((sec, i) => ({ sec, w: tot > 0 ? amt[i] / tot : 1 / secs.length }));
  };
  const LOGI_SLOT = { id: 'deplacement', label: 'Déplacement' };
  // Bas de section, après les recettes : Location (charges) puis Déplacement.
  const CHARGE_RANK = 950;
  const LOGI_RANK = 960;

  // 2. Déplacements. Une ligne = temps facturé (heures × taux) + frais (nuits, repas, billets).
  //    • Prise de cotes (avec ou sans déplacement) : le temps va sur l'article « Prise de cotes »
  //      (étiquette Pose, ses heures comptent en pose) ; les frais sur « Frais de déplacement ».
  //    • Déplacement : UNE ligne « Frais de déplacement » au prix complet (temps + frais), coût =
  //      frais. Les HEURES de trajet (que cet article ne compte pas) sont réparties sur les lignes
  //      Pose du devis (heures vendues seulement, leur prix ne bouge pas) : elles remontent ainsi
  //      dans les heures de pose du projet et dans la tâche Pose (règle validée le 2026-10-08).
  //    Isolés → section logistique ; fondus → répartis au prorata des sections.
  const fraisProduct = resolve('Frais de déplacement', {});
  const ws = weights();
  let travelHours = 0;
  depRows.forEach((row) => {
    const total = toNum(row.prix_total ?? row.total_price);
    const frais = toNum(row.cout_nuits) + toNum(row.cout_repas) + toNum(row.cout_billet_total);
    if (!total && !frais) return;
    minuteTotal += total;
    minuteCost += frais;
    const hours = toNum(row.heures_facturees);
    const priseDeCotes = /cotes/i.test(row.type_deplacement || '');
    const dest = isolate || !ws.length ? [{ sec: sectionFor(LOGI_TITLE, ORDER_LOGI), w: 1 }] : ws;
    if (!priseDeCotes) travelHours += hours;
    for (const { sec, w } of dest) {
      if (priseDeCotes) {
        const mo = total - frais;
        if (mo || hours) push({ sec, typeKey: '__logi', slot: LOGI_SLOT, slotIdx: LOGI_RANK, comp: DEP_COMP, row, product: resolve('Prise de cotes', row), amount: mo * w, cost: 0, hours: hours * w });
        if (frais) push({ sec, typeKey: '__logi', slot: LOGI_SLOT, slotIdx: LOGI_RANK + 1, comp: DEP_COMP, row, product: fraisProduct, amount: frais * w, cost: frais * w });
      } else {
        push({ sec, typeKey: '__logi', slot: LOGI_SLOT, slotIdx: LOGI_RANK + 1, comp: DEP_COMP, row, product: fraisProduct, amount: total * w, cost: frais * w });
      }
    }
  });
  // Heures de trajet → lignes Pose (au prorata de leurs heures, sinon de leur prix).
  if (travelHours) {
    const poseLines = [...sections.values()].flatMap((sec) => [...sec.lines.values()]).filter((l) => l.comps.has('pv_pose'));
    if (poseLines.length) {
      const byHours = poseLines.reduce((a, l) => a + l.hours, 0);
      const byAmount = poseLines.reduce((a, l) => a + Math.max(0, l.amount), 0);
      for (const l of poseLines) {
        const w = byHours > 0 ? l.hours / byHours : byAmount > 0 ? Math.max(0, l.amount) / byAmount : 1 / poseLines.length;
        l.hours += travelHours * w;
        l.travelHours = (l.travelHours || 0) + travelHours * w;
      }
    } else {
      // Aucune pose vendue : une ligne « Pose » à 0 € porte les heures de trajet.
      const sec = isolate || !ws.length ? sectionFor(LOGI_TITLE, ORDER_LOGI) : ws[ws.length - 1].sec;
      const line = push({ sec, typeKey: '__logi', slot: { id: 'trajet', label: 'Heures de trajet' }, slotIdx: LOGI_RANK + 2, comp: COMPONENT_BY_KEY.get('pv_pose'), row: null, product: resolve('Pose', {}), amount: 0, cost: 0, hours: travelHours });
      line.travelHours = travelHours;
      warnings.push(`Aucune ligne de pose dans le devis : les ${round2(travelHours)} h de trajet sont portées par une ligne « Pose » à 0 €.`);
    }
  }

  // 3. Charges annexes → coût porté par l'article de même nature analytique.
  let commissionPartenaire = 0;
  const allLines = () => [...sections.values()].flatMap((sec) => [...sec.lines.values()]);
  const charges = collectCharges({ extraRows }).map((ch) => {
    const { host, place } = chargeSetting(config, ch.key);
    minuteCost += ch.amount; // une charge non reportée apparaît en écart dans le contrôle (voulu)
    if (host === 'none') return { ...ch, host, place, applied: false };
    if (host === '@commission') { commissionPartenaire += ch.amount; return { ...ch, host, place, applied: true }; }

    const isManuf = host === '@manufacture';
    const hostProduct = isManuf ? null : resolve(host, {});
    if (!isManuf && !hostProduct) {
      warnings.push(`« ${ch.label} » : article « ${host} » introuvable dans Odoo, coût non reporté.`);
      return { ...ch, host, place, applied: false };
    }
    const matches = (l) => (isManuf ? /^manufacture/i.test(l.product?.name || '') : String(l.product?.id) === String(hostProduct?.id));
    const addTo = (l, amount) => { l.cost += amount; l.charges.push({ label: ch.label, amount }); };

    // 3a. Sur les lignes existantes de l'article, au prorata de leur prix.
    const targets = place === 'lignes' ? allLines().filter(matches) : [];
    if (targets.length) {
      const base = targets.reduce((a, l) => a + Math.max(0, l.amount), 0);
      for (const l of targets) addTo(l, base > 0 ? (Math.max(0, l.amount) / base) * ch.amount : ch.amount / targets.length);
      return { ...ch, host, place, applied: true };
    }
    // 3b. Sinon : une ligne « coût seul » (0 €) de l'article, à l'endroit choisi.
    const dest = !isolate && ws.length ? ws : [{ sec: sectionFor(LOGI_TITLE, ORDER_LOGI), w: 1 }];
    const chComp = { key: `__charge:${ch.key}`, label: ch.label, family: 'Charges' };
    for (const { sec, w } of dest) {
      const firstRow = [...sec.lines.values()].find((l) => l.sources.length)?.sources[0]?.row || rows[0] || {};
      const product = isManuf ? resolve('@manufacture', firstRow) : hostProduct;
      const line = push({ sec, typeKey: '__logi', slot: { id: `charge_${ch.key}`, label: ch.label }, slotIdx: CHARGE_RANK, comp: chComp, row: null, product, amount: 0, cost: 0 });
      line.costOnly = true;
      addTo(line, ch.amount * w);
    }
    return { ...ch, host, place, applied: true };
  });

  // 4. Mise en forme : PU / quantités, textes, heures par catégorie.
  // pose = lignes Pose (trajet compris) ; depl = Prise de cotes ; trajet = part du trajet dans pose.
  const hours = { conf: 0, prepa: 0, pose: 0, depl: 0, trajet: round2(travelHours) };
  let quoteTotal = 0;
  let quoteCost = 0;
  const outSections = [...sections.values()]
    .sort((a, b) => a.order - b.order || a.subOrder - b.subOrder)
    .map((sec) => {
      const blockRank = (t) => (t === '__logi' ? 999 : sec.blocks.get(t) ?? 998);
      const lines = [...sec.lines.values()]
        .sort((a, b) => blockRank(a.typeKey) - blockRank(b.typeKey) || a.slotIdx - b.slotIdx)
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
            typeKey: l.typeKey,
            slotId: l.slot.id,
            slotLabel: l.slot.label,
            productId: l.product?.id ?? null,
            productName: l.product?.name ?? '— article manquant —',
            productTag: l.product?.tag ?? null,
            cgTags: l.product?.cgTags || [],
            description: describe(l),
            qty, uom, priceUnit,
            subtotal: odooSubtotal,
            costUnit, cost,
            hours: round2(l.hours),
            travelHours: round2(l.travelHours || 0),
            bucket: l.comp.bucket || null,
            charges: l.charges.map((c) => ({ label: c.label, amount: round2(c.amount) })),
            costOnly: !!l.costOnly,
            from: [...l.comps.values()],
            // Origine Droitfil lisible : colonnes de la minute + autres dépenses dont le coût est porté ici.
            sourceLabels: [
              ...(l.comp.family === 'Charges' ? [] : [...l.comps.values()]),
              ...(l.comp.family === 'Charges' ? [`Autres dépenses › ${l.comp.label}`] : []),
              ...[...new Set(l.charges.map((c) => `Autres dépenses › ${c.label}`))],
            ],
            compKeys: [...l.comps.keys()],
            nbRows: l.sources.length,
          };
        });
      return {
        key: sec.key,
        title: sec.title,
        sub: sec.sub,
        apart: sec.order >= ORDER_LOGI,
        // Types de produit du bloc (dans l'ordre) + une ligne de minute exemple de chacun (pour
        // afficher les lignes de recette non utilisées et l'article qu'elles prendraient).
        types: [...sec.blocks.entries()].sort((a, b) => a[1] - b[1]).map(([t]) => t).filter((t) => t !== '__logi'),
        samples: Object.fromEntries(sec.samples),
        lines,
        total: round2(lines.reduce((a, l) => a + l.subtotal, 0)),
        cost: round2(lines.reduce((a, l) => a + l.cost, 0)),
      };
    });

  for (const x of missingXml) {
    warnings.push(`Article « ${XML_PRODUCTS[`xml:${x}`] || x} » absent de cette base Odoo : envoyé sur « Tissu » (même étiquette CG).`);
  }

  // 5. Contrôles exigés par Odoo (module lenglart_controle_gestion) :
  //    - article étiqueté Pose / Conf / Prépa → heures vendues ≠ 0, sinon Odoo REFUSE le devis ;
  //    - autre article → coût ≠ 0, sinon impression et confirmation bloquées ;
  //    - coût sur un article sans étiquette de coût → compté nulle part dans le contrôle de gestion.
  const blocking = [];
  if (products.length) {
    for (const sec of outSections) for (const l of sec.lines) {
      if (!l.productId) continue;
      const where = `${[sec.title, sec.sub].filter(Boolean).map((t) => `${t} › `).join('')}${l.productName}`;
      const hourTag = l.cgTags.some((t) => HOUR_TAGS.has(t));
      const costTag = l.cgTags.some((t) => CG_COST_FIELD[t]);
      if (hourTag && !l.hours) { l.check = 'hours'; blocking.push(`${where} : heures vendues à 0 (obligatoires sur un article ${l.cgTags.join('/')}).`); }
      else if (!hourTag && !l.cost) { l.check = 'cost'; warnings.push(`${where} : coût à 0 → la confirmation du devis sera bloquée dans Odoo.`); }
      else if (l.cost && !costTag) { l.check = 'untagged'; warnings.push(`${where} : article sans étiquette de coût → ce coût ne sera compté nulle part dans le contrôle de gestion.`); }
    }
  }

  // Contrôle de gestion attendu, calculé côté Droitfil (à comparer au retour d'Odoo).
  const cg = {};
  for (const sec of outSections) for (const l of sec.lines) {
    const field = l.cgTags.map((t) => CG_COST_FIELD[t]).find(Boolean);
    if (field) cg[field] = round2((cg[field] || 0) + l.cost);
  }

  return {
    sections: outSections,
    blocking,
    cg,
    types: [...typesUsed.values()].map(({ type, rows: n }) => ({ key: type.key, label: type.label, rows: n })),
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
    hours: { conf: round2(hours.conf), prepa: round2(hours.prepa), pose: round2(hours.pose), depl: round2(hours.depl), trajet: hours.trajet },
    warnings: [...new Set(warnings)],
  };
}
