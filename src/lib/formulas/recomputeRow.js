// src/lib/formulas/recomputeRow.js
import { evalFormula } from "./eval";

/**
 * Recalcule toutes les colonnes de type formula + overrides de cellule (__cellFormulas)
 * @param {object} row    Ligne source
 * @param {Array}  schema Colonnes [{key, type, formula, ...}]
 * @returns {object}      Ligne recalculée
 */
export function recomputeRow(row, schema, ctx = {}) {
  const cols = Array.isArray(schema) ? schema : [];
  const cellFx = row?.__cellFormulas || {};
  const next = { ...(row || {}) };

  for (const col of cols) {
    if (!col || !col.key) continue;
    const k = col.key;
    const expr = cellFx[k] || col.formula;
    if (!expr) continue;

    try {
      next[k] = evalFormula(expr, next, ctx);
    } catch {
      // Option : ne pas écraser la valeur existante en cas d'erreur
      // next[k] = "#ERR"; // ← si tu préfères signaler l'erreur visuellement
    }
  }
  return next;
}
