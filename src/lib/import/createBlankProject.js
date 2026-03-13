// src/lib/import/createBlankProject.js
import { uid } from "../utils/uid";
import { computeFormulas } from "../formulas/compute";

function seedRowsFor(type) {
  // on met seulement l'essentiel ; adapte si tu veux préremplir plus
  const base = { id: uid(), produit: type, zone: "", piece: "" };
  return [base]; // 1 ligne vide par type (tu peux en mettre 0 si tu préfères)
}

/**
 * @param {Object} opts
 * @param {Array} prodSchema
 * @returns {Array} rowsProduction
 */
export function createBlankProject(opts, prodSchema) {
  const rows = [];
  if (opts?.useRideaux)        rows.push(...seedRowsFor("Rideau"));
  if (opts?.useStoresClassiques) rows.push(...seedRowsFor("Store Enrouleur"));
  if (opts?.useStoresBateau)   rows.push(...seedRowsFor("Store Bateau"));
  if (opts?.useTentures)       rows.push(...seedRowsFor("Tenture murale"));
  if (opts?.useCacheSommier)   rows.push(...seedRowsFor("Cache-sommier"));
  if (opts?.usePlaid)          rows.push(...seedRowsFor("Plaid"));
  if (opts?.useCoussins)       rows.push(...seedRowsFor("Coussin"));
  if (opts?.useMobilier)       rows.push(...seedRowsFor("Mobilier"));
  
  return computeFormulas(rows, prodSchema);
}