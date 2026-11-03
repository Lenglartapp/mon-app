// src/lib/gridTotals.js
// -----------------------------------------------------------------------------
// Ligne « Total » sous un tableau : calcul choisi colonne par colonne (vide par défaut).
// Colonnes chiffrées : somme, moyenne, min, max, nombre. Colonnes texte : nombre de
// cases remplies, valeurs différentes, vides.
// Une colonne à unité (ex. Stock dispo : m, pièces, u) est calculée PAR UNITÉ — additionner
// des mètres et des unités n'aurait pas de sens : « 412,5 m · 35 u ».
// -----------------------------------------------------------------------------

export const NUMERIC_TOTALS = [
  { key: 'sum', label: 'Somme' },
  { key: 'avg', label: 'Moyenne' },
  { key: 'min', label: 'Min' },
  { key: 'max', label: 'Max' },
  { key: 'count', label: 'Nombre' },
];
export const TEXT_TOTALS = [
  { key: 'count', label: 'Nombre' },
  { key: 'distinct', label: 'Valeurs différentes' },
  { key: 'empty', label: 'Vides' },
];
export const totalLabel = (kind) => [...NUMERIC_TOTALS, ...TEXT_TOTALS].find((t) => t.key === kind)?.label || '';

const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';
const toNumber = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const nf = (v) => v.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

function aggregateNumbers(kind, nums) {
  if (!nums.length) return null;
  switch (kind) {
    case 'sum': return nums.reduce((a, b) => a + b, 0);
    case 'avg': return nums.reduce((a, b) => a + b, 0) / nums.length;
    case 'min': return Math.min(...nums);
    case 'max': return Math.max(...nums);
    default: return null;
  }
}

/**
 * Texte du total d'une colonne.
 * @param kind     clé du calcul (sum, avg, min, max, count, distinct, empty)
 * @param items    [{ value, unit? }] — une entrée par ligne affichée
 * @param numeric  colonne chiffrée (les calculs numériques ignorent les cases non chiffrées)
 */
export function computeTotal(kind, items, { numeric = false } = {}) {
  if (!kind) return '';
  if (kind === 'count') return nf(items.filter((it) => !isEmpty(it.value)).length);
  if (kind === 'empty') return nf(items.filter((it) => isEmpty(it.value)).length);
  if (kind === 'distinct') return nf(new Set(items.filter((it) => !isEmpty(it.value)).map((it) => String(it.value).trim().toLowerCase())).size);
  if (!numeric) return '';

  const byUnit = new Map();
  for (const it of items) {
    const n = toNumber(it.value);
    if (n === null) continue;
    const u = String(it.unit ?? '').trim();
    if (!byUnit.has(u)) byUnit.set(u, []);
    byUnit.get(u).push(n);
  }
  const parts = [...byUnit].map(([u, nums]) => {
    const v = aggregateNumbers(kind, nums);
    return v === null ? null : `${nf(v)}${u ? ` ${u}` : ''}`;
  }).filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}
