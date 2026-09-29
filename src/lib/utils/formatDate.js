// src/lib/utils/formatDate.js
export function formatDateFR(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-");
  return `${d}/${m}/${y}`;
}
// Date (ISO, timestamp ms ou Date) → "jj/mm/aaaa", "—" si absente/invalide
export function formatAnyDateFR(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR");
}
