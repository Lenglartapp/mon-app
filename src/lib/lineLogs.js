// src/lib/lineLogs.js
// -----------------------------------------------------------------------------
// Historique des modifications de lignes (« Modif … ») rangé HORS des gros JSONB.
//
// Avant : chaque modification ajoutait une entrée `type:'log'` dans row.comments.
// Ces journaux faisaient ~72 % du poids des gros devis (PANTHER : 3,8 Mo / 5 Mo) et
// voyageaient à chaque chargement et chaque sauvegarde.
//
// Maintenant (ZÉRO PERTE, rien n'est jamais effacé) :
//  • ÉCRITURE — inchangée pour l'app : les journaux s'ajoutent toujours à
//    row.comments en mémoire. Au moment de SAUVEGARDER, archiveRowLogs copie les
//    journaux dans la table `line_logs` puis, SEULEMENT si la copie a réussi, les
//    retire du payload envoyé et pose sur la ligne un pointeur `__logArchive`.
//    Si la table n'existe pas encore ou si l'envoi échoue → payload inchangé.
//  • POINTEUR `__logArchive: [{ p, r, until }]` : où trouver l'historique archivé
//    (p = chiffrage/projet, r = id de ligne). Comme il est DANS la ligne, il suit
//    automatiquement toutes les copies (duplication de ligne, variante de devis,
//    projet créé depuis un devis, recalibrage). `until` = date du dernier journal
//    archivé au moment de la copie : une copie ne voit pas l'historique ajouté
//    à l'original APRÈS la copie (même comportement qu'avant).
//  • LECTURE — fetchRowLogs / mergeRowLogs recomposent l'historique complet
//    (archivé + encore dans la ligne, sans doublon) pour les écrans qui l'affichent.
//    Les vrais commentaires (`msg`) et photos (`image`) restent dans la ligne.
// -----------------------------------------------------------------------------

import { supabase } from './supabaseClient';
import { isPermanentDbError } from './dbErrors';

const TABLE = 'line_logs';
const CHUNK = 500;

/** Entrée de journal automatique (et anciens journaux sans type « Modif … »). */
export const isLogEntry = (c) =>
  !!c && typeof c === 'object' && !c.pending &&
  (c.type === 'log' || (!c.type && typeof c.text === 'string' && c.text.startsWith('Modif')));

/** Identifiant stable d'une entrée (sert à l'idempotence et au dédoublonnage). */
export const logIdOf = (c) =>
  String(c.id ?? `${c.createdAt || c.date || ''}|${c.field || c.text || ''}|${c.from ?? ''}|${c.to ?? ''}`);

const tsOf = (c) => {
  const t = Date.parse(c?.createdAt || '') || Number(c?.date) || 0;
  return Number.isFinite(t) ? t : 0;
};

// Journaux déjà archivés pendant cette session : `${parent}::${row}` -> Set(logId).
// Évite de renvoyer à chaque sauvegarde des journaux déjà en table (l'état local
// de l'écran garde, lui, l'historique complet en mémoire).
const archivedIds = new Map();
// Table absente (migration pas encore jouée) ou refus définitif : on n'archive plus
// pendant la session — l'app fonctionne exactement comme avant.
let archivingDisabled = false;

const upsertRef = (refs, ref) => {
  const list = Array.isArray(refs) ? refs.filter(x => !(x?.p === ref.p && x?.r === ref.r)) : [];
  return [...list, ref];
};

/**
 * Archive les journaux des lignes dans `line_logs`, puis renvoie les lignes SANS
 * ces journaux (+ pointeur). En cas d'échec : renvoie les lignes d'origine.
 * @param {string} parentId  id du chiffrage ou du projet
 * @param {object[]} rows
 * @returns {Promise<object[]>}
 */
export const archiveRowLogs = async (parentId, rows) => {
  if (archivingDisabled || !parentId || !Array.isArray(rows) || rows.length === 0) return rows;

  const toInsert = [];
  const touched = []; // index des lignes contenant des journaux
  rows.forEach((row, i) => {
    if (!row || row.id == null || !Array.isArray(row.comments)) return;
    const logs = row.comments.filter(isLogEntry);
    if (logs.length === 0) return;
    touched.push(i);
    const key = `${parentId}::${row.id}`;
    const done = archivedIds.get(key);
    for (const log of logs) {
      const logId = logIdOf(log);
      if (done?.has(logId)) continue;
      const t = tsOf(log);
      toInsert.push({
        parent_id: String(parentId),
        row_id: String(row.id),
        log_id: logId,
        entry: log,
        created_at: new Date(t || Date.now()).toISOString(),
      });
    }
  });
  if (touched.length === 0) return rows;

  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { error } = await supabase
      .from(TABLE)
      .upsert(chunk, { onConflict: 'parent_id,row_id,log_id', ignoreDuplicates: true });
    if (error) {
      if (isPermanentDbError(error) || error.code === 'PGRST205' || error.code === '42P01') {
        archivingDisabled = true;
        console.warn('[lineLogs] archivage désactivé (table line_logs absente ou refusée) — historique conservé dans les lignes :', error.message);
      } else {
        console.warn('[lineLogs] archivage reporté (réseau / base) — historique conservé dans les lignes :', error.message);
      }
      return rows; // AUCUN retrait tant que tout n'est pas archivé
    }
    for (const r of chunk) {
      const key = `${r.parent_id}::${r.row_id}`;
      if (!archivedIds.has(key)) archivedIds.set(key, new Set());
      archivedIds.get(key).add(r.log_id);
    }
  }

  const out = rows.slice();
  for (const i of touched) {
    const row = rows[i];
    const logs = row.comments.filter(isLogEntry);
    const until = Math.max(...logs.map(tsOf), 0);
    const prevSelf = (row.__logArchive || []).find(x => x?.p === String(parentId) && x?.r === String(row.id));
    out[i] = {
      ...row,
      comments: row.comments.filter(c => !isLogEntry(c)),
      __logArchive: upsertRef(row.__logArchive, {
        p: String(parentId),
        r: String(row.id),
        until: Math.max(until, Number(prevSelf?.until) || 0),
      }),
    };
  }
  return out;
};

/**
 * Charge l'historique archivé des lignes données.
 * @returns {Promise<Map<string, object[]>>} rowId -> journaux archivés (sans doublon)
 */
export const fetchRowLogs = async (parentId, rows) => {
  const result = new Map();
  if (!Array.isArray(rows) || rows.length === 0) return result;

  // Références à lire : celles portées par chaque ligne + la ligne elle-même.
  const refsByRow = new Map();
  const rowsByParent = new Map(); // p -> Set(r)
  for (const row of rows) {
    if (!row || row.id == null) continue;
    const refs = [...(Array.isArray(row.__logArchive) ? row.__logArchive : [])];
    if (parentId) refs.push({ p: String(parentId), r: String(row.id), self: true });
    refsByRow.set(String(row.id), refs);
    for (const ref of refs) {
      if (!ref?.p || ref.r == null) continue;
      if (!rowsByParent.has(ref.p)) rowsByParent.set(ref.p, new Set());
      rowsByParent.get(ref.p).add(String(ref.r));
    }
  }

  // Lecture paginée (PostgREST plafonne à 1000 lignes par requête).
  const entriesByRef = new Map(); // `${p}::${r}` -> entry[]
  for (const [p, rset] of rowsByParent) {
    const rowIds = [...rset];
    const filterRows = rowIds.length <= 100; // sinon on lit tout le parent (moins de requêtes)
    for (let from = 0; ; from += 1000) {
      let q = supabase.from(TABLE).select('row_id,entry').eq('parent_id', p);
      if (filterRows) q = q.in('row_id', rowIds);
      const { data, error } = await q.order('created_at', { ascending: true }).range(from, from + 999);
      if (error) {
        // Table absente : pas d'historique archivé (tout est encore dans les lignes).
        if (error.code === 'PGRST205' || error.code === '42P01') return result;
        throw error;
      }
      for (const d of data || []) {
        const k = `${p}::${d.row_id}`;
        if (!entriesByRef.has(k)) entriesByRef.set(k, []);
        entriesByRef.get(k).push(d.entry);
      }
      if (!data || data.length < 1000) break;
    }
  }

  for (const [rowId, refs] of refsByRow) {
    const seen = new Set();
    const list = [];
    for (const ref of refs) {
      const until = ref.self ? Infinity : (Number(ref.until) || Infinity);
      for (const e of entriesByRef.get(`${ref.p}::${ref.r}`) || []) {
        if (tsOf(e) > until) continue;
        const id = logIdOf(e);
        if (seen.has(id)) continue;
        seen.add(id);
        list.push(e);
      }
    }
    if (list.length) result.set(rowId, list);
  }
  return result;
};

/**
 * Historique complet d'une ligne : journaux archivés + contenu actuel de
 * row.comments (sans doublon), dans l'ordre chronologique.
 */
export const mergeRowLogs = (comments, archived) => {
  const own = Array.isArray(comments) ? comments : [];
  if (!archived || archived.length === 0) return own;
  const ownIds = new Set(own.filter(isLogEntry).map(logIdOf));
  const extra = archived.filter(e => !ownIds.has(logIdOf(e)));
  if (extra.length === 0) return own;
  return [...extra, ...own].sort((a, b) => tsOf(a) - tsOf(b));
};
