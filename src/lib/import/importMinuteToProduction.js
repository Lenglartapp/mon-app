// src/lib/import/importMinuteToProduction.js
import { uid } from "../utils/uid";
import { computeFormulas } from "../formulas/compute";

// 1) renvoie l'ensemble des keys communes (même nom) entre 2 schémas
export function getSharedKeys(minuteSchema, prodSchema) {
  const mset = new Set((minuteSchema || []).map(c => c.key));
  return (prodSchema || []).map(c => c.key).filter(k => mset.has(k));
}

// 2) normalise une row minute -> row production en copiant uniquement les champs partagés
export function mapMinuteRowToProdRow(minuteRow, sharedKeys) {
  const out = { id: uid() };
  for (const k of sharedKeys) {
    out[k] = minuteRow?.[k];
  }
  // métadonnées de traçabilité
  out.source_minute_id = minuteRow?.__minute_id ?? minuteRow?.minute_id ?? null;
  out.source_line_id   = minuteRow?.id ?? null;
  out.imported_at      = new Date().toISOString();
  return out;
}

/**
 * Importer une minute dans le tableau "Production"
 * @param {Object} minute - objet minute { id, name, rows:[] }
 * @param {Array} minuteSchema
 * @param {Array} prodSchema
 * @param {Array} existingRows - lignes production existantes (projet déjà ouvert)
 * @returns {Array} nextRows - nouvelles lignes production (existantes + importées) recalculées
 */
export function importMinuteToProduction(minute, minuteSchema, prodSchema, existingRows = []) {
  if (!minute || !Array.isArray(minute.rows)) return existingRows || [];
  const shared = getSharedKeys(minuteSchema, prodSchema);

  // copie stricte des champs communs
  const imported = minute.rows.map(r => mapMinuteRowToProdRow(r, shared));

  // concat + recalcul formules côté Production
  const merged = [ ...(existingRows || []), ...imported ];
  return computeFormulas(merged, prodSchema);
}