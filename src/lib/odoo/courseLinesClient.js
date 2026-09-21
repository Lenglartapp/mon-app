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
 * Crée une entrée d'inventaire + une ligne de journal (mouvement IN) à partir d'une ligne
 * de course réceptionnée. Métrage total ; détail des pièces à compléter ensuite dans Droitfil.
 * Le fournisseur (pas de champ dédié en stock) est mis dans le motif du mouvement.
 */
async function createReceptionEntry(line, projectName) {
  const product = [line.reference, line.coloris].filter(Boolean).join(" — ") || line.reference || "Réception";
  const qty = line.quantite ?? 0;
  const unit = line.unite || null;
  const category = line.unite && /m/i.test(line.unite) ? "Tissu" : "Divers";
  const reason = ["Réception Odoo", line.fournisseur].filter(Boolean).join(" — ");
  const now = new Date().toISOString();

  const { error: itemErr } = await supabase.from("inventory_items").insert([
    { product, ref: line.reference || null, laize: line.laize || null, qty, unit, project: projectName || null, location: "", category, pieces: [] },
  ]);
  if (itemErr) throw itemErr;

  const { error: logErr } = await supabase.from("inventory_logs").insert([
    { type: "IN", product, qty, unit, user_name: "Synchro Odoo", location: "", project: projectName || null, reason, pieces_names: null, date: now },
  ]);
  if (logErr) throw logErr;
}

/**
 * Rafraîchit depuis Odoo : upsert les lignes courantes, marque « retirées » celles disparues
 * (sans les supprimer), puis bascule en stock les lignes « Réceptionné » pas encore basculées.
 * Renvoie { lines, receptionsCreated }.
 */
export async function refreshCourseLines(droitfilProjectId, odooProjectId, projectName) {
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

  // Bascule en stock : lignes réceptionnées pas encore basculées (idempotent via stock_created)
  const current = await readCourseLines(droitfilProjectId);
  const candidates = current.filter(
    (l) => l.statut === "receptionne" && !l.stock_created && !l.removed_from_odoo && Number(l.quantite) > 0
  );
  console.log(`[odoo] Réceptions à basculer en stock : ${candidates.length}`, candidates.map((l) => l.odoo_id));

  let receptionsCreated = 0;
  const receptionErrors = [];
  for (const line of candidates) {
    try {
      await createReceptionEntry(line, projectName);
      const { error } = await supabase
        .from("odoo_course_lines")
        .update({ stock_created: true })
        .eq("odoo_id", line.odoo_id);
      if (error) throw error;
      receptionsCreated++;
      console.log(`[odoo] Réception #${line.odoo_id} basculée en stock ✓`);
    } catch (e) {
      console.error(`[odoo] Échec bascule réception #${line.odoo_id} :`, e);
      receptionErrors.push(`${line.reference || "#" + line.odoo_id} : ${e?.message || e}`);
    }
  }

  return { lines: await readCourseLines(droitfilProjectId), receptionsCreated, receptionErrors };
}
