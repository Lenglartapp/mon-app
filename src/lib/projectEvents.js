// Historique du dossier (table project_events, migration 2026-10-08_project_events.sql).
// Écritures « au mieux » : un échec (table pas encore créée…) ne bloque jamais l'action.

import { supabase } from './supabaseClient';

export const ORIGIN_LABEL = {
  blank: () => 'Projet créé — projet vierge',
  import: (o) => `Projet créé par import manuel de la minute « ${o.minuteName || '—'} »`,
  odoo: (o) => `Projet créé automatiquement à la confirmation de la commande Odoo ${o.orderName || ''}`.trim(),
};

export async function logProjectEvent(projectId, type, label, detail = null, userName = null) {
  if (!projectId) return;
  try {
    await supabase.from('project_events').insert({ project_id: String(projectId), type, label, detail, user_name: userName });
  } catch (e) {
    console.warn('[projectEvents]', e.message);
  }
}

export function logProjectCreation(projectId, origin = {}) {
  const type = ORIGIN_LABEL[origin.type] ? origin.type : 'blank';
  return logProjectEvent(projectId, 'created', ORIGIN_LABEL[type](origin), { origin: type, ...origin }, origin.by || null);
}

/** Événements du projet, du plus ancien au plus récent. Sans ligne « created » (projets antérieurs
 *  au 2026-10-08), l'origine est reconstituée : avec minute source = import, sinon projet vierge. */
export async function fetchProjectEvents(project) {
  const { data, error } = await supabase.from('project_events').select('*')
    .eq('project_id', String(project.id)).order('created_at', { ascending: true });
  const events = error ? [] : (data || []);
  if (!events.some((e) => e.type === 'created')) {
    const minuteId = project.sourceMinuteId || project.source_minute_id;
    events.unshift({
      id: 'origin', type: 'created', guessed: true,
      created_at: project.created_at || project.createdAt,
      label: minuteId ? 'Projet créé depuis une minute (import)' : 'Projet créé — projet vierge',
      user_name: null,
    });
  }
  return { events, missingTable: !!error };
}
