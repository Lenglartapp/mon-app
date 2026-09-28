// src/lib/rowWriteLock.js
// -----------------------------------------------------------------------------
// Verrou d'écriture PAR LIGNE de base (table + id), partagé par TOUT l'onglet.
//
// Plusieurs chemins écrivent sur la même ligne `projects` / `minutes` : la
// sauvegarde en direct (updateProject / updateMinute), la file hors ligne
// (drainQueue) et la synchro des photos (drainPhotos). Sans coordination, deux
// UPDATE de plusieurs Mo partaient en parallèle sur la même ligne → verrous
// Postgres, timeouts, pool de connexions épuisé (base "Unhealthy") — et le plus
// ancien pouvait écraser le plus récent.
//
// withRowLock enchaîne les écritures d'une même ligne : une seule à la fois.
// -----------------------------------------------------------------------------

const chains = new Map();

export const withRowLock = (table, id, fn) => {
  const key = `${table}::${id}`;
  const prev = chains.get(key) || Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  chains.set(key, tail);
  tail.then(() => { if (chains.get(key) === tail) chains.delete(key); });
  return run;
};
