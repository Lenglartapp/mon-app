// GET /api/odoo/project-status?name=...&odooProjectId=...
// Renvoie le statut de rapprochement Odoo d'UN projet (pour l'encart dossier). Lecture seule.

import { resolveProjectByName } from '../_odooPreview.js';

export default async function handler(req, res) {
  try {
    const q = req.query || {};
    const name = q.name || (typeof req.body === 'object' ? req.body?.name : undefined);
    const odooProjectId = q.odooProjectId ? Number(q.odooProjectId) : null;
    if (!name && !odooProjectId) {
      res.status(400).json({ ok: false, error: 'Paramètre "name" requis.' });
      return;
    }
    const r = await resolveProjectByName(name, odooProjectId);
    res.status(200).json({ ok: true, ...r });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
