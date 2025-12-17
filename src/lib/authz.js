// src/lib/authz.js
export function can(user, action) {
  const role = user?.role;
  if (!role) return false;
  if (role === "admin") return true; // admin = tout

  const RIGHTS = {
    ordonnancement: {
      "users.manage": false,
      "chiffrage.view": true,
      "chiffrage.edit": true,
      "chiffrage.moulinette": true, // Access to Moulinette Tab
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
      "chiffrage.edit": true,
      "chiffrage.moulinette": true,
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
      "chiffrage.edit": false,
      "chiffrage.moulinette": false,
      "production.view": true,
      "production.edit": true,
      "inventory.view": true,
      "inventory.edit": true,
      "planning.view": true,
      "planning.edit": false,
    },
    adv: {
      "users.manage": false,
      "chiffrage.view": true,
      "chiffrage.edit": true,
      "chiffrage.moulinette": false, // RESTRICTED
      "production.view": true, // Can view production progress
      "production.edit": false, // But cannot edit rows
      "inventory.view": true,
      "inventory.edit": false,
      "planning.view": true,
      "planning.edit": false,
    },
  };

  const map = RIGHTS[role];
  if (!map) return false;
  if (action in map) return !!map[action];

  // Default fallbacks if keys missing in map but present in concept
  // Actually better to be strict, return false if not in map
  return false;
}