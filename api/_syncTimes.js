// Cœur de l'écriture des temps dans Odoo (feuilles de temps), partagé entre
// l'endpoint manuel /api/odoo/sync et le job de nuit /api/cron/nightly.
// Upsert idempotent par (tâche, employé générique) — rejouer met à jour, ne duplique jamais.

import { resolveProjectByName, SERVICES, GENERIC_EMPLOYEE_ID } from './_odooPreview.js';
import { upsertTimesheetLine, SERVICE_LABEL } from './_odooWrite.js';

/**
 * Écrit les temps agrégés des projets RELIÉS dans Odoo.
 * @param {Array} projects [{ id, name, odooProjectId?, hours:{conf,prepa,pose} }]
 * @param {string|null} date 'YYYY-MM-DD' pour la ligne de temps (défaut : aujourd'hui)
 * @returns {{ date, summary:{created,updated,skipped}, results }}
 */
export async function syncTimesheets(projects, date = null) {
  const syncDate = date || new Date().toISOString().slice(0, 10);
  const results = [];
  let created = 0, updated = 0, skipped = 0;

  for (const p of projects || []) {
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

  return { date: syncDate, summary: { created, updated, skipped }, results };
}
