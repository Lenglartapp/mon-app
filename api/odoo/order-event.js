// POST /api/odoo/order-event — Odoo prévient Droitfil qu'un devis issu d'une minute change d'état
// (module lenglart_controle_gestion, ERP 9ea1294 / 3c4b106) : confirmed | cancelled | draft | deleted,
// et pour le projet Odoo lié : project_archived | project_restored | project_deleted.
//
// Sécurité : en-tête « Authorization: Bearer <ODOO_EVENT_SECRET> » (même valeur que le paramètre
// système Odoo droitfil.event_secret). Écrit avec la clé service (getSupabaseAdmin).
//
// Ce que fait Droitfil (cycle validé le 2026-10-08) :
//   • confirmed : minute → « Commande » ; si un projet issu de la minute existe déjà, il est relié ;
//                 sinon la minute est marquée « projet à créer » (odoo_quote.link.pendingProject) et
//                 l'appli ouverte le crée avec le MÊME code que l'import manuel (useOdooOrderProjects).
//   • cancelled / deleted : projet relié ARCHIVÉ (jamais supprimé) ; la minute
//                 revient au statut qu'elle avait avant la commande (par défaut « Validée »).
//   • draft : simple mise à jour de l'état.
//   • project_archived / project_deleted (projet Odoo archivé ou supprimé à la main, commande
//                 inchangée) : projet Droitfil archivé ; la minute reste en « Commande ».
//   • project_restored : projet Droitfil ressorti des archives s'il avait été archivé par Odoo.
//   • course_lines_changed (réception / retour validé, « Solder ») : relecture immédiate de la liste
//                 de courses des projets indiqués — même code que le job de nuit (syncCourseLinesInto).
// Chaque action sur le projet est inscrite dans son historique (table project_events).
// Idempotent : le même événement reçu deux fois ne crée rien de plus.
//
// ⚠️ Une seule base Droitfil pour la prod et les tests : un événement venant d'une base Odoo autre
// que la production ne remplit JAMAIS projects.id_projet_odoo (sinon le job de nuit enverrait les
// temps vers le projet de même id dans l'Odoo de production).

import { timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from '../_supabaseAdmin.js';
import { searchRead } from '../_odooClient.js';
import { COURSE_FIELDS } from './course-lines.js';
import { syncCourseLinesInto } from '../../src/lib/odoo/courseLinesCore.js';

export const PROD_ODOO_DB = 'lenglart-erp-lenglart-main-9543240';
// La relecture d'une liste de courses enchaîne des appels Odoo / Supabase (comme le job de nuit).
export const config = { maxDuration: 60 };
const EVENTS = new Set(['confirmed', 'cancelled', 'draft', 'deleted', 'project_archived', 'project_restored', 'project_deleted']);
const ARCHIVE_REASON = {
  cancelled: 'Commande Odoo {name} annulée',
  deleted: 'Devis Odoo {name} supprimé',
  project_archived: 'Projet Odoo de la commande {name} archivé',
  project_deleted: 'Projet Odoo de la commande {name} supprimé',
};

// Historique du dossier (table project_events) : un échec n'empêche pas de traiter l'événement.
async function logEvent(sb, projectId, type, label, detail) {
  try {
    await sb.from('project_events').insert({ project_id: String(projectId), type, label, detail, user_name: 'Odoo' });
  } catch (e) {
    console.warn('[order-event] historique non écrit :', e.message);
  }
}

function authorized(req) {
  const secret = process.env.ODOO_EVENT_SECRET || '';
  const header = String(req.headers?.authorization || req.headers?.Authorization || '');
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!secret || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Liste de courses modifiée dans Odoo : on relit les projets concernés tout de suite (sans attendre la
// nuit). Seulement pour la base de PRODUCTION : la lecture se fait sur l'Odoo de l'hébergement (ODOO_URL),
// un événement d'une autre base viserait d'autres projets. Rejouable sans risque (upsert + garde stock).
async function courseLinesChanged({ database, project_ids: projectIds = [] }, res) {
  if (database !== PROD_ODOO_DB) { res.status(200).json({ ok: true, ignored: 'base non production' }); return; }
  const ids = [...new Set((projectIds || []).map(Number).filter(Boolean))];
  if (!ids.length) { res.status(200).json({ ok: true, ignored: 'aucun projet' }); return; }
  const sb = getSupabaseAdmin();
  const { data: projects, error } = await sb.from('projects').select('id,name,id_projet_odoo').in('id_projet_odoo', ids);
  if (error) throw new Error(error.message);
  const synced = [];
  for (const p of projects || []) {
    const odooLines = await searchRead('project.course.line', [['project_id', '=', Number(p.id_projet_odoo)]], COURSE_FIELDS, { order: 'sequence' });
    const r = await syncCourseLinesInto(sb, { odooLines, droitfilProjectId: p.id, odooProjectId: Number(p.id_projet_odoo), projectName: p.name });
    synced.push({ project: p.name, lines: r.lines.length, receptionsCreated: r.receptionsCreated });
  }
  res.status(200).json({ ok: true, event: 'course_lines_changed', synced });
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'POST attendu.' }); return; }
    if (!authorized(req)) { res.status(401).json({ ok: false, error: 'Secret invalide.' }); return; }

    const { event, database, minute_id: minuteId, order = {}, project = null, sent_at: sentAt } = req.body || {};
    if (event === 'course_lines_changed') { await courseLinesChanged(req.body || {}, res); return; }
    if (!event || !minuteId) { res.status(400).json({ ok: false, error: 'event ou minute_id manquant.' }); return; }
    // Événement inconnu (ajout futur côté Odoo) : accusé de réception, sinon Odoo le renverrait en boucle.
    if (!EVENTS.has(event)) { res.status(200).json({ ok: true, ignored: `événement ${event} non géré` }); return; }

    const sb = getSupabaseAdmin();
    const { data: minute, error: mErr } = await sb.from('minutes')
      .select('id,name,status,owner,odoo_quote').eq('id', minuteId).maybeSingle();
    if (mErr) throw new Error(mErr.message);
    // Minute inconnue (supprimée ?) : on répond 200 pour qu'Odoo arrête ses renvois.
    if (!minute) { res.status(200).json({ ok: true, ignored: 'minute inconnue' }); return; }

    const isProdSource = database === PROD_ODOO_DB;
    const quote = minute.odoo_quote || {};
    const link = { ...(quote.link || {}) };
    Object.assign(link, {
      orderId: order.id ?? link.orderId,
      name: order.name || link.name,
      state: event === 'deleted' ? 'deleted' : (order.state || link.state),
      database,
      isProdSource,
      lastEvent: { event, sentAt: sentAt || null, receivedAt: new Date().toISOString() },
    });
    if (project?.id) link.project = { id: project.id, name: project.name || null, active: project.active ?? null };

    const minuteUpdates = {};
    const result = { event };

    if (event === 'confirmed') {
      link.confirmedAt = order.confirmed_at || null;
      if (!['ORDERED', 'ORDER_COMPLETED'].includes(minute.status)) {
        link.statusBeforeOrder = minute.status || null;
        minuteUpdates.status = 'ORDERED';
      }
      // Projet déjà relié (re-confirmation après annulation) : on le ressort des archives.
      let linked = null;
      if (link.droitfilProjectId) {
        const { data } = await sb.from('projects').select('id,status,id_projet_odoo').eq('id', link.droitfilProjectId).maybeSingle();
        linked = data || null;
        if (linked && linked.status === 'ARCHIVED' && link.archivedByOdoo) {
          await sb.from('projects').update({ status: link.projectStatusBefore || 'TODO' }).eq('id', linked.id);
          link.archivedByOdoo = false;
          result.restored = linked.id;
          await logEvent(sb, linked.id, 'restored', `Commande Odoo ${order.name || link.name || ''} reconfirmée — projet ressorti des archives`, { odooEvent: event, orderName: order.name || link.name });
        }
      }
      // Sinon : projet déjà créé à la main depuis cette minute ?
      if (!linked) {
        const { data } = await sb.from('projects').select('id,status,id_projet_odoo')
          .eq('source_minute_id', minute.id).neq('status', 'ARCHIVED')
          .order('created_at', { ascending: false }).limit(1);
        linked = data?.[0] || null;
      }
      if (linked) {
        if (link.droitfilProjectId !== linked.id) {
          await logEvent(sb, linked.id, 'odoo_linked', `Commande Odoo ${order.name || link.name || ''} confirmée — projet relié à la commande`, { odooEvent: event, orderName: order.name || link.name });
        }
        link.droitfilProjectId = linked.id;
        link.pendingProject = false;
        if (isProdSource && project?.id && !linked.id_projet_odoo) {
          await sb.from('projects').update({ id_projet_odoo: project.id }).eq('id', linked.id);
          result.linkedOdooProject = project.id;
        }
        result.project = linked.id;
      } else if (link.pendingProject === 'claimed' && link.pendingClaimAt
        && Date.now() - new Date(link.pendingClaimAt).getTime() < 5 * 60_000) {
        result.pendingProject = 'en cours'; // une appli est déjà en train de le créer
      } else {
        link.pendingProject = true; // créé par l'appli ouverte (même code que l'import manuel)
        result.pendingProject = true;
      }
    }

    // Archivage du projet Droitfil (jamais de suppression), inscrit dans son historique.
    const archiveProject = async () => {
      if (!link.droitfilProjectId) return;
      const { data: p } = await sb.from('projects').select('id,status').eq('id', link.droitfilProjectId).maybeSingle();
      if (!p || p.status === 'ARCHIVED') return;
      const reason = ARCHIVE_REASON[event].replace('{name}', order.name || link.name || '');
      await sb.from('projects').update({ status: 'ARCHIVED' }).eq('id', p.id);
      await logEvent(sb, p.id, 'archived', `${reason} — projet archivé automatiquement`, { odooEvent: event, orderName: order.name || link.name });
      link.archivedByOdoo = true;
      link.archivedReason = event;
      link.projectStatusBefore = p.status || 'TODO';
      result.archived = p.id;
    };

    if (event === 'cancelled' || event === 'deleted') {
      link.pendingProject = false;
      if (minute.status === 'ORDERED') {
        minuteUpdates.status = link.statusBeforeOrder && link.statusBeforeOrder !== 'ORDERED' ? link.statusBeforeOrder : 'VALIDATED';
      }
      await archiveProject();
    }

    if (event === 'project_archived' || event === 'project_deleted') await archiveProject();

    if (event === 'project_restored' && link.droitfilProjectId && link.archivedByOdoo) {
      const { data: p } = await sb.from('projects').select('id,status').eq('id', link.droitfilProjectId).maybeSingle();
      if (p && p.status === 'ARCHIVED') {
        await sb.from('projects').update({ status: link.projectStatusBefore || 'TODO' }).eq('id', p.id);
        result.restored = p.id;
        await logEvent(sb, p.id, 'restored', `Projet Odoo de la commande ${order.name || link.name || ''} désarchivé — projet ressorti des archives`, { odooEvent: event, orderName: order.name || link.name });
      }
      link.archivedByOdoo = false;
    }

    minuteUpdates.odoo_quote = { ...quote, link };
    const { error: uErr } = await sb.from('minutes').update(minuteUpdates).eq('id', minute.id);
    if (uErr) throw new Error(uErr.message);

    res.status(200).json({ ok: true, ...result });
  } catch (e) {
    // 500 : Odoo retentera (toutes les 10 min, 24 fois au plus).
    res.status(500).json({ ok: false, error: e.message });
  }
}
