// GET /api/cron/nightly — JOB DE NUIT (Vercel Cron).
// Rejoue automatiquement, pour tous les projets Droitfil reliés (id_projet_odoo) :
//   1) Flux Temps      : agrège le consommé validé (depuis la date de bascule) -> feuilles de temps Odoo
//   2) Flux Courses    : lit project.course.line -> miroir Supabase + bascule des tissus réceptionnés en stock
//
// Sécurité : si CRON_SECRET est défini, exige l'en-tête « Authorization: Bearer <secret> »
// (envoyé automatiquement par Vercel Cron) ou « ?secret=<secret> » (déclenchement manuel).
// Idempotent : rejouer ne duplique rien (upsert par clés naturelles + garde stock_created).

import { searchRead } from '../_odooClient.js';
import { getSupabaseAdmin } from '../_supabaseAdmin.js';
import { syncTimesheets } from '../_syncTimes.js';
import { COURSE_FIELDS } from '../odoo/course-lines.js';
import { aggregateConsumed } from '../../src/lib/odoo/aggregateConsumed.js';
import { syncCourseLinesInto } from '../../src/lib/odoo/courseLinesCore.js';

export const config = { maxDuration: 60 }; // le job enchaîne plusieurs appels Odoo/Supabase

const EVENTS_PAGE_SIZE = 1000;

/** Contrôle d'accès : Bearer <CRON_SECRET> (Vercel Cron) ou ?secret= (manuel). Ouvert si non configuré. */
function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev local / non configuré
  const auth = req.headers?.authorization || req.headers?.Authorization || '';
  const q = req.query?.secret;
  return auth === `Bearer ${secret}` || q === secret;
}

/** Lit une clé de configuration applicative (table app_config). */
async function readConfig(supabase, key) {
  const { data } = await supabase.from('app_config').select('value').eq('key', key).maybeSingle();
  return data?.value ?? null;
}

/** Charge tous les créneaux (pagination) et les projets reliés. */
async function loadFromSupabase(supabase) {
  const events = [];
  for (let page = 0; page < 100; page++) {
    const from = page * EVENTS_PAGE_SIZE;
    const { data, error } = await supabase
      .from('events')
      .select('id, type, project_id, start_time, end_time, meta')
      .order('id', { ascending: true })
      .range(from, from + EVENTS_PAGE_SIZE - 1);
    if (error) throw error;
    events.push(...(data || []));
    if (!data || data.length < EVENTS_PAGE_SIZE) break;
  }

  const { data: projects, error: pErr } = await supabase
    .from('projects')
    .select('id, name, id_projet_odoo');
  if (pErr) throw pErr;

  return { events, projects: projects || [] };
}

// Remet les créneaux bruts DB au format attendu par aggregateConsumed (comme le mapping du front).
function toFrontEvents(rows) {
  return (rows || []).map((e) => ({
    type: e.type,
    meta: {
      ...(e.meta || {}),
      projectId: e.meta?.projectId ?? e.project_id ?? null,
      start: e.meta?.start ?? e.start_time,
      end: e.meta?.end ?? e.end_time,
    },
  }));
}

export default async function handler(req, res) {
  const startedAt = new Date().toISOString();
  if (!authorized(req)) {
    res.status(401).json({ ok: false, error: 'Non autorisé (CRON_SECRET requis).' });
    return;
  }

  const report = { ok: true, startedAt, temps: null, courses: null, errors: [] };

  try {
    const supabase = getSupabaseAdmin();
    const cutoffDate = await readConfig(supabase, 'odoo_cutoff_date');
    report.cutoffDate = cutoffDate;

    const { events, projects } = await loadFromSupabase(supabase);
    const odooIdOf = new Map(projects.map((p) => [p.id, p.id_projet_odoo || null]));
    const linkedProjects = projects.filter((p) => p.id_projet_odoo);

    // ---- Flux 1 : Temps -> Odoo ----
    try {
      if (!cutoffDate) {
        report.temps = { skipped: true, reason: "Date de bascule (odoo_cutoff_date) non configurée — push ignoré." };
      } else {
        const agg = aggregateConsumed(toFrontEvents(events), projects, { cutoffDate });
        const payload = agg
          .filter((r) => odooIdOf.get(r.id))
          .map((r) => ({ id: r.id, name: r.name, hours: r.hours, odooProjectId: odooIdOf.get(r.id) }));
        report.temps = await syncTimesheets(payload, null);
      }
    } catch (e) {
      report.temps = { error: e.message };
      report.errors.push(`Temps : ${e.message}`);
    }

    // ---- Flux 2 : Liste de courses <- Odoo ----
    try {
      let receptionsCreated = 0;
      const perProject = [];
      const receptionErrors = [];
      for (const p of linkedProjects) {
        try {
          const odooLines = await searchRead(
            'project.course.line',
            [['project_id', '=', Number(p.id_projet_odoo)]],
            COURSE_FIELDS,
            { order: 'sequence' }
          );
          const r = await syncCourseLinesInto(supabase, {
            odooLines,
            droitfilProjectId: p.id,
            odooProjectId: Number(p.id_projet_odoo),
            projectName: p.name,
          });
          receptionsCreated += r.receptionsCreated;
          if (r.receptionErrors?.length) receptionErrors.push(...r.receptionErrors);
          perProject.push({ project: p.name, odooProjectId: Number(p.id_projet_odoo), lines: r.lines.length, receptionsCreated: r.receptionsCreated });
        } catch (e) {
          receptionErrors.push(`${p.name} : ${e.message}`);
        }
      }
      report.courses = { projects: linkedProjects.length, receptionsCreated, receptionErrors, perProject };
      if (receptionErrors.length) report.errors.push(...receptionErrors.map((m) => `Courses : ${m}`));
    } catch (e) {
      report.courses = { error: e.message };
      report.errors.push(`Courses : ${e.message}`);
    }

    report.finishedAt = new Date().toISOString();
    report.ok = report.errors.length === 0;
    res.status(200).json(report);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, startedAt, errors: [...report.errors, e.message] });
  }
}
