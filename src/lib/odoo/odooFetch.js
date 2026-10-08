// fetch vers /api/odoo/* avec le jeton de session Supabase : le serveur vérifie qui appelle
// (api/_auth.js) avant de toucher à Odoo.

import { supabase } from '../supabaseClient';

export async function odooFetch(url, options = {}) {
  let token = null;
  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token || null;
  } catch { /* hors ligne : le serveur répondra 401 */ }
  return fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}
