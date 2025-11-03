import { toNumber } from "../utils/number.js";
import { normKey as norm } from "../utils/norm.js";

// tiny helper
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// --- new: numeric sanitizer
const num = (x) => {
  const n = toNumber(x);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Evaluate a formula with support for:
 * - {field} references (legacy)
 * - bare field names: largeur + retour_g
 * - optional leading "="
 *
 * Available helpers inside the formula:
 *  ROUND(x, n), ROUNDUP(x), IF(cond, a, b), MIN(...), MAX(...), NVL(x, y), CEIL(x)
 */
export function evalFormula(expr, row, ctx = {}) {
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
    // ⬇️ NE PAS remplacer à l'intérieur des chaînes ' " `
    const rx = new RegExp(
      `(?<!['"\\\`])\\b(?:${normalized.map(esc).join("|")})\\b`,
      "g"
    );
    js = js.replace(rx, (m) => `get('${norm(m)}')`);
  }
}

  // helpers available in formulas (all numeric-safe)
  const get = (k) => {
    const v = row[k];
    // si c'est clairement numérique ➜ nombre, sinon telle quelle (string/bool/…)
    const n = toNumber(v);
    return (typeof v === "number" || (String(v).trim() !== "" && Number.isFinite(n))) ? n : v;
  };
  const ROUND    = (x, n = 0) => { const p = 10 ** n; return Math.round(num(x) * p) / p; };
  const ROUNDUP  = (x)        => Math.ceil(num(x));
  const IF       = (cond, a, b) => (cond ? a : b);
  const MIN      = (...xs)      => Math.min(...xs.map(num));
  const MAX      = (...xs)      => Math.max(...xs.map(num));
  const NVL      = (x, y = 0)   => {
    const n = toNumber(x);
    return Number.isFinite(n) ? n : toNumber(y);
  };
  const CEIL     = (x)          => Math.ceil(toNumber(x));
  const PARAM    = new Proxy({}, {
    get(_t, prop) {
      const map = ctx?.paramsMap || {};
      const raw = map[String(prop)];
      const n = toNumber(raw);
      return Number.isFinite(n) ? n : 0;
    }
  });

  try {
    const fn = new Function(
      "get","ROUND","IF","MIN","MAX","ROUNDUP","NVL","CEIL","PARAM",
      `return (${js});`
    );
    const out = fn(get, ROUND, IF, MIN, MAX, ROUNDUP, NVL, CEIL, PARAM);

    // post-normalisation: si c’est un nombre non fini ➜ 0
    if (typeof out === "number") {
      return Number.isFinite(out) ? out : 0;
    }
    // si c’est coercible en nombre fini, renvoie ce nombre
    const n = Number(out);
    if (Number.isFinite(n)) return n;

    // sinon, renvoie tel quel (ex: strings "Paire"/"Oui")
    return out ?? "";
  } catch {
    // plus jamais "#ERR" : on renvoie 0 pour ne pas polluer l’UI
    return 0;
  }
}
