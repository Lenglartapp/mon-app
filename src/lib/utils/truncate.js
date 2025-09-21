// src/lib/utils/truncate.js

/**
 * Coupe un texte trop long et ajoute "…" à la fin.
 * @param {string} str - le texte d’origine
 * @param {number} max - longueur max
 */
export function truncate(str, max = 100) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "…" : str;
}