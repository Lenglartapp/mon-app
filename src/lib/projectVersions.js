// Historique de versions d'un PROJET (table `projects_history`, alimentée par le
// déclencheur Postgres — cf. db/migrations/2026-10-14_projects_history.sql).
// Seules les LIGNES du projet sont versionnées et restaurées (pas le journal, ni les
// infos du dossier). Restauration réservée aux admins / ordo (authz : production.restore_version).

import { supabase } from "./supabaseClient";

/** Versions d'un projet (sans le gros JSONB), plus récente d'abord. */
export async function readProjectVersions(projectId) {
  if (!projectId) return [];
  const { data, error } = await supabase
    .from("projects_history")
    .select("id, captured_at, reason, author, changed_by, nb_lignes, name, status")
    .eq("project_id", String(projectId))
    .order("captured_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Lignes d'une version (chargées seulement au moment de restaurer). */
export async function readProjectVersionRows(versionId) {
  const { data, error } = await supabase
    .from("projects_history")
    .select("rows")
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw error;
  return Array.isArray(data?.rows) ? data.rows : null;
}

/**
 * Garde l'état ACTUEL avant de restaurer (version « Avant restauration ») : la
 * restauration peut ainsi être annulée en revenant à cette version.
 */
export async function saveVersionBeforeRestore(project, rows, author) {
  const { error } = await supabase.from("projects_history").insert({
    project_id: String(project.id),
    reason: "pre-restore",
    author: author || null,
    rows,
    nb_lignes: Array.isArray(rows) ? rows.length : 0,
    name: project.name || null,
    status: project.status || null,
  });
  if (error) throw error;
}
