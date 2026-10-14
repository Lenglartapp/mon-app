import { useState, useEffect } from 'react';
import { isServerReachable, CONNECTIVITY_EVENT, probeServer } from '../lib/supabaseClient';

/**
 * En ligne = le navigateur se dit connecté ET le serveur répond.
 * Sur iPhone (appli installée), `navigator.onLine` reste à true en mode avion : la
 * joignabilité réelle vient des requêtes (lib/supabaseClient). Hors ligne, on vérifie
 * toutes les 20 s si le serveur est revenu (petite requête sans données).
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(isServerReachable);

  useEffect(() => {
    const update = () => setIsOnline(isServerReachable());
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    window.addEventListener(CONNECTIVITY_EVENT, update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      window.removeEventListener(CONNECTIVITY_EVENT, update);
    };
  }, []);

  useEffect(() => {
    if (isOnline) return undefined;
    const t = setInterval(() => { if (navigator.onLine !== false) probeServer(); }, 20_000);
    return () => clearInterval(t);
  }, [isOnline]);

  return isOnline;
}
