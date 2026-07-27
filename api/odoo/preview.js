// POST /api/odoo/preview — mode aperçu (dry-run). NE FAIT AUCUNE ÉCRITURE.
// Body attendu : { cutoffDate: 'YYYY-MM-DD', projects: [{ id, name, odooProjectId?, hours:{conf,prepa,pose} }] }
// Renvoie, pour chaque projet, son statut de rapprochement Odoo et ce qui serait envoyé.

import { buildPreview } from '../_odooPreview.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Méthode non autorisée (POST attendu).' });
    return;
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { cutoffDate, projects } = body;
    if (!Array.isArray(projects)) {
      res.status(400).json({ ok: false, error: 'Champ "projects" (tableau) requis.' });
      return;
    }
    const preview = await buildPreview(cutoffDate || null, projects);
    res.status(200).json({ ok: true, ...preview });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
