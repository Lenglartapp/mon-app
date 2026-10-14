// src/lib/offlineProjects.js
// -----------------------------------------------------------------------------
// Projets ouverts HORS CONNEXION (depuis la copie du téléphone).
//
//  • server_rows : dernière version des lignes reçue du serveur, par projet. C'est la
//    « base » de la fusion au retour du réseau (lib/rowsMerge).
//  • projets « hors ligne » : ouverts depuis la copie locale, donc possiblement en
//    retard sur le serveur. Leurs modifications passent TOUJOURS par la file (jamais
//    d'écriture directe du tableau entier) et sont fusionnées à l'envoi. Le projet
//    redevient normal dès qu'il a été rechargé depuis le serveur.
// -----------------------------------------------------------------------------

import { db } from './offlineDb';

export const saveServerRows = (id, rows) => {
  if (!id || !Array.isArray(rows)) return Promise.resolve();
  return db.server_rows.put({ id: String(id), rows, at: Date.now() }).catch(() => {});
};

export const getServerRows = async (id) => {
  try { return (await db.server_rows.get(String(id)))?.rows || null; } catch { return null; }
};

const offlineOpened = new Set();
export const markOpenedOffline = (id) => offlineOpened.add(String(id));
export const isOpenedOffline = (id) => offlineOpened.has(String(id));
export const clearOpenedOffline = (id) => offlineOpened.delete(String(id));

/**
 * Une lecture a échoué faute de réseau (et non parce que la donnée n'existe pas).
 * Ne se fie PAS à navigator.onLine seul : sur iPhone (appli installée) il reste à true
 * en mode avion, et la requête échoue par délai dépassé.
 */
export const isNetworkFailure = (error) => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!error) return false;
  const code = String(error.code || '');
  if (code === 'PGRST116') return false; // aucune ligne : le projet n'existe pas / plus
  const msg = `${error.name || ''} ${error.message || error}`.toLowerCase();
  return !code || /fetch|network|timeout|timed out|délai|abort|load failed/.test(msg);
};

// Dernier échec d'ouverture d'un projet ('network' | 'error') : choisit le message affiché.
const detailFailures = new Map();
export const noteDetailFailure = (id, kind) => { if (kind) detailFailures.set(String(id), kind); else detailFailures.delete(String(id)); };
export const detailFailureOf = (id) => detailFailures.get(String(id)) || null;
