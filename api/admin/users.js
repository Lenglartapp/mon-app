// POST /api/admin/users — gestion des comptes depuis Paramètres › Utilisateurs.
// Réservé aux administrateurs (rôle `admin` du profil de l'appelant, vérifié ici).
// Agit sur les comptes de connexion Supabase (clé service_role, jamais exposée au navigateur)
// et sur la table `profiles`.
//
// body : { action, ...params }
//   list                                   → e-mail, dernière connexion, blocage de chaque compte
//   setRole       { userId, role }
//   setPassword   { userId, password }     → mot de passe provisoire
//   deactivate    { userId }               → profil archivé + connexion bloquée (réversible)
//   reactivate    { userId }
//   invite        { email, firstName, lastName, role, redirectTo }

import { getSupabaseAdmin } from '../_supabaseAdmin.js';
import { getRequestUser } from '../_auth.js';

const ROLES = new Set(['admin', 'sales', 'ordo', 'ordo_conf', 'op', 'prepa', 'pose', 'conf', 'compta']);
const BAN_FOREVER = '876000h'; // ~100 ans : connexion bloquée jusqu'à réactivation

async function requireAdmin(req, res, sb) {
  const user = await getRequestUser(req);
  if (!user) { res.status(401).json({ ok: false, error: 'Connexion Droitfil requise.' }); return null; }
  const { data } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (data?.role !== 'admin') { res.status(403).json({ ok: false, error: 'Réservé aux administrateurs.' }); return null; }
  return user;
}

async function listAccounts(sb) {
  const out = {};
  for (let page = 1; page < 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    (data?.users || []).forEach((u) => {
      out[u.id] = {
        email: u.email || null,
        lastSignInAt: u.last_sign_in_at || null,
        invitedAt: u.invited_at || null,
        confirmed: !!(u.email_confirmed_at || u.confirmed_at),
        banned: !!(u.banned_until && new Date(u.banned_until) > new Date()),
      };
    });
    if (!data?.users || data.users.length < 200) break;
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST attendu.' });
  let sb;
  try { sb = getSupabaseAdmin(); } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  if (!process.env.SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ ok: false, error: 'SUPABASE_SERVICE_KEY absente : la gestion des comptes est indisponible sur cet environnement.' });
  }
  const me = await requireAdmin(req, res, sb);
  if (!me) return undefined;

  const { action, userId, role, password, email, firstName, lastName, redirectTo } = req.body || {};
  try {
    switch (action) {
      case 'list':
        return res.status(200).json({ ok: true, accounts: await listAccounts(sb) });

      case 'setRole': {
        if (!ROLES.has(role)) throw new Error('Rôle inconnu.');
        if (userId === me.id && role !== 'admin') throw new Error('Vous ne pouvez pas retirer votre propre rôle administrateur.');
        const { error } = await sb.from('profiles').update({ role }).eq('id', userId);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      case 'setPassword': {
        if (!password || String(password).length < 8) throw new Error('Le mot de passe doit faire au moins 8 caractères.');
        const { error } = await sb.auth.admin.updateUserById(userId, { password: String(password) });
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      case 'deactivate':
      case 'reactivate': {
        if (userId === me.id) throw new Error('Vous ne pouvez pas désactiver votre propre compte.');
        const off = action === 'deactivate';
        const { error } = await sb.from('profiles').update({ archived_at: off ? new Date().toISOString() : null }).eq('id', userId);
        if (error) throw error;
        // Profil sans compte de connexion (ex. intérimaire du planning) : rien de plus à faire.
        const { error: banErr } = await sb.auth.admin.updateUserById(userId, { ban_duration: off ? BAN_FOREVER : 'none' });
        if (banErr && !/not found|user_not_found/i.test(banErr.message || '')) throw banErr;
        return res.status(200).json({ ok: true });
      }

      case 'invite': {
        const mail = String(email || '').trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) throw new Error('E-mail invalide.');
        if (!ROLES.has(role)) throw new Error('Rôle inconnu.');
        if (!String(firstName || '').trim()) throw new Error('Prénom requis.');
        const { data, error } = await sb.auth.admin.inviteUserByEmail(mail, redirectTo ? { redirectTo } : undefined);
        if (error) throw error;
        const id = data?.user?.id;
        const { error: pErr } = await sb.from('profiles').upsert({
          id, first_name: String(firstName).trim(), last_name: String(lastName || '').trim() || null, role,
        }, { onConflict: 'id' });
        if (pErr) throw pErr;
        return res.status(200).json({ ok: true, userId: id });
      }

      default:
        return res.status(400).json({ ok: false, error: 'Action inconnue.' });
    }
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message || String(e) });
  }
}
