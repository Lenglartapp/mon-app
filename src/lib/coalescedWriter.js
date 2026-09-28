// src/lib/coalescedWriter.js
// -----------------------------------------------------------------------------
// Écrivain COALESCÉ et RÉSILIENT pour les grosses lignes JSONB (`minutes`, `projects`).
//
//  1. Coalescence : un seul UPDATE en cours par ligne ; les sauvegardes arrivées
//     pendant ce temps sont fusionnées et seule la plus récente part.
//  2. Verrou partagé (withRowLock) avec la file hors ligne et la synchro photos :
//     jamais deux écritures simultanées sur la même ligne, dans tout l'onglet.
//  3. Échec transitoire (réseau, délai dépassé, base saturée) : le payload est mis
//     en file hors ligne PERSISTANTE (IndexedDB, survit à la fermeture de l'onglet)
//     et la ligne passe en "pause" avec un délai croissant (5 s → 5 min) : pendant
//     la pause, les nouvelles saisies vont directement en file au lieu de relancer
//     un envoi de plusieurs Mo vers une base déjà à genoux.
//  4. Succès : les mutations plus anciennes encore en file pour les mêmes champs
//     sont retirées (dans le verrou) → la file ne peut jamais rejouer une version
//     plus ancienne par-dessus une sauvegarde plus récente.
//  5. Dérive de schéma (colonne inconnue) : colonne retirée et écriture rejouée
//     (updateStrippingPhantomColumns) ; un résidu non identifiable n'est JAMAIS mis
//     en file (il échouerait en boucle).
// -----------------------------------------------------------------------------

import { supabase } from './supabaseClient';
import { queueMutation, supersedeQueuedMutations } from './syncQueue';
import { isSchemaDriftError, updateStrippingPhantomColumns } from './schemaDrift';
import { isPermanentDbError, backoffDelay } from './dbErrors';
import { withRowLock } from './rowWriteLock';

/**
 * @param {string} table
 * @param {object} [opts]
 * @param {(payload: object) => object} [opts.prepare]  nettoyage juste avant envoi
 * @param {(dropped: string[]) => void} [opts.onDropped] colonnes fantômes retirées
 * @param {(id: string, payload: object) => Promise<object>} [opts.transform]
 *        transformation asynchrone juste avant l'envoi (ex. archivage de l'historique
 *        des lignes) ; doit renvoyer le payload d'origine en cas d'échec.
 */
export const createCoalescedWriter = (table, { prepare = (p) => p, onDropped, transform } = {}) => {
  const inFlight = new Set();
  const pending = new Map();   // id -> payload fusionné en attente
  const pause = new Map();     // id -> { failures, until }

  const flush = async (id) => {
    if (inFlight.has(id)) return;
    inFlight.add(id);
    try {
      while (pending.has(id)) {
        let cleaned = prepare({ ...pending.get(id) });
        pending.delete(id);
        if (!cleaned || Object.keys(cleaned).length === 0) continue;
        const p = pause.get(id);
        if (p && Date.now() < p.until) {
          // Base en difficulté pour cette ligne : on ne relance pas d'envoi, on
          // persiste en file (la file réessaiera avec son propre rythme).
          await queueMutation(table, id, cleaned);
          continue;
        }

        if (transform) {
          try { cleaned = await transform(id, cleaned); }
          catch (e) { console.warn(`[${table}] transformation avant envoi ignorée :`, e); }
        }

        const startedAt = Date.now();
        const { error, dropped, body } = await withRowLock(table, id, async () => {
          const res = await updateStrippingPhantomColumns(supabase, table, id, cleaned);
          if (!res.error) await supersedeQueuedMutations(table, id, Object.keys(res.body), startedAt);
          return res;
        });
        if (dropped.length > 0) {
          console.warn(`[${table}] colonne(s) absente(s) en base ignorée(s) : ${dropped.join(', ')} — le reste a été sauvegardé.`);
          onDropped?.(dropped);
        }
        if (!error) { pause.delete(id); continue; }
        if (isSchemaDriftError(error)) {
          console.error(`[${table}] sauvegarde rejetée (dérive schéma persistante), abandonnée : ${error.message}`);
          continue;
        }
        if (isPermanentDbError(error)) {
          // Refus définitif : en file (mise de côté par drainQueue, jamais perdue).
          console.error(`[${table}] sauvegarde refusée par la base :`, error);
        } else {
          const failures = (p?.failures || 0) + 1;
          pause.set(id, { failures, until: Date.now() + backoffDelay(failures) });
          console.error(`[${table}] sauvegarde échouée (essai ${failures}), mise en file :`, error);
        }
        await queueMutation(table, id, body);
      }
    } finally {
      inFlight.delete(id);
    }
  };

  /** Enregistre `dbUpdates` pour la ligne `id` (fusionné avec l'attente) et lance l'envoi. */
  const write = (id, dbUpdates) => {
    pending.set(id, { ...(pending.get(id) || {}), ...dbUpdates });
    return flush(id);
  };

  return { write };
};
