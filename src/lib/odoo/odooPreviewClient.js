// Helper client : appelle les fonctions serverless /api/odoo/* depuis le navigateur.
// La clé API n'est JAMAIS ici — elle vit côté serveur (Vercel).

// Domaine public d'Odoo (pas un secret) — sert à construire les liens directs vers les fiches.
export const ODOO_BASE_URL = 'https://lenglart-erp-lenglart.odoo.com';

/** Lien direct vers un projet dans Odoo. */
export function odooProjectUrl(projectId) {
  return `${ODOO_BASE_URL}/odoo/project/${projectId}`;
}

async function callApi(path, options) {
  let res;
  try {
    res = await fetch(path, options);
  } catch (e) {
    throw new Error(`Impossible de joindre ${path} (${e.message}).`);
  }
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Réponse inattendue de ${path} (HTTP ${res.status}). ` +
        `En dev local, \`vite\` ne sert pas les fonctions /api — utilise \`vercel dev\` ou un déploiement Vercel.`
    );
  }
  if (!res.ok || data.ok === false) {
    throw new Error(data?.error || `Erreur ${res.status} sur ${path}.`);
  }
  return data;
}

/** Test de connexion Odoo. */
export function pingOdoo() {
  return callApi('/api/odoo/ping', { method: 'GET' });
}

/**
 * Mode aperçu (dry-run) — envoie les projets agrégés, reçoit les statuts Odoo.
 * @param {string} cutoffDate 'YYYY-MM-DD'
 * @param {Array} projects [{ id, name, odooProjectId?, hours:{conf,prepa,pose} }]
 */
export function fetchOdooPreview(cutoffDate, projects) {
  return callApi('/api/odoo/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cutoffDate, projects }),
  });
}
