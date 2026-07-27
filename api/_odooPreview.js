// Logique de "mode aperçu" (dry-run) — résout, pour chaque projet Droitfil, son équivalent
// Odoo + ses 3 tâches Confection/Préparation/Pose, et prépare ce qui SERAIT envoyé.
// NE FAIT AUCUNE ÉCRITURE dans Odoo.

import { execute, searchRead } from './_odooClient.js';

export const SERVICES = ['conf', 'prepa', 'pose'];
const GENERIC_EMPLOYEE_ID = 31; // "Droitfil (Atelier)"

// Le type d'activité est porté par la TÂCHE. Convention Odoo cible : « <préfixe éventuel> Mot (h) »
//   confection  -> ... Confection (h)
//   préparation -> ... Préparation (h)
//   pose        -> ... Pose (h)
// Pièges gérés : accents, espaces insécables ( ), préfixes (réf devis / nom projet),
// casse. On compare des noms NORMALISÉS plutôt que via =ilike (qui rate sur   et accents).
const TARGET_WORD = { conf: 'confection', prepa: 'preparation', pose: 'pose' };

function normalizeName(s) {
  return String(s || '')
    .replace(/ /g, ' ')           // espace insécable -> espace normal
    .replace(/\s+/g, ' ')              // espaces multiples -> un seul
    .trim()
    .toLowerCase()
    .normalize('NFD')                  // décompose les accents
    .replace(/[̀-ͯ]/g, '');  // retire les diacritiques
}

// À quel service correspond ce nom de tâche ? (mot + suffixe "(h)", précédé d'un début
// de chaîne ou d'un séparateur - / – / : pour éviter les faux positifs type "Repose (h)").
function matchService(taskName) {
  const n = normalizeName(taskName);
  for (const svc of SERVICES) {
    const re = new RegExp(`(^|[-\\u2013:]\\s*)${TARGET_WORD[svc]} \\(h\\)$`);
    if (re.test(n)) return svc;
  }
  return null;
}

function mapTasksToServices(tasks) {
  const out = { conf: null, prepa: null, pose: null };
  for (const t of tasks || []) {
    const svc = matchService(t.name);
    if (svc && !out[svc]) out[svc] = t; // 1re tâche correspondante par service
  }
  return out;
}

/**
 * Résout un projet Droitfil (par nom, ou par id Odoo si déjà mappé) vers Odoo.
 * Statuts : 'not_found' | 'ambiguous' | 'pending_tasks' | 'linked'.
 */
export async function resolveProjectByName(name, odooProjectId = null) {
  let project;
  if (odooProjectId) {
    const rows = await searchRead('project.project', [['id', '=', odooProjectId]], ['id', 'name']);
    if (!rows.length) return { status: 'not_found' };
    project = rows[0];
  } else {
    const matches = await searchRead('project.project', [['name', '=', name]], ['id', 'name']);
    if (matches.length === 0) return { status: 'not_found' };
    if (matches.length > 1) {
      // Homonymes : enrichir chaque candidat (nb de tâches Conf/Prépa/Pose détectées).
      const candidates = [];
      for (const m of matches) {
        const tks = await searchRead('project.task', [['project_id', '=', m.id]], ['id', 'name']);
        const tbs = mapTasksToServices(tks);
        const taskCount = SERVICES.filter((s) => tbs[s]).length;
        candidates.push({ ...m, taskCount, hasTasks: taskCount >= 3 });
      }
      return { status: 'ambiguous', candidates };
    }
    project = matches[0];
  }

  const tasks = await searchRead(
    'project.task',
    [['project_id', '=', project.id]],
    ['id', 'name', 'allocated_hours', 'effective_hours']
  );
  const taskByService = mapTasksToServices(tasks);
  const hasAll = SERVICES.every((s) => taskByService[s]);
  return { status: hasAll ? 'linked' : 'pending_tasks', project, taskByService };
}

/**
 * Construit l'aperçu pour une liste de projets Droitfil agrégés.
 * @param {string} cutoffDate  'YYYY-MM-DD' (info seulement ici)
 * @param {Array}  projects    [{ id, name, odooProjectId?, hours:{conf,prepa,pose} }]
 */
export async function buildPreview(cutoffDate, projects) {
  const rows = [];
  for (const p of projects) {
    const hours = p.hours || {};
    const resolved = await resolveProjectByName(p.name, p.odooProjectId || null);

    const line = { droitfil: { id: p.id ?? null, name: p.name, hours }, status: resolved.status };
    if (resolved.status === 'ambiguous') line.candidates = resolved.candidates;
    if (resolved.status === 'pending_tasks' || resolved.status === 'linked') line.odooProject = resolved.project;
    if (resolved.status === 'linked') {
      line.wouldSend = SERVICES.filter((svc) => (hours[svc] || 0) > 0).map((svc) => {
        const t = resolved.taskByService[svc];
        return {
          service: svc,
          taskId: t.id,
          taskName: t.name,
          venduH: t.allocated_hours,
          reelActuelH: t.effective_hours,
          reelViseH: hours[svc],
          employeeId: GENERIC_EMPLOYEE_ID,
        };
      });
    }
    rows.push(line);
  }
  return { cutoffDate, generatedFor: projects.length, rows };
}

export { GENERIC_EMPLOYEE_ID };
