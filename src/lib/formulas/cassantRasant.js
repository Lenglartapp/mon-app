// src/lib/formulas/cassantRasant.js
// Lecture de la colonne « Cassant / Rasant » (finition_bas) des rideaux.
// Valeur positive = cassant (le rideau casse sur le sol), négative = rasant.
// La colonne est numérique mais d'anciennes lignes contiennent du texte saisi à la main :
// « CASSANT 7 » (Royal Monceau), « Rasant », « Rasant +/- 0.5 cm » (tolérance, pas une valeur).

const normalize = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const NUM_RE = /-?\d+(?:[.,]\d+)?/;
// Tolérance « +/- x » ou « ± x » : précision de pose, jamais une valeur de cassant / rasant.
const TOL_RE = /(?:\+\s*\/\s*-|±)\s*(\d+(?:[.,]\d+)?)\s*(?:cm)?/i;
const toNumber = (s) => parseFloat(String(s).replace(",", "."));
const fmt = (n) => String(Math.round(n * 100) / 100).replace(".", ",");

/**
 * @returns {number|string|null}
 *  - null   : colonne jamais renseignée (null, undefined, chaîne vide)
 *  - nombre : valeur signée (+ cassant, − rasant)
 *  - texte  : saisie illisible, à afficher telle quelle
 */
export function parseCassantRasant(x) {
  if (x === null || x === undefined) return null;
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  const raw = String(x).trim();
  if (!raw) return null;
  // 1. Nombre ou chaîne numérique (virgule ou point).
  if (/^-?\d+(?:[.,]\d+)?$/.test(raw)) return toNumber(raw);
  const str = raw.replace(TOL_RE, " ");
  const t = normalize(str);
  const m = str.match(NUM_RE);
  const n = m ? Math.abs(toNumber(m[0])) : 0;
  // 2. Mot-clé (+ nombre ; sans nombre → 0).
  if (t.includes("cassant")) return n;
  if (t.includes("rasant")) return n ? -n : 0;
  // 3. Nombre sans mot-clé : selon son signe.
  if (m) return toNumber(m[0]);
  // 4. Illisible.
  return raw;
}

/** Tolérance saisie (« +/- 0.5 cm » → 0.5), sinon null. */
export function cassantRasantTolerance(x) {
  if (x === null || x === undefined || typeof x === "number") return null;
  const m = String(x).match(TOL_RE);
  return m ? toNumber(m[1]) : null;
}

/** Valeur numérique pour les calculs (hauteur finie) : 0 si vide ou illisible. */
export function cassantRasantNum(x) {
  const v = parseCassantRasant(x);
  return typeof v === "number" ? v : 0;
}

/** Texte de l'étiquette : « cassant 7 cm », « rasant 3 cm », « rasant 0 cm (± 0,5) » ; "" si vide. */
export function cassantRasantText(x) {
  const v = parseCassantRasant(x);
  if (v === null) return "";
  if (typeof v === "string") return v;
  const tol = cassantRasantTolerance(x);
  const base = v > 0 ? `cassant ${fmt(v)} cm` : `rasant ${fmt(Math.abs(v))} cm`;
  return tol ? `${base} (± ${fmt(tol)})` : base;
}
