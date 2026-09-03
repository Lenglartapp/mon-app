// src/lib/minuteHistory.js
// -----------------------------------------------------------------------------
// Journal des modifications d'un chiffrage (bibliothèque d'articles + paramètres
// globaux). Les entrées produites ici ont EXACTEMENT le format déjà rendu par
// MinuteHistoryDialog (`type: 'log'`, `field`, `from`, `to`, `context`, `author`)
// et sont stockées dans la même liste que les changements de statut :
// `minute.modules.history`.
// -----------------------------------------------------------------------------

// Plafond de l'historique : `modules` est un blob JSONB réécrit à chaque
// sauvegarde, on ne le laisse pas grossir indéfiniment.
const HISTORY_MAX = 500;

// Au-delà de ce nombre d'articles touchés d'un coup (import, auto-init de la
// bibliothèque depuis le catalogue global), on résume en UNE entrée au lieu d'en
// écrire des centaines.
const BULK_THRESHOLD = 20;

const SETTING_LABELS = {
  taux_horaire: 'Taux Horaire (€)',
  prix_nuit: 'Prix Nuit (€)',
  prix_repas: 'Prix Repas (€)',
  coef_sous_traitance: 'Coef Sous-traitance',
  commission_rate: 'Commission (%)',
  vatRate: 'TVA (%)',
};

const CATALOG_FIELD_LABELS = {
  provider: 'Fournisseur',
  reference: 'Référence',
  color: 'Coloris',
  category: 'Catégorie',
  buyPrice: "Prix Achat (€)",
  coef: 'Coef',
  sellPrice: 'Prix Vente (€)',
  unit: 'Unité',
  width: 'Laize (cm)',
  motif: 'Motif',
  raccord_v: 'Raccord V (cm)',
  raccord_h: 'Raccord H (cm)',
};

// Onglet de la bibliothèque auquel appartient un article (même découpage que
// CatalogManager.filteredRows) — sert de badge de contexte dans l'historique.
const categoryTab = (category) => {
  const c = String(category || '');
  if (['Tissu', 'Tissus', 'Doublure', 'Doublures', 'Inter', 'Confection'].includes(c)) return 'Tissus';
  if (['Rail', 'Rails', 'Tringle', 'Mecanisme', 'Mécanisme'].includes(c)) return 'Rails';
  if (['Store', 'Stores', 'Mecanisme Store'].includes(c)) return 'Stores';
  if (c === 'Passementerie') return 'Passementerie';
  return 'Articles';
};

const articleLabel = (row) => {
  const parts = [row?.provider, row?.reference, row?.color].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return row?.name || 'Article sans nom';
};

const EMPTY = '—';

/** Rend une valeur comparable ET affichable ('' / null / undefined -> null). */
const normalize = (val) => {
  if (val === '' || val === null || val === undefined) return null;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const num = Number(String(val).replace(',', '.'));
  if (String(val).trim() !== '' && Number.isFinite(num)) return num;
  return String(val);
};

const display = (val) => {
  const n = normalize(val);
  if (n === null) return EMPTY;
  if (typeof n === 'boolean') return n ? 'Oui' : 'Non';
  if (typeof n === 'number') return String(Math.round(n * 1000) / 1000).replace('.', ',');
  return n;
};

const sameValue = (a, b) => {
  const na = normalize(a);
  const nb = normalize(b);
  if (typeof na === 'number' && typeof nb === 'number') return Math.abs(na - nb) < 1e-9;
  return na === nb;
};

let seq = 0;
const makeEntry = ({ field, from, to, context, author }) => ({
  id: `${Date.now()}-${seq++}`,
  type: 'log',
  field,
  from,
  to,
  context,
  author,
  date: Date.now(),
  createdAt: new Date().toISOString(),
});

/** Entrée d'historique pour un changement de STATUT du devis. */
export const buildStatusLog = (from, to, author) => ({
  ...makeEntry({ field: 'Statut', from, to, context: 'Minute', author }),
  type: 'status', // rendu spécifique (libellés « Validée », « À reprendre »…)
});

/**
 * Entrées d'historique pour un changement de PARAMÈTRES GLOBAUX.
 * Ne compare que les réglages réellement pilotés par l'écran (pas les defaults
 * ni les settings globaux hérités), pour ne pas générer de bruit.
 */
export const buildSettingsLogs = (oldSettings, newSettings, author) => {
  const before = oldSettings || {};
  const after = newSettings || {};
  const entries = [];
  for (const key of Object.keys(SETTING_LABELS)) {
    if (!(key in after)) continue;
    if (sameValue(before[key], after[key])) continue;
    // Une valeur vidée en cours de frappe (champ effacé avant re-saisie) n'est
    // pas un changement métier : on ne la journalise pas.
    if (normalize(after[key]) === null) continue;
    entries.push(makeEntry({
      field: SETTING_LABELS[key],
      from: display(before[key]),
      to: display(after[key]),
      context: 'Paramètres Globaux',
      author,
    }));
  }
  return entries;
};

// Signature de repli pour apparier deux versions d'un article quand l'id change
// ou manque (backfill d'ids au montage de CatalogManager, import Excel…).
// Sans ça, un simple ajout d'id ferait croire à une suppression + un ajout.
const signature = (row) => [row?.provider, row?.reference, row?.color, row?.category]
  .map(v => String(v ?? '').trim().toLowerCase()).join('|');

/**
 * Entrées d'historique pour un changement de BIBLIOTHÈQUE D'ARTICLES :
 * ajout, suppression, et modification champ par champ (coef, prix d'achat…).
 */
export const buildCatalogLogs = (oldCatalog, newCatalog, author) => {
  const before = Array.isArray(oldCatalog) ? oldCatalog : [];
  const after = Array.isArray(newCatalog) ? newCatalog : [];

  const byId = new Map();
  const bySig = new Map();
  before.forEach(row => {
    if (row?.id) byId.set(row.id, row);
    const sig = signature(row);
    if (!bySig.has(sig)) bySig.set(sig, row);
  });

  const matched = new Set();
  const added = [];
  const changes = [];

  after.forEach(row => {
    let prev = row?.id ? byId.get(row.id) : undefined;
    if (!prev) {
      const candidate = bySig.get(signature(row));
      if (candidate && !matched.has(candidate)) prev = candidate;
    }
    if (!prev) { added.push(row); return; }
    matched.add(prev);

    for (const [field, label] of Object.entries(CATALOG_FIELD_LABELS)) {
      if (sameValue(prev[field], row[field])) continue;
      changes.push(makeEntry({
        field: `${articleLabel(row)} — ${label}`,
        from: display(prev[field]),
        to: display(row[field]),
        context: `Bibliothèque · ${categoryTab(row.category)}`,
        author,
      }));
    }
  });

  const removed = before.filter(row => !matched.has(row));

  const entries = [];

  if (added.length > BULK_THRESHOLD) {
    entries.push(makeEntry({
      field: 'Import de la bibliothèque',
      from: `${before.length} article(s)`,
      to: `${after.length} article(s)`,
      context: 'Bibliothèque',
      author,
    }));
  } else {
    added.forEach(row => entries.push(makeEntry({
      field: "Ajout d'article",
      from: EMPTY,
      to: articleLabel(row),
      context: `Bibliothèque · ${categoryTab(row.category)}`,
      author,
    })));
  }

  if (removed.length > BULK_THRESHOLD) {
    entries.push(makeEntry({
      field: "Suppression d'articles",
      from: `${before.length} article(s)`,
      to: `${after.length} article(s)`,
      context: 'Bibliothèque',
      author,
    }));
  } else {
    removed.forEach(row => entries.push(makeEntry({
      field: "Suppression d'article",
      from: articleLabel(row),
      to: EMPTY,
      context: `Bibliothèque · ${categoryTab(row.category)}`,
      author,
    })));
  }

  // Les modifications champ par champ ne sont pertinentes que hors import massif.
  if (added.length <= BULK_THRESHOLD && removed.length <= BULK_THRESHOLD) {
    entries.push(...changes);
  }

  return entries;
};

/** Ajoute les entrées à `modules.history` (plafonné) et renvoie le nouveau `modules`. */
export const appendHistory = (modules, entries) => {
  const base = modules || { rideau: true, store: true, decor: true };
  if (!entries || entries.length === 0) return base;
  const old = Array.isArray(base.history) ? base.history : [];
  const merged = [...old, ...entries];
  return { ...base, history: merged.slice(-HISTORY_MAX) };
};
