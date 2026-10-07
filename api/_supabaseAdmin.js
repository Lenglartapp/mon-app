// Client Supabase CÔTÉ SERVEUR (Vercel Functions / cron). N'existe jamais dans le navigateur.
// Utilise de préférence la clé "service_role" (SUPABASE_SERVICE_KEY) ; à défaut, retombe sur
// l'URL + clé anon (VITE_*) en dev local uniquement — la clé anon ne lit plus rien depuis la
// migration RLS du 2026-10-07 (accès réservé aux connectés).
//
// Variables attendues (Vercel + .env local) :
//   SUPABASE_URL          ex. https://bnwfrdjcujhvobzusziq.supabase.co
//   SUPABASE_SERVICE_KEY  clé service_role (secret serveur) — recommandé
//   (fallback dev) VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY

import { createClient } from '@supabase/supabase-js';

let _client = null;

export function getSupabaseAdmin() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  // En production, la clé anon ne voit plus rien (RLS réservée aux connectés, migration
  // 2026-10-07) : sans clé service_role, le cron lirait des tables vides sans le dire.
  if (process.env.VERCEL_ENV === 'production' && !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_SERVICE_KEY manquante dans Vercel (production) : la clé anon ne peut plus lire les données.');
  }
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'Configuration Supabase serveur incomplète : SUPABASE_URL et SUPABASE_SERVICE_KEY (ou VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY) requis.'
    );
  }
  _client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _client;
}
