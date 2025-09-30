// src/lib/acl.js
export const PERMS = {
  // écrans
  "view:settings": true,
  "view:chiffrage": ["admin","ordonnancement","pilotage_projet"],
  "view:production": ["admin","ordonnancement","pilotage_projet","production"],
  "view:inventory":  ["admin","ordonnancement","pilotage_projet","production"],
  "view:planning":   ["admin","ordonnancment","pilotage_projet","production"], // lecture seule pour production + pilotage
  // actions
  "edit:planning":   ["admin","ordonnancement"],
  "edit:inventory":  ["admin","ordonnancement","pilotage_projet","production"],
  "edit:production": ["admin","ordonnancement","pilotage_projet","production"],
  "edit:chiffrage":  ["admin","ordonnancement","pilotage_projet"],
  "admin:users":     ["admin"],
};

export const ROLE_LABELS = {
  admin: "Admin",
  ordonnancement: "Ordonnancement (plein accès hors admin)",
  pilotage_projet: "Pilotage Projet (tout, planning en lecture seule)",
  production: "Production (Prod + Inventaire, pas Chiffrage; planning lecture seule)",
};

// petit helper
export function can(role, perm) {
  const rule = PERMS[perm];
  if (rule === true) return true;
  if (!Array.isArray(rule)) return false;
  return rule.includes(role);
}