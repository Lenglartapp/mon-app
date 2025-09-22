// src/lib/utils/slug.js
export function slugParamName(raw = "") {
  return String(raw)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // retire les accents
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")                              // espaces -> _
    .replace(/[^a-z0-9_]/g, "_");                      // nettoie le reste
}