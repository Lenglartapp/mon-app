// Devis Odoo confirmé → projet Droitfil créé automatiquement.
//
// Le serveur (api/odoo/order-event.js) reçoit l'événement d'Odoo, passe la minute en « Commande »
// et, s'il n'existe pas encore de projet, marque la minute « projet à créer »
// (odoo_quote.link.pendingProject). Ici, l'appli ouverte de N'IMPORTE QUEL utilisateur connecté
// (pour que ça marche même quand Aristide et Audry sont absents) réclame la minute (mise à jour
// filtrée → une seule appli la prend), puis crée le projet avec EXACTEMENT
// le même code que l'import manuel (buildProjectFromMinute) et le relie à la minute.
// Elle rafraîchit aussi minutes et projets quand Odoo a envoyé un événement (annulation…).

import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { buildProjectFromMinute } from '../lib/import/projectFromMinute';
import { ODOO_QUOTE_USER_IDS } from '../lib/odoo/quoteAccess';

const POLL_MS = 30_000;
const STALE_CLAIM_MS = 5 * 60_000; // réclamation abandonnée (appli fermée en cours) → reprise

async function readLink(id) {
  const { data } = await supabase.from('minutes').select('odoo_quote').eq('id', id).maybeSingle();
  return data?.odoo_quote || {};
}

async function writeLink(id, patch) {
  const quote = await readLink(id);
  const link = { ...(quote.link || {}), ...patch };
  await supabase.from('minutes').update({ odoo_quote: { ...quote, link } }).eq('id', id);
  return link;
}

export function useOdooOrderProjects({ currentUser, addProject, loadMinuteDetail, refreshProjects, addNotification }) {
  const enabled = !!currentUser?.id;
  const busy = useRef(false);
  const since = useRef(new Date().toISOString());
  const deps = useRef({});
  deps.current = { addProject, loadMinuteDetail, refreshProjects, addNotification, currentUser };

  const createFor = useCallback(async (row) => {
    const { addProject, loadMinuteDetail, addNotification, currentUser } = deps.current;
    const quote = row.odoo_quote || {};
    const claimAt = new Date().toISOString();
    // Réclamation atomique : seule la mise à jour qui trouve encore pendingProject = true passe.
    let claim = supabase.from('minutes')
      .update({ odoo_quote: { ...quote, link: { ...quote.link, pendingProject: 'claimed', pendingClaimAt: claimAt } } })
      .eq('id', row.id).eq('odoo_quote->link->>pendingProject', String(quote.link?.pendingProject));
    if (quote.link?.pendingClaimAt) claim = claim.eq('odoo_quote->link->>pendingClaimAt', quote.link.pendingClaimAt);
    const { data: claimed } = await claim.select('id');
    if (!claimed?.length) return;

    try {
      // Projet créé à la main entre-temps ? On le relie au lieu d'en faire un deuxième.
      const { data: existing } = await supabase.from('projects').select('id,name')
        .eq('source_minute_id', row.id).neq('status', 'ARCHIVED').limit(1);
      if (existing?.length) {
        await writeLink(row.id, { pendingProject: false, droitfilProjectId: existing[0].id, pendingClaimAt: null });
        return;
      }
      const minute = await loadMinuteDetail(row.id);
      if (!minute?.lines?.length) throw new Error('minute sans lignes');
      const link = quote.link || {};
      const project = buildProjectFromMinute(minute);
      project.notes = [
        `Créé automatiquement depuis la commande Odoo ${link.name || ''} — à compléter : date de livraison, lieu, type d'intervention.`,
        project.notes,
      ].filter(Boolean).join('\n');
      // Lien vers le projet Odoo UNIQUEMENT si l'événement vient de la production (le job de
      // nuit pousse les temps vers id_projet_odoo : une id de préprod viserait un autre projet).
      if (link.isProdSource && link.project?.id) project.id_projet_odoo = link.project.id;
      const { data, error } = await addProject(project);
      if (error || !data?.[0]) throw new Error(error?.message || 'création refusée');
      await writeLink(row.id, { pendingProject: false, droitfilProjectId: data[0].id, pendingClaimAt: null });
      // Prévenus : les personnes du module Devis Odoo + celle dont l'appli a créé le projet.
      new Set([...ODOO_QUOTE_USER_IDS, currentUser?.id].filter(Boolean)).forEach((uid) => addNotification?.(
        'Projet créé depuis Odoo',
        `${link.name || 'Commande'} confirmée : le projet « ${project.name} » a été créé (à compléter).`,
        'success', null, uid,
      ));
    } catch (e) {
      console.error('[useOdooOrderProjects] création du projet échouée :', e.message);
      await writeLink(row.id, { pendingProject: true, pendingClaimAt: null, lastError: e.message });
    }
  }, []);

  const tick = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const { data: pending } = await supabase.from('minutes').select('id,odoo_quote')
        .in('odoo_quote->link->>pendingProject', ['true', 'claimed']);
      for (const row of pending || []) {
        const link = row.odoo_quote?.link || {};
        const stale = link.pendingProject === 'claimed'
          && (!link.pendingClaimAt || Date.now() - new Date(link.pendingClaimAt).getTime() > STALE_CLAIM_MS);
        if (link.pendingProject === true || stale) await createFor(row);
      }
      // Événements Odoo reçus depuis le dernier passage → minute et projets à jour à l'écran.
      const now = new Date().toISOString();
      const { data: touched } = await supabase.from('minutes').select('id')
        .gt('odoo_quote->link->lastEvent->>receivedAt', since.current);
      since.current = now;
      if (touched?.length) {
        await Promise.all(touched.map((m) => deps.current.loadMinuteDetail(m.id)));
        deps.current.refreshProjects?.();
      }
    } catch (e) {
      console.warn('[useOdooOrderProjects]', e.message);
    } finally {
      busy.current = false;
    }
  }, [createFor]);

  useEffect(() => {
    if (!enabled) return undefined;
    tick();
    const t = setInterval(tick, POLL_MS);
    const onFocus = () => tick();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [enabled, tick]);
}
