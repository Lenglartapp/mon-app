// Vérifie, côté serveur, l'utilisateur Droitfil qui appelle une fonction /api/* :
// le navigateur envoie son jeton de session Supabase (Authorization: Bearer <access_token>),
// qu'on fait valider par Supabase. Sans jeton valide → 401.

import { getSupabaseAdmin } from './_supabaseAdmin.js';

/** @returns {Promise<{ id: string, email: string } | null>} */
export async function getRequestUser(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const token = String(header).replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  try {
    const { data, error } = await getSupabaseAdmin().auth.getUser(token);
    if (error || !data?.user) return null;
    return { id: data.user.id, email: data.user.email };
  } catch {
    return null;
  }
}

/**
 * Garde commune : renvoie l'utilisateur, ou répond 401 / 403 et renvoie null.
 * @param {(user) => boolean} [allow] contrôle supplémentaire (ex. accès réservé)
 */
export async function requireUser(req, res, allow) {
  const user = await getRequestUser(req);
  if (!user) {
    res.status(401).json({ ok: false, error: 'Connexion Droitfil requise.' });
    return null;
  }
  if (allow && !allow(user)) {
    res.status(403).json({ ok: false, error: 'Accès réservé.' });
    return null;
  }
  return user;
}
