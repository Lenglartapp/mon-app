import { toNumber } from "../utils/number.js";
import { normKey as norm } from "../utils/norm.js";

// tiny helper
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// --- new: numeric sanitizer
const num = (x) => {
  if (typeof x === "number") return Number.isFinite(x) ? x : 0;
  if (x == null) return 0;
  // Nettoyage agressif : on vire les espaces (insécables ou non), devises, etc.
  // On garde chifres, point, virgule, moins.
  const s = String(x)
    .replace(/\s/g, "")
    .replace(/[^\d.,-]/g, "")
    .replace(",", ".");
  const n = parseFloat(s);
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
    // on tente de nettoyer proprement
    return num(v);
  };
  const ROUND = (x, n = 0) => { const p = 10 ** n; return Math.round(num(x) * p) / p; };
  const ROUNDUP = (x) => Math.ceil(num(x));
  const IF = (cond, a, b) => (cond ? a : b);
  const MIN = (...xs) => Math.min(...xs.map(num));
  const MAX = (...xs) => Math.max(...xs.map(num));

  // Implémentation NVL demandée : si vide/null => default, sinon valeur nettoyée
  const NVL = (x, y = 0) => {
    // Si chaîne vide ou null/undefined -> valeur par défaut
    if (x === null || x === undefined || x === "") return num(y);
    const n = num(x);
    // Si n est 0, c'est peut-être la valeur réelle ou un échec de parsing.
    // Mais num() renvoie 0 si fail.
    // NVL(val, def) : si val existe, on prend val.
    return n;
  };

  const CEIL = (x) => Math.ceil(num(x));
  const PARAM = new Proxy({}, {
    get(_t, prop) {
      const map = ctx?.paramsMap || {};
      const raw = map[String(prop)];
      return num(raw);
    }
  });

  try {
    const fn = new Function(
      "get", "ROUND", "IF", "MIN", "MAX", "ROUNDUP", "NVL", "CEIL", "PARAM",
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
