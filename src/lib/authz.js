// src/lib/authz.js

// CENTRALIZED PERMISSIONS CONFIGURATION
const PERMISSIONS = {
  // ADMIN : Full Access
  admin: "*",

  // SALES (Commercial)
  sales: {
    "nav.chiffrage": true,
    "nav.production": true,
    "nav.inventory": true,
    "nav.planning": true,
    "nav.logistique": true,
    "nav.performance": false,
    "nav.settings": true,

    "chiffrage.view": true,
    "chiffrage.edit": true,
    "chiffrage.moulinette": false,
    "project.create": true,

    "planning.view": true,
    "planning.edit": false,
    "planning.view_gauges": true,
    "planning.view_assistant": false,
    "planning.manage_team": false,

    "inventory.view": true,
    "inventory.edit": false,

    "production.edit": true,

    "logistique.edit": false,
  },

  // ORDO (Ordonnancement)
  ordo: {
    "nav.chiffrage": false,
    "nav.production": true,
    "nav.inventory": true,
    "nav.planning": true,
    "nav.logistique": true,
    "nav.performance": true,
    "nav.settings": true,

    "performance.edit": true,

    "planning.view": true,
    "planning.edit": true,
    "planning.view_gauges": true,
    "planning.view_assistant": true,
    "planning.manage_team": true,

    "production.edit": true,

    "inventory.view": true,
    "inventory.edit": true,

    "logistique.edit": true,
  },

  // OP (Opérateur)
  op: {
    "nav.chiffrage": false,
    "nav.production": true,
    "nav.inventory": true,
    "nav.planning": true,
    "nav.logistique": true,
    "nav.performance": false,
    "nav.settings": true,

    "planning.view": true,
    "planning.edit": false,
    "planning.view_gauges": true,
    "planning.view_assistant": false,
    "planning.manage_team": false,

    "production.edit": true,

    "inventory.view": true,
    "inventory.edit": true,

    "logistique.edit": true,
  },

  // PREPA (Préparation)
  prepa: {
    "nav.chiffrage": false,
    "nav.production": true,
    "nav.inventory": true,
    "nav.planning": true,
    "nav.logistique": true,
    "nav.performance": false,
    "nav.settings": true,

    "planning.view": true,
    "planning.edit": false,
    "planning.view_gauges": true,
    "planning.view_assistant": false,
    "planning.manage_team": false,

    "inventory.view": true,
    "inventory.edit": true,

    "logistique.edit": true,
  },

  // POSE (Poseurs)
  // Production : lecture seule sauf Prise de côtes et Suivi de projet
  pose: {
    "nav.chiffrage": false,
    "nav.production": true,
    "nav.inventory": true,
    "nav.planning": true,
    "nav.logistique": true,
    "nav.performance": false,
    "nav.settings": true,

    "production.edit": false,
    "production.edit.prise_de_cotes": true,
    "production.edit.suivi_projet": true,

    "planning.view": true,
    "planning.edit": false,
    "planning.view_gauges": true,
    "planning.view_assistant": false,
    "planning.manage_team": false,

    "inventory.view": true,
    "inventory.edit": true,

    "logistique.edit": false,
  },

  // CONF (Confection)
  // Production : lecture seule uniquement
  conf: {
    "nav.chiffrage": false,
    "nav.production": true,
    "nav.inventory": true,
    "nav.planning": true,
    "nav.logistique": true,
    "nav.performance": false,
    "nav.settings": true,

    "production.edit": false,

    "planning.view": true,
    "planning.edit": false,
    "planning.view_gauges": true,
    "planning.view_assistant": false,
    "planning.manage_team": false,

    "inventory.view": true,
    "inventory.edit": true,

    "logistique.edit": false,
  },

  // COMPTA (Comptabilité)
  // Accès consultation uniquement : inventaire + planning
  compta: {
    "nav.chiffrage": false,
    "nav.production": false,
    "nav.inventory": true,
    "nav.planning": true,
    "nav.logistique": false,
    "nav.performance": false,
    "nav.settings": true,

    "planning.view": true,
    "planning.edit": false,
    "planning.view_gauges": true,
    "planning.view_assistant": false,
    "planning.manage_team": false,

    "inventory.view": true,
    "inventory.edit": false,

    "logistique.edit": false,
  },
};

export function can(user, action) {
  if (!user || !user.role) return false;

  const role = user.role.toLowerCase();

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
