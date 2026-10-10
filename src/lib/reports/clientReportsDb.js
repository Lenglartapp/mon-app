// Rapport client — accès base (tables client_reports et client_report_settings,
// migration db/migrations/2026-10-11_client_reports.sql).

import { supabase } from '../supabaseClient';

const LIST_COLS = 'id,number,author,comment,row_count,created_at';

// Forme utilisée par l'écran : `date` = date d'émission, `project` = instantané du projet.
const toEntry = (r) => r && ({
    id: r.id,
    number: r.number,
    author: r.author,
    comment: r.comment || '',
    rowCount: r.row_count,
    date: r.created_at,
    ...(r.rows ? { levels: r.levels, settings: r.settings, texts: r.texts, project: r.project_snapshot, rows: r.rows } : {}),
});

/** Table absente (migration pas encore jouée) : message clair plutôt qu'une erreur brute. */
export const isMissingTable = (error) => error?.code === '42P01' || error?.code === 'PGRST205' || /does not exist|schema cache/i.test(error?.message || '');

/** Historique d'un projet (sans le contenu), du plus récent au plus ancien. */
export async function listReports(projectId) {
    const { data, error } = await supabase.from('client_reports').select(LIST_COLS)
        .eq('project_id', String(projectId)).order('number', { ascending: false });
    if (error) throw error;
    return (data || []).map(toEntry);
}

/** Rapport complet (lignes, textes, réglages) pour le rouvrir ou le réimprimer. */
export async function getReport(id) {
    const { data, error } = await supabase.from('client_reports').select('*').eq('id', id).single();
    if (error) throw error;
    return toEntry(data);
}

/**
 * Archive un rapport avec le numéro suivant du projet. Le couple (projet, numéro) est
 * unique en base : si quelqu'un archive au même instant, on reprend le numéro suivant.
 */
export async function createReport({ projectId, author, levels, settings, texts, project, rows }) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const { data: last } = await supabase.from('client_reports').select('number')
            .eq('project_id', String(projectId)).order('number', { ascending: false }).limit(1);
        const number = (last?.[0]?.number || 0) + 1;
        const { data, error } = await supabase.from('client_reports').insert({
            project_id: String(projectId), number, author, levels, settings, texts,
            project_snapshot: project, rows, row_count: rows.length,
        }).select('*').single();
        if (!error) return toEntry(data);
        if (error.code !== '23505') throw error; // 23505 : numéro déjà pris → on recommence
    }
    throw new Error("Impossible d'attribuer un numéro de rapport, réessayez.");
}

export async function updateReportComment(id, comment) {
    const { error } = await supabase.from('client_reports').update({ comment: comment || null }).eq('id', id);
    if (error) throw error;
}

export async function deleteReport(id) {
    const { error } = await supabase.from('client_reports').delete().eq('id', id);
    if (error) throw error;
}

/** Prochain numéro de rapport du projet (affiché dans l'aperçu avant archivage). */
export async function nextReportNumber(projectId) {
    const { data, error } = await supabase.from('client_reports').select('number')
        .eq('project_id', String(projectId)).order('number', { ascending: false }).limit(1);
    if (error) throw error;
    return (data?.[0]?.number || 0) + 1;
}

/** Réglages : `key` = 'global' (libellés de statuts) ou l'id du projet (photo de couverture). */
export async function getReportSettings(keys) {
    const { data, error } = await supabase.from('client_report_settings').select('*').in('key', keys.map(String));
    if (error) throw error;
    return Object.fromEntries((data || []).map((r) => [r.key, r]));
}

export async function saveReportSettings(key, patch) {
    const { error } = await supabase.from('client_report_settings')
        .upsert({ key: String(key), ...patch, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
}
