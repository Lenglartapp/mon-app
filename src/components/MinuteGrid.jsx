// src/components/MinuteGrid.jsx
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import { schemaToGridCols } from '../lib/utils/schemaToGridCols.jsx';
import { recomputeRow } from '../lib/formulas/recomputeRow';
import { generateRowLogs } from '../lib/utils/logUtils';
import { uid } from '../lib/utils/uid';
import { Plus, Trash2, Columns } from 'lucide-react';

const STORAGE_PREFIX = 'ag_grid_state_v1_';
const GRID_STATE_VERSION = 5; // à incrémenter si le calcul des largeurs change


const AG_GRID_LOCALE_FR = {
    // Filtres — conditions
    contains: 'Contient',
    notContains: 'Ne contient pas',
    equals: 'Égal à',
    notEqual: 'Différent de',
    startsWith: 'Commence par',
    endsWith: 'Se termine par',
    blank: 'Vide',
    notBlank: 'Non vide',
    // Nombres
    lessThan: 'Inférieur à',
    greaterThan: 'Supérieur à',
    lessThanOrEqual: 'Inférieur ou égal à',
    greaterThanOrEqual: 'Supérieur ou égal à',
    inRange: 'Entre',
    inRangeStart: 'De',
    inRangeEnd: 'À',
    // Dates
    dateFormatOoo: 'dd/mm/yyyy',
    // Opérateurs logiques
    andCondition: 'ET',
    orCondition: 'OU',
    // Boutons
    filterOoo: 'Filtrer...',
    applyFilter: 'Appliquer',
    resetFilter: 'Réinitialiser',
    clearFilter: 'Effacer',
    cancelFilter: 'Annuler',
    // En-tête menu
    filter: 'Filtre',
    columns: 'Colonnes',
    // Divers
    noRowsToShow: 'Aucune ligne à afficher',
    loadingOoo: 'Chargement...',
    // Tri
    sortAscending: 'Tri croissant',
    sortDescending: 'Tri décroissant',
    sortUnSort: 'Annuler le tri',
    // Sélection
    selectAll: 'Tout sélectionner',
    selectAllSearchResults: 'Sélectionner tous les résultats',
    searchOoo: 'Rechercher...',
    // Pagination
    page: 'Page',
    more: 'Plus',
    to: 'à',
    of: 'sur',
    next: 'Suivant',
    last: 'Dernier',
    first: 'Premier',
    previous: 'Précédent',
    // Agrégations
    sum: 'Somme',
    min: 'Min',
    max: 'Max',
    avg: 'Moyenne',
    count: 'Nombre',
};

// ─── Ligne de totaux interactive (style Excel) ──────────────────────────────

const AGG_OPTIONS = [
    { value: 'none',  label: 'Aucun'     },
    { value: 'sum',   label: 'Σ  Somme'   },
    { value: 'avg',   label: 'ø  Moyenne' },
    { value: 'min',   label: '↓  Min'     },
    { value: 'max',   label: '↑  Max'     },
    { value: 'count', label: '#  Nombre'  },
];

const NON_NUMERIC_TYPES = new Set(['photo', 'croquis', 'checkbox', 'select', 'singleSelect', 'button', 'date', 'datetime']);

function computeAgg(rawValues, type) {
    const nums = rawValues.map(v => Number(v)).filter(n => !isNaN(n) && isFinite(n));
    if (nums.length === 0 || type === 'none') return null;
    let result;
    switch (type) {
        case 'sum':   result = nums.reduce((a, b) => a + b, 0); break;
        case 'avg':   result = nums.reduce((a, b) => a + b, 0) / nums.length; break;
        case 'min':   result = Math.min(...nums); break;
        case 'max':   result = Math.max(...nums); break;
        case 'count': return nums.length;
        default:      return null;
    }
    // Arrondi à 1 décimale
    return Math.round(result * 10) / 10;
}



// CSS custom pour le thème AG Grid
const AG_CUSTOM_CSS = `
.ag-theme-alpine .ag-header-cell-label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}
.ag-theme-alpine .ag-header {
  background-color: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}
.ag-theme-alpine .ag-header-cell {
  border-right: 1px solid #e5e7eb;
}
.ag-theme-alpine .ag-cell {
  font-size: 13px;
  color: #111827;
  border-right: 1px solid #f3f4f6;
  display: flex;
  align-items: center;
}
.ag-theme-alpine .ag-row-even {
  background-color: #ffffff;
}
.ag-theme-alpine .ag-row-odd {
  background-color: #fafafa;
}
.ag-theme-alpine .ag-row-hover {
  background-color: #eff6ff !important;
}
.ag-theme-alpine .ag-row-selected {
  background-color: #dbeafe !important;
}
.ag-theme-alpine .ag-row-pinned .ag-cell {
  cursor: pointer;
  font-weight: 600;
  color: #065f46;
}
.ag-cell-read-only {
  background-color: #f3f4f6 !important;
  color: #9ca3af !important;
  cursor: not-allowed;
}
.ag-theme-alpine .ag-checkbox-cell {
  display: flex;
  align-items: center;
  justify-content: center;
}
`;

// Injecter le CSS une seule fois
if (typeof document !== 'undefined' && !document.getElementById('ag-custom-styles')) {
    const style = document.createElement('style');
    style.id = 'ag-custom-styles';
    style.textContent = AG_CUSTOM_CSS;
    document.head.appendChild(style);
}

function MinuteGrid({
    rows,
    onRowsChange,
    schema,
    enableCellFormulas = true,
    formulaCtx = {},
    title,
    catalog = [],
    railOptions = [],
    onAdd,
    initialVisibilityModel = {},
    onDuplicateRow,
    hideCroquis = false,
    minuteId,
    projectId,
    onRowClick,
    readOnly = false,
    currentUser,
    isMobile = false,
    gridKey,
}) {
    const gridRef = useRef(null);
    const [selectedCount, setSelectedCount] = useState(0);
    const [colPanelOpen, setColPanelOpen] = useState(false);
    const [colVisibility, setColVisibility] = useState({});
    const [quickFilter, setQuickFilter] = useState('');
    const [colAggregations, setColAggregations] = useState({});
    const [aggMenu, setAggMenu] = useState(null); // { field, x, y }
    const [resizeInfo, setResizeInfo] = useState(null); // { name, width }
    const rowsRef = useRef(rows);
    rowsRef.current = rows;
    // Ref pour éviter le stale closure sur onRowsChange (arePropsEqual bloque le re-render
    // quand seul onRowsChange change, donc useCallback ne se met pas à jour)
    const onRowsChangeRef = useRef(onRowsChange);
    onRowsChangeRef.current = onRowsChange;

    // ID unique pour la persistance des colonnes
    const gridId = useMemo(() => {
        if (gridKey) return `${STORAGE_PREFIX}${gridKey}`;
        if (projectId) return `${STORAGE_PREFIX}prod_${projectId}_${title || 'grid'}`;
        if (minuteId) return `${STORAGE_PREFIX}minute_${minuteId}_${title || 'grid'}`;
        return `${STORAGE_PREFIX}${title || 'default'}`;
    }, [gridKey, projectId, minuteId, title]);

    // Persistance : restauration au démarrage
    // Les largeurs viennent de columnDefs (baked depuis schema + _widths localStorage).
    // On restaure ici uniquement l'ordre. La visibilité est toujours pilotée par
    // initialVisibilityModel (prioritaire) ou le localStorage si pas de modèle défini.
    const onGridReady = useCallback((params) => {
        const hasVisibilityModel = initialVisibilityModel && Object.keys(initialVisibilityModel).length > 0;

        try {
            const saved = localStorage.getItem(gridId);
            if (saved) {
                const { columnState, v } = JSON.parse(saved);
                if (columnState && v === GRID_STATE_VERSION) {
                    if (hasVisibilityModel) {
                        // Restaurer uniquement l'ordre des colonnes, pas la visibilité
                        params.api.applyColumnState({
                            state: columnState.map(cs => ({ colId: cs.colId, pinned: cs.pinned })),
                            applyOrder: true,
                        });
                    } else {
                        // Pas de modèle imposé : restaurer ordre + visibilité depuis localStorage
                        params.api.applyColumnState({
                            state: columnState.map(cs => ({ colId: cs.colId, hide: cs.hide, pinned: cs.pinned })),
                            applyOrder: true,
                        });
                        const visMap = {};
                        columnState.forEach(cs => { if (cs.colId) visMap[cs.colId] = !cs.hide; });
                        setColVisibility(visMap);
                        return;
                    }
                }
            }
        } catch (_) { /* ignore */ }

        if (hasVisibilityModel) {
            const stateToApply = Object.entries(initialVisibilityModel)
                .filter(([, visible]) => !visible)
                .map(([field]) => ({ colId: field, hide: true }));
            if (stateToApply.length > 0) {
                params.api.applyColumnState({ state: stateToApply });
            }
            setColVisibility(initialVisibilityModel);
        }
    }, [gridId, initialVisibilityModel]);

    // Charger les agrégations sauvegardées
    useEffect(() => {
        try {
            const saved = localStorage.getItem(`${gridId}_agg`);
            if (saved) setColAggregations(JSON.parse(saved));
        } catch { /* ignore */ }
    }, [gridId]);

    const onPinnedCellClicked = useCallback((params) => {
        if (params.node.rowPinned !== 'bottom') return;
        const field = params.colDef?.field;
        if (!field) return;
        const schemaCol = schema.find(s => s.key === field);
        if (!schemaCol) return;
        if (NON_NUMERIC_TYPES.has(schemaCol.type) || field === 'detail' || field === 'sel') return;
        // Position du menu : juste sous la cellule cliquée
        const cellEl = params.event?.target?.closest('[comp-id]') || params.event?.target;
        const rect = cellEl?.getBoundingClientRect?.();
        const x = rect ? rect.left : params.event.clientX;
        const y = rect ? rect.bottom + 4 : params.event.clientY + 4;
        setAggMenu({ field, x, y });
    }, [schema]);

    const onAggregationChange = useCallback((field, aggType) => {
        setColAggregations(prev => {
            const next = { ...prev, [field]: aggType };
            try { localStorage.setItem(`${gridId}_agg`, JSON.stringify(next)); } catch { /* ignore */ }
            return next;
        });
    }, [gridId]);

    // Persistance : sauvegarde
    const saveColumnState = useCallback((api) => {
        try {
            const columnState = api.getColumnState();
            localStorage.setItem(gridId, JSON.stringify({ columnState, v: GRID_STATE_VERSION }));
        } catch (_) { /* ignore */ }
    }, [gridId]);

    const onColumnResized = useCallback((params) => {
        if (!params.column) return;
        const width = Math.round(params.column.getActualWidth());
        const name = params.column.getColDef().headerName || params.column.getColId();
        setResizeInfo(params.finished ? null : { name, width });
        if (params.finished) {
            // Sauvegarder le override de largeur séparément (clé _widths)
            const colId = params.column.getColId();
            try {
                const current = JSON.parse(localStorage.getItem(`${gridId}_widths`) || '{}');
                current[colId] = width;
                localStorage.setItem(`${gridId}_widths`, JSON.stringify(current));
            } catch { /* ignore */ }
            saveColumnState(params.api);
        }
    }, [gridId, saveColumnState]);

    const onColumnVisible = useCallback((params) => {
        saveColumnState(params.api);
    }, [saveColumnState]);

    const onColumnMoved = useCallback((params) => {
        if (params.finished) saveColumnState(params.api);
    }, [saveColumnState]);

    // Ouvrir le panneau de détail
    const handleOpenDetail = useCallback((row) => {
        if (onRowClick) onRowClick(row.id);
    }, [onRowClick]);

    // Upload photo
    const handlePhotoChange = useCallback((id, field, value) => {
        const newRows = rowsRef.current.map(r => r.id === id ? { ...r, [field]: value } : r);
        onRowsChange(newRows);
    }, [onRowsChange]);

    // Ajouter une ligne
    const handleAddRow = useCallback(() => {
        if (onAdd) { onAdd(); return; }
        const newRow = { id: uid(), ...Object.fromEntries(schema.map(col => [col.key, ''])) };
        onRowsChange([...rowsRef.current, newRow]);
    }, [onRowsChange, schema, onAdd]);

    // Supprimer les lignes sélectionnées
    const handleDeleteRows = useCallback(() => {
        const api = gridRef.current?.api;
        if (!api) return;
        const selectedIds = new Set(api.getSelectedRows().map(r => r.id));
        const newRows = rowsRef.current.filter(r => !selectedIds.has(r.id));
        onRowsChange(newRows);
        setSelectedCount(0);
    }, [onRowsChange]);

    const onSelectionChanged = useCallback((params) => {
        setSelectedCount(params.api.getSelectedRows().length);
    }, []);

    // Panneau de visibilité des colonnes
    const handleToggleColPanel = useCallback(() => {
        const api = gridRef.current?.api;
        if (!api) return;
        if (!colPanelOpen) {
            const vis = {};
            api.getColumns()?.forEach(col => {
                const id = col.getColId();
                if (id && col.getColDef().field) {
                    vis[id] = col.isVisible();
                }
            });
            setColVisibility(vis);
        }
        setColPanelOpen(prev => !prev);
    }, [colPanelOpen]);

    const handleToggleColumn = useCallback((colId, visible) => {
        const api = gridRef.current?.api;
        if (!api) return;
        api.setColumnsVisible([colId], visible);
        saveColumnState(api);
        setColVisibility(prev => ({ ...prev, [colId]: visible }));
    }, [saveColumnState]);

    // Définitions des colonnes
    // Les largeurs sont baked directement dans les colDefs depuis le schéma + overrides _widths.
    // Cela évite tout problème de timing avec initialWidth / applyColumnState.
    const columnDefs = useMemo(() => {
        let savedWidths = {};
        try {
            savedWidths = JSON.parse(localStorage.getItem(`${gridId}_widths`) || '{}');
        } catch { /* ignore */ }

        const cols = schemaToGridCols(
            schema, enableCellFormulas, handleOpenDetail,
            catalog, railOptions, handlePhotoChange,
            onDuplicateRow, hideCroquis, readOnly, title
        );

        const withWidths = cols.map(col => {
            const schemaWidth = col.initialWidth ?? col.width ?? 120;
            const w = savedWidths[col.field] ?? schemaWidth;
            return { ...col, width: w, initialWidth: undefined };
        });

        if (isMobile) {
            const mobileKeys = ['piece', 'produit', 'statut_cotes', 'statut_prepa', 'statut_conf', 'statut_pose', 'detail'];
            return withWidths.filter(c => mobileKeys.includes(c.field) || c.checkboxSelection);
        }

        return withWidths;
    }, [schema, enableCellFormulas, handleOpenDetail, catalog, railOptions, handlePhotoChange, onDuplicateRow, hideCroquis, readOnly, title, isMobile, gridId]);

    const defaultColDef = useMemo(() => ({
        resizable: true,
        sortable: true,
        filter: true,
        minWidth: 60,
    }), []);

    // ─────────────────────────────────────────────────────────────────────────
    // onCellValueChanged — remplace processRowUpdate de MUI DataGrid
    //
    // IMPORTANT : on n'appelle PAS node.setData() ici.
    // On laisse React gérer la mise à jour via la prop rowData.
    // Cela évite la race condition qui faisait revenir les valeurs à l'ancienne.
    // ─────────────────────────────────────────────────────────────────────────

    const onCellValueChanged = useCallback((params) => {
        const changedKey = params.colDef.field;
        const oldVal = params.oldValue;
        const newVal = params.newValue;


        // Avec getRowId, AG Grid ne mute PAS params.data — la nouvelle valeur est dans params.newValue.
        const oldRow = { ...params.data, [changedKey]: oldVal };
        let updatedRow = { ...params.data, [changedKey]: newVal };

        const cellFx = { ...(oldRow.__cellFormulas || {}) };
        let hasOverride = false;

        // 1. Catalog auto-fill
        const isCatalogColumn = changedKey && (
            changedKey.includes('tissu') ||
            changedKey.includes('doublure') ||
            changedKey.includes('passementerie') ||
            changedKey === 'produit' ||
            changedKey === 'modele_mecanisme' ||
            changedKey === 'toile_finition_1'
        );

        if (isCatalogColumn) {
            const articleName = updatedRow[changedKey];
            const article = catalog.find(a => a.name === articleName);
            if (article) {
                const mapping = {};
                if (changedKey === 'tissu_deco1') {
                    mapping.laize = 'laize_tissu1'; mapping.rv = 'raccord_v_tissu1'; mapping.rh = 'raccord_h_tissu1'; mapping.pa = 'pa_tissu1'; mapping.pv = 'pv_tissu1';
                } else if (changedKey === 'tissu_deco2') {
                    mapping.laize = 'laize_tissu2'; mapping.rv = 'raccord_v_tissu2'; mapping.rh = 'raccord_h_tissu2'; mapping.pa = 'pa_tissu2'; mapping.pv = 'pv_tissu2';
                } else if (changedKey === 'tissu_1') {
                    mapping.laize = 'laize_tissu_1'; mapping.pa = 'pa_tissu_1'; mapping.pv = 'pv_tissu_1';
                } else if (changedKey === 'tissu_2') {
                    mapping.laize = 'laize_tissu_2'; mapping.pa = 'pa_tissu_2'; mapping.pv = 'pv_tissu_2';
                } else if (changedKey === 'toile_finition_1') {
                    mapping.laize = 'laize_toile_finition_1'; mapping.rv = 'raccord_v_toile_finition_1'; mapping.rh = 'raccord_h_toile_finition_1'; mapping.pa = 'pa_toile_finition_1'; mapping.pv = 'pv_toile_finition_1';
                } else if (changedKey === 'doublure') {
                    mapping.laize = 'laize_doublure'; mapping.pa = 'pa_doublure'; mapping.pv = 'pv_doublure';
                } else if (changedKey === 'interdoublure') {
                    mapping.laize = 'laize_interdoublure'; mapping.pa = 'pa_interdoublure'; mapping.pv = 'pv_interdoublure';
                } else if (changedKey === 'inter_doublure') {
                    mapping.laize = 'laize_inter'; mapping.pa = 'pa_inter'; mapping.pv = 'pv_inter';
                } else if (changedKey === 'passementerie1' || changedKey === 'passementerie_1') {
                    mapping.pa = changedKey === 'passementerie1' ? 'pa_pass1' : 'pa_pass_1';
                    mapping.pv = changedKey === 'passementerie1' ? 'pv_pass1' : 'pv_pass_1';
                } else if (changedKey === 'passementerie2' || changedKey === 'passementerie_2') {
                    mapping.pa = changedKey === 'passementerie2' ? 'pa_pass2' : 'pa_pass_2';
                    mapping.pv = changedKey === 'passementerie2' ? 'pv_pass2' : 'pv_pass_2';
                } else if (changedKey === 'modele_mecanisme' || changedKey === 'mecanisme_bis') {
                    if (updatedRow.type_mecanisme === 'Rail') {
                        mapping.pa = changedKey === 'modele_mecanisme' ? 'pa_mecanisme' : 'pa_mecanisme_bis';
                        mapping.pv = changedKey === 'modele_mecanisme' ? 'pv_mecanisme' : 'pv_mecanisme_bis';
                    }
                }
                if (mapping.laize && schema.some(c => c.key === mapping.laize)) updatedRow[mapping.laize] = article.width;
                if (mapping.pa && schema.some(c => c.key === mapping.pa)) updatedRow[mapping.pa] = article.buyPrice;
                if (mapping.pv && schema.some(c => c.key === mapping.pv)) updatedRow[mapping.pv] = article.sellPrice;
                if (article.motif) {
                    if (mapping.rv && schema.some(c => c.key === mapping.rv)) updatedRow[mapping.rv] = article.raccord_v;
                    if (mapping.rh && schema.some(c => c.key === mapping.rh)) updatedRow[mapping.rh] = article.raccord_h;
                } else {
                    if (mapping.rv && schema.some(c => c.key === mapping.rv)) updatedRow[mapping.rv] = 0;
                    if (mapping.rh && schema.some(c => c.key === mapping.rh)) updatedRow[mapping.rh] = 0;
                }
            }
        }

        // 2. Formules — on track TOUTES les saisies manuelles de nombres pour
        //    éviter que recomputeRow(SCHEMA_64) dans handleSubsetChange écrase la valeur.
        schema.forEach((col) => {
            if (col.type === 'formula' || col.type === 'number' || enableCellFormulas) {
                const key = col.key;
                const oldVal = oldRow[key];
                const newVal = updatedRow[key];
                if (String(newVal) !== String(oldVal)) {
                    const strVal = String(newVal ?? '');
                    if (strVal.startsWith('=')) {
                        cellFx[key] = strVal.substring(1);
                        hasOverride = true;
                    } else if (strVal !== '' && strVal !== 'undefined') {
                        // Stocker le override même pour les colonnes sans formula définie,
                        // pour protéger la valeur manuelle contre tout recomputeRow en aval.
                        cellFx[key] = strVal;
                        hasOverride = true;
                    }
                }
            }
        });
        if (hasOverride) updatedRow.__cellFormulas = cellFx;

        // 3. Parse des nombres
        schema.forEach(col => {
            const val = updatedRow[col.key];
            if (col.type === 'number' && val !== undefined && val !== null && val !== '') {
                if (!String(val).startsWith('=')) {
                    const n = parseFloat(String(val).replace(',', '.'));
                    if (!isNaN(n)) updatedRow[col.key] = n;
                }
            }
        });

        // 4. Auto-log
        const author = currentUser?.name || currentUser?.email || 'Utilisateur';
        const logs = generateRowLogs(oldRow, updatedRow, schema, author);
        if (logs.length > 0) {
            const prevComments = Array.isArray(oldRow.comments) ? oldRow.comments : [];
            updatedRow.comments = [...prevComments, ...logs];
        }

        // 5. Recompute formulas avec le schema de la section
        try {

            const recomputed = recomputeRow(updatedRow, schema, formulaCtx);

            const newAllRows = [];
            params.api.forEachNode(node => {
                newAllRows.push(node.data.id === recomputed.id ? recomputed : node.data);
            });

            onRowsChangeRef.current(newAllRows);
        } catch (e) {
            console.error('Erreur calcul', e);
        }
    }, [schema, formulaCtx, catalog, currentUser, enableCellFormulas]);

    const isLargeGrid = rows.length > 100;

    // Ligne de totaux interactive (valeurs calculées selon colAggregations)
    const pinnedBottomRowData = useMemo(() => {
        if (rows.length === 0) return [];
        const totals = { _isPinnedTotal: true };
        schema.forEach(col => {
            // Exclure les types clairement non-numériques
            if (NON_NUMERIC_TYPES.has(col.type)) return;
            if (col.key === 'detail' || col.key === 'sel') return;
            const aggType = colAggregations[col.key] || 'none';
            if (aggType === 'none') return;
            const values = rows.map(r => {
                if (col.valueGetter) {
                    try { return col.valueGetter({ row: r }); } catch { return r[col.key]; }
                }
                return r[col.key];
            });
            const result = computeAgg(values, aggType);
            if (result !== null) totals[col.key] = result;
        });
        return [totals];
    }, [rows, schema, colAggregations]);

    // Vue mobile (cards)
    if (isMobile) {
        const MobileCard = ({ row }) => {
            let mainStatus = { label: '—', bg: '#F3F4F6', color: '#6B7280' };
            if (row.statut_pose === 'Terminé') mainStatus = { label: 'Posé', bg: '#ECFDF5', color: '#065F46' };
            else if (row.statut_conf === 'Terminé') mainStatus = { label: 'Confectionné', bg: '#FDF2F8', color: '#9D174D' };
            else if (row.statut_prepa === 'Terminé') mainStatus = { label: 'Prêt', bg: '#F5F3FF', color: '#5B21B6' };
            else if (row.statut_cotes === 'Définitive') mainStatus = { label: 'Coté', bg: '#EFF6FF', color: '#1E40AF' };
            return (
                <div onClick={() => handleOpenDetail(row)} style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{row.piece || 'Sans pièce'}</div>
                            <div style={{ fontSize: 13, color: '#4B5563', marginTop: 2 }}>{row.produit || '—'}</div>
                        </div>
                        <div style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: mainStatus.bg, color: mainStatus.color, textTransform: 'uppercase' }}>{mainStatus.label}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#6B7280', borderTop: '1px solid #F9FAFB', paddingTop: 8 }}>
                        <div>L: <span style={{ color: '#111827', fontWeight: 600 }}>{row.largeur || '—'}</span></div>
                        <div>H: <span style={{ color: '#111827', fontWeight: 600 }}>{row.hauteur || '—'}</span></div>
                    </div>
                </div>
            );
        };
        return (
            <div style={{ width: '100%' }}>
                <div className="mobile-grid-cards">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>{rows.length} Lignes</span>
                        {!readOnly && <button onClick={handleAddRow} style={{ background: '#2563EB', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>+ Ajouter</button>}
                    </div>
                    {rows.length === 0 ? (
                        <div style={{ padding: 30, textAlign: 'center', color: '#9CA3AF', background: 'transparent', borderRadius: 8, border: '1px dashed #D1D5DB' }}>Aucune ligne</div>
                    ) : (
                        rows.map(row => <MobileCard key={row.id} row={row} />)
                    )}
                </div>
            </div>
        );
    }

    // Colonnes visibles pour le panneau (en excluant la colonne checkbox)
    const schemaCols = useMemo(() =>
        schema.filter(col => col.key !== 'sel' && !col.hidden).map(col => ({
            field: col.key,
            label: col.headerName || col.label || col.key,
        })),
        [schema]
    );

    return (
        <div style={{ width: '100%' }}>

            {/* Toolbar */}
            <div style={{ padding: '8px 10px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 8, alignItems: 'center', background: '#fafafa', flexWrap: 'wrap' }}>
                {!readOnly && (
                    <button onClick={handleAddRow} style={{ cursor: 'pointer', padding: '5px 10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                        <Plus size={14} /> Ajouter
                    </button>
                )}
                {selectedCount > 0 && !readOnly && (
                    <button onClick={handleDeleteRows} style={{ cursor: 'pointer', padding: '5px 10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                        <Trash2 size={14} /> Supprimer ({selectedCount})
                    </button>
                )}
                {/* Recherche rapide */}
                <input
                    type="text"
                    placeholder="Rechercher..."
                    value={quickFilter}
                    onChange={e => setQuickFilter(e.target.value)}
                    style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, width: 160, outline: 'none' }}
                />
                {/* Bouton colonnes */}
                <div style={{ position: 'relative', marginLeft: 'auto' }}>
                    <button
                        onClick={handleToggleColPanel}
                        style={{ cursor: 'pointer', padding: '5px 10px', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                    >
                        <Columns size={14} /> Colonnes
                    </button>
                    {colPanelOpen && (
                        <div
                            style={{
                                position: 'absolute', right: 0, top: '100%', marginTop: 4,
                                background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
                                boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 1000,
                                maxHeight: 320, overflowY: 'auto', minWidth: 200, padding: 8,
                            }}
                        >
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', padding: '4px 8px 8px' }}>Afficher / Masquer</div>
                            {schemaCols.map(col => (
                                <label key={col.field} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <input
                                        type="checkbox"
                                        checked={colVisibility[col.field] !== false}
                                        onChange={e => handleToggleColumn(col.field, e.target.checked)}
                                        style={{ accentColor: '#2563eb' }}
                                    />
                                    <span>{col.label}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
                {/* Fermer le panneau colonnes en cliquant ailleurs */}
                {colPanelOpen && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setColPanelOpen(false)} />
                )}
            </div>

            {/* Indicateur de largeur en live pendant resize */}
            {resizeInfo && (
                <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#1f2937', color: 'white', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'none' }}>
                    <span style={{ color: '#9ca3af', fontWeight: 400 }}>{resizeInfo.name}</span>
                    <span style={{ color: '#34d399', fontSize: 16 }}>{resizeInfo.width} px</span>
                </div>
            )}

            {/* Menu agrégation (style Excel) */}
            {aggMenu && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setAggMenu(null)} />
                    <div style={{
                        position: 'fixed', left: aggMenu.x, top: aggMenu.y,
                        background: 'white', border: '1px solid #e5e7eb', borderRadius: 6,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 9999,
                        minWidth: 150, overflow: 'hidden',
                    }}>
                        <div style={{ padding: '6px 12px 4px', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', borderBottom: '1px solid #f3f4f6' }}>
                            {schema.find(s => s.key === aggMenu.field)?.label || aggMenu.field}
                        </div>
                        {AGG_OPTIONS.map(opt => {
                            const current = (colAggregations[aggMenu.field] || 'none') === opt.value;
                            return (
                                <div
                                    key={opt.value}
                                    onClick={() => { onAggregationChange(aggMenu.field, opt.value); setAggMenu(null); }}
                                    style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 13, background: current ? '#f0fdf4' : 'white', fontWeight: current ? 700 : 400, color: current ? '#065f46' : '#111827', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                    onMouseEnter={e => { if (!current) e.currentTarget.style.background = '#f9fafb'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = current ? '#f0fdf4' : 'white'; }}
                                >
                                    <span>{opt.label}</span>
                                    {current && <span style={{ fontSize: 10 }}>✓</span>}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* AG Grid */}
            <div className="ag-theme-alpine" style={{ width: '100%', height: isLargeGrid ? 600 : undefined }}>
                <AgGridReact
                    ref={gridRef}
                    rowData={rows}
                    pinnedBottomRowData={pinnedBottomRowData}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    context={{ colAggregations, onAggregationChange }}
                    getRowStyle={(params) => {
                        if (params.node.rowPinned === 'bottom') {
                            return { background: '#f0fdf4', borderTop: '2px solid #10b981' };
                        }
                    }}
                    quickFilterText={quickFilter}
                    getRowId={(params) => String(params.data.id)}
                    suppressColumnVirtualisation={true}
                    domLayout={isLargeGrid ? 'normal' : 'autoHeight'}
                    rowHeight={48}
                    rowSelection={{
                        mode: 'multiRow',
                        enableClickSelection: false,
                        checkboxes: !readOnly,
                        headerCheckbox: !readOnly,
                    }}
                    onSelectionChanged={onSelectionChanged}
                    onCellClicked={onPinnedCellClicked}
                    onCellValueChanged={onCellValueChanged}
                    onGridReady={onGridReady}
                    onColumnResized={onColumnResized}
                    onColumnVisible={onColumnVisible}
                    onColumnMoved={onColumnMoved}
                    localeText={AG_GRID_LOCALE_FR}
                    theme="legacy"
                    animateRows={false}
                    singleClickEdit
                    stopEditingWhenCellsLoseFocus
                />
            </div>
        </div>
    );
}

function arePropsEqual(prev, next) {
    if (prev.rows !== next.rows) {
        if (prev.rows.length !== next.rows.length) return false;
        if (prev.rows.some((r, i) => r !== next.rows[i])) return false;
    }
    return (
        prev.schema === next.schema &&
        prev.enableCellFormulas === next.enableCellFormulas &&
        prev.readOnly === next.readOnly &&
        prev.catalog === next.catalog &&
        prev.isMobile === next.isMobile &&
        prev.gridKey === next.gridKey
    );
}

export default React.memo(MinuteGrid, arePropsEqual);
