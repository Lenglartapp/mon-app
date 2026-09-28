import { useState, useEffect, useCallback, useRef } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { drainQueue, getPendingCount, drainPhotos, getPendingPhotoCount } from '../lib/syncQueue';

/**
 * Draine automatiquement la file de mutations offline :
 * - au montage si on est déjà en ligne (gère le cas DevTools throttle / retour sans événement)
 * - au retour de connexion (événement online réel)
 * - quand la page redevient visible (onglet en arrière-plan)
 *
 * @param {function} [onSynced] - Callback après sync réussie (ex: refreshProjects)
 */
export function useSyncQueue(onSynced) {
  const isOnline = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const drainLock = useRef(false);

  const tryDrain = useCallback(async () => {
    if (!navigator.onLine || drainLock.current) return;
    drainLock.current = true;
    try {
      const mutCount = await getPendingCount();
      const photoCount = await getPendingPhotoCount();
      const total = mutCount + photoCount;
      setPendingCount(total);
      if (total === 0) return;

      setIsSyncing(true);
      // Mutations d'abord (rows sans photos), puis photos (qui patchent les vraies URLs)
      const mutResult = await drainQueue().catch(() => ({ synced: 0, failed: 1 }));
      const photoResult = await drainPhotos().catch(() => ({ synced: 0, failed: 1 }));
      const remaining = (await getPendingCount()) + (await getPendingPhotoCount());
      setPendingCount(remaining);
      setIsSyncing(false);

      if ((mutResult.synced > 0 || photoResult.synced > 0) && onSynced) onSynced();
    } finally {
      drainLock.current = false;
    }
  }, [onSynced]);

  // Reprise automatique tant qu'il reste des éléments en file (la cadence réelle
  // d'envoi est bornée par la reprise progressive de drainQueue : 5 s → 5 min).
  useEffect(() => {
    if (pendingCount === 0) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') tryDrain(); }, 30_000);
    return () => clearInterval(t);
  }, [pendingCount, tryDrain]);

  // Au montage : drainer si mutations en attente et déjà en ligne
  useEffect(() => {
    tryDrain();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Au retour de connexion réel (WiFi coupé/rétabli)
  useEffect(() => {
    if (isOnline) tryDrain();
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // Quand l'onglet redevient visible (retour depuis un autre onglet)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') tryDrain();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [tryDrain]);

  return { pendingCount, isSyncing };
}
