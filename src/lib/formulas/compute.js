// src/lib/formulas/compute.js
// (Extrait de ton App.jsx — mêmes fonctions, simplement exportées)

import { recomputeRow } from "./recomputeRow";

export const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export const NVL = (x, y) => {
  const xn = Number(x);
  return Number.isFinite(xn) ? xn : Number(y ?? 0);
}

export function evalFormulaExpr(expr, vars) {
  if (!expr || typeof expr !== "string") return 0;

  const RESERVED = new Set([
    "IF", "CEIL", "NVL",
    "Math", "Number", "NaN", "Infinity", "true", "false", "null", "undefined"
  ]);

  // Remplace tout identifiant par vars.<id> sauf nos fonctions et mots réservés
  const safeExpr = expr.replace(/\b([A-Za-z_]\w*)\b/g, (m, id) => {
    if (RESERVED.has(id)) return id;
    return `vars.${id}`;
  });

  const IF   = (cond, a, b) => (cond ? a : b);
  const CEIL = (x) => Math.ceil(Number(x || 0));

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function("vars","IF","CEIL","NVL","Math","Number",
      `const out = (${safeExpr});
       const n = Number(out);
       return Number.isFinite(n) ? n : 0;`
    );
    return fn(vars, IF, CEIL, NVL, Math, Number);
  } catch (e) {
    // console.warn("Formula error:", expr, e);
    return 0;
  }
}

/**
 * computeFormulas(rows, schema)
 * - Calcule les colonnes "formula" (support IF/CEIL/NVL).
 * - Respecte un override manuel si row.__manual?.[key] === true.
 * - 2 passes pour gérer des dépendances simples (ex: a_plat puis ml_*).
 * (identique à ton App.jsx, juste sans le défaut "schema = SCHEMA_64")
 */
export function computeFormulas(rows, schema, ctx = {}) {
  if (!Array.isArray(rows)) return [];
  if (!Array.isArray(schema)) return rows || [];

  // Applique recomputeRow à chaque ligne et nettoie les timers éventuels
  return rows.map((r) => recomputeRow(r, schema, ctx));
}

// Sécurise les anciens appels : no-op si non utilisé
export function preserveManualAfterCompute(nextRows, prevRows) {
  return nextRows;
}
