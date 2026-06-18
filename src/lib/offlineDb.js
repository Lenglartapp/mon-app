import Dexie from 'dexie';

// Base de données locale pour le mode hors ligne
export const db = new Dexie('droitfil');

db.version(1).stores({
  projects: 'id',
  events: 'id',
  expedition_items: 'id',
  expedition_colis: 'id',
});

// Version 2 : file de mutations offline (écriture hors ligne)
db.version(2).stores({
  projects: 'id',
  events: 'id',
  expedition_items: 'id',
  expedition_colis: 'id',
  pending_mutations: '++id, table, record_id, timestamp',
});

// Version 3 : file de photos offline
db.version(3).stores({
  projects: 'id',
  events: 'id',
  expedition_items: 'id',
  expedition_colis: 'id',
  pending_mutations: '++id, table, record_id, timestamp',
  offline_photos: '++id, project_id, timestamp',
});

// Version 4 : cache local des minutes (chiffrages) — symétrique à `projects`.
// Permet l'affichage instantané (Cmd+K, liste) au rechargement sans attendre le réseau.
db.version(4).stores({
  projects: 'id',
  minutes: 'id',
  events: 'id',
  expedition_items: 'id',
  expedition_colis: 'id',
  pending_mutations: '++id, table, record_id, timestamp',
  offline_photos: '++id, project_id, timestamp',
});
