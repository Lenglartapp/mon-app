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
 * Crée une entrée de stock + sa ligne de journal (mouvement IN). L'emplacement vaut « À COMPLÉTER »
 * tant que les pièces et l'emplacement n'ont pas été saisis. Le journal n'est plus jamais modifié.
 * Avec `move` (détail Odoo) : quantité, date et bon de réception de CE mouvement ; sinon la ligne entière.
 */
async function createReceptionEntryWith(supabase, line, projectName, projectId = null, move = null) {
  const product = productOf(line);
  const qty = move ? Number(move.quantity) || 0 : (line.quantite ?? 0);
  const unit = line.unite || null;
  const category = TYPE_TO_CATEGORY[line.type_produit] || (line.unite && /m/i.test(line.unite) ? "Tissu" : "Divers");
  const meta = metaOf(line);
  // Fournisseur aussi gardé dans le motif : filet de sécurité si la migration des colonnes n'est pas jouée.
  const reason = ["Réception Odoo", line.fournisseur, move?.picking].filter(Boolean).join(" — ");
  const date = move ? odooUtc(move.date) : new Date().toISOString();

  const { error: itemErr } = await insertStrippingPhantomColumns(supabase, "inventory_items", [
    { product, ...meta, qty, qty_recue: qty, unit, project: projectName || null, project_id: projectId, location: LOC_A_COMPLETER, category, pieces: [] },
  ]);
  if (itemErr) throw itemErr;

  const { error: logErr } = await insertStrippingPhantomColumns(supabase, "inventory_logs", [
    { type: "IN", product, ...meta, qty, unit, user_name: "Synchro Odoo", location: "", project: projectName || null, project_id: projectId,
      reason, pieces_names: null, date, ...(move ? { odoo_move_key: moveKey(line.odoo_id, move) } : {}) },
  ]);
  if (logErr) throw logErr;
}

/** Retour fournisseur : inscrit au journal (sortie, vraie date) ; la quantité en stock n'est pas retouchée. */
async function logReturnWith(supabase, line, projectName, projectId, move) {
  const { error } = await insertStrippingPhantomColumns(supabase, "inventory_logs", [{
    type: "OUT", product: productOf(line), ...metaOf(line), qty: Math.abs(Number(move.quantity) || 0), unit: line.unite || null,
    user_name: "Synchro Odoo", location: "", project: projectName || null, project_id: projectId,
    reason: ["Retour fournisseur Odoo", line.fournisseur, move.picking, "stock à ajuster à la main"].filter(Boolean).join(" — "),
    pieces_names: null, date: odooUtc(move.date), odoo_move_key: moveKey(line.odoo_id, move),
  }]);
  if (error) throw error;
}

const productOf = (line) => [line.reference, line.coloris].filter(Boolean).join(" — ") || line.reference || "Réception";
const metaOf = (line) => pickItemMeta({ ref: line.reference, coloris: line.coloris, laize: line.laize, fournisseur: line.fournisseur });

// --- Réceptions détaillées (project.course.line.droitfil_receptions, Odoo 2026-10-09) -----------
// Une entrée par mouvement validé : { move_id, date (UTC), quantity (négative = retour), type, picking }.
// Chaque mouvement entre en stock DÈS qu'il est validé (réception partielle comprise) : 45 ml le 12,
// puis 45 ml le 15 = deux entrées. La clé « ligne:mouvement » garantit qu'un mouvement n'entre qu'une fois.
const moveKey = (lineId, m) => `${lineId}:${m.move_id}`;
const odooUtc = (d) => (d ? new Date(String(d).replace(" ", "T")).toISOString() : new Date().toISOString());
const sameUnit = (a, b) => !a || !b || String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

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
 * disparues (sans supprimer), puis met en stock les tissus reçus :
 *  • avec le détail Odoo (receptions) : chaque réception validée, partielle comprise, à sa date ;
 *  • sans détail (unité différente, Odoo indisponible) : la ligne entière à « Réceptionné », comme avant.
 * @param {object} supabase   client Supabase (navigateur OU serveur)
 * @param {object} args       { odooLines, receptions, droitfilProjectId, odooProjectId, projectName }
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

  const current = await readCourseLinesWith(supabase, droitfilProjectId);
  const isTissu = (l) => !l.removed_from_odoo && l.type_produit === "tissu";
  const projectId = droitfilProjectId ?? null;

  // Détail des réceptions Odoo, utilisé seulement si le journal sait garder la clé de mouvement.
  const movesByLine = receptionsByLine(receptions, current);
  const allKeys = [...movesByLine].flatMap(([id, ms]) => ms.map((m) => moveKey(id, m)));
  const logged = await loggedMoveKeys(supabase, allKeys);
  const detailed = logged !== null;

  let receptionsCreated = 0;
  const receptionErrors = [];
  const fail = (line, e) => receptionErrors.push(`${line.reference || "#" + line.odoo_id} : ${e?.message || e}`);
  const markStocked = async (line) => {
    const { error } = await supabase.from("odoo_course_lines").update({ stock_created: true }).eq("odoo_id", line.odoo_id);
    if (error) throw error;
  };

  for (const line of current.filter(isTissu)) {
    const moves = detailed ? movesByLine.get(line.odoo_id) : null;
    try {
      if (moves) {
        // Ligne déjà mise en stock d'un bloc AVANT le détail (ancienne entrée unique) : on n'y touche pas.
        if (line.stock_created && !moves.some((m) => logged.has(moveKey(line.odoo_id, m)))) continue;
        for (const m of moves) {
          if (logged.has(moveKey(line.odoo_id, m))) continue; // déjà entré : seuls les nouveaux mouvements comptent
          if (Number(m.quantity) < 0 || m.type === "retour") await logReturnWith(supabase, line, projectName, projectId, m);
          else if (Number(m.quantity) > 0) { await createReceptionEntryWith(supabase, line, projectName, projectId, m); receptionsCreated++; }
          logged.add(moveKey(line.odoo_id, m));
        }
        if (!line.stock_created) await markStocked(line);
      } else if (line.statut === "receptionne" && !line.stock_created && Number(line.quantite) > 0) {
        // Sans détail : comportement d'origine, la ligne entière une fois tout reçu.
        await createReceptionEntryWith(supabase, line, projectName, projectId);
        await markStocked(line);
        receptionsCreated++;
      }
    } catch (e) {
      fail(line, e);
    }
  }

  return { lines: await readCourseLinesWith(supabase, droitfilProjectId), receptionsCreated, receptionErrors };
}
