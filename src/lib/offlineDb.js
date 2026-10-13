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

// Version 5 : dernière version des lignes (`rows`) REÇUE DU SERVEUR par projet.
// Sert de base à la fusion au retour du réseau (lib/rowsMerge) : on ne rejoue que ce
// que le téléphone a réellement modifié, sans écraser le travail fait au bureau.
db.version(5).stores({
  projects: 'id',
  minutes: 'id',
  events: 'id',
  expedition_items: 'id',
  expedition_colis: 'id',
  pending_mutations: '++id, table, record_id, timestamp',
  offline_photos: '++id, project_id, timestamp',
  server_rows: 'id',
});
