import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// RÉSILIENCE — Délai maximum sur les requêtes BASE (PostgREST `/rest/v1/`).
// Sans ça, quand la base est saturée ("Unhealthy"), les promesses restent pendantes
// indéfiniment : loader infini, écran figé, et les requêtes s'empilent côté serveur.
// Avec un délai, l'appel échoue proprement (erreur réseau) → l'UI peut proposer
// « Réessayer » et les écritures repassent par leur mécanisme de reprise.
// Lectures : 30 s. Écritures (payloads JSONB de plusieurs Mo) : 60 s.
// Storage (upload photos) et Auth ne sont PAS concernés (durées légitimement longues).
const READ_TIMEOUT_MS = 30_000;
const WRITE_TIMEOUT_MS = 60_000;

const fetchWithTimeout = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  if (!url.includes('/rest/v1/') || typeof AbortSignal?.timeout !== 'function') {
    return fetch(input, init);
  }
  const method = String(init.method || 'GET').toUpperCase();
  const timeoutSignal = AbortSignal.timeout(method === 'GET' || method === 'HEAD' ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS);
  // Conserve un éventuel signal fourni par l'appelant (.abortSignal()).
  const signal = init.signal && typeof AbortSignal.any === 'function'
    ? AbortSignal.any([init.signal, timeoutSignal])
    : (init.signal || timeoutSignal);
  return fetch(input, { ...init, signal });
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithTimeout },
});
