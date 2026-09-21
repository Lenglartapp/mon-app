// Cœur « liste de courses » (project.course.line) — logique PURE, sans client Supabase importé.
// Reçoit un client `supabase` en paramètre → réutilisable côté navigateur (clé anon) ET
// côté serveur / job de nuit (clé service). Odoo est maître ; une ligne disparue d'Odoo
// n'est PAS supprimée (removed_from_odoo=true).

const m2oName = (v) => (Array.isArray(v) ? v[1] : null); // Many2one Odoo -> [id, nom]
const dateOrNull = (v) => (v && typeof v === "string" ? v : null); // Odoo renvoie false si vide

// Seul le tissu bascule en stock ; catégorie de l'article créé selon le type de produit Odoo.
const TYPE_TO_CATEGORY = { tissu: "Tissu", rail: "Rail", mecanisme: "Mécanisme", consommable: "Consommable", store: "Divers", autre: "Divers" };

/** Transforme une ligne Odoo brute en ligne du miroir Supabase. */
export function mapOdooLine(l, { droitfilProjectId, odooProjectId, now }) {
  return {
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
    type_produit: l.type_produit || null,
    date_livraison_estimee: dateOrNull(l.date_livraison_estimee),
    date_reception: dateOrNull(l.date_reception),
    write_date: l.write_date || null,
    removed_from_odoo: false,
    synced_at: now,
  };
}

/** Lit le miroir local (Supabase) d'un projet Droitfil, trié. */
export async function readCourseLinesWith(supabase, droitfilProjectId) {
  const { data, error } = await supabase
    .from("odoo_course_lines")
    .select("*")
    .eq("droitfil_project_id", droitfilProjectId)
    .order("sequence", { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Crée une entrée d'inventaire + une ligne de journal (mouvement IN) pour une ligne
 * de course réceptionnée. Métrage total ; détail des pièces à compléter dans Droitfil.
 */
async function createReceptionEntryWith(supabase, line, projectName) {
  const product = [line.reference, line.coloris].filter(Boolean).join(" — ") || line.reference || "Réception";
  const qty = line.quantite ?? 0;
  const unit = line.unite || null;
  const category = TYPE_TO_CATEGORY[line.type_produit] || (line.unite && /m/i.test(line.unite) ? "Tissu" : "Divers");
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
 * Synchronise dans Supabase les lignes Odoo fournies : upsert, marque « retirées » celles
 * disparues (sans supprimer), puis bascule en stock les tissus « Réceptionné » pas encore basculés.
 * @param {object} supabase   client Supabase (navigateur OU serveur)
 * @param {object} args       { odooLines, droitfilProjectId, odooProjectId, projectName }
 * @returns {{ lines, receptionsCreated, receptionErrors }}
 */
export async function syncCourseLinesInto(supabase, { odooLines, droitfilProjectId, odooProjectId, projectName }) {
  const now = new Date().toISOString();
  const rows = (odooLines || []).map((l) => mapOdooLine(l, { droitfilProjectId, odooProjectId, now }));

  if (rows.length) {
    const { error } = await supabase.from("odoo_course_lines").upsert(rows, { onConflict: "odoo_id" });
    if (error) throw error;
  }

  // Marquer « retirées d'Odoo » les lignes du miroir absentes de la réponse (sans supprimer).
  const { data: existing } = await supabase
    .from("odoo_course_lines")
    .select("odoo_id")
    .eq("droitfil_project_id", droitfilProjectId);
  const fetchedIds = new Set((odooLines || []).map((l) => l.id));
  const toMark = (existing || []).map((e) => e.odoo_id).filter((id) => !fetchedIds.has(id));
  if (toMark.length) {
    await supabase
      .from("odoo_course_lines")
      .update({ removed_from_odoo: true, synced_at: now })
      .in("odoo_id", toMark);
  }

  // Bascule en stock : SEUL le tissu, réceptionné, pas encore basculé, quantité > 0 (idempotent).
  const current = await readCourseLinesWith(supabase, droitfilProjectId);
  const candidates = current.filter(
    (l) => l.statut === "receptionne" && !l.stock_created && !l.removed_from_odoo && Number(l.quantite) > 0 && l.type_produit === "tissu"
  );

  let receptionsCreated = 0;
  const receptionErrors = [];
  for (const line of candidates) {
    try {
      await createReceptionEntryWith(supabase, line, projectName);
      const { error } = await supabase
        .from("odoo_course_lines")
        .update({ stock_created: true })
        .eq("odoo_id", line.odoo_id);
      if (error) throw error;
      receptionsCreated++;
    } catch (e) {
      receptionErrors.push(`${line.reference || "#" + line.odoo_id} : ${e?.message || e}`);
    }
  }

  return { lines: await readCourseLinesWith(supabase, droitfilProjectId), receptionsCreated, receptionErrors };
}
