// src/lib/formulas/eval.js
import { toNumber } from "../utils/number.js";
import { normKey as norm } from "../utils/norm.js";

// tiny helper
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Evaluate a formula with support for:
 * - {field} references (legacy)
 * - bare field names: largeur + retour_g
 * - optional leading "="
 *
 * Available helpers inside the formula:
 *  ROUND(x, n), ROUNDUP(x), IF(cond, a, b), MIN(...), MAX(...)
 */
export function evalFormula(expr, row) {
  if (expr == null || expr === "") return "";

  // 1) normalize: remove optional "="
  let js = String(expr).trim();
  if (js.startsWith("=")) js = js.slice(1);

  // 2) replace {field} → get('field')
  js = js.replace(/\{([^}]+)\}/g, (_, name) => `get('${norm(name)}')`);

  // 3) also support bare identifiers that match row keys
  const keys = Object.keys(row || {}).filter((k) => k !== "__cellFormulas");
  if (keys.length) {
    const normalized = keys.map((k) => norm(k)).filter(Boolean);
    if (normalized.length) {
      const rx = new RegExp(`\\b(?:${normalized.map(esc).join("|")})\\b`, "g");
      js = js.replace(rx, (m) => `get('${norm(m)}')`);
    }
  }

  // helpers available in formulas
  const get = (k) => {
  const v = row[k];
  console.log("evalFormula get:", k, "→", v); // debug
  const n = toNumber(v);
  return (typeof v==="number" || (String(v).trim()!=="" && Number.isFinite(n)))? n : v;
};
  const ROUND = (x, n = 0) => {
    const p = 10 ** n;
    return Math.round(toNumber(x) * p) / p;
  };
  const IF = (cond, a, b) => (cond ? a : b);
  const MIN = (...xs) => Math.min(...xs.map(toNumber));
  const MAX = (...xs) => Math.max(...xs.map(toNumber));
  const ROUNDUP = (x) => Math.ceil(toNumber(x));

  try {
    const fn = new Function(
      "get",
      "ROUND",
      "IF",
      "MIN",
      "MAX",
      "ROUNDUP",
      `return (${js});`
    );
    return fn(get, ROUND, IF, MIN, MAX, ROUNDUP);
  } catch {
    return "#ERR";
  }
}