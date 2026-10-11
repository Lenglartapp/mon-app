// Gestion des comptes (Paramètres › Utilisateurs) : appels à /api/admin/users, réservé aux
// administrateurs. Le jeton de session part avec chaque appel ; le serveur vérifie le rôle.

import { odooFetch } from './odoo/odooFetch';

async function call(action, params = {}) {
  const res = await odooFetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params }),
  });
  let json = null;
  try { json = await res.json(); } catch { /* réponse vide */ }
  if (!res.ok || !json?.ok) throw new Error(json?.error || `Erreur serveur (${res.status})`);
  return json;
}

export const listAccounts = async () => (await call('list')).accounts || {};
export const setUserRole = (userId, role) => call('setRole', { userId, role });
export const setUserPassword = (userId, password) => call('setPassword', { userId, password });
export const deactivateUser = (userId) => call('deactivate', { userId });
export const reactivateUser = (userId) => call('reactivate', { userId });
export const inviteUser = ({ email, firstName, lastName, role }) =>
  call('invite', { email, firstName, lastName, role, redirectTo: `${window.location.origin}/` });
