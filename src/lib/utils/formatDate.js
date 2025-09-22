// src/lib/utils/formatDate.js
export function formatDateFR(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-");
  return `${d}/${m}/${y}`;
}