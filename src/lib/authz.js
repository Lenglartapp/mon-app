// src/lib/authz.js
export function can(user, action) {
  // TEMPORAIRE : Accès total pour tout le monde le temps du déploiement
  if (user) return true;

  const role = user?.role;
  if (!role) return false;
  if (role === "admin") return true; // Admin voit tout

  const RIGHTS = {
    // Rôle : Ordonnancement (Thomas)
    ordonnancement: {
      "users.manage": false,
      "chiffrage.view": true,
      "chiffrage.edit": true,
      "chiffrage.moulinette": true,
      "production.view": true, // <--- C'est ici que ça se joue
      "production.edit": true,
      "inventory.view": true,
      "inventory.edit": true,
      "planning.view": true,
      "planning.edit": true,
    },
    // Rôle : Pilotage Projet (Pauline)
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
    // Rôle : Production / Atelier / Pose
    production: {
      "users.manage": false,
      "chiffrage.view": false,
      "chiffrage.edit": false,
      "production.view": true,
      "production.edit": true, // Peut avancer les statuts
      "inventory.view": true,
      "inventory.edit": true,
      "planning.view": true,
      "planning.edit": false,
    },
    // Rôle : ADV
    adv: {
      "users.manage": false,
      "chiffrage.view": true,
      "chiffrage.edit": true,
      "production.view": true,
      "production.edit": false,
      "inventory.view": true,
      "planning.view": true,
      "planning.edit": false,
    },
  };

  const map = RIGHTS[role];
  if (!map) return false; // Rôle inconnu = rien

  // Si l'action est listée, on retourne sa valeur, sinon false
  if (action in map) return !!map[action];

  return false;
}