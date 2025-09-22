// src/lib/utils/norm.js
export function normKey(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normValue(v) {
  if (v == null) return "";
  if (Array.isArray(v)) return JSON.stringify([...v].sort());
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}