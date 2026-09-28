// Accès à l'historique de versions d'un chiffrage (table `minutes_history`,
// alimentée automatiquement par le trigger Postgres — cf. supabase_add_minutes_history.sql).

import { supabase } from "./supabaseClient";

// Champs "lourds" (croquis/photos) NON archivés dans les versions du chiffrage —
// mêmes que ceux retirés par le trigger SQL. Sert à ne pas les perdre au restore.
export const HEAVY_FIELDS = [
  "croquis", "schema_photo", "photos_sur_site", "schema_principe",
  "croquis_intervalle", "schema_dessin", "photos", "photo",
];

/** Liste des versions d'un chiffrage (léger : sans le gros JSONB), plus récent d'abord. */
export async function readMinuteVersions(minuteId) {
  if (!minuteId) return [];
  const { data, error } = await supabase
    .from("minutes_history")
    .select("id, captured_at, reason, author, nb_lignes, ca_total, name, status")
    .eq("minute_id", minuteId)
    .order("captured_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Contenu complet d'une version (chargé seulement au moment de restaurer). */
export async function readVersionContent(versionId) {
  const { data, error } = await supabase
    .from("minutes_history")
    .select("lines, deplacements, extra_depenses")
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * Restaurer préserve les visuels ACTUELS : pour chaque ligne restaurée, si une ligne
 * de même id existe encore dans le devis courant, on recopie ses champs visuels
 * (les versions ne les archivent pas, on ne veut pas les effacer en revenant en arrière).
 */
export function mergeVisualsFromCurrent(versionLines, currentLines) {
  const curById = new Map((currentLines || []).map((r) => [String(r.id), r]));
  return (versionLines || []).map((r) => {
    const cur = curById.get(String(r.id));
    if (!cur) return r;
    const merged = { ...r };
    for (const f of HEAVY_FIELDS) if (cur[f] !== undefined) merged[f] = cur[f];
    return merged;
  });
}
