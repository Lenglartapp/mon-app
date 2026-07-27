// Logique de "mode aperçu" (dry-run) — résout, pour chaque projet Droitfil,
// son équivalent Odoo + ses 3 tâches Conf/Prépa/Pose, et prépare ce qui SERAIT
// envoyé. NE FAIT AUCUNE ÉCRITURE dans Odoo.

import { execute, searchRead } from './_odooClient.js';

// Catégorie Droitfil -> nom exact de la tâche Odoo (créée par lenglart_custo)
export const TASK_NAME = { conf: 'Conf', prepa: 'Prépa', pose: 'Pose' };
export const SERVICES = ['conf', 'prepa', 'pose'];

const GENERIC_EMPLOYEE_ID = 31; // "Droitfil (Atelier)"

/**
 * Résout un projet Droitfil (par nom) vers Odoo.
 * Renvoie un statut :
 *   - 'not_found'     : aucun projet Odoo de ce nom
 *   - 'ambiguous'     : plusieurs projets Odoo de ce nom -> l'utilisateur doit choisir
 *   - 'pending_tasks' : projet trouvé mais tâches Conf/Prépa/Pose absentes (devis non confirmé)
 *   - 'linked'        : projet + 3 tâches trouvés -> prêt à recevoir les temps
 */
export async function resolveProjectByName(name, odooProjectId = null) {
  let project;
  if (odooProjectId) {
    const rows = await searchRead(
      'project.project',
      [['id', '=', odooProjectId]],
      ['id', 'name']
    );
    if (!rows.length) return { status: 'not_found' };
    project = rows[0];
  } else {
    const matches = await searchRead(
      'project.project',
      [['name', '=', name]],
      ['id', 'name']
    );
    if (matches.length === 0) return { status: 'not_found' };
    if (matches.length > 1) {
      // Homonymes : enrichir chaque candidat pour aider l'utilisateur à choisir
      // (a-t-il déjà ses 3 tâches Conf/Prépa/Pose ?).
      const candidates = [];
      for (const m of matches) {
        const taskCount = await execute('project.task', 'search_count', [
          [['project_id', '=', m.id], ['name', 'in', Object.values(TASK_NAME)]],
        ]);
        candidates.push({ ...m, taskCount, hasTasks: taskCount >= 3 });
      }
      return { status: 'ambiguous', candidates };
    }
    project = matches[0];
  }

  const tasks = await searchRead(
    'project.task',
    [
      ['project_id', '=', project.id],
      ['name', 'in', Object.values(TASK_NAME)],
    ],
    ['id', 'name', 'allocated_hours', 'effective_hours']
  );

  const taskByService = {};
  for (const svc of SERVICES) {
    taskByService[svc] = tasks.find((t) => t.name === TASK_NAME[svc]) || null;
  }
  const hasAll = SERVICES.every((s) => taskByService[s]);
  return {
    status: hasAll ? 'linked' : 'pending_tasks',
    project,
    taskByService,
  };
}

/**
 * Construit l'aperçu pour une liste de projets Droitfil agrégés.
 * @param {string} cutoffDate  'YYYY-MM-DD' — date de bascule (info seulement ici)
 * @param {Array}  projects    [{ id, name, odooProjectId?, hours: {conf, prepa, pose} }]
 */
export async function buildPreview(cutoffDate, projects) {
  const rows = [];
  for (const p of projects) {
    const hours = p.hours || {};
    const resolved = await resolveProjectByName(p.name, p.odooProjectId || null);

    const line = {
      droitfil: { id: p.id ?? null, name: p.name, hours },
      status: resolved.status,
    };

    if (resolved.status === 'ambiguous') {
      line.candidates = resolved.candidates;
    }
    if (resolved.status === 'pending_tasks' || resolved.status === 'linked') {
      line.odooProject = resolved.project;
    }
    if (resolved.status === 'linked') {
      // Ce qui SERAIT écrit : 1 ligne de temps par service (upsert par task+employé)
      line.wouldSend = SERVICES.filter((svc) => (hours[svc] || 0) > 0).map((svc) => {
        const t = resolved.taskByService[svc];
        return {
          service: svc,
          taskId: t.id,
          taskName: t.name,
          venduH: t.allocated_hours,
          reelActuelH: t.effective_hours,
          reelViseH: hours[svc], // total consommé Droitfil qui remplacerait le réel
          employeeId: GENERIC_EMPLOYEE_ID,
        };
      });
    }
    rows.push(line);
  }
  return { cutoffDate, generatedFor: projects.length, rows };
}

export { GENERIC_EMPLOYEE_ID };
