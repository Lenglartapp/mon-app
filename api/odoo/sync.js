// POST /api/odoo/sync — ÉCRIT les temps consommés dans Odoo (feuilles de temps).
// Body : { projects:[{ id, name, odooProjectId?, hours:{conf,prepa,pose} }], confirm:true, date? }
// Sécurité : n'écrit que si confirm === true. Ne traite que les projets 'linked'
// (les autres sont ignorés proprement). Logique partagée avec le job de nuit (_syncTimes).

import { syncTimesheets } from '../_syncTimes.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Méthode non autorisée (POST attendu).' });
    return;
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { projects, confirm, date } = body;
    if (!Array.isArray(projects)) {
      res.status(400).json({ ok: false, error: 'Champ "projects" (tableau) requis.' });
      return;
    }
    if (confirm !== true) {
      res.status(400).json({ ok: false, error: 'Écriture refusée : "confirm" doit valoir true.' });
      return;
    }
    const out = await syncTimesheets(projects, date || null);
    res.status(200).json({ ok: true, ...out });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
