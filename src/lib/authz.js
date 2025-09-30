// src/lib/authz.js
export function can(user, action) {
  const role = user?.role;
  if (!role) return false;
  if (role === "admin") return true; // admin = tout

  const RIGHTS = {
    ordonnancement: {
      "users.manage": false,
      "chiffrage.view": true,
      "production.view": true,
      "production.edit": true,
      "inventory.view": true,
      "inventory.edit": true,
      "planning.view": true,
      "planning.edit": true,
    },
    pilotage_projet: {
      "users.manage": false,
      "chiffrage.view": true,
      "production.view": true,
      "production.edit": true,
      "inventory.view": true,
      "inventory.edit": true,
      "planning.view": true,
      "planning.edit": false,
    },
    production: {
      "users.manage": false,
      "chiffrage.view": false,
      "production.view": true,
      "production.edit": true,
      "inventory.view": true,
      "inventory.edit": true,
      "planning.view": true,
      "planning.edit": false,
    },
  };

  const map = RIGHTS[role];
  if (!map) return false;
  if (action in map) return !!map[action];
  return false;
}