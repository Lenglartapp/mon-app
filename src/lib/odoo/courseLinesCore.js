// Cœur « liste de courses » (project.course.line) — logique PURE, sans client Supabase importé.
// Reçoit un client `supabase` en paramètre → réutilisable côté navigateur (clé anon) ET
// côté serveur / job de nuit (clé service). Odoo est maître ; une ligne disparue d'Odoo
// n'est PAS supprimée (removed_from_odoo=true).

import { insertStrippingPhantomColumns } from "../schemaDrift.js";
import { LOC_A_COMPLETER, pickItemMeta } from "../inventory/stockFields.js";

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
    // Quantités du dossier dans l'unité d'achat (0 tant que la ligne n'est pas reliée à une ligne d'achat).
    quantite_commandee: l.quantite_commandee ?? null,
    quantite_recue: l.quantite_recue ?? null,
    purchase_uom: m2oName(l.purchase_uom_id),
    purchase_line: m2oName(l.purchase_line_id),
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
 * de course réceptionnée. Métrage total ; l'emplacement vaut « À COMPLÉTER » tant que
 * les pièces et l'emplacement n'ont pas été saisis dans le stock. Le journal, lui,
 * n'est plus jamais modifié (trace immuable de la réception Odoo).
 */
async function createReceptionEntryWith(supabase, line, projectName, projectId = null, moves = null, alreadyLogged = new Set()) {
  const product = [line.reference, line.coloris].filter(Boolean).join(" — ") || line.reference || "Réception";
  // Avec le détail Odoo : quantité réellement reçue (somme des mouvements), sinon quantité de la liste.
  const movedQty = moves ? Math.round(moves.reduce((t, m) => t + Number(m.quantity || 0), 0) * 100) / 100 : null;
  const qty = movedQty != null && movedQty > 0 ? movedQty : (line.quantite ?? 0);
  const unit = line.unite || null;
  const category = TYPE_TO_CATEGORY[line.type_produit] || (line.unite && /m/i.test(line.unite) ? "Tissu" : "Divers");
  const meta = pickItemMeta({ ref: line.reference, coloris: line.coloris, laize: line.laize, fournisseur: line.fournisseur });
  // Fournisseur aussi gardé dans le motif : filet de sécurité si la migration des colonnes n'est pas jouée.
  const reason = ["Réception Odoo", line.fournisseur].filter(Boolean).join(" — ");
  const now = new Date().toISOString();

  const { error: itemErr } = await insertStrippingPhantomColumns(supabase, "inventory_items", [
    { product, ...meta, qty, qty_recue: qty, unit, project: projectName || null, project_id: projectId, location: LOC_A_COMPLETER, category, pieces: [] },
  ]);
  if (itemErr) throw itemErr;

  // Journal : une ligne par réception réelle (vraie date, bon de réception), sinon une ligne unique.
  const logs = moves
    ? moves.filter((m) => !alreadyLogged.has(moveKey(line.odoo_id, m))).map((m) => moveLog(m, line, { product, meta, unit, projectName, projectId }))
    : [{ type: "IN", product, ...meta, qty, unit, user_name: "Synchro Odoo", location: "", project: projectName || null, project_id: projectId, reason, pieces_names: null, date: now }];
  if (logs.length) {
    const { error: logErr } = await insertStrippingPhantomColumns(supabase, "inventory_logs", logs);
    if (logErr) throw logErr;
  }
}

// --- Réceptions détaillées (project.course.line.droitfil_receptions, Odoo 2026-10-09) -----------
// Une entrée par mouvement validé : { move_id, date (UTC), quantity (négative = retour), type, picking }.
const moveKey = (lineId, m) => `${lineId}:${m.move_id}`;
const odooUtc = (d) => (d ? new Date(String(d).replace(" ", "T")).toISOString() : new Date().toISOString());
const sameUnit = (a, b) => !a || !b || String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

function moveLog(m, line, { product, meta, unit, projectName, projectId, after = false }) {
  const retour = Number(m.quantity) < 0 || m.type === "retour";
  const what = retour ? "Retour fournisseur Odoo" : "Réception Odoo";
  const reason = [what, line.fournisseur, m.picking, after && retour ? "stock non ajusté automatiquement" : null].filter(Boolean).join(" — ");
  return {
    type: retour ? "OUT" : "IN", product, ...meta, qty: Math.abs(Number(m.quantity) || 0), unit,
    user_name: "Synchro Odoo", location: "", project: projectName || null, project_id: projectId,
    reason, pieces_names: null, date: odooUtc(m.date), odoo_move_key: moveKey(line.odoo_id, m),
  };
}

/** Index des réceptions par ligne de courses ; ignoré si l'unité d'achat ≠ unité de la ligne. */
function receptionsByLine(receptions, lines) {
  const byId = new Map(lines.map((l) => [l.odoo_id, l]));
  const out = new Map();
  for (const r of receptions || []) {
    const line = byId.get(r.course_line_id);
    if (!line || !Array.isArray(r.receptions) || !r.receptions.length) continue;
    if (!sameUnit(line.unite, r.uom)) continue;
    out.set(r.course_line_id, [...r.receptions].sort((a, b) => String(a.date).localeCompare(String(b.date))));
  }
  return out;
}

/** Clés de mouvements déjà inscrites au journal ; null si la colonne n'existe pas (migration non jouée). */
async function loggedMoveKeys(supabase, keys) {
  if (!keys.length) return new Set();
  const { data, error } = await supabase.from("inventory_logs").select("odoo_move_key").in("odoo_move_key", keys);
  if (error) return null;
  return new Set((data || []).map((d) => d.odoo_move_key));
}

/**
 * Synchronise dans Supabase les lignes Odoo fournies : upsert, marque « retirées » celles
 * disparues (sans supprimer), puis bascule en stock les tissus « Réceptionné » pas encore basculés.
 * @param {object} supabase   client Supabase (navigateur OU serveur)
 * @param {object} args       { odooLines, droitfilProjectId, odooProjectId, projectName }
 * @returns {{ lines, receptionsCreated, receptionErrors }}
 */
export async function syncCourseLinesInto(supabase, { odooLines, receptions = null, droitfilProjectId, odooProjectId, projectName }) {
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

  // Détail des réceptions Odoo, utilisé seulement si le journal sait garder la clé de mouvement.
  const movesByLine = receptionsByLine(receptions, current);
  const allKeys = [...movesByLine].flatMap(([id, ms]) => ms.map((m) => moveKey(id, m)));
  const logged = await loggedMoveKeys(supabase, allKeys);
  const detailed = logged !== null;

  let receptionsCreated = 0;
  const receptionErrors = [];
  for (const line of candidates) {
    try {
      await createReceptionEntryWith(supabase, line, projectName, droitfilProjectId ?? null, detailed ? movesByLine.get(line.odoo_id) || null : null, logged || undefined);
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

  // Mouvements arrivés APRÈS la mise en stock (retour fournisseur…) : inscrits au journal, seulement pour
  // les lignes déjà suivies mouvement par mouvement (les anciennes entrées uniques restent telles quelles).
  if (detailed) {
    const done = new Set(candidates.map((l) => l.odoo_id));
    for (const line of current) {
      const moves = movesByLine.get(line.odoo_id);
      if (!moves || !line.stock_created || done.has(line.odoo_id)) continue;
      if (!moves.some((m) => logged.has(moveKey(line.odoo_id, m)))) continue;
      const fresh = moves.filter((m) => !logged.has(moveKey(line.odoo_id, m)));
      if (!fresh.length) continue;
      const product = [line.reference, line.coloris].filter(Boolean).join(" — ") || line.reference || "Réception";
      const meta = pickItemMeta({ ref: line.reference, coloris: line.coloris, laize: line.laize, fournisseur: line.fournisseur });
      const { error } = await insertStrippingPhantomColumns(supabase, "inventory_logs",
        fresh.map((m) => moveLog(m, line, { product, meta, unit: line.unite || null, projectName, projectId: droitfilProjectId ?? null, after: true })));
      if (error) receptionErrors.push(`${line.reference || "#" + line.odoo_id} : ${error.message}`);
    }
  }

  return { lines: await readCourseLinesWith(supabase, droitfilProjectId), receptionsCreated, receptionErrors };
}
