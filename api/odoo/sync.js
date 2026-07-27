// POST /api/odoo/sync — ÉCRIT les temps consommés dans Odoo (feuilles de temps).
// Body : { projects:[{ id, name, odooProjectId?, hours:{conf,prepa,pose} }], confirm:true, date? }
// Sécurité : n'écrit que si confirm === true. Ne traite que les projets 'linked'
// (les autres sont ignorés proprement). Upsert idempotent par (tâche, employé 31).

import { resolveProjectByName, SERVICES, GENERIC_EMPLOYEE_ID } from '../_odooPreview.js';
import { upsertTimesheetLine, SERVICE_LABEL } from '../_odooWrite.js';

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
    const syncDate = date || new Date().toISOString().slice(0, 10);

    const results = [];
    let created = 0, updated = 0, skipped = 0;
    for (const p of projects) {
      const r = await resolveProjectByName(p.name, p.odooProjectId || null);
      if (r.status !== 'linked') {
        skipped++;
        results.push({ name: p.name, status: r.status, lines: [] });
        continue;
      }
      const lines = [];
      for (const svc of SERVICES) {
        const h = Number(p.hours?.[svc] || 0);
        const task = r.taskByService[svc];
        if (!task || h <= 0) continue;
        const out = await upsertTimesheetLine({
          projectId: r.project.id,
          taskId: task.id,
          employeeId: GENERIC_EMPLOYEE_ID,
          name: SERVICE_LABEL[svc],
          hours: h,
          date: syncDate,
        });
        if (out.action === 'created') created++; else updated++;
        lines.push({ svc, taskId: task.id, hours: h, ...out });
      }
      results.push({ name: p.name, odooProjectId: r.project.id, status: 'linked', lines });
    }

    res.status(200).json({ ok: true, date: syncDate, summary: { created, updated, skipped }, results });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
