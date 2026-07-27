// Agrégation du temps CONSOMMÉ (validé) par projet × service, pour la remontée Odoo.
// Réplique fidèlement le calcul d'heures du planning (EventModal / PlanningGrid) :
//   - conf/prépa : meta.durationHours (mode durée)
//   - pose       : durée start→end MOINS 1h si le créneau enjambe la pause déjeuner (12h–13h)
// Ne compte que les créneaux meta.status === 'validated', type conf/prepa/pose,
// hors events internes/absences, à partir de la date de bascule.

import { differenceInMinutes } from 'date-fns';

export const SERVICES = ['conf', 'prepa', 'pose'];

/** Heures réelles d'un créneau (identique au planning). */
export function eventHours(e) {
  const dh = e?.meta?.durationHours;
  if (typeof dh === 'number') return dh;

  const start = new Date(e?.meta?.start || e?.start_time || e?.date);
  const end = new Date(e?.meta?.end || e?.end_time || e?.date);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

  let mins = differenceInMinutes(end, start);
  const lunchStart = new Date(start); lunchStart.setHours(12, 0, 0, 0);
  const lunchEnd = new Date(start); lunchEnd.setHours(13, 0, 0, 0);
  if (start < lunchStart && end > lunchEnd) mins -= 60;
  return Math.max(0, mins) / 60;
}

/** Un créneau est-il "interne" (non rattachable à un projet client) ? */
export function isInternalEvent(e, internalProjectId = null) {
  return (
    (internalProjectId != null && e?.meta?.projectId === internalProjectId) ||
    !!e?.meta?.internalChapter
  );
}

/**
 * Agrège le consommé validé par projet Droitfil.
 * @param {Array} events    créneaux (format front : { type, meta:{ projectId, status, start, end, durationHours } })
 * @param {Array} projects  projets Droitfil ({ id, name })
 * @param {Object} opts     { cutoffDate:'YYYY-MM-DD', internalProjectId }
 * @returns {Array} [{ id, name, hours:{conf,prepa,pose}, total }] trié par nom, total > 0
 */
export function aggregateConsumed(events, projects, opts = {}) {
  const { cutoffDate = null, internalProjectId = null } = opts;
  const cutoff = cutoffDate ? new Date(`${cutoffDate}T00:00:00`) : null;
  const nameById = new Map((projects || []).map((p) => [p.id, p.name]));

  const byProject = new Map();
  for (const e of events || []) {
    if (e?.meta?.status !== 'validated') continue;         // consommé uniquement
    if (!SERVICES.includes(e.type)) continue;              // conf/prepa/pose (exclut absences)
    if (isInternalEvent(e, internalProjectId)) continue;   // exclut interne
    const pid = e?.meta?.projectId;
    if (!pid) continue;

    if (cutoff) {
      const d = new Date(e?.meta?.start || e?.start_time || e?.date);
      if (isNaN(d.getTime()) || d < cutoff) continue;      // avant la bascule -> ignoré
    }

    if (!byProject.has(pid)) {
      byProject.set(pid, {
        id: pid,
        name: nameById.get(pid) || null,
        hours: { conf: 0, prepa: 0, pose: 0 },
      });
    }
    byProject.get(pid).hours[e.type] += eventHours(e);
  }

  const rows = [];
  for (const r of byProject.values()) {
    for (const s of SERVICES) r.hours[s] = Math.round(r.hours[s] * 10) / 10;
    r.total = Math.round((r.hours.conf + r.hours.prepa + r.hours.pose) * 10) / 10;
    if (r.total > 0) rows.push(r);
  }
  rows.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  return rows;
}
