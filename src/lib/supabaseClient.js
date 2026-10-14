import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// RÉSILIENCE — Délai maximum sur TOUTES les requêtes vers Supabase.
// Sans ça, une requête peut rester en attente indéfiniment : base saturée ("Unhealthy"),
// et surtout iPhone en mode avion, où les requêtes ne ÉCHOUENT pas, elles attendent
// (loader infini, écran blanc à l'ouverture, photo qui tourne sans fin). Avec un délai,
// l'appel échoue proprement (erreur réseau) → l'appli bascule sur la copie de l'appareil
// et les envois passent en file.
//   Base (lecture 30 s / écriture 60 s, gros JSONB) · Connexion 10 s · Fichiers 30 s.
const READ_TIMEOUT_MS = 30_000;
const WRITE_TIMEOUT_MS = 60_000;
const AUTH_TIMEOUT_MS = 10_000;
const STORAGE_TIMEOUT_MS = 30_000;

const timeoutFor = (url, method) => {
  if (url.includes('/rest/v1/')) return method === 'GET' || method === 'HEAD' ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS;
  if (url.includes('/auth/v1/')) return AUTH_TIMEOUT_MS;
  if (url.includes('/storage/v1/')) return STORAGE_TIMEOUT_MS;
  return null;
};

// Signal de délai compatible avec les anciens iOS (AbortSignal.timeout / .any absents).
const withTimeout = (callerSignal, ms) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('Délai dépassé (réseau injoignable)', 'TimeoutError')), ms);
  if (callerSignal) {
    if (callerSignal.aborted) ctrl.abort(callerSignal.reason);
    else callerSignal.addEventListener('abort', () => ctrl.abort(callerSignal.reason), { once: true });
  }
  return { signal: ctrl.signal, done: () => clearTimeout(timer) };
};

// ——— Joignabilité RÉELLE du serveur ———
// Sur iPhone (appli installée), `navigator.onLine` reste à true en mode avion : on ne peut
// pas s'y fier. On observe les requêtes : un échec réseau (ou un délai dépassé) → hors
// ligne ; la moindre réponse du serveur, même une erreur HTTP → en ligne.
export const CONNECTIVITY_EVENT = 'droitfil:connectivity';
let serverReachable = true;
const setReachable = (ok) => {
  if (ok === serverReachable) return;
  serverReachable = ok;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CONNECTIVITY_EVENT));
};
/** Le serveur est-il joignable ? (navigator.onLine ET dernières requêtes réussies) */
export const isServerReachable = () => (typeof navigator === 'undefined' || navigator.onLine !== false) && serverReachable;
if (typeof window !== 'undefined') window.addEventListener('online', () => { serverReachable = true; });

/** Petite requête sans données (santé du service de connexion) : le serveur répond-il ? */
export const probeServer = async () => {
  try {
    const res = await fetchWithTimeout(`${supabaseUrl}/auth/v1/health`, { headers: { apikey: supabaseAnonKey } });
    return !!res;
  } catch { return false; }
};

const fetchWithTimeout = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  // Requête de données SANS session (jeton anonyme) : toutes les tables sont réservées
  // aux connectés (RLS), la base répondrait « aucune ligne » — ce que l'appli prendrait
  // pour une liste vide et pourrait recopier dans son cache hors ligne. Cas réel : session
  // expirée qu'un réseau instable n'a pas pu renouveler. On échoue comme une coupure
  // réseau : les écrans gardent la copie de l'appareil et les envois restent en file.
  if (url.includes('/rest/v1/')) {
    const headers = new Headers(init.headers || (typeof input === 'object' ? input.headers : undefined));
    if (headers.get('Authorization') === `Bearer ${supabaseAnonKey}`) {
      return Promise.reject(new TypeError('Failed to fetch (session non renouvelée)'));
    }
  }
  const ms = timeoutFor(url, String(init.method || 'GET').toUpperCase());
  if (!ms) return fetch(input, init);
  const { signal, done } = withTimeout(init.signal, ms);
  return fetch(input, { ...init, signal }).then(
    (res) => { done(); setReachable(true); return res; },
    (err) => {
      done();
      // Abandon volontaire de l'appelant (pas un délai) : ne dit rien sur le réseau.
      const callerAbort = init.signal?.aborted && err?.name === 'AbortError';
      if (!callerAbort) setReachable(false);
      throw err;
    },
  );
};

// Lien d'invitation (ou de réinitialisation) reçu par e-mail : Supabase connecte la personne
// via le fragment d'URL (#…&type=invite), qu'il efface aussitôt. On note le type AVANT, pour
// lui demander de choisir son mot de passe (voir SetPasswordScreen dans App.jsx).
export const MUST_SET_PASSWORD_KEY = 'df_must_set_password';
try {
  const linkType = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type');
  if (linkType === 'invite' || linkType === 'recovery') sessionStorage.setItem(MUST_SET_PASSWORD_KEY, linkType);
} catch { /* navigation privée : on n'empêche pas la connexion */ }

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithTimeout },
});
