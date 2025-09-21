// src/lib/utils/format.js

/**
 * Formate une date en français (JJ/MM/AAAA).
 * @param {string|number|Date} d
 */
export function formatDateFR(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR");
  } catch {
    return String(d);
  }
}