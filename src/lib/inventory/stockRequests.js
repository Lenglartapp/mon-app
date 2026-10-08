// « Mise à disposition » : demandes atelier → logistique. Logique pure (client Supabase
// passé en paramètre). Confirmer une ligne déplace les pièces demandées vers ATELIER :
// toute la réception si tout est pris, sinon les pièces sont détachées dans une entrée
// « ATELIER » (même article) et le reste garde son emplacement.

import { insertStrippingPhantomColumns } from '../schemaDrift.js';
import { pickItemMeta } from './stockFields.js';

export const LOC_ATELIER = 'ATELIER';
export const requestLabel = (req) => `MAD-${req?.num ?? '?'}`;

const round2 = (n) => Math.round(Number(n) * 100) / 100;
const cleanPiece = (p) => ({ id: p.id, qty: Number(p.qty), name: p.name });
const sumQty = (pieces) => round2(pieces.reduce((s, p) => s + Number(p.qty || 0), 0));

/** Demandes (avec leurs lignes), les plus récentes d'abord ; filtrées sur un dossier si fourni. */
export async function fetchRequests(supabase, { project } = {}) {
  let q = supabase.from('stock_requests').select('*, lines:stock_request_lines(*)').order('created_at', { ascending: false });
  if (project) q = q.eq('project', project);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((r) => ({ ...r, lines: [...(r.lines || [])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))) }));
}

// Ligne de demande à enregistrer : infos article recopiées + pièces / métrage demandés.
const lineRow = (requestId, { item, pieces, qty }) => ({
  request_id: requestId,
  item_id: item.id,
  product: item.product,
  ...pickItemMeta(item),
  unit: item.unit || null,
  project: item.project || null,
  from_location: item.location || '',
  pieces: (pieces || []).map(cleanPiece),
  qty: pieces?.length ? sumQty(pieces) : round2(qty),
});

/**
 * Crée une demande et ses lignes.
 * @param {object} req   { project, requested_by, requested_for, comment }
 * @param {Array}  lines [{ item, pieces:[{id,name,qty}], qty }] — `item` = article inventory_items
 */
export async function createRequest(supabase, req, lines) {
  const { data, error } = await supabase.from('stock_requests').insert([{
    project: req.project || null,
    requested_by: req.requested_by,
    requested_for: req.requested_for || null,
    comment: req.comment || null,
  }]).select().single();
  if (error) throw error;

  const rows = lines.map((l) => lineRow(data.id, l));
  const { error: linesErr } = await supabase.from('stock_request_lines').insert(rows);
  if (linesErr) {
    await supabase.from('stock_requests').delete().eq('id', data.id); // pas de demande vide
    throw linesErr;
  }
  return data;
}

/**
 * Modifie une demande encore ouverte (sans historique) : en-tête (demandeur, date,
 * commentaire) et lignes EN ATTENTE. Les lignes déjà mises à disposition ne bougent pas.
 * @param {object} request la demande d'origine (avec ses lignes)
 * @param {object} header  { requested_by, requested_for, comment }
 * @param {Array}  lines   lignes en attente voulues : [{ lineId?, item, pieces, qty }]
 *                         (lineId = ligne existante à mettre à jour ; absent = nouvelle ligne)
 */
export async function updateRequest(supabase, request, header, lines) {
  const { error } = await supabase.from('stock_requests').update({
    requested_by: header.requested_by,
    requested_for: header.requested_for || null,
    comment: header.comment || null,
    updated_at: new Date().toISOString(),
  }).eq('id', request.id);
  if (error) throw error;

  const pending = (request.lines || []).filter((l) => l.status === 'pending');
  const keptIds = new Set(lines.map((l) => l.lineId).filter(Boolean));
  const removed = pending.filter((l) => !keptIds.has(l.id)).map((l) => l.id);
  if (removed.length) {
    const { error: delErr } = await supabase.from('stock_request_lines').delete().in('id', removed).eq('status', 'pending');
    if (delErr) throw delErr;
  }
  for (const l of lines.filter((x) => x.lineId)) {
    const row = lineRow(request.id, l);
    const { error: upErr } = await supabase.from('stock_request_lines')
      .update({ pieces: row.pieces, qty: row.qty }).eq('id', l.lineId).eq('status', 'pending');
    if (upErr) throw upErr;
  }
  const added = lines.filter((x) => !x.lineId).map((l) => lineRow(request.id, l));
  if (added.length) {
    const { error: insErr } = await supabase.from('stock_request_lines').insert(added);
    if (insErr) throw insErr;
  }
  await refreshRequestStatus(supabase, request.id);
}

/** Passe la demande à « done » quand plus aucune ligne n'est en attente (ou « cancelled » si tout est annulé). */
async function refreshRequestStatus(supabase, requestId) {
  const { data: lines, error } = await supabase.from('stock_request_lines').select('status').eq('request_id', requestId);
  if (error) throw error;
  const pending = lines.some((l) => l.status === 'pending');
  const status = pending ? 'open' : lines.every((l) => l.status === 'cancelled') ? 'cancelled' : 'done';
  await supabase.from('stock_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', requestId);
}

/** Annule une ligne encore en attente. */
export async function cancelLine(supabase, line) {
  const { error } = await supabase.from('stock_request_lines').update({ status: 'cancelled' }).eq('id', line.id).eq('status', 'pending');
  if (error) throw error;
  await refreshRequestStatus(supabase, line.request_id);
}

/**
 * Confirme une ligne : les pièces (ou le métrage) passent à l'emplacement ATELIER,
 * avec une trace DÉPLACEMENT au journal. Relit l'article en base (état frais).
 */
export async function confirmLine(supabase, request, line, operator) {
  const { data: item, error: itemErr } = await supabase.from('inventory_items').select('*').eq('id', line.item_id).maybeSingle();
  if (itemErr) throw itemErr;
  if (!item) throw new Error("L'article n'existe plus dans le stock.");

  const itemPieces = Array.isArray(item.pieces) ? item.pieces.map(cleanPiece) : [];
  const wantedIds = new Set((line.pieces || []).map((p) => p.id));
  let moved, remaining, movedQty;

  if (wantedIds.size > 0) {
    moved = itemPieces.filter((p) => wantedIds.has(p.id));
    if (moved.length !== wantedIds.size) throw new Error('Une pièce demandée n’est plus dans le stock (déjà sortie ou modifiée).');
    remaining = itemPieces.filter((p) => !wantedIds.has(p.id));
    movedQty = sumQty(moved);
  } else {
    movedQty = Math.min(round2(line.qty), round2(item.qty));
    if (!(movedQty > 0)) throw new Error('Plus de stock disponible sur cet article.');
    moved = [];
    remaining = itemPieces;
  }
  const remainingQty = wantedIds.size > 0 ? sumQty(remaining) : round2(Number(item.qty) - movedQty);
  const from = item.location || '—';

  // Entrée ATELIER déjà existante pour ce même article (même produit, même dossier) ?
  const { data: atelier } = await supabase.from('inventory_items').select('*')
    .eq('product', item.product).eq('location', LOC_ATELIER)
    .filter('project', item.project ? 'eq' : 'is', item.project || null)
    .neq('id', item.id)
    .limit(1).maybeSingle();
  const takesAll = remainingQty <= 0 && remaining.length === 0;

  if (takesAll && !atelier) {
    // Tout part et rien en atelier : la réception entière change d'emplacement.
    const { error } = await supabase.from('inventory_items').update({ location: LOC_ATELIER }).eq('id', item.id);
    if (error) throw error;
  } else {
    // On retire de l'article d'origine (à 0 si tout part : la ligne disparaît de l'état du stock)…
    const { error } = await supabase.from('inventory_items')
      .update({ qty: takesAll ? 0 : remainingQty, pieces: takesAll ? [] : remaining }).eq('id', item.id);
    if (error) throw error;
    // …et on ajoute à l'entrée ATELIER du même article (créée au besoin).
    if (atelier) {
      const pieces = [...(Array.isArray(atelier.pieces) ? atelier.pieces.map(cleanPiece) : []), ...moved];
      const qty = pieces.length ? sumQty(pieces) : round2(Number(atelier.qty) + movedQty);
      const { error: e2 } = await supabase.from('inventory_items').update({ qty, pieces }).eq('id', atelier.id);
      if (e2) throw e2;
    } else {
      const { error: e2 } = await insertStrippingPhantomColumns(supabase, 'inventory_items', [{
        product: item.product, ...pickItemMeta(item), unit: item.unit, project: item.project || null,
        category: item.category, location: LOC_ATELIER, qty: movedQty, pieces: moved,
      }]);
      if (e2) throw e2;
    }
  }

  const { error: logErr } = await insertStrippingPhantomColumns(supabase, 'inventory_logs', [{
    type: 'MOVE', product: item.product, ...pickItemMeta(item), qty: movedQty, unit: item.unit,
    user_name: operator, location: LOC_ATELIER, project: item.project || null,
    reason: `Mise à disposition ${requestLabel(request)} : de ${from} vers ${LOC_ATELIER}`,
    pieces_names: moved.map((p) => p.name).filter(Boolean).join(', ') || null,
    date: new Date().toISOString(),
  }]);
  if (logErr) throw logErr;

  const { error: lineErr } = await supabase.from('stock_request_lines')
    .update({ status: 'done', done_by: operator, done_at: new Date().toISOString(), qty: movedQty })
    .eq('id', line.id);
  if (lineErr) throw lineErr;
  await refreshRequestStatus(supabase, line.request_id);
}
