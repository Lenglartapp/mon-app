// Rattachement stock ↔ dossier (articles, journal, demandes de mise à disposition).
//
// Historiquement par NOM (colonne `project`) : renommer un dossier décrochait ses tissus.
// Désormais chaque enregistrement porte aussi `project_id`, et à la lecture le nom est
// remplacé par le nom ACTUEL du dossier retrouvé par son id. Les anciennes lignes sans
// `project_id` restent rattachées par leur nom, comme avant.

/** Liste légère des dossiers (id + nom). */
export async function fetchProjectNames(supabase) {
    const { data, error } = await supabase.from('projects').select('id,name');
    if (error) throw error;
    return data || [];
}

/** Index des dossiers par id et par nom (le premier dossier d'un nom en double l'emporte). */
export function projectIndex(projects = []) {
    const byId = new Map();
    const byName = new Map();
    for (const p of projects) {
        if (!p) continue;
        byId.set(String(p.id), p);
        if (p.name && !byName.has(p.name)) byName.set(p.name, p);
    }
    return { byId, byName };
}

/** Identifiant du dossier portant ce nom, ou null (stock libre / nom inconnu). */
export const projectIdOf = (index, name) => (name ? index.byName.get(name)?.id ?? null : null);

/** Enregistrement avec le nom actuel de son dossier (s'il est rattaché par id). */
export function withCurrentProjectName(rec, index) {
    const proj = rec?.project_id != null ? index.byId.get(String(rec.project_id)) : null;
    return proj && proj.name !== rec.project ? { ...rec, project: proj.name } : rec;
}
