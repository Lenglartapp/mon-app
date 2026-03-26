import Dexie from 'dexie';

// Base de données locale pour le mode hors ligne
// Version 1 : stockage des projets, événements planning et expéditions
export const db = new Dexie('droitfil');

db.version(1).stores({
  projects: 'id',
  events: 'id',
  expedition_items: 'id',
  expedition_colis: 'id',
});
