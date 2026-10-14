// src/lib/undoManager.js
// -----------------------------------------------------------------------------
// Ctrl+Z / Cmd+Z (annuler) et Ctrl+Maj+Z / Cmd+Maj+Z / Ctrl+Y (rétablir) dans les
// tableaux du chiffrage et des projets.
//
//  • Une pile par page (chiffrage / projet ouvert), vidée en changeant de page.
//  • Seulement les actions faites par SOI pendant la session (50 max).
//  • Une annulation ne touche QUE les cases modifiées par l'action, et seulement si
//    elles ont encore la valeur laissée par l'action : jamais le travail d'un collègue.
//  • Chaque tableau enregistre ses actions avec une fonction `apply(direction)` qui
//    sait les défaire / refaire (cf. MinuteGrid).
// -----------------------------------------------------------------------------

const MAX = 50;
export const UNDO_TOAST_EVENT = 'droitfil:undo-toast';

let scope = null;
const undoStack = [];
const redoStack = [];

const toast = (text) => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(UNDO_TOAST_EVENT, { detail: { text } }));
};

/**
 * Enregistre une action. action = { scope, label, apply(direction: 'undo'|'redo') → boolean }
 * Une action d'une autre page vide les piles (on ne défait jamais une autre page).
 */
export function recordAction(action) {
  if (!action?.apply) return;
  if (action.scope !== scope) { undoStack.length = 0; redoStack.length = 0; scope = action.scope; }
  undoStack.push(action);
  if (undoStack.length > MAX) undoStack.shift();
  redoStack.length = 0;
}

/** Page quittée : rien à annuler sur la suivante. */
export function resetUndo(nextScope = null) {
  undoStack.length = 0; redoStack.length = 0; scope = nextScope;
}

function run(from, to, direction, verb) {
  while (from.length) {
    const action = from.pop();
    let ok = false;
    try { ok = action.apply(direction) !== false; } catch (e) { console.warn('[undo]', e); }
    if (ok) { to.push(action); toast(`${verb} : ${action.label}`); return true; }
    // Tableau fermé entre-temps : action impossible, on passe à la précédente.
  }
  toast(direction === 'undo' ? 'Rien à annuler' : 'Rien à rétablir');
  return false;
}

export const undo = () => run(undoStack, redoStack, 'undo', 'Annulé');
export const redo = () => run(redoStack, undoStack, 'redo', 'Rétabli');

// ——— Comparaison et application des changements de lignes ————————————————

// « 220 » saisi et 220 recalculé sont la même valeur ; vide = null.
const prim = (v) => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return v;
};
const stable = (v) => {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(prim(v));
};
export const sameValue = (a, b) => stable(a) === stable(b);

// Champs de trace : jamais « défaits » (l'annulation ajoute sa propre trace).
const TRACE_FIELDS = new Set(['comments', 'history']);

/**
 * Différences entre deux versions des lignes d'un tableau, par id.
 * @returns {Array<{ id, before, after, index }>} before absent = ligne ajoutée, after absent = supprimée
 */
export function diffRows(beforeRows, afterRows) {
  const B = new Map((beforeRows || []).map((r, i) => [String(r?.id), { r, i }]));
  const A = new Map((afterRows || []).map((r, i) => [String(r?.id), { r, i }]));
  const out = [];
  for (const [id, { r: after, i }] of A) {
    const b = B.get(id);
    if (!b) out.push({ id, before: undefined, after, index: i });
    else if (b.r !== after && !sameValue(withoutTrace(b.r), withoutTrace(after))) out.push({ id, before: b.r, after, index: i });
  }
  for (const [id, { r: before, i }] of B) if (!A.has(id)) out.push({ id, before, after: undefined, index: i });
  return out;
}

const withoutTrace = (row) => {
  if (!row || typeof row !== 'object') return row;
  const o = { ...row };
  TRACE_FIELDS.forEach((k) => delete o[k]);
  return o;
};

/** Champs modifiés entre deux versions d'une ligne (hors champs de trace). */
export const changedFields = (from, to) => [...new Set([...Object.keys(from || {}), ...Object.keys(to || {})])]
  .filter((k) => !TRACE_FIELDS.has(k) && !sameValue(from?.[k], to?.[k]));

/**
 * Applique des changements à l'ENVERS (undo) ou à l'endroit (redo) sur les lignes actuelles.
 * Une case n'est remise que si elle a encore la valeur laissée par l'action.
 * @returns {{ rows, removed: boolean, touched: number }}
 */
export function applyChanges(currentRows, changes, direction) {
  const src = direction === 'undo' ? 'after' : 'before';
  const dst = direction === 'undo' ? 'before' : 'after';
  let rows = [...(currentRows || [])];
  let removed = false;
  let touched = 0;
  for (const ch of changes) {
    const from = ch[src], to = ch[dst];
    const idx = rows.findIndex((r) => String(r?.id) === ch.id);
    if (!to) {                       // la ligne doit disparaître
      if (idx >= 0) { rows.splice(idx, 1); removed = true; touched++; }
    } else if (!from) {              // la ligne doit réapparaître
      if (idx < 0) { rows.splice(Math.min(ch.index, rows.length), 0, to); touched++; }
    } else if (idx >= 0) {           // case par case
      const cur = rows[idx];
      const next = { ...cur };
      let any = false;
      for (const k of changedFields(from, to)) {
        if (sameValue(cur[k], from[k])) { next[k] = to[k]; any = true; }
      }
      if (any) { rows[idx] = next; touched++; }
    }
  }
  return { rows, removed, touched };
}
