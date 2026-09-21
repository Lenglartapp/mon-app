// Liste de courses Odoo (project.course.line) — accès NAVIGATEUR.
// La lecture Odoo passe par l'endpoint serveur ; la logique de synchro/bascule est
// partagée avec le job de nuit via courseLinesCore (même comportement garanti).

import { supabase } from "../supabaseClient";
import { readCourseLinesWith, syncCourseLinesInto } from "./courseLinesCore";

/** Appelle l'endpoint serveur qui lit Odoo. */
async function fetchFromOdoo(odooProjectId) {
  const res = await fetch(`/api/odoo/course-lines?odooProjectId=${encodeURIComponent(odooProjectId)}`);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("API /api/odoo indisponible (dev local sans plugin, ou déploiement requis).");
  }
  if (!res.ok || data.ok === false) throw new Error(data?.error || `Erreur ${res.status}.`);
  return data.lines || [];
}

/** Lit le miroir local (Supabase) d'un projet Droitfil, trié. */
export async function readCourseLines(droitfilProjectId) {
  return readCourseLinesWith(supabase, droitfilProjectId);
}

/**
 * Rafraîchit depuis Odoo : upsert les lignes courantes, marque « retirées » celles disparues,
 * puis bascule en stock les tissus « Réceptionné » pas encore basculés.
 * Renvoie { lines, receptionsCreated, receptionErrors }.
 */
export async function refreshCourseLines(droitfilProjectId, odooProjectId, projectName) {
  const odooLines = await fetchFromOdoo(odooProjectId);
  return syncCourseLinesInto(supabase, { odooLines, droitfilProjectId, odooProjectId, projectName });
}
