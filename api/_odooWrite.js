// Écriture des temps dans Odoo (feuilles de temps). Upsert idempotent :
// 1 ligne agrégée par (tâche, employé générique). Rejouer met à jour, ne duplique jamais.

import { execute } from './_odooClient.js';

export const SERVICE_LABEL = {
  conf: 'Confection (Droitfil)',
  prepa: 'Préparation (Droitfil)',
  pose: 'Pose (Droitfil)',
};

/**
 * Crée ou met à jour LA ligne de temps agrégée d'une tâche pour l'employé donné.
 * Clé d'idempotence naturelle : (task_id, employee_id) — seul Droitfil poste sous cet employé.
 */
export async function upsertTimesheetLine({ projectId, taskId, employeeId, name, hours, date }) {
  const existing = await execute(
    'account.analytic.line',
    'search',
    [[['task_id', '=', taskId], ['employee_id', '=', employeeId]]],
    { limit: 1 }
  );
  const vals = {
    project_id: projectId,
    task_id: taskId,
    employee_id: employeeId,
    unit_amount: hours, // HEURES
    name,
    date,
  };
  if (existing.length) {
    await execute('account.analytic.line', 'write', [existing, vals]);
    return { action: 'updated', id: existing[0] };
  }
  const id = await execute('account.analytic.line', 'create', [vals]);
  return { action: 'created', id };
}

/** Supprime des lignes de temps (utilitaire, ex. nettoyage de test). */
export async function deleteTimesheetLines(ids) {
  if (!ids || !ids.length) return { deleted: 0 };
  await execute('account.analytic.line', 'unlink', [ids]);
  return { deleted: ids.length };
}
