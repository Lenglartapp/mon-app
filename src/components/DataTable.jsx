import React, { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_VIEWS } from "../lib/constants/views";
import { useActivity } from "../contexts/activity";
import { useAuth } from "../auth.jsx";
import { COLORS, S, TABLE_DENSITY } from "../lib/constants/ui";
import { uid } from "../lib/utils/uid";
import RowFormModal from "./RowFormModal.jsx";
import EditFieldModal from "./EditFieldModal.jsx";
import ColumnPicker from "./ColumnPicker.jsx";
import EtqFieldPicker from "./EtqFieldPicker.jsx";
import LightboxModal from "./LightboxModal.jsx";
import InputCell from "./cells/InputCell.jsx";
import ActivitySidebar from "./ActivitySidebar.jsx";
import { recomputeRow } from "../lib/formulas/recomputeRow";
import { computeFormulas } from "../lib/formulas/compute";
import FilterPanel from "./FilterPanel.jsx";



// icônes utilisées par DataTable
import {
  PencilRuler, Database, Boxes, GanttChart,
  Plus, Filter, Layers3, Star, Settings2, Search,
  ChevronUp, ChevronDown, Edit3, ChevronRight, X, MoreVertical,
  Trash2, Copy
} from "lucide-react";

// Petit hook local pour mémoriser dans localStorage
function useLocalStorage(key, initialValue) {
  const [value, setValue] = React.useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  React.useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignorer */
    }
  }, [key, value]);

  return [value, setValue];
}

const EMPTY_CTX = {};

// ——— utils visibilité colonnes ———
const MIN_COLS = ["sel", "detail"]; // colonnes protégées (toujours visibles)

/** Intersecte visibleCols avec le schéma + réimpose MIN_COLS, sans doublons. */
function normalizeVisibleCols(schema, visible) {
  const allKeys = new Set((schema || []).map(c => c.key));
  const base = Array.isArray(visible) ? visible.filter(k => allKeys.has(k)) : [];
  const withMin = Array.from(new Set([...base, ...MIN_COLS]));
  return withMin;
}

/** Comparaison shallow d’array par contenu (ordre compris) */
function arrEq(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}


// =============== DataTable ===============
function DataTable({
  title,
  tableKey,
  rows,
  onRowsChange,
  schema,
  setSchema,
  searchQuery = "",
  viewKey = "installation",
  // NEW: active le support "=..." dans les cellules
  enableCellFormulas = false,
  formulaCtx = EMPTY_CTX,
}) {
  // --- Versionning du localStorage pour forcer la prise en compte des nouvelles présélections
const VIEWS_VERSION = 7; // ← incrémente quand tu changes DEFAULT_VIEWS
const keyLS = `prod.v${VIEWS_VERSION}.visible.${viewKey}.${tableKey}`;

// [NEW] défauts de visibilité : DEFAULT_VIEWS si présents, sinon toutes les colonnes du schéma
const defaultFromViews = Array.isArray(DEFAULT_VIEWS?.[viewKey]?.[tableKey])
  ? DEFAULT_VIEWS[viewKey][tableKey]
  : schema.map(c => c.key);

// [NEW] visibleCols avec normalisation immédiate (intersection schéma + MIN_COLS)
const [visibleCols, setVisibleCols] = useLocalStorage(
  keyLS,
  normalizeVisibleCols(schema, defaultFromViews)
);

// [NEW] quand le schéma change, on renormalise SANS boucler
React.useEffect(() => {
  const normalized = normalizeVisibleCols(schema, visibleCols);
  if (!arrEq(visibleCols, normalized)) {
    setVisibleCols(normalized);
  }
  // ⚠️ surtout pas dépendant de visibleCols, sinon ping-pong
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [schema]);



// NEW: helper pour muter les lignes via onRowsChange
  const setRows = React.useCallback(
    (updater) => {
      const next =
        typeof updater === "function" ? updater(rows) : updater;
      onRowsChange?.(next);
    },
    [rows, onRowsChange]
  );


  // NEW: applique l'édition d'une cellule, avec support "=..."
  const handleCellChange = React.useCallback(
  (rowId, key, raw) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;

        // copie
        let next = { ...r, __cellFormulas: { ...(r.__cellFormulas || {}) } };

        if (
          enableCellFormulas &&
          typeof raw === "string" &&
          raw.trim().startsWith("=")
        ) {
          // override par cellule
          const expr = raw.trim().slice(1); // on enlève le "="
          next.__cellFormulas[key] = expr;
          // on ne pose PAS la valeur brute : on recalcule la ligne
        } else {
          // valeur littérale => on supprime un éventuel override
          if (next.__cellFormulas[key]) delete next.__cellFormulas[key];
          next[key] = raw;
        }

        // ✅ Recompute ciblé pour cette ligne (prend en compte __cellFormulas)
        try {
          next = recomputeRow(next, schema, formulaCtx);
        } catch {
          /* silencieux */
        }
        return next;
      })
    );
  },
  [enableCellFormulas, schema, setRows, formulaCtx]
);

// -- COPIE / COLLAGE natifs (fonctionnent même si le wrapper n'a pas le focus parfait)

// copie: remplit le presse-papier avec la grille sélectionnée (ou la cellule seule)
// -- COPIE / COLLAGE natifs (fonctionnent même si le wrapper n'a pas le focus parfait)

// copie: remplit le presse-papier avec la grille sélectionnée (ou la cellule seule)
const handleCopy = (e) => {
  const hasSel = !!selBox || !!selectedCell;
  if (!hasSel) return;

  const box = selBox
    ? selBox
    : (() => {
        const ci = colIndexByKey.get(selectedCell.colKey) ?? 0;
        return { rowStart: selectedCell.rowIndex, rowEnd: selectedCell.rowIndex, colStart: ci, colEnd: ci };
      })();

  const rowsInSel = filtered.slice(box.rowStart, box.rowEnd + 1);
  const colsInSel = cols.slice(box.colStart, box.colEnd + 1);

  const grid = rowsInSel
    .map((r) => colsInSel.map((c) => (r[c.key] == null ? "" : String(r[c.key]))).join("\t"))
    .join("\n");

  if (e.clipboardData) {
    e.clipboardData.setData("text/plain", grid);
    e.preventDefault();
    return;
  }
  try { navigator.clipboard.writeText(grid); } catch {}
};

// collage: colle au point d’ancrage (cellule ou rectangle) avec support "=..." sur colonnes formule/RO
const handlePaste = async (e) => {
  // Pas d’édition en cours, et besoin d’un ancrage
  const hasSel = !!selBox || !!selectedCell;
  if (editing || !hasSel) return;

  let txt = "";
  if (e.clipboardData?.getData) {
    txt = e.clipboardData.getData("text/plain") || "";
  }
  if (!txt) {
    try { txt = await navigator.clipboard.readText(); } catch {}
  }
  if (!txt) return;
  e.preventDefault();

  // Normalise \r\n et supprime les lignes vides finales (comme Excel)
  const lines = txt.replace(/\r/g, "").split("\n");
  while (lines.length && lines[lines.length - 1] === "") lines.pop();

  const matrix = lines.map((line) => line.split("\t"));
  const H = matrix.length;
  const W = Math.max(...matrix.map((r) => r.length || 0));
  if (!H || !W) return;

  const startRowIndex = selBox ? selBox.rowStart : selectedCell.rowIndex;
  const startColIndex = selBox
    ? selBox.colStart
    : (colIndexByKey.get(selectedCell.colKey) ?? 0);

  const isSingleTarget = !selBox || (selBox.rowStart === selBox.rowEnd && selBox.colStart === selBox.colEnd);
  const destRows = isSingleTarget ? H : (selBox.rowEnd - selBox.rowStart + 1);
  const destCols = isSingleTarget ? W : (selBox.colEnd - selBox.colStart + 1);

  const updates = [];
  for (let dr = 0; dr < destRows; dr++) {
    const rIndex = startRowIndex + dr;
    if (rIndex < 0 || rIndex >= filtered.length) break;
    const row = filtered[rIndex];

    for (let dc = 0; dc < destCols; dc++) {
      const cIndex = startColIndex + dc;
      if (cIndex < 0 || cIndex >= cols.length) break;
      const col = cols[cIndex];

      // ---- Récupération source avec "tiling" (répétition du motif) ----
      const srcR = dr % H;
      const srcRow = matrix[srcR] || [];
      const rowW = srcRow.length || 1;
      const srcC = dc % rowW;
      const raw = (srcRow[srcC] != null) ? srcRow[srcC] : "";

      // autorisations:
      // - si colonne readOnly ou type "formula", on autorise SEULEMENT si c’est un override "=..."
      const isOverride = typeof raw === "string" && raw.trim().startsWith("=");
      const isFormulaType = col.type === "formula";
      const isReadOnly = !!col.readOnly;

      if ((isFormulaType || isReadOnly) && !isOverride) continue;

      let value = raw;
      if (col.type === "number" && !isOverride) {
        value = (raw === "" ? "" : String(raw).replace(",", "."));
      }

      updates.push({ id: row.id, key: col.key, value });
    }
  }

  if (updates.length) {
    // UX: si on colle dans la colonne triée, évite un saut visuel
    const keysUpdated = new Set(updates.map(u => u.key));
    if (keysUpdated.has(sort?.key)) freezeSortOnce?.();

    setManyCells(updates);
  }

  // recadre la sélection sur la zone collée
  const lastRow = Math.min(startRowIndex + destRows - 1, filtered.length - 1);
  const lastCol = Math.min(startColIndex + destCols - 1, cols.length - 1);
  setSelectedCell({ rowIndex: startRowIndex, colKey: cols[startColIndex].key });
  setSelBox({ rowStart: startRowIndex, rowEnd: lastRow, colStart: startColIndex, colEnd: lastCol });
  setActiveCell?.({ rowIndex: startRowIndex, colKey: cols[startColIndex].key });
  scrollCellIntoView(lastRow, cols[lastCol].key);

  // reprise focus clavier
  try { wrapRef.current?.focus?.({ preventScroll: true }); } catch { wrapRef.current?.focus?.(); }
};



// ——— Cell formulas helpers ———
const isCellOverridden = React.useCallback(
  (r, key) => Boolean(r?.__cellFormulas?.[key]),
  []
);

const resetCellFormula = React.useCallback(
  (rowId, key) => {
    setRows(prev =>
      prev.map(r => {
        if (r.id !== rowId) return r;

        // clone + enlève l’override pour cette cellule
        const next = { ...r };
        if (next.__cellFormulas && next.__cellFormulas[key]) {
          const fm = { ...next.__cellFormulas };
          delete fm[key];
          if (Object.keys(fm).length) next.__cellFormulas = fm;
          else delete next.__cellFormulas;
        }

        // recalc formules de la ligne si tu as computeFormulas
        try {
          return recomputeRow(next, schema, formulaCtx);
        } catch {
          return next;
        }
      })
    );
  },
  [setRows, schema, formulaCtx]
);

// Helper : savoir si une colonne est de type "formula"
const isFormulaKey = (schema, key) => {
  const col = schema?.find?.(c => c.key === key);
  return col?.type === "formula";
};

const keyCollapsed = `prod.group.collapsed.${viewKey}.${tableKey}`;
const [collapsed, setCollapsed] = useLocalStorage(keyCollapsed, {}); 
const toggleGroup = (gv)=> setCollapsed(s=> ({ ...s, [String(gv)]: !s[String(gv)] }));


// --- Auto-réparation: si rien de visible (ou clés obsolètes), on remet un défaut sain
React.useEffect(() => {
  const allKeys = (schema || []).map(c => c.key);
  setVisibleCols((arr) => {
    const cur = Array.isArray(arr) ? arr : [];
    // ne garder que les clés encore présentes dans le schéma
    const valid = cur.filter(k => allKeys.includes(k));

    // si plus rien de visible → réinitialise avec le défaut de la vue (protège MIN_COLS)
    if (valid.length === 0) {
      const reset = Array.from(new Set([
        ...MIN_COLS,
        ...(defaultFromViews || []).filter(k => allKeys.includes(k)),
      ]));
      return reset.length ? reset : allKeys; // dernier filet de sécurité
    }

    // sinon, s'assurer que MIN_COLS sont présents + unicité
    return Array.from(new Set([...valid, ...MIN_COLS]));
  });
}, [schema, defaultFromViews, setVisibleCols]);

// Persistance par vue/tableau
  const keyOrder   = `prod.order.${viewKey}.${tableKey}`;
  const keyFilters = `prod.filters.${viewKey}.${tableKey}`;
  const keyGroup   = `prod.group.${viewKey}.${tableKey}`;
  const [order,   setOrder]   = useLocalStorage(keyOrder, null);   // null = ordre par défaut (schéma)
  const [filters, setFilters] = useLocalStorage(keyFilters, []);   // [{key,op,value}]
  const [groupBy, setGroupBy] = useLocalStorage(keyGroup, null);   // {key} | null
  
  // === Agrégats en pied de tableau (simple) ===
const keyAgg = `prod.agg.${viewKey}.${tableKey}`;
const [aggByCol, setAggByCol] = useLocalStorage(keyAgg, {}); // ex: { largeur: "sum", produit:"unique" }

const AGG_NUMERIC   = ["none", "sum", "avg"];            // Aucune, Somme, Moyenne
const AGG_NON_NUM   = ["none", "filled", "empty", "unique"]; // Aucune, Remplies, Vides, Unique
const nf = useMemo(() => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }), []);

const isNumericCol = (col) => col?.type === "number"; // on garde simple (tu pourras enrichir si tu as d'autres types numériques)
const isEmptyValue = (v) => v == null || String(v).trim() === "";

const computeAggValue = (col, rows, mode) => {
  if (!mode || mode === "none") return "";

  const key = col.key;
  // numériques
  if (isNumericCol(col)) {
    const nums = rows
      .map(r => {
        const raw = r[key];
        if (raw === "" || raw == null) return null;
        const x = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
        return Number.isFinite(x) ? x : null;
      })
      .filter(x => x != null);

    if (nums.length === 0) return "—";

    if (mode === "sum") {
      const s = nums.reduce((a, b) => a + b, 0);
      return `Somme ${nf.format(s)}`;
    }
    if (mode === "avg") {
      const s = nums.reduce((a, b) => a + b, 0);
      return `Moyenne ${nf.format(s / nums.length)}`;
    }
    return "—";
  }

  // non numériques
  const vals = rows.map(r => r[key]);
  if (mode === "filled") {
    const n = vals.filter(v => !isEmptyValue(v)).length;
    return `Remplies ${n}`;
  }
  if (mode === "empty") {
    const n = vals.filter(v => isEmptyValue(v)).length;
    return `Vides ${n}`;
  }
  if (mode === "unique") {
    const set = new Set(vals.filter(v => !isEmptyValue(v)).map(v => String(v)));
    return `Unique ${set.size}`;
  }
  return "—";
};

  // Réimpose les colonnes protégées UNE FOIS si absentes
useEffect(() => {
  setVisibleCols((arr) => {
    const cur = Array.isArray(arr) ? arr : [];
    const need = MIN_COLS.some(k => !cur.includes(k));
    return need ? Array.from(new Set([...cur, ...MIN_COLS])) : arr;
  });
  // on ne dépend pas de visibleCols ici pour éviter les boucles
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

// Colonne de tri initiale = 1ère colonne visible non protégée (on le garde pour info, mais on ne l’applique pas)
const firstSortable = useMemo(
  () =>
    schema.find((c) => visibleCols.includes(c.key) && !MIN_COLS.includes(c.key))?.key || null,
  [schema, visibleCols]
);

// ✅ Aucun tri par défaut au démarrage
const [sort, setSort] = useState({ key: null, dir: "asc" });

  // — Gèle le tri pendant un cycle de rendu quand on édite la colonne triée
const [sortFreeze, setSortFreeze] = useState(false);
const freezeSortOnce = () => {
  setSortFreeze(true);
  setTimeout(() => setSortFreeze(false), 0);
};
  const [lightbox, setLightbox] = useState(null);
  const [debugKeys, setDebugKeys] = useState(false); // activer via un bouton

const { addChange } = useActivity();
const { currentUser } = useAuth();
const { addUpdate } = useActivity();

// === ÉDITION COURANTE (une seule cellule à la fois) ===
const [editing, setEditing] = useState(null); // { rowId, colKey } | null
const [navOrder, setNavOrder] = useState(null); // null | string[] (liste d'IDs)
const isCellEditing = (rowId, colKey) =>
  editing?.rowId === rowId && editing?.colKey === colKey;

const esc = React.useCallback(
  (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  []
);

  const parseFxRefs = React.useCallback(
    (expr, row) => {
        if (!expr) return [];
        const s = String(expr).trim().replace(/^=/, "");
        const keys = Object.keys(row || {}).filter((k) => k !== "__cellFormulas");
        const seen = new Set();
        const refs = [];
        for (const k of keys) {
          const rx = new RegExp(`\\b${esc(k)}\\b`, "g");
          if (rx.test(s) && !seen.has(k)) {
            seen.add(k);
            refs.push({ key: k });
          }
        }
        return refs;
      },
    [esc]
  );

const [showCols, setShowCols] = useState(false);
  const [editColKey, setEditColKey] = useState(null);
  const [detailRow, setDetailRow] = useState(null);
  const wrapRef = useRef(null);
  const [menu, setMenu] = useState(null); // { key, x, y }
  const [showFilters, setShowFilters] = useState(false);

  // ==== Mode édition de formule "Google Sheets" ====
  const FX_COLORS = React.useMemo(() => [
    { stroke: "#1a73e8", fill: "rgba(26,115,232,.18)" },
    { stroke: "#ea4335", fill: "rgba(234,67,53,.18)" },
    { stroke: "#34a853", fill: "rgba(52,168,83,.18)" },
    { stroke: "#fbbc05", fill: "rgba(251,188,5,.22)" },
    { stroke: "#a142f4", fill: "rgba(161,66,244,.20)" },
  ], []);
  const [fxSession, setFxSession] = useState({
    active: false,
    rowIndex: null,
    rowId: null,
    colKey: null,
    refs: [],
  });
  const [fxForceDraft, setFxForceDraft] = useState(null);
  const [fxPendingToken, setFxPendingToken] = useState(null);

  const ensureRefColorIndex = React.useCallback((key) => {
    const idx = fxSession.refs.findIndex((r) => r.key === key);
    if (idx >= 0) return idx;
    const newIdx = fxSession.refs.length % FX_COLORS.length;
    setFxSession((s) => ({
      ...s,
      refs: [...s.refs, { key, colorIndex: newIdx }],
    }));
    return newIdx;
  }, [fxSession.refs, FX_COLORS]);

  const isFxHighlighted = React.useCallback((rowIndex, colKey) => {
    if (!fxSession.active) return false;
    if (rowIndex !== fxSession.rowIndex) return false;
    return fxSession.refs.some((r) => r.key === colKey);
  }, [fxSession]);

  const refColorOf = React.useCallback((key) => {
  const r = fxSession.refs.find((x) => x.key === key);
  return r ? FX_COLORS[r.colorIndex] : null;
  }, [fxSession.refs, FX_COLORS]);


  const clearFxSession = React.useCallback(() => {
    setFxSession({ active: false, rowIndex: null, rowId: null, colKey: null, refs: [] });
    setFxForceDraft(null);
    setFxPendingToken(null);
  }, []);

  const startEdit = (rowIndex, rowId, colKey) => {
    clearFxSession();
    setSelectedCell({ rowIndex, colKey });    // on garde la sélection
    setEditing({ rowId, colKey });            // on entre en édition
    setNavOrder(filtered.map(r => r.id));     // ← fige l'ordre courant des lignes visibles
    requestAnimationFrame(() => {
      focusCell(rowIndex, colKey, { edit: true });
    });
  };

  const stopEdit = () => {
    setEditing(null);
    setNavOrder(null); // ← enlève l'ordre figé
    clearFxSession();
  };
  const tdRefMap = useRef(new Map());
const setTdRef = (rowIndex, colKey, el) => {
  const k = `${rowIndex}::${colKey}`;
  if (el) tdRefMap.current.set(k, el);
  else tdRefMap.current.delete(k);
};


// === Drag & Drop colonnes (Airtable-like) ===
const [dragColKey, setDragColKey] = useState(null); // clé en cours de drag
const [dropIdx, setDropIdx] = useState(null);       // index d'insertion (dans "cols")

const isProtected = (key) => MIN_COLS.includes(key);
const isStickyKey = (key) => {
  const i = cols.findIndex(c => c.key === key);
  return i > -1 && i < stickyFirst;
};
const canDragKey = (key) => !isProtected(key) && !isStickyKey(key);

// ordre "full" de référence (si pas d'ordre → schéma)
const getFullOrder = () =>
  (order && order.length ? [...order] : schema.map(c => c.key));

// Applique le réordonnancement à partir d'un déplacement visible -> persiste dans `order`
const applyReorder = (fromKey, toVisibleIndex) => {
  if (!fromKey || toVisibleIndex == null) return;

  // liste des clés visibles (dans l'ordre affiché)
  const vis = cols.map(c => c.key);

  // indices visibles bornés + interdiction de déposer dans la zone sticky
  const minIdx = stickyFirst;
  const targetVisIdx = Math.max(minIdx, Math.min(toVisibleIndex, vis.length));
  const fromVisIdx   = vis.indexOf(fromKey);
  if (fromVisIdx < minIdx) return; // on ne déplace pas depuis la zone sticky

  // on déplace dans la projection visible
  const visNew = [...vis];
  visNew.splice(fromVisIdx, 1);
  visNew.splice(targetVisIdx > fromVisIdx ? targetVisIdx - 1 : targetVisIdx, 0, fromKey);

  // reconstruire un `order` complet : visible (réordonné) + clés cachées (ordre conservé)
  const full = getFullOrder();
  const hidden = full.filter(k => !vis.includes(k));
  const merged = [...visNew, ...hidden.filter(k => !visNew.includes(k))];

  setOrder(merged);
};

const handleDragStart = (e, key) => {
  if (!canDragKey(key)) { e.preventDefault(); return; }
  setDragColKey(key);
  setDropIdx(null);
  // utile pour Firefox
  e.dataTransfer?.setData("text/plain", key);
  e.dataTransfer?.setDragImage?.(e.currentTarget, 10, 10);
  e.dataTransfer.effectAllowed = "move";
};

const handleDragOver = (e, thIndex) => {
  if (!dragColKey) return;
  e.preventDefault(); // autorise le drop
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const before = x < rect.width / 2;
  const idx = before ? thIndex : thIndex + 1; // insertion avant/après
  setDropIdx(idx);
};

const handleDrop = (e) => {
  e.preventDefault();
  if (dragColKey != null && dropIdx != null) {
    applyReorder(dragColKey, dropIdx);
  }
  setDragColKey(null);
  setDropIdx(null);
};

const handleDragEnd = () => {
  setDragColKey(null);
  setDropIdx(null);
};

  const colsByKey = useMemo(
    () => Object.fromEntries(schema.map((c) => [c.key, c])),
    [schema]
  );

  const NON_SELECTABLE_TYPES = new Set(["button"]); // <-- select & photo deviennent sélectionnables
const NON_SELECTABLE_KEYS  = new Set(["detail"]);

const isSelectableColumn = (c) => (
  c && !NON_SELECTABLE_TYPES.has(c.type) && !NON_SELECTABLE_KEYS.has(c.key)
);

  // Ordre des colonnes : d'abord les protégées visibles (sel, detail), puis le reste des visibles
  const cols = useMemo(() => {
    const head = MIN_COLS
      .map((k) => colsByKey[k])
      .filter(Boolean)
      .filter((c) => visibleCols.includes(c.key));

    const tail = schema.filter(
      (c) => visibleCols.includes(c.key) && !MIN_COLS.includes(c.key)
    );

    // tri du "tail" selon l'ordre de la vue s'il existe
    const idx = new Map((order || []).map((k, i) => [k, i]));
    const tailSorted = [...tail].sort((a, b) => {
      const ia = idx.has(a.key) ? idx.get(a.key) : 9999;
      const ib = idx.has(b.key) ? idx.get(b.key) : 9999;
      return ia - ib;
    });

    const combined = [...head, ...tailSorted];

    if (combined.length === 0) {
      // Fallback immédiat : si toutes les colonnes visibles ont disparu,
      // on renvoie tout le schéma (hors colonnes protégées inexistantes).
      return schema.filter((c) => !MIN_COLS.includes(c.key));
    }

    return combined;
  }, [schema, visibleCols, colsByKey, order]);

// Si la projection produit 0 colonne, réinitialise la visibilité sur tout le schéma (avec MIN_COLS)
useEffect(() => {
  if ((cols?.length || 0) === 0 && Array.isArray(schema) && schema.length > 0) {
    const ALL = Array.from(new Set([...MIN_COLS, ...schema.map(c => c.key)]));
    setVisibleCols(ALL);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [cols?.length, schema?.length]);


  // Si plus aucune colonne n'est réellement visible (par ex. préférences locales corrompues),
  // on réinitialise sur une sélection sûre basée sur le schéma courant.
  useEffect(() => {
    if (!schema?.length) return;
    const schemaKeys = schema.map((c) => c.key);
    const intersection = (visibleCols || []).filter((key) => schemaKeys.includes(key));
    if (intersection.length > 0) return;

    const defaults = DEFAULT_VIEWS?.[viewKey]?.[tableKey];
    const base = Array.isArray(defaults) && defaults.length ? defaults : schemaKeys;
    const next = Array.from(new Set([...base, ...MIN_COLS])).filter((key) =>
      schemaKeys.includes(key)
    );

    if (next.length) {
      setVisibleCols(next);
    }
  }, [visibleCols, schema, tableKey, viewKey, setVisibleCols]);

  const colIndexByKey = useMemo(
  () => new Map(cols.map((c, i) => [c.key, i])),
  [cols]
);

// --- Helpers pour la sélection/édition ----

// --- Accès direct à un <td> via la map des refs ---
const getTdRef = (rowIndex, colKey) => {
  const k = `${rowIndex}::${colKey}`;
  return tdRefMap.current.get(k) || null;
};

// --- Mettre le focus sur une cellule (et optionnellement entrer en édition) ---
const focusCell = (rowIndex, colKey, { edit = false } = {}) => {
  const ci = colIndexByKey.get(colKey);
  if (ci == null) return;

  const table = wrapRef.current?.querySelector('table');
  const tr = table?.querySelectorAll('tbody tr')[rowIndex];
  const td = tr?.querySelectorAll('td')[ci];

  if (!td) return;

  td.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  if (edit) {
    focusEditableInside(td);
  } else {
    wrapRef.current?.focus?.();
  }
};

// --- Utilitaire de rendu : savoir si une cellule est dans le rectangle sélectionné ---
const isSelected = (rowIndex, colKey) => {
  if (!selBox) return false;
  const ci = colIndexByKey.get(colKey);
  if (ci == null) return false;
  return (
    rowIndex >= selBox.rowStart && rowIndex <= selBox.rowEnd &&
    ci      >= selBox.colStart  && ci      <= selBox.colEnd
  );
};

// cellule éditable ?
const isEditableColumn = (c) =>
  c &&
  !c.readOnly &&
  !["button","photo","detail"].includes(c.type) &&
  (c.type !== "formula" || enableCellFormulas);

// combien de colonnes figées (ex: 2 = Sel, Détail)
const stickyFirst = 2;

// calcul des décalages "left" pour chaque colonne figée
const leftOffsets = useMemo(() => {
  const map = {};
  let acc = 0;
  cols.slice(0, stickyFirst).forEach((c) => {
    map[c.key] = acc;
    acc += (c.width || 120);
  });
  return map;
}, [cols, stickyFirst]);

// helper pour savoir si une colonne est sticky
const isSticky = (key) => leftOffsets[key] !== undefined;

// largeur minimale du tableau (somme des colonnes)
const totalMinWidth = useMemo(
  () => cols.reduce((sum, c) => sum + (c.width || 120), 0),
  [cols]
);
const filtered = useMemo(() => {
  const qq = searchQuery.trim().toLowerCase();
  let data = rows;
  if (qq)
    data = data.filter((r) =>
      [r.zone, r.piece, r.produit].some((x) => String(x || "").toLowerCase().includes(qq))
    );

      // Filtres par vue (AND)
    if (filters?.length) {
    data = data.filter((r) => {
      return filters.every(f => {
        const v = r[f.key];
        const sv = String(v ?? "");
        switch (f.op) {
          case "contains":   return sv.toLowerCase().includes(String(f.value||"").toLowerCase());
          case "eq":         return sv === String(f.value ?? "");
          case "neq":        return sv !== String(f.value ?? "");
          case "gt":         return toNumber(v) >  toNumber(f.value);
          case "gte":        return toNumber(v) >= toNumber(f.value);
          case "lt":         return toNumber(v) <  toNumber(f.value);
          case "lte":        return toNumber(v) <= toNumber(f.value);
          case "isTrue":     return Boolean(v) === true;
          case "isFalse":    return Boolean(v) === false;
          case "isEmpty":    return sv === "" || v == null;
          case "notEmpty":   return !(sv === "" || v == null);
          default:           return true;
        }
      });
    });
  }

// SIMPLIFICATION: Pas de tri du tout pendant l'édition
if (editing || sortFreeze) {
  return data; // Retourne les données sans tri
}

// Tri normal uniquement quand aucune édition n'est en cours
// ✅ Garde: si pas de clé de tri, on renvoie tel quel
if (!sort?.key) return data;

const dir = sort.dir === "asc" ? 1 : -1;
return [...data].sort(
  (a, b) =>
    String(a[sort.key] ?? "").localeCompare(String(b[sort.key] ?? ""), "fr", {
      numeric: true,
    }) * dir
);
}, [rows, searchQuery, sort, filters, editing, sortFreeze]);


// Pré-calcul mémoïsé pour toutes les colonnes visibles
const footerAggValues = useMemo(() => {
  const map = {};
  for (const c of cols) {
    const mode = aggByCol?.[c.key] || "none";
    map[c.key] = computeAggValue(c, filtered, mode);
  }
  return map;
}, [cols, filtered, aggByCol]);

// === Grouping (derive) ===
const groups = useMemo(() => {
  if (!groupBy?.key) return null;
  const m = new Map();
  for (const r of filtered) {
    const gv = r[groupBy.key] ?? "";
    const key = String(gv);
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(r);
  }
  return Array.from(m.entries()).sort(([a],[b]) =>
    a.localeCompare(b, "fr", { numeric: true })
  ); // [ [groupValueStr, rows[]], ... ]
}, [filtered, groupBy]);

  // Sélection rectangulaire
const [selBox, setSelBox] = useState(null); // { rowStart,rowEnd,colStart,colEnd }
const draggingRef = useRef(null);           // { rowStart, colStart }
// Gestion sélection globale (checkbox "tout sélectionner")
const selectedRowIds = useMemo(() => {
  return new Set(filtered.filter(r => r.sel).map(r => r.id));
}, [filtered]);

const allVisibleSelected = filtered.length > 0 && selectedRowIds.size === filtered.length;
const someVisibleSelected = selectedRowIds.size > 0 && !allVisibleSelected;

// Fonction pour cocher/décocher toutes les lignes visibles
const toggleSelectAllVisible = (checked) => {
  const ids = new Set(filtered.map(r => r.id));
  const next = computeFormulas(
    rows.map(r => ids.has(r.id) ? { ...r, sel: checked } : r),
    schema,
    formulaCtx
  );
  onRowsChange(next);
};

const deleteSelected = () => {
  if (selectedRowIds.size === 0) return;
  if (!confirm(`Supprimer ${selectedRowIds.size} ligne(s) sélectionnée(s) ?`)) return;
  const next = rows.filter(r => !selectedRowIds.has(r.id));
  onRowsChange(next);
};

// index des lignes visibles (filtered) → utile pendant le drag
const rowIndexById = useMemo(() => {
  const m = new Map();
  filtered.forEach((r, i) => m.set(r.id, i));
  return m;
}, [filtered]);

// Cellule active et ancre de sélection (pour Shift+flèches)
const [activeCell, setActiveCell] = useState(null);   // { rowIndex, colKey } | null
const [selAnchor,  setSelAnchor]  = useState(null);   // { rowIndex, colKey } | null


// Cellule simplement sélectionnée (clic simple) — sert de base pour taper, Enter, Tab, flèches
const [selectedCell, setSelectedCell] = useState(null); // { rowIndex, colKey } | null

// util: donne l’index de colonne à partir de la clé
const getColIndex = (key) => colIndexByKey.get(key);

// util: borne un entier dans [min,max]
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// place la sélection 1x1, met la cellule active, et (optionnel) entre en édition
const activateCell = (rowIndex, colKey, { edit = false } = {}) => {
  const ci = getColIndex(colKey);
  if (ci == null) return;
  setActiveCell({ rowIndex, colKey });
  setSelAnchor({ rowIndex, colKey });
  setSelBox({ rowStart: rowIndex, rowEnd: rowIndex, colStart: ci, colEnd: ci });

  if (edit) {
    // tente de focus l’input de la cellule
    const table = wrapRef.current?.querySelector('table');
    const row = table?.querySelectorAll('tbody tr')[rowIndex];
    const td = row?.querySelectorAll('td')[ci];
    if (td) requestAnimationFrame(() => focusEditableInside(td));
  }
};

// === Déplacement cellule → cellule (garde la même colonne) ===
const gotoCell = (rowIndex, colKey, { edit = false } = {}) => {
  const ci = colIndexByKey.get(colKey);
  if (ci == null) return;

  setSelectedCell({ rowIndex, colKey });
  setSelBox({ rowStart: rowIndex, rowEnd: rowIndex, colStart: ci, colEnd: ci });

  // Si tu as déjà activateCell, utilise-le (sinon focusCell)
  if (typeof activateCell === "function") {
    activateCell(rowIndex, colKey, { edit });
  } else if (typeof focusCell === "function") {
    focusCell(rowIndex, colKey, { edit });
  }

  // ⬅️ garde le focus "global tableau" pour que les flèches marchent sans re-cliquer
  try {
    wrapRef.current?.focus?.({ preventScroll: true });
  } catch {
    wrapRef.current?.focus?.();
  }
};

// === Appelé par une cellule quand on presse Enter dans un champ ===
const handleFieldEnter = (rowId, colKey, { shift = false } = {}) => {
  // 1) Ordre de référence : snapshot si dispo, sinon ordre courant
  const order = navOrder && navOrder.length ? navOrder : filtered.map(r => r.id);

  // 2) Position actuelle (par ID)
  const curPos = order.indexOf(rowId);
  if (curPos < 0) return;

  // 3) Ligne cible dans l'ordre figé
  const delta   = shift ? -1 : 1;
  const nextPos = Math.max(0, Math.min(order.length - 1, curPos + delta));
  const nextId  = order[nextPos];

  // 4) Convertit ID cible -> index courant pour le focus
  const nextIndex = filtered.findIndex(r => r.id === nextId);
  if (nextIndex < 0) return;

  // 5) Laisse commit/blur se terminer avant de bouger
requestAnimationFrame(() => {
  gotoCell(nextIndex, colKey, { edit: false });
  // 👇 garde le focus “global tableau” pour enchaîner flèches/saisie sans re-cliquer
  try {
    wrapRef.current?.focus?.({ preventScroll: true });
  } catch {
    // certains navigateurs ne supportent pas l’option ; fallback simple
    wrapRef.current?.focus?.();
  }
});
};


// étend le rectangle depuis l’ancre jusqu’à (rowIndex,colKey)
const extendFromAnchorTo = (rowIndex, colKey) => {
  if (!selAnchor) return;
  const ci = getColIndex(colKey);
  const ai = getColIndex(selAnchor.colKey);
  if (ci == null || ai == null) return;
  setActiveCell({ rowIndex, colKey });
  setSelBox({
    rowStart: Math.min(selAnchor.rowIndex, rowIndex),
    rowEnd:   Math.max(selAnchor.rowIndex, rowIndex),
    colStart: Math.min(ai, ci),
    colEnd:   Math.max(ai, ci),
  });
};

const ensureAnchor = () => {
  if (!selAnchor && selectedCell) setSelAnchor(selectedCell);
};

// renvoie la prochaine cellule (déplacement par flèche/Enter)
const nextCell = (rowIndex, colKey, dir) => {
  // dir: 'down'|'up'|'left'|'right'
  const colsCount = cols.length;
  const ci = getColIndex(colKey) ?? 0;
  let r = rowIndex, c = ci;

  if (dir === 'down')  r += 1;
  if (dir === 'up')    r -= 1;
  if (dir === 'right') c += 1;
  if (dir === 'left')  c -= 1;

  r = clamp(r, 0, filtered.length - 1);
  c = clamp(c, 0, colsCount - 1);
  return { rowIndex: r, colKey: cols[c].key };
};

// scroll dans la vue si nécessaire
const scrollCellIntoView = (rowIndex, colKey) => {
  const ci = getColIndex(colKey);
  const table = wrapRef.current?.querySelector('table');
  const row = table?.querySelectorAll('tbody tr')[rowIndex];
  const td = row?.querySelectorAll('td')[ci];
  td?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
};

// lire la valeur d'une cellule
const getCellValue = (rowId, colKey) => {
  const r = rows.find(x => x.id === rowId);
  return r ? r[colKey] : undefined;
};

// mise à jour en lot de plusieurs lignes pour une même colonne
const bulkSet = (colKey, ids, value) => {
  const idset = new Set(ids);
  const next = computeFormulas(
    rows.map(r => (idset.has(r.id) ? { ...r, [colKey]: value } : r)),
    schema,
    formulaCtx
  );
  onRowsChange(next);
};

const setManyCells = (updates) => {
  if (!Array.isArray(updates) || updates.length === 0) return;

  // index des rows avant modif
  const before = new Map(rows.map(r => [r.id, r]));
  // log toutes les diffs
  for (const u of updates) {
    const prev = before.get(u.id);
    if (!prev) continue;
    const oldVal = prev[u.key];
    if (String(oldVal) !== String(u.value)) {
      addChange(u.id, u.key, oldVal, u.value, currentUser?.name || "Utilisateur");
    }
  }

  // appliquer les changements regroupés
  const byId = new Map();
  for (const u of updates) {
    if (!byId.has(u.id)) byId.set(u.id, {});
    byId.get(u.id)[u.key] = u.value;
  }
  const next = computeFormulas(
    rows.map(r => byId.has(r.id) ? { ...r, ...byId.get(r.id) } : r),
    schema,
    formulaCtx
  );
  onRowsChange(next);
};

// démarrer une sélection
const beginSelection = (rowIndex, rowId, colKey, e) => {
  const ci = colIndexByKey.get(colKey);
  if (ci == null) return;

  setSelBox({ rowStart: rowIndex, rowEnd: rowIndex, colStart: ci, colEnd: ci });

  // ✅ IMPORTANT : reprendre le focus clavier sur le wrapper
  try { wrapRef.current?.focus?.({ preventScroll: true }); } catch { wrapRef.current?.focus?.(); }

  draggingRef.current = { rowStart: rowIndex, colStart: ci };
};

// étendre la sélection pendant le glisser
const extendSelection = (rowIndex, colKey, e) => {
  const drag = draggingRef.current;
  if (!drag) return;

  // si le bouton gauche n’est plus enfoncé → on arrête le drag
  if (!e || !(e.buttons & 1)) { draggingRef.current = null; return; }

  const ci = colIndexByKey.get(colKey);
  if (ci == null) return;

  const rowStart = Math.min(drag.rowStart, rowIndex);
  const rowEnd   = Math.max(drag.rowStart, rowIndex);
  const colStart = Math.min(drag.colStart, ci);
  const colEnd   = Math.max(drag.colStart, ci);

  setSelBox({ rowStart, rowEnd, colStart, colEnd });
};

// terminer la sélection au relâchement de la souris
const endSelection = () => { draggingRef.current = null; };

useEffect(() => {
  const end = () => endSelection();
  window.addEventListener("mouseup", end);
  return () => window.removeEventListener("mouseup", end);
}, []);

// --- Gestion clavier “Excel-like” ---
const handleKeyDown = async (e) => {
  // Sommes-nous dans un champ éditable ?
  const active = document.activeElement;
  const tag = active?.tagName?.toLowerCase();
  const inField = tag === "input" || tag === "textarea" || tag === "select";

  // 0) ESC
  if (e.key === "Escape") {
    if (inField) return;
    setSelBox(null);
    setEditing(null);
    return;
  }

  if (inField) {
  // Si on tape dans un input / textarea / select,
  // on laisse InputCell gérer Enter/Blur/Commit.
  return;
}

  // "=" pour démarrer l'édition de formule (cellule de type "formula")
  if (!inField && e.key === "=" && selectedCell) {
    const { rowIndex, colKey } = selectedCell;
    const col = colsByKey[colKey];
    if (col?.type === "formula") {
      e.preventDefault();
      const rowId = filtered[rowIndex]?.id;
      if (!rowId) return;
      startEdit(rowIndex, rowId, colKey);
      setFxForceDraft("=");
      setFxSession({ active: true, rowIndex, rowId, colKey, refs: [] });
      setFxPendingToken(null);
      requestAnimationFrame(() => focusCell(rowIndex, colKey, { edit: true }));
      return;
    }
  }

  // 1) Copie/Collage — uniquement hors champ
  if (!inField && (e.metaKey || e.ctrlKey)) {
    const k = e.key.toLowerCase();
    if (!selBox && !selectedCell) return;

    if (k === "c") {
      e.preventDefault();
      const rowsInSel = filtered.slice(selBox.rowStart, selBox.rowEnd + 1);
      const colsInSel = cols.slice(selBox.colStart, selBox.colEnd + 1);
      const grid = rowsInSel.map(r =>
        colsInSel.map(c => (r[c.key] == null ? "" : String(r[c.key]))).join("\t")
      ).join("\n");
      try { await navigator.clipboard.writeText(grid); } catch {}
      return;
    }

    if (k === "v") {
      e.preventDefault();
      let txt = "";
      try { txt = await navigator.clipboard.readText(); } catch {}
      if (!txt) return;

      const lines  = txt.replace(/\r/g, "").split("\n");
      const matrix = lines.map(line => line.split("\t"));
      const H = matrix.length;
      const W = Math.max(...matrix.map(r => r.length || 0));

      if (!selectedCell && !selBox) return;

      const startRowIndex = selectedCell ? selectedCell.rowIndex : selBox.rowStart;
      const startColIndex = selectedCell ? (colIndexByKey.get(selectedCell.colKey) ?? 0) : selBox.colStart;

      const isSingleTarget = !selBox || (selBox.rowStart === selBox.rowEnd && selBox.colStart === selBox.colEnd);
      const destRows = isSingleTarget ? H : (selBox.rowEnd - selBox.rowStart + 1);
      const destCols = isSingleTarget ? W : (selBox.colEnd - selBox.colStart + 1);

      const updates = [];
      for (let dr = 0; dr < destRows; dr++) {
        const rIndex = startRowIndex + dr;
        if (rIndex < 0 || rIndex >= filtered.length) break;
        const row = filtered[rIndex];

        for (let dc = 0; dc < destCols; dc++) {
          const cIndex = startColIndex + dc;
          if (cIndex < 0 || cIndex >= cols.length) break;
          const col = cols[cIndex];
          if (!col || col.type === "formula" || col.readOnly) continue;

          const srcR = Math.min(dr, H - 1);
          const srcC = Math.min(dc, (matrix[srcR]?.length || 0) - 1);
          const raw = (matrix[srcR] && matrix[srcR][srcC] != null) ? matrix[srcR][srcC] : "";
          const value = col.type === "number"
            ? (raw === "" ? "" : String(raw).replace(",", "."))
            : raw;

          updates.push({ id: row.id, key: col.key, value });
        }
      }

      if (updates.length) setManyCells(updates);

      const lastRow = Math.min(startRowIndex + destRows - 1, filtered.length - 1);
      const lastCol = Math.min(startColIndex + destCols - 1, cols.length - 1);
      setSelectedCell({ rowIndex: startRowIndex, colKey: cols[startColIndex].key });
      setSelBox({ rowStart: startRowIndex, rowEnd: lastRow, colStart: startColIndex, colEnd: lastCol });
      setActiveCell?.({ rowIndex: startRowIndex, colKey: cols[startColIndex].key });
      scrollCellIntoView(lastRow, cols[lastCol].key);
      return;
    }
  }

  // 2) Taper un caractère hors champ -> éditer
  if (!inField && e.key.length === 1 && !e.altKey && !e.metaKey && !e.ctrlKey && selectedCell) {
    const { rowIndex, colKey } = selectedCell;
    const col = colsByKey[colKey];
    if (col && !col.readOnly && !["formula","button","photo","detail"].includes(col.type)) {
      e.preventDefault();
      setEditing({ rowId: filtered[rowIndex].id, colKey });
      requestAnimationFrame(() => {
        const td = getTdRef(rowIndex, colKey);
        const el = td?.querySelector('input:not([type="checkbox"]), textarea, select');
        if (!el) return;
        el.focus();
        if ("value" in el && typeof el.value === "string") {
          el.value = e.key;
          const evt = new Event("input", { bubbles: true });
          el.dispatchEvent(evt);
          el.setSelectionRange?.(el.value.length, el.value.length);
        }
      });
  }
  return;
}


  // Enter : laisser l'InputCell committer puis on stoppera la session via onFxStop
  if (fxSession.active && e.key === "Enter") {
    e.preventDefault();
    return;
  }

  // Escape : annule la session
  if (fxSession.active && e.key === "Escape") {
    e.preventDefault();
    clearFxSession();
    stopEdit();
    return;
  }

  // 3) ENTER — géré au niveau tableau seulement si on n’est PAS dans un champ
if (e.key === "Enter") {
  // Si on est dans un input/textarea/select, on laisse InputCell s'en occuper.
  if (inField) return;

  e.preventDefault();
  if (!selectedCell) return;

  const { rowIndex, colKey } = selectedCell;
  const delta    = e.shiftKey ? -1 : 1;
  const nextRow  = clamp(rowIndex + delta, 0, filtered.length - 1);
  const ci       = colIndexByKey.get(colKey) ?? 0;

  setSelectedCell({ rowIndex: nextRow, colKey });
  setSelBox({ rowStart: nextRow, rowEnd: nextRow, colStart: ci, colEnd: ci });

  const nextCol   = colsByKey[colKey];
  const editable  = nextCol && !nextCol.readOnly && !["formula","button","photo","detail"].includes(nextCol.type);

  if (editable) {
    setEditing({ rowId: filtered[nextRow].id, colKey });
    requestAnimationFrame(() => focusCell(nextRow, colKey, { edit: true }));
  } else {
    focusCell(nextRow, colKey, { edit: false });
  }
  return;
}

  // 4) TAB
  if (e.key === "Tab") {
    e.preventDefault();
    if (!selectedCell) return;
    const { rowIndex, colKey } = selectedCell;
    const cur = colIndexByKey.get(colKey);
    const delta = e.shiftKey ? -1 : 1;
    const nc = Math.max(0, Math.min(cols.length - 1, cur + delta));
    const nextKey = cols[nc].key;

    setSelectedCell({ rowIndex, colKey: nextKey });
    setSelBox({ rowStart: rowIndex, rowEnd: rowIndex, colStart: nc, colEnd: nc });

    const nextCol = colsByKey[nextKey];
    if (nextCol && !nextCol.readOnly && !["formula","button","photo","detail"].includes(nextCol.type)) {
      setEditing({ rowId: filtered[rowIndex].id, colKey: nextKey });
      requestAnimationFrame(() => focusCell(rowIndex, nextKey, { edit: true }));
    } else {
      focusCell(rowIndex, nextKey);
    }
    return;
  }

  // 5) Flèches
  if (!inField && ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) {
  e.preventDefault();
  if (!selectedCell) return;

  const { rowIndex, colKey } = selectedCell;
  const cur = colIndexByKey.get(colKey) ?? 0;

  let nr = rowIndex, nc = cur;
  if (e.key === "ArrowUp")    nr = Math.max(0, rowIndex - 1);
  if (e.key === "ArrowDown")  nr = Math.min(filtered.length - 1, rowIndex + 1);
  if (e.key === "ArrowLeft")  nc = Math.max(0, cur - 1);
  if (e.key === "ArrowRight") nc = Math.min(cols.length - 1, cur + 1);

  const nextKey = cols[nc].key;

  if (e.shiftKey) {
    // Étend la sélection depuis l’ancre jusqu’à la nouvelle cellule
    ensureAnchor(); // si pas d’ancre, utilise la cellule d’origine
    setSelectedCell({ rowIndex: nr, colKey: nextKey }); // curseur visible
    extendFromAnchorTo(nr, nextKey);                    // met à jour selBox
  } else {
    // Déplacement simple (réinitialise le rectangle)
    setSelAnchor({ rowIndex: nr, colKey: nextKey });
    setSelectedCell({ rowIndex: nr, colKey: nextKey });
    setSelBox({ rowStart: nr, rowEnd: nr, colStart: nc, colEnd: nc });
  }

  focusCell(nr, nextKey, { edit: false });
  return;
}
};

const handleMouseDown = (e, rowIndex, colKey) => {
  if (e.button !== 0) return; // uniquement clic gauche

  // ne pas démarrer si on clique dans un champ éditable
  const t = e.target;
  const tag = t.tagName?.toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea" || t.isContentEditable) return;

  const col = colsByKey[colKey];
  if (!isSelectableColumn(col)) return; // <-- important

  const rowId = filtered[rowIndex]?.id;
  if (!rowId) return;

  beginSelection(rowIndex, rowId, colKey, e);
  e.preventDefault();
};

const handleMouseOver = (e, rowIndex, colKey) => {
  const t = e.target;
  const tag = t.tagName?.toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea" || t.isContentEditable) return;

  extendSelection(rowIndex, colKey, e);
};

// --- Focus l’élément éditable (input/textarea/select) à l’intérieur d’un <td> ---
const focusEditableInside = (td) => {
  if (!td) return false;
  const el = td.querySelector('input:not([type="checkbox"]), textarea, select');
  if (!el) return false;

  el.focus();

  // 👉 IMPORTANT: ne plus faire select() (ça cause l'auto-sélection gênante)
  // Place simplement le caret à la fin si c’est un input/textarea texte
  if (("selectionStart" in el) && typeof el.value === "string") {
    const end = el.value.length;
    try { el.setSelectionRange(end, end); } catch {}
  }

  return true;
};


const handleClickCell = (e, rowIndex, colKey) => {
  if (e.button !== undefined && e.button !== 0) return; // sécurité: clic gauche seulement s'il y a button

  // ne pas voler le clic des inputs/select/textarea
  const t = e.target;
  const tag = t.tagName?.toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea" || t.isContentEditable) return;

  // En mode formule, un clic sur une cellule de la même ligne insère la ref
  if (fxSession.active) {
    const rowId = filtered[rowIndex]?.id;
    if (rowId != null && rowIndex === fxSession.rowIndex) {
      const k = colKey;
      const targetCol = colsByKey[k];
      if (isSelectableColumn(targetCol)) {
        ensureRefColorIndex(k);
        const ci = colIndexByKey.get(k) ?? 0;
        setSelectedCell({ rowIndex, colKey: k });
        setActiveCell({ rowIndex, colKey: k });
        setSelAnchor({ rowIndex, colKey: k });
        setSelBox({ rowStart: rowIndex, rowEnd: rowIndex, colStart: ci, colEnd: ci });
        setFxPendingToken(k);
        return;
      }
    }
  }

  const col = colsByKey[colKey];
  if (!isSelectableColumn(col)) return;

  // 👉 Excel-like: un clic = sélectionne la cellule (PAS d’édition)
  const ci = colIndexByKey.get(colKey);
  if (ci == null) return;

  setSelectedCell({ rowIndex, colKey });

  // activeCell + ancre de sélection + rectangle 1x1
  setActiveCell({ rowIndex, colKey });
  setSelAnchor({ rowIndex, colKey });
  setSelBox({ rowStart: rowIndex, rowEnd: rowIndex, colStart: ci, colEnd: ci });

  // vider un éventuel mode édition et reprendre le focus clavier
  setEditing(null);
  wrapRef.current?.focus?.();

  // stop drag précédent
  draggingRef.current = null;

  e.preventDefault();
};

const handleDoubleClickCell = (e, rowIndex, colKey) => {
  const t = e.target;
  const tag = t.tagName?.toLowerCase();

  if (tag === "input" || tag === "select" || tag === "textarea" || t.isContentEditable) {
    return;
  }

  const col = colsByKey[colKey];
  if (!isSelectableColumn(col)) return;

  const ci = colIndexByKey.get(colKey);
  if (ci == null) return;
  setActiveCell({ rowIndex, colKey });
  setSelAnchor({ rowIndex, colKey });
  setSelBox({ rowStart: rowIndex, rowEnd: rowIndex, colStart: ci, colEnd: ci });

  const rowId = filtered[rowIndex]?.id;
  if (!rowId) return;
  startEdit(rowIndex, rowId, colKey);

  if (col.type === "formula") {
    const r = filtered[rowIndex];
    const expr =
      (r?.__cellFormulas?.[colKey] ? `=${r.__cellFormulas[colKey]}`
       : col.formula ? `=${col.formula}`
       : "");
    const refs = parseFxRefs(expr, r).map((ref, i) => ({
      key: ref.key,
      colorIndex: i % FX_COLORS.length,
    }));
    setFxSession({
      active: true,
      rowIndex,
      rowId,
      colKey,
      refs,
    });
    setFxForceDraft(expr || "=");   // ← force l’InputCell à afficher la formule (=…)
    setFxPendingToken(null);
  }

  requestAnimationFrame(() => {
    focusCell(rowIndex, colKey, { edit: true });
  });

  e.preventDefault();
};


  const update = (id, key, value) => {
  // 1) journalisation (si présent chez toi)
  const before = (rows || []).find(r => r.id === id);
  const oldVal = before ? before[key] : undefined;
  if (String(oldVal) !== String(value)) {
    addChange?.(id, key, oldVal, value, currentUser?.name || "Utilisateur");
  }

  // 2) si on modifie la colonne triée, fige le tri pour le prochain render
  if (key === sort?.key) freezeSortOnce?.();

  // 3) applique la saisie + marque la cellule comme "manuelle"
  const changed = (rows || []).map(r => {
    if (r.id !== id) return r;
    return {
      ...r,
      [key]: value,
      __manual: { ...(r.__manual || {}), [key]: true }, // ← important
    };
  });

  // 4) recalcul des formules
  const computed = typeof computeFormulas === "function"
    ? computeFormulas(changed, schema, formulaCtx)
    : changed;

  // 5) préserve les valeurs manuelles après le calcul
  const next = computed.map(nr => {
    const pr = changed.find(p => p.id === nr.id);
    if (!pr?.__manual) return nr;
    const out = { ...nr, __manual: pr.__manual };
    for (const k of Object.keys(pr.__manual)) {
      if (pr.__manual[k]) out[k] = pr[k]; // ← on remet la valeur saisie
    }
    return out;
  });

  // 6) commit
  onRowsChange?.(next);
};


  const addRow = () => {
  // Sélection d’un gabarit sûr pour préremplir (si dispo)
  const hasFiltered = Array.isArray(filtered) && filtered.length > 0;
  const hasRows     = Array.isArray(rows) && rows.length > 0;
  const base        = (hasFiltered ? filtered[filtered.length - 1]
                     : hasRows    ? rows[rows.length - 1]
                                  : {}) || {};

  // 🔒 Produit par défaut forcé UNIQUEMENT via tableKey (pour matcher le filtre MinuteEditor)
  const defaultProduit =
    tableKey === "rideaux" ? "Rideau"
  : tableKey === "decors"  ? "Décor de lit"
  :                          "Store Enrouleur"; // 'stores'

  const newRow = {
    id: uid(),
    produit: defaultProduit,
    // on clone quelques champs utiles pour que la ligne passe d'éventuels filtres locaux
    zone: base.zone ?? "",
    piece: base.piece ?? "",
    type_confection: base.type_confection ?? "",
    pair_un: base.pair_un ?? "",
    l_mecanisme: base.l_mecanisme ?? "",
    largeur: base.largeur ?? "",
    hauteur: base.hauteur ?? "",
    f_bas: base.f_bas ?? "",
    croisement: base.croisement ?? "",
    retour_g: base.retour_g ?? "",
    retour_d: base.retour_d ?? "",
    val_ded_rail: base.val_ded_rail ?? "",
    val_ourlet_cote: base.val_ourlet_cote ?? "",
    val_ourlet_haut: base.val_ourlet_haut ?? "",
  };

  // On pousse UNIQUEMENT la sous-liste (DataTable) ; MinuteEditor fusionnera et recalculera
  const safeRows = Array.isArray(rows) ? rows : [];
  const next = [...safeRows, newRow];
  onRowsChange(next);

  // scroll jusqu'en bas pour rendre la nouvelle ligne visible
  requestAnimationFrame(() => {
    if (wrapRef?.current) {
      wrapRef.current.scrollTop = wrapRef.current.scrollHeight;
    }
  });
};

  const onSaveCol = (key, patch) => {
    setSchema((s) => {
      const idx = s.findIndex((c) => c.key === key);
      if (idx === -1) return s;
      const next = [...s];
      next[idx] = { ...next[idx], ...patch, options: patch.options ?? next[idx].options };
      return next;
    });
  };

  const HeaderSelectAll = ({ all, some, onToggle }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some && !all;
  }, [all, some]);

  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
      <input
        ref={ref}
        type="checkbox"
        checked={all}
        onChange={(e) => onToggle(e.target.checked)}
        aria-checked={some && !all ? "mixed" : all}
      />
      <span>Sélec.</span>
    </label>
  );
};
  const SortLabel = ({ columnKey, children }) => {
    const active = sort.key === columnKey;
    const DirIcon = sort.dir === "asc" ? ChevronUp : ChevronDown;
    return (
      <button
        onClick={() =>
          setSort((s) => ({
            key: columnKey,
            dir: s.key === columnKey && s.dir === "asc" ? "desc" : "asc",
          }))
        }
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
      >
        <span>{children}</span>
        {active && <DirIcon size={14} />}
      </button>
    );
  };

  const AggSelect = ({ col }) => {
  const options = isNumericCol(col) ? AGG_NUMERIC : AGG_NON_NUM;
  const value   = aggByCol?.[col.key] || "none";

  const setVal = (v) => setAggByCol(s => ({ ...(s || {}), [col.key]: v }));

  // petit select compact
  return (
    <select
      value={value}
      onChange={(e) => setVal(e.target.value)}
      title="Agrégat de colonne"
      style={{
        fontSize: 12,
        padding: "2px 6px",
        borderRadius: 6,
        border: `1px solid ${COLORS.border}`,
        background: "#fff",
      }}
    >
      {options.map(o => (
        <option key={o} value={o}>
          {o === "none" ? "Aucune"
           : o === "sum" ? "Somme"
           : o === "avg" ? "Moyenne"
           : o === "filled" ? "Remplies"
           : o === "empty" ? "Vides"
           : o === "unique" ? "Unique"
           : o}
        </option>
      ))}
    </select>
  );
};

  // ==== Étape 6 — Menu d'en-tête façon Airtable ====


// rendu du menu
const HeaderMenu = ({ anchor }) => {
  if (!anchor) return null;
  const k = anchor.key;
  const col = colsByKey[k];
  if (!col) return null;
  const lock = MIN_COLS.includes(k);

  return (
    <>
      {/* backdrop pour clic extérieur */}
      <div
        onClick={closeMenu}
        style={{ position: "fixed", inset: 0, zIndex: 999 }}
      />
      <div
        style={{
          position: "fixed",
          left: anchor.x,
          top: anchor.y,
          width: 280,
          maxHeight: "70vh",
          overflow: "auto",
          background: "#fff",
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          boxShadow: "0 12px 28px rgba(0,0,0,.18)",
          zIndex: 1000
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}`, fontWeight: 700 }}>
          {col.label}
        </div>

        <div style={{ 
  padding: "6px 10px", 
  borderBottom: `1px solid ${COLORS.border}`, 
  fontSize: 12, 
  display: "flex", 
  alignItems: "center", 
  gap: 8 
}}>
  <span style={{ opacity: .7 }}>Clé pour formules :</span>
  <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 6 }}>
    {col.key}
  </code>
  <button
    style={S.smallBtn}
    onClick={async () => { try { await navigator.clipboard.writeText(col.key); } catch {} }}
    title="Copier la clé (à utiliser dans les formules)"
  >
    Copier
  </button>
</div>

        <div style={{ padding: 6, display: "grid", gap: 4 }}>
          <button style={S.smallBtn} onClick={() => { setEditColKey(k); closeMenu(); }}>
            ✏️ Modifier le champ
          </button>
          <button style={S.smallBtn} onClick={() => duplicateField(k)}>
            🧬 Dupliquer le champ
          </button>
          <button style={S.smallBtn} onClick={() => insertLeft(k)}>
            ↩︎ Insérer à gauche
          </button>
          <button style={S.smallBtn} onClick={() => insertRight(k)}>
            ↪︎ Insérer à droite
          </button>

          <div style={{ height: 1, background: COLORS.border, margin: "6px 0" }} />

          <button style={S.smallBtn} onClick={() => sortAsc(k)}>
            🔼 Trier 1 → 9 / A → Z
          </button>
          <button style={S.smallBtn} onClick={() => sortDesc(k)}>
            🔽 Trier 9 → 1 / Z → A
          </button>

          <button style={S.smallBtn} onClick={() => quickFilterNotEmpty(k)}>
            🔎 Filtrer: non vide
          </button>
          <button style={S.smallBtn} onClick={() => groupByThis(k)}>
            🧩 Grouper selon ce champ
          </button>

          <div style={{ height: 1, background: COLORS.border, margin: "6px 0" }} />

          <button style={{ ...S.smallBtn, opacity: lock ? .5 : 1 }} disabled={lock} onClick={() => hideField(k)}>
            🙈 Masquer le champ
          </button>

          <button
  style={{ ...S.smallBtn, color: "#b91c1c", borderColor: COLORS.border, opacity: lock ? .5 : 1 }}
  disabled={lock}
  onClick={() => removeField(k)}
>
  🗑️ Supprimer le champ
</button>

        </div>
      </div>
    </>
  );
};


  const closeMenu = () => setMenu(null);

  // Masquer une colonne (sauf protégées)
  const hideField = (key) => {
    const MIN_COLS = ["sel", "detail"];
    if (MIN_COLS.includes(key)) return; // protégées
    setVisibleCols(cols => cols.filter(k => k !== key));
    closeMenu();
  };

  // Supprimer complètement une colonne du schéma
const removeField = (key) => {
  if (MIN_COLS.includes(key)) return; // sel/detail protégées

  // 1) Retirer du schéma
  setSchema((sc) => sc.filter((c) => c.key !== key));

  // 2) Nettoyer tous les états liés
  setVisibleCols((cols) => (cols || []).filter((k) => k !== key));
  setOrder((ord) => (ord || []).filter((k) => k !== key));
  setFilters((fs) => (fs || []).filter((f) => f.key !== key));
  setGroupBy((g) => (g?.key === key ? null : g));
  setSort((s) => (s.key === key ? { key: firstSortable, dir: "asc" } : s));

  // (optionnel) ne touche pas aux rows : avoir une clé orpheline dans l’objet ne gêne pas,
  // et l’effet sur le parent recalculera les formules avec le nouveau schéma.

  closeMenu();
};

  // Trier asc/desc sur la colonne
  const sortAsc  = (key) => { setSort({ key, dir: "asc"  }); closeMenu(); };
  const sortDesc = (key) => { setSort({ key, dir: "desc" }); closeMenu(); };

  // Créer une entrée de filtre basique selon le type
  const addFilterFor = (key) => {
    const col = colsByKey[key];
    if (!col) return;
    const base =
      col.type === "number"
        ? { key, op: "gte", value: 0 }
        : col.type === "checkbox"
        ? { key, op: "isTrue", value: true }
        : { key, op: "contains", value: "" }; // texte/select par défaut
    setFilters(fs => [...(fs || []), base]);
    closeMenu();
  };

  // Grouper par cette colonne
  const groupByField = (key) => { setGroupBy({ key }); closeMenu(); };

  // Dupliquer un champ dans le schéma (et copier les valeurs)
  const duplicateField = (key) => {
    const src = colsByKey[key];
    if (!src) return;
    // génère une clé unique
    const baseKey = `${src.key}_copy`;
    let k = baseKey, i = 1;
    const keys = new Set(schema.map(c => c.key));
    while (keys.has(k)) { i += 1; k = `${baseKey}_${i}`; }

    const newCol = {
      ...src,
      key: k,
      label: `${src.label} (copie)`,
      readOnly: src.type === "formula" ? true : src.readOnly
    };

    // insérer la colonne juste à droite dans l'ordre courant
    setSchema(sc => {
      const idx = sc.findIndex(c => c.key === key);
      const next = [...sc];
      next.splice(idx + 1, 0, newCol);
      return next;
    });

    // valeurs copiées
    const nextRows = computeFormulas(
      rows.map(r => ({ ...r, [k]: r[key] })),
      schema,
      formulaCtx
    );
    onRowsChange(nextRows);

    // afficher la colonne si elle était masquée
    setVisibleCols(cols => Array.from(new Set([...cols, k])));

    // mémoriser l'ordre (localStorage) si tu utilises `order`
    setOrder(ord => {
      const cur = ord && ord.length ? [...ord] : schema.map(c => c.key);
      const pos = cur.indexOf(key);
      const out = [...cur];
      out.splice(pos + 1, 0, k);
      return out;
    });

    closeMenu();
  };

const insertField = (key, side = "right") => {
    const srcIndex = schema.findIndex(c => c.key === key);
  if (srcIndex < 0) return;

  // colonne vide par défaut (texte)
  const baseKey = "new_field";
  let k = baseKey, i = 1;
  const keys = new Set(schema.map(c => c.key));
  while (keys.has(k)) { i += 1; k = `${baseKey}_${i}`; }

  const newCol = { key: k, label: "Nouveau champ", type: "text", width: 140 };

  setSchema(sc => {
    const next = [...sc];
    const at = side === "left" ? srcIndex : srcIndex + 1;
    next.splice(at, 0, newCol);
    return next;
  });

  // rendre visible + insérer dans l’ordre
  setVisibleCols(cols => Array.from(new Set([...cols, k])));
  setOrder(ord => {
    const cur = ord && ord.length ? [...ord] : schema.map(c => c.key);
    const at = side === "left" ? cur.indexOf(key) : cur.indexOf(key) + 1;
    const out = [...cur];
    out.splice(at, 0, k);
    return out;
  });

  // rows inchangées (valeurs vides)
  onRowsChange(computeFormulas(rows, schema, formulaCtx));
  closeMenu();
};

// Aliases pour compat avec HeaderMenu
 const insertLeft  = (key) => insertField(key, "left");
 const insertRight = (key) => insertField(key, "right");
 const quickFilterNotEmpty = (key) => {
   setFilters((fs) => [...(fs || []), { key, op: "notEmpty" }]);
   closeMenu();
 };
 const groupByThis = (key) => groupByField(key);


  // Copier une « URL » de champ (placeholder local)
  const copyFieldUrl = async (key) => {
    const url = `#/view/${viewKey}/table/${tableKey}/field/${key}`;
    try { await navigator.clipboard.writeText(url); } catch {}
    closeMenu();
  };

  // Ouvrir la modale d’édition (pour description/permissions on réutilise la même)
  const editField = (key) => { setEditColKey(key); closeMenu(); };

  // Masquer via action dédiée
  const hideThisField = (key) => hideField(key);

  if (!cols || cols.length === 0) {
    return (
      <div
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          background: "#fff",
          padding: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <strong>{title || "Tableau"}</strong>
          <button
            style={S.smallBtn}
            onClick={() => {
              try {
                const allKeys = normalizeVisibleCols(schema, schema?.map?.((c) => c.key) || []);
                setVisibleCols(allKeys);
              } catch {
                /* ignore */
              }
            }}
          >
            Réinitialiser les colonnes
          </button>
        </div>
        <div style={{ opacity: 0.7 }}>Aucune colonne visible pour cette vue.</div>
      </div>
    );
  }

  return (
    <div style={{ ...S.tableBlock }}>
      <div style={S.tableHeader}>
        <div style={S.tableTitle}>{title}</div>
        <div style={S.tableRight}>
  {/* + Ajouter */}
  <button style={S.smallBtn} title="Ajouter" onClick={addRow}>
    <Plus size={16} />
  </button>

  {/* 🗑️ Supprimer les lignes sélectionnées — À AJOUTER ICI */}
  <button
    style={S.smallBtn}
    title="Supprimer les lignes sélectionnées"
    onClick={deleteSelected}
    disabled={selectedRowIds.size === 0}
  >
    <X size={16} /> Supprimer
  </button>

{/* Filtres */}
  <div style={{ position: "relative", display: "inline-block" }}>
    <button
      style={S.smallBtn}
      title="Filtres"
      onClick={() => setShowFilters(s => !s)}
    >
      <Filter size={16} />
    </button>
    {showFilters && (
      <FilterPanel
        filters={filters}
        setFilters={setFilters}
        schema={schema}
        onClose={() => setShowFilters(false)}
      />
    )}
  </div>

  {/* Regrouper */}
<div style={{ position:"relative" }}>
  <select
    style={S.smallBtn}
    title="Grouper par"
    value={groupBy?.key || ""}
    onChange={(e)=> setGroupBy(e.target.value ? { key: e.target.value } : null)}
  >
    <option value="">— Aucun groupe —</option>
    {cols.filter(c=>c.key!=="sel" && c.key!=="detail").map(c=>(
      <option key={c.key} value={c.key}>{c.label}</option>
    ))}
  </select>
  {groupBy?.key && (
    <button style={S.smallBtn} onClick={()=>setGroupBy(null)}>Annuler le groupe</button>
  )}
</div>

  {/* Favoris */}
  <button style={S.smallBtn} title="Favoris">
    <Star size={16} />
  </button>

  {/* Colonnes */}
  <div style={{ position: "relative" }}>
    <button style={S.smallBtn} title="Colonnes" onClick={() => setShowCols((s) => !s)}>
      <Settings2 size={16} />
    </button>
    {showCols && (
      <ColumnPicker
        visibleCols={visibleCols}
        setVisibleCols={setVisibleCols}
        schema={schema}
        onClose={() => setShowCols(false)}
      />
    )}
  </div>
  <button
  style={{
    ...S.smallBtn,
    background: debugKeys ? "#2563eb" : "#f3f4f6",
    color: debugKeys ? "#fff" : "#111",
  }}
  onClick={() => setDebugKeys(d => !d)}
  title="Afficher les infos de debug (cellule active/sélection, etc.)"
>
  🐞 Debug
</button>

</div>
      </div>

      <div
  ref={wrapRef}
  tabIndex={0}
  onKeyDown={handleKeyDown}
  onCopy={handleCopy}
  onPaste={handlePaste}
  onClick={() => {
    try {
      wrapRef.current?.focus?.({ preventScroll: true });
    } catch {
      wrapRef.current?.focus?.();
    }
  }}
  style={{ ...S.tableWrap, userSelect: draggingRef.current ? "none" : "auto" }}
  onMouseDownCapture={(e) => {
    // Si on clique sur un vrai champ, on laisse faire.
    const t = e.target;
    const tag = t?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;

    // Si une cellule est en édition, empêche le clic "de transition"
    // de voler le focus avant que l’input ait le temps de blur/commit.
    if (editing) e.preventDefault();
  }}
>
  {/* Bannière info formules par cellule */}
  {enableCellFormulas && (
    <div
      style={{
        margin: "8px 0 10px",
        padding: "8px 10px",
        borderRadius: 8,
        border: "1px dashed #e5e7eb",
        background: "#fffbea",
        fontSize: 12,
        display: "flex",
        alignItems: "center",
        gap: 8
      }}
    >
      <span style={{ fontWeight: 700 }}>✨ Formules par cellule activées</span>
      <span style={{ opacity: 0.85 }}>
        Tapez <code>=…</code> dans une cellule pour définir une formule personnalisée.  
        Cliquez sur <b>⟲</b> dans la cellule pour revenir au calcul de colonne.
      </span>
    </div>
  )}

  <table style={{ ...S.table, ...(TABLE_DENSITY.compact?.table || {}), minWidth: totalMinWidth }}>
    <thead>
  <tr>
    {cols.map((c, i) => {
      const isSticky = leftOffsets[c.key] !== undefined;
      const stickyStyle = isSticky
        ? { position: "sticky", left: leftOffsets[c.key], zIndex: 3, background: "#fff" }
        : {};

      return (
        <th
          key={c.key}
          style={{
            ...S.th,
            minWidth: c.width || 120,
            position: "relative",
            ...stickyStyle,
            cursor: canDragKey(c.key) ? "grab" : "default",
            opacity: dragColKey === c.key ? 0.6 : 1,
          }}

          /* ==== Drag & Drop (Airtable-like) ==== */
          draggable={canDragKey(c.key)}
          onDragStart={(e) => handleDragStart(e, c.key)}
          onDragOver={(e) => handleDragOver(e, i)}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}

          /* ==== Menu contextuel existant ==== */
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu({ key: c.key, x: e.clientX, y: e.clientY });
          }}
        >
          {/* Barre d’insertion visuelle */}
          {dropIdx != null && (
            <>
              {dropIdx === i && (
                <div
                  style={{
                    position: "absolute",
                    left: -2,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    background: "#2563eb",
                  }}
                />
              )}
              {dropIdx === i + 1 && (
                <div
                  style={{
                    position: "absolute",
                    right: -2,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    background: "#2563eb",
                  }}
                />
              )}
            </>
          )}

          {/* Contenu d’en-tête inchangé */}
          <div style={S.thHead}>
            {c.key === "sel" ? (
              <HeaderSelectAll
                all={allVisibleSelected}
                some={someVisibleSelected}
                onToggle={toggleSelectAllVisible}
              />
            ) : (
              <>
                <SortLabel columnKey={c.key}>{c.label}</SortLabel>
                <button
                  title="Modifier le champ"
                  onClick={() => setEditColKey(c.key)}
                  style={{ border: "none", background: "transparent", cursor: "pointer" }}
                >
                  <Edit3 size={14} />
                </button>
                <button
                  title="Menu"
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    setMenu({ key: c.key, x: r.left, y: r.bottom });
                  }}
                  style={{ border: "none", background: "transparent", cursor: "pointer" }}
                >
                  <MoreVertical size={16} />
                </button>
              </>
            )}
          </div>
        </th>
      );
    })}
  </tr>
</thead>
          <tbody>
  {!groupBy?.key ? (
    /* ========= Rendu PLAT ========= */
    filtered.map((r, rowIndex) => (
      <tr key={r.id} style={rowIndex % 2 ? S.trAlt : undefined}>
        {cols.map((c) => {
          const isHL = isFxHighlighted(rowIndex, c.key);
          const colr = isHL ? refColorOf(c.key) : null;
          const stickyStyles = isSticky(c.key)
            ? {
                position: "sticky",
                left: leftOffsets[c.key],
                zIndex: 3,
                background: "#fff",
              }
            : {};
          const isCellSelected = isSelected(rowIndex, c.key);
          const selectionShadow = isCellSelected
            ? `inset 0 0 0 1px ${debugKeys ? "#10b98133" : "#2563eb22"}`
            : undefined;
          const highlightShadow = isHL && colr ? `inset 0 0 0 2px ${colr.stroke}` : undefined;
          const boxShadow = [selectionShadow, highlightShadow].filter(Boolean).join(", ") || undefined;

          return (
            <td
              key={c.key}
              ref={(el) => setTdRef(rowIndex, c.key, el)}
              tabIndex={-1}
              data-row={rowIndex}
              data-col={c.key}
              style={{
                ...(S.td || {}),
                ...stickyStyles,
                ...(isCellSelected
                  ? {
                      outline: debugKeys ? "2px solid #10b981" : "2px solid #2563eb",
                      outlineOffset: -2,
                    }
                  : {}),
                padding: 8,
                borderBottom: "1px solid " + COLORS.border,
                position: "relative",
                // surlignage quand la cellule est référencée par la formule en cours
                boxShadow,
                background: isHL && colr ? colr.fill || undefined : undefined,
              }}
              onMouseDown={(e) => handleMouseDown(e, rowIndex, c.key)}
              onMouseOver={(e) => handleMouseOver(e, rowIndex, c.key)}
              onDoubleClick={(e) => handleDoubleClickCell(e, rowIndex, c.key)}
              onClick={(e) => handleClickCell(e, rowIndex, c.key)}
            >
            {c.key === "detail" ? (
              <button style={S.smallBtn} onClick={() => setDetailRow(r)}>
                Ouvrir <ChevronRight size={14} />
              </button>
            ) : c.key === "sel" ? (
              <input
                type="checkbox"
                checked={!!r.sel}
                onChange={(e) => update(r.id, "sel", e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <InputCell
                  row={r}
                  col={c}
                  isEditing={isCellEditing(r.id, c.key)}
                  onStartEdit={() => startEdit(rowIndex, r.id, c.key)}
                  onEndEdit={stopEdit}
                  onChange={(key, value) => handleCellChange(r.id, key, value)}
                  onOpenLightbox={(imgs, idx) => setLightbox({ images: imgs, index: idx })}
                  onEnter={(shift) => handleFieldEnter(r.id, c.key, { shift })}
                  liveRecalc={false}
                  formulaCtx={formulaCtx}
                  fxSessionActive={
                    fxSession.active && fxSession.rowId === r.id && fxSession.colKey === c.key
                  }
                  fxForceDraft={fxForceDraft}
                  fxPendingToken={fxPendingToken}
                  onFxConsumeToken={() => setFxPendingToken(null)}
                  onFxStop={clearFxSession}
                />

                {/* Reset cell formula button */}
                {enableCellFormulas &&
                  isCellOverridden(r, c.key) &&
                  !isCellEditing(r.id, c.key) && (
                    <button
                      type="button"
                      title="Réinitialiser la cellule (retirer la formule personnalisée)"
                      onClick={(e) => {
                        e.stopPropagation();
                        resetCellFormula(r.id, c.key);
                      }}
                      style={{
                        position: "absolute",
                        top: 2,
                        right: 2,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                        borderRadius: 6,
                        fontSize: 12,
                        lineHeight: 1,
                        padding: "2px 6px",
                        cursor: "pointer",
                        opacity: 0.85,
                      }}
                    >
                      ⟲
                    </button>
                  )}
              </>
            )}
          </td>
          );
        })}
      </tr>
    ))
  ) : (
    /* ========= Rendu GROUPÉ ========= */
    groups.map(([gv, rowsIn], gi) => {
      const isCol = !!collapsed[String(gv)];
      const count = rowsIn.length;
      return (
        <React.Fragment key={`grp_${gv}_${gi}`}>
          <tr style={{ background: "#fafafa" }}>
            <td colSpan={cols.length} style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>
              <button
                onClick={() => toggleGroup(gv)}
                style={{ ...S.smallBtn, marginRight: 8 }}
                title={isCol ? "Déplier" : "Replier"}
              >
                {isCol ? "▶" : "▼"}
              </button>
              <b>{String(gv) || "(sans valeur)"}</b>
              <span style={{ opacity: 0.6, marginLeft: 6 }}>— {count} ligne(s)</span>
            </td>
          </tr>

          {!isCol &&
            rowsIn.map((r) => {
              const absIdx = rowIndexById.get(r.id) ?? 0;
              return (
                <tr key={r.id}>
                  {cols.map((c) => {
                    const fxRef = fxSession.refs.find((ref) => ref.key === c.key);
                    const fxColor = fxRef ? FX_COLORS[fxRef.colorIndex % FX_COLORS.length] : null;
                    return (
                    <td
                      key={c.key}
                      data-row={absIdx}
                      data-col={c.key}
                      ref={(el) => setTdRef(absIdx, c.key, el)}
                      onMouseDown={(e) => handleMouseDown(e, absIdx, c.key)}
                      onMouseOver={(e) => handleMouseOver(e, absIdx, c.key)}
                      onClick={(e) => handleClickCell(e, absIdx, c.key)}
                      onDoubleClick={(e) => {
  e.preventDefault();
  e.stopPropagation();
  const rowId = r.id;
  startEdit(absIdx, rowId, c.key); // ⬅️ on force l’édition
}}
                      style={{
                        ...S.td,
                        ...(isSticky(c.key)
  ? {
      position: "sticky",
      left: leftOffsets[c.key],
      zIndex: 3,
      background: "#fff",
    }
  : {}),
                        ...(isSelected(absIdx, c.key)
                          ? {
      outline: debugKeys ? "2px solid #10b981" : "2px solid #2563eb",
      outlineOffset: -2,
      boxShadow: `inset 0 0 0 1px ${debugKeys ? "#10b98133" : "#2563eb22"}`,
    }
  : {}),
                        ...(isFxHighlighted(absIdx, c.key) && fxColor
                          ? {
                              boxShadow: `inset 0 0 0 2px ${fxColor.stroke}55`,
                              background: fxColor.fill,
                            }
                          : {}),
                      }}
                    >
                      {c.key === "detail" ? (
                        <button style={S.smallBtn} onClick={() => setDetailRow(r)}>
                          Ouvrir <ChevronRight size={14} />
                        </button>
                      ) : c.key === "sel" ? (
                        <input
                          type="checkbox"
                          checked={!!r.sel}
                          onChange={(e) => update(r.id, "sel", e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div style={{ position: "relative" }}>
                          <InputCell
                            row={r}
                            col={c}
                            isEditing={isCellEditing(r.id, c.key)}
                            onStartEdit={() => startEdit(absIdx, r.id, c.key)}
                            onEndEdit={() => stopEdit()}
                            onChange={(k, v) => handleCellChange(r.id, k, v)}
                            liveRecalc={true}   // ⬅️ active le recalcul pendant saisie (debounced)
                            formulaCtx={formulaCtx}
                            fxSessionActive={
                              fxSession.active &&
                              fxSession.rowId === r.id &&
                              fxSession.colKey === c.key
                            }
                            fxForceDraft={
                              fxSession.active && fxSession.rowId === r.id && fxSession.colKey === c.key
                                ? fxForceDraft
                                : null
                            }
                            fxPendingToken={
                              fxSession.active && fxSession.rowId === r.id && fxSession.colKey === c.key
                                ? fxPendingToken
                                : null
                            }
                            onFxConsumeToken={() => setFxPendingToken(null)}
                            onFxStop={clearFxSession}
                            onOpenLightbox={(images, startIndex = 0) => {
                              if (!Array.isArray(images) || images.length === 0) return;
                              setLightbox({ images, index: startIndex });
                            }}
                            onEnter={(shift) => {
                              stopEdit();
                              handleFieldEnter(r.id, c.key, { shift });
                            }}
                          />

                          {/* Reset cell formula button */}
                          {enableCellFormulas &&
                            isCellOverridden(r, c.key) &&
                            !isCellEditing(r.id, c.key) && (
                              <button
                                type="button"
                                title="Réinitialiser la cellule (retirer la formule personnalisée)"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  resetCellFormula(r.id, c.key);
                                }}
                                style={{
                                  position: "absolute",
                                  top: 2,
                                  right: 2,
                                  border: "1px solid #e5e7eb",
                                  background: "#fff",
                                  borderRadius: 6,
                                  fontSize: 12,
                                  lineHeight: 1,
                                  padding: "2px 6px",
                                  cursor: "pointer",
                                  opacity: 0.85,
                                }}
                              >
                                ⟲
                              </button>
                            )}
                        </div>
                      )}
                    </td>
                    );
                  })}
                </tr>
              );
            })}
        </React.Fragment>
      );
    })
  )}
</tbody>
<tfoot>
  <tr>
    {cols.map((c) => (
      <td
        key={c.key}
        style={{
          ...S.td,
          position: leftOffsets[c.key] !== undefined ? "sticky" : undefined,
          left: leftOffsets[c.key],
          zIndex: leftOffsets[c.key] !== undefined ? 1 : undefined,
          background: "#fafafa",
          borderTop: `1px solid ${COLORS.border}`,
          // un peu de style “footer”
          fontSize: 12,
          color: "#111827",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ opacity: footerAggValues[c.key] ? 1 : .55 }}>
            {footerAggValues[c.key] || "—"}
          </div>
          {/* pas d’agrégat pour les colonnes protégées si tu veux */}
          {!["detail"].includes(c.key) && (
            <AggSelect col={c} />
          )}
        </div>
      </td>
    ))}
  </tr>
</tfoot>
        </table>
      </div>
      {debugKeys && (
  <div style={{ 
    marginTop: 8, 
    padding: 8, 
    border: `1px dashed ${COLORS.border}`, 
    borderRadius: 8, 
    background: "#fafafa", 
    fontSize: 12, 
    lineHeight: 1.5 
  }}>
    <div><b>Cellule sélectionnée</b> : {selectedCell ? `${selectedCell.rowIndex} :: ${selectedCell.colKey}` : "(aucune)"}</div>
    <div><b>Cellule active</b> : {activeCell ? `${activeCell.rowIndex} :: ${activeCell.colKey}` : "(aucune)"}</div>
    <div>
      <b>Rectangle sélectionné</b> :{" "}
      {selBox
        ? `rows ${selBox.rowStart} → ${selBox.rowEnd}, cols ${selBox.colStart} → ${selBox.colEnd}`
        : "(aucun)"}
    </div>
    <div><b>Tri</b> : {sort.key} ({sort.dir})</div>
    <div><b>Groupe</b> : {groupBy?.key || "—"}</div>
    <div><b>Filtres</b> : {filters?.length ? JSON.stringify(filters) : "—"}</div>
    <div><b>Colonnes visibles</b> : {Array.isArray(visibleCols) ? visibleCols.join(", ") : "—"}</div>
  </div>
)}
      {detailRow && (
        <RowFormModal
          row={detailRow}
          schema={schema}
          onClose={() => setDetailRow(null)}
          onSave={(val) => {
            const next = computeFormulas(
              rows.map((r) => (r.id === val.id ? val : r)),
              schema,
              formulaCtx
            );
            onRowsChange(next);
          }}
          visibleKeys={cols.map(c => c.key)}
        />
      )}

      {detailRow && (
  <ActivitySidebar
    row={detailRow}
    onClose={() => setDetailRow(null)}
  />
)}

      {editColKey && (
        <EditFieldModal
          col={colsByKey[editColKey]}
          onClose={() => setEditColKey(null)}
          onSave={(patch) => onSaveCol(editColKey, patch)}
        />
      )}
      {lightbox && (
        <LightboxModal
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onPrev={() => {
            setLightbox((lb) => ({
              ...lb,
              index: (lb.index - 1 + lb.images.length) % lb.images.length
            }))
          }}
          onNext={() => {
            setLightbox((lb) => ({
              ...lb,
              index: (lb.index + 1) % lb.images.length
            }))
          }}
        />
      )}

        {menu && <HeaderMenu anchor={menu} />}
  </div>
);
}

export default DataTable;
