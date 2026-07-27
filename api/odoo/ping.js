// GET /api/odoo/ping — test de connexion Odoo (lecture seule).
// Renvoie la version Odoo, l'uid authentifié et le nombre de projets visibles.

import { version, authenticate, execute } from '../_odooClient.js';

export default async function handler(req, res) {
  try {
    const ver = await version();
    const uid = await authenticate();
    const projectCount = await execute('project.project', 'search_count', [[]]);
    res.status(200).json({
      ok: true,
      serverVersion: ver.server_version,
      uid,
      projectCount,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
