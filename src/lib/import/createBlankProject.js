// src/lib/import/createBlankProject.js
import { uid } from "../utils/uid";
import { computeFormulas } from "../formulas/compute";

function seedRowsFor(type) {
  // on met seulement l'essentiel ; adapte si tu veux préremplir plus
  const base = { id: uid(), produit: type, zone: "", piece: "" };
  return [base]; // 1 ligne vide par type (tu peux en mettre 0 si tu préfères)
}

/**
 * @param {{rideaux:boolean, stores:boolean, decors:boolean}} opts
 * @param {Array} prodSchema
 * @returns {Array} rowsProduction
 */
export function createBlankProject(opts, prodSchema) {
  const rows = [];
  if (opts?.rideaux) rows.push(...seedRowsFor("Rideau"));
  if (opts?.stores)  rows.push(...seedRowsFor("Store Enrouleur"));
  if (opts?.decors)  rows.push(...seedRowsFor("Décor de lit"));
  return computeFormulas(rows, prodSchema);
}