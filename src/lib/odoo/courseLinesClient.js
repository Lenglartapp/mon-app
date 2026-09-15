// Liste de courses Odoo (project.course.line) — récupération + miroir Supabase.
// Odoo est maître. Règle : une ligne disparue d'Odoo n'est PAS supprimée (removed_from_odoo=true).

import { supabase } from "../supabaseClient";

const m2oName = (v) => (Array.isArray(v) ? v[1] : null); // Many2one Odoo -> [id, nom]
const dateOrNull = (v) => (v && typeof v === "string" ? v : null); // Odoo renvoie false si vide

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
  const { data, error } = await supabase
    .from("odoo_course_lines")
    .select("*")
    .eq("droitfil_project_id", droitfilProjectId)
    .order("sequence", { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Rafraîchit depuis Odoo : upsert les lignes courantes, marque « retirées » celles disparues
 * (sans les supprimer). Renvoie la liste à jour du miroir.
 */
export async function refreshCourseLines(droitfilProjectId, odooProjectId) {
  const odooLines = await fetchFromOdoo(odooProjectId);
  const now = new Date().toISOString();

  const rows = odooLines.map((l) => ({
    odoo_id: l.id,
    droitfil_project_id: droitfilProjectId,
    odoo_project_id: odooProjectId,
    sequence: l.sequence ?? null,
    reference: l.reference || null,
    coloris: l.coloris || null,
    laize: l.laize || null,
    quantite: l.quantite ?? null,
    unite: m2oName(l.unite_id),
    fournisseur: m2oName(l.fournisseur_id),
    prix_indicatif: l.prix_indicatif ?? null,
    purchase_order: m2oName(l.purchase_order_id),
    statut: l.statut || null,
    date_livraison_estimee: dateOrNull(l.date_livraison_estimee),
    date_reception: dateOrNull(l.date_reception),
    write_date: l.write_date || null,
    removed_from_odoo: false,
    synced_at: now,
  }));

  if (rows.length) {
    const { error } = await supabase.from("odoo_course_lines").upsert(rows, { onConflict: "odoo_id" });
    if (error) throw error;
  }

  // Marquer « retirées d'Odoo » les lignes du miroir absentes de la réponse (sans supprimer)
  const { data: existing } = await supabase
    .from("odoo_course_lines")
    .select("odoo_id")
    .eq("droitfil_project_id", droitfilProjectId);
  const fetchedIds = new Set(odooLines.map((l) => l.id));
  const toMark = (existing || []).map((e) => e.odoo_id).filter((id) => !fetchedIds.has(id));
  if (toMark.length) {
    await supabase
      .from("odoo_course_lines")
      .update({ removed_from_odoo: true, synced_at: now })
      .in("odoo_id", toMark);
  }

  return readCourseLines(droitfilProjectId);
}
