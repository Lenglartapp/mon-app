// src/lib/authz.js

// CENTRALIZED PERMISSIONS CONFIGURATION
const PERMISSIONS = {
  // ADMIN : Full Access
  admin: "*",

  // SALES (Commercial / ADV)
  sales: {
    "nav.chiffrage": true,
    "nav.production": true,
    "nav.inventory": true,
    "nav.settings": true,

    "chiffrage.view": true,
    "chiffrage.edit": true,
    "chiffrage.moulinette": false,

    "project.create": true, // Added

    "planning.view": true,
    "planning.edit": false,
    "planning.view_gauges": true,

    "inventory.view": true,
    "inventory.edit": false,
  },

  // ADV (Alias for Sales)
  adv: {
    "nav.chiffrage": true,
    "nav.production": true,
    "nav.inventory": true,
    "nav.settings": true,
    "chiffrage.view": true,
    "chiffrage.edit": true,
    "project.create": true,
    "planning.view": true,
    "inventory.view": true,
  },

  // ORDO (Ordonnancement)
  ordo: {
    "nav.chiffrage": false,
    "nav.production": true,
    "nav.inventory": true,
    "nav.settings": true,

    "planning.view": true,
    "planning.edit": true, // Can Drag & Drop
    "planning.view_gauges": true,

    "inventory.view": true,
    "inventory.edit": true, // Can Edit
  },

  // OP (Opérateur / Chef d'atelier ?)
  op: {
    "nav.chiffrage": false,
    "nav.production": true,
    "nav.inventory": true,
    "nav.settings": true,

    "planning.view": true,
    "planning.edit": false,
    "planning.view_gauges": true,

    "inventory.view": true,
    "inventory.edit": false,
  },

  // PREPA (Préparation)
  prepa: {
    "nav.chiffrage": false,
    "nav.production": true,
    "nav.inventory": true,
    "nav.settings": true,

    "planning.view": true,
    "planning.edit": false,
    "planning.view_gauges": false, // Hidden

    "inventory.view": true,
    "inventory.edit": true, // Can Edit
  },

  // POSE (Poseurs)
  pose: {
    "nav.chiffrage": false,
    "nav.production": true,
    "nav.inventory": false, // Hidden
    "nav.settings": true,

    "planning.view": true,
    "planning.edit": false,
    "planning.view_gauges": false, // Hidden

    "inventory.view": false,
  },

  // CONF (Confection)
  conf: {
    "nav.chiffrage": false,
    "nav.production": false, // Hidden
    "nav.inventory": false, // Hidden
    "nav.settings": true,

    "planning.view": true,
    "planning.edit": false,
    "planning.view_gauges": false, // Hidden
  },

  // COMPTA (Comptabilité)
  compta: {
    "nav.chiffrage": false,
    "nav.production": false, // Hidden
    "nav.inventory": true,
    "nav.settings": true,

    "planning.view": true,
    "planning.edit": false,
    "planning.view_gauges": false, // Hidden

    "inventory.view": true,
    "inventory.edit": false,
  },
};

export function can(user, action) {
  if (!user || !user.role) return false;

  const role = user.role.toLowerCase(); // Align case

  // Admin Bypass
  if (role === 'admin') return true;

  const rules = PERMISSIONS[role];
  if (!rules) return false; // Unknown role

  if (rules === "*") return true;

  return !!rules[action];
}

export function role(user) {
  return user?.role?.toLowerCase() || 'guest';
}