// Mémorisation locale du rapprochement projet Droitfil -> projet Odoo (choix des homonymes,
// liaison manuelle des « introuvables »). Stocké dans le navigateur (localStorage) pour cette
// première version. À terme : à déplacer côté Supabase pour un mapping partagé entre postes.

const KEY = "odoo_project_map_v1";

function readMap() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* quota / mode privé : on ignore silencieusement */
  }
}

/** id Odoo mappé pour un projet Droitfil, ou null. */
export function getOdooId(droitfilProjectId) {
  if (droitfilProjectId == null) return null;
  const v = readMap()[String(droitfilProjectId)];
  return v == null ? null : Number(v);
}

/** Définit (ou efface si odooId == null) le mapping d'un projet Droitfil. */
export function setOdooId(droitfilProjectId, odooId) {
  if (droitfilProjectId == null) return;
  const map = readMap();
  if (odooId == null) delete map[String(droitfilProjectId)];
  else map[String(droitfilProjectId)] = Number(odooId);
  writeMap(map);
}

/** Tout le mapping (pour debug / futur export). */
export function getAllMappings() {
  return readMap();
}
