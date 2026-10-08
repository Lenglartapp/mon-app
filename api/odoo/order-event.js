// POST /api/odoo/order-event — Odoo prévient Droitfil qu'un devis issu d'une minute change d'état
// (module lenglart_controle_gestion, ERP 9ea1294) : confirmed | cancelled | draft | deleted.
//
// Sécurité : en-tête « Authorization: Bearer <ODOO_EVENT_SECRET> » (même valeur que le paramètre
// système Odoo droitfil.event_secret). Écrit avec la clé service (getSupabaseAdmin).
//
// Ce que fait Droitfil (cycle validé le 2026-10-08) :
//   • confirmed : minute → « Commande » ; si un projet issu de la minute existe déjà, il est relié ;
//                 sinon la minute est marquée « projet à créer » (odoo_quote.link.pendingProject) et
//                 l'appli ouverte le crée avec le MÊME code que l'import manuel (useOdooOrderProjects).
//   • cancelled / deleted : projet relié ARCHIVÉ (jamais supprimé) avec une mention ; la minute
//                 revient au statut qu'elle avait avant la commande (par défaut « Validée »).
//   • draft : simple mise à jour de l'état.
// Idempotent : le même événement reçu deux fois ne crée rien de plus.
//
// ⚠️ Une seule base Droitfil pour la prod et les tests : un événement venant d'une base Odoo autre
// que la production ne remplit JAMAIS projects.id_projet_odoo (sinon le job de nuit enverrait les
// temps vers le projet de même id dans l'Odoo de production).

import { timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from '../_supabaseAdmin.js';

export const PROD_ODOO_DB = 'lenglart-erp-lenglart-main-9543240';
const EVENTS = new Set(['confirmed', 'cancelled', 'draft', 'deleted']);

function authorized(req) {
  const secret = process.env.ODOO_EVENT_SECRET || '';
  const header = String(req.headers?.authorization || req.headers?.Authorization || '');
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!secret || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'POST attendu.' }); return; }
    if (!authorized(req)) { res.status(401).json({ ok: false, error: 'Secret invalide.' }); return; }

    const { event, database, minute_id: minuteId, order = {}, project = null, sent_at: sentAt } = req.body || {};
    if (!EVENTS.has(event) || !minuteId) { res.status(400).json({ ok: false, error: 'event ou minute_id invalide.' }); return; }

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
    if (project?.id) link.project = { id: project.id, name: project.name || null };

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

    if (event === 'cancelled' || event === 'deleted') {
      link.pendingProject = false;
      if (minute.status === 'ORDERED') {
        minuteUpdates.status = link.statusBeforeOrder && link.statusBeforeOrder !== 'ORDERED' ? link.statusBeforeOrder : 'VALIDATED';
      }
      if (link.droitfilProjectId) {
        const { data: p } = await sb.from('projects').select('id,status,notes').eq('id', link.droitfilProjectId).maybeSingle();
        if (p && p.status !== 'ARCHIVED') {
          const mention = `⚠️ Commande ${order.name || link.name || ''} ${event === 'deleted' ? 'supprimée' : 'annulée'} dans Odoo le ${new Date().toLocaleDateString('fr-FR')} — projet archivé automatiquement.`;
          await sb.from('projects').update({ status: 'ARCHIVED', notes: [mention, p.notes].filter(Boolean).join('\n') }).eq('id', p.id);
          link.archivedByOdoo = true;
          link.projectStatusBefore = p.status || 'TODO';
          result.archived = p.id;
        }
      }
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
