// src/components/MinuteGrid.jsx
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import { schemaToGridCols } from '../lib/utils/schemaToGridCols.jsx';
import { recomputeRow } from '../lib/formulas/recomputeRow';
import { generateRowLogs } from '../lib/utils/logUtils';
import { uid } from '../lib/utils/uid';
import { createDecentreePair, PAIRE_DECENTREE, DECENTREE_PARENT_ONLY_TECH } from '../lib/utils/pairDecentree';
import { Plus, Trash2, Columns, Layers, Edit2, Filter, FileSpreadsheet } from 'lucide-react';
import FilterPanel, { isConditionActive, evaluateCondition } from './FilterPanel';
import { getDefaultMatieres } from '../lib/constants/matiereGroups';
import { useAuth } from '../auth';
import { useSharedGridState } from '../lib/hooks/useSharedGridState';

const STORAGE_PREFIX = 'ag_grid_state_v1_';
const GRID_STATE_VERSION = 5; // à incrémenter si le calcul des largeurs change


const AG_GRID_LOCALE_FR = {
    // Regroupement (panneau « Regrouper par »)
    rowGroupColumnsEmptyMessage: 'Glissez un champ ici pour regrouper',
    group: 'Groupe',
    expandAll: 'Tout déplier',
    collapseAll: 'Tout replier',
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
.ag-theme-alpine .ag-header-cell.filter-col-active {
  background-color: #dbeafe !important;
  border-bottom: 2px solid #3b82f6 !important;
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
    matiereGroups = [],
    activeMatieres = null,
    onMatiereChange,
    mecaGroups = [],
    confGroups = [],
    showExpeditionCol = false,
    enableDecentree = false, // active l'éclatement « Paire décentrée » (production rideaux uniquement)
}) {
    const gridRef = useRef(null);
    const gridContainerRef = useRef(null);
    const { currentUser: authUser } = useAuth();
    const resolvedUser = currentUser ?? authUser;
    const [selectedCount, setSelectedCount] = useState(0);
    const [selectedRows, setSelectedRows] = useState([]);
    const [colPanelOpen, setColPanelOpen] = useState(false);
    const [colSearch, setColSearch] = useState('');
    const colBtnRef = useRef(null);
    const [matierePanelOpen, setMatierePanelOpen] = useState(false);
    const [colVisibility, setColVisibility] = useState({});
    const [quickFilter, setQuickFilter] = useState('');
    const [colAggregations, setColAggregations] = useState({});
    const [aggMenu, setAggMenu] = useState(null); // { field, x, y }
    const [resizeInfo, setResizeInfo] = useState(null); // { name, width }
    const [filterConditions, setFilterConditions] = useState([]);
    const [filterPanelOpen, setFilterPanelOpen] = useState(false);
    const filterConditionsRef = useRef([]);
    filterConditionsRef.current = filterConditions;

    // ── Paire décentrée : état déplié/replié (par pair_id) ───────────────────
    const collapsedPairsRef = useRef(new Set());
    const toggleDecentree = useCallback((pairId) => {
        const set = collapsedPairsRef.current;
        if (set.has(pairId)) set.delete(pairId); else set.add(pairId);
        const api = gridRef.current?.api;
        if (api) {
            api.onFilterChanged();             // masque/affiche les enfants repliés
            api.refreshCells({ force: true }); // met à jour la flèche du chevron
        }
    }, []);
    const toggleDecentreeRef = useRef(toggleDecentree);
    toggleDecentreeRef.current = toggleDecentree;

    // Renderer de la colonne identité (zone) : chevron sur le parent, indentation sur les enfants
    const decentreeZoneRenderer = useCallback((params) => {
        const row = params.data || {};
        const val = params.value == null ? '' : params.value;
        if (row.pair_role === 'parent') {
            const collapsed = collapsedPairsRef.current.has(row.pair_id);
            return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                React.createElement('span', {
                    onClick: (e) => { e.stopPropagation(); toggleDecentreeRef.current(row.pair_id); },
                    style: { cursor: 'pointer', userSelect: 'none', fontSize: 11, color: '#6b7280', width: 12, textAlign: 'center', display: 'inline-block' },
                    title: collapsed ? 'Déplier la paire' : 'Replier la paire',
                }, collapsed ? '▶' : '▼'),
                React.createElement('span', { style: { fontWeight: 600 } }, val),
            );
        }
        if (row.pair_role === 'left' || row.pair_role === 'right') {
            return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 16, color: '#6b7280' } },
                React.createElement('span', { style: { fontSize: 10 } }, row.pair_role === 'left' ? '↳ Gauche' : '↳ Droite'),
                React.createElement('span', null, val),
            );
        }
        return val;
    }, []);

    // Colonnes techniques du rail (largeur méca, nb glisseurs) : « voir parent » sur les enfants
    const decentreeParentOnlyRenderer = useCallback((params) => {
        const role = params.data?.pair_role;
        if (role === 'left' || role === 'right') {
            return React.createElement('span', {
                style: { color: '#9ca3af', fontStyle: 'italic', fontSize: 11 },
                title: 'Donnée portée par la ligne parent',
            }, 'voir parent');
        }
        return params.valueFormatted != null ? params.valueFormatted : (params.value == null ? '' : params.value);
    }, []);
    const activeFilterFieldsRef = useRef(new Set());

    // État local des matières (source de vérité pour le panneau Configuration)
    const [localMatieres, setLocalMatieres] = useState(
        () => activeMatieres ?? getDefaultMatieres(matiereGroups, initialVisibilityModel)
    );
    const localMatieresRef = useRef(localMatieres);
    localMatieresRef.current = localMatieres;

    // État local méca et conf — initialisés depuis les defaults, mis à jour par sharedState après chargement Supabase
    const [localMeca, setLocalMeca] = useState(() =>
        Object.fromEntries(mecaGroups.map(g => [g.id, initialVisibilityModel[g.fields[0]] !== false]))
    );
    const [localConf, setLocalConf] = useState(() =>
        Object.fromEntries(confGroups.map(g => [g.id, initialVisibilityModel[g.fields[0]] !== false]))
    );
    const localMecaRef = useRef(localMeca);
    localMecaRef.current = localMeca;
    const localConfRef = useRef(localConf);
    localConfRef.current = localConf;
    const isGridReadyRef = useRef(false);
    const pendingRowUpdatesRef = useRef({});  // batch des onCellValueChanged simultanés (paste/fill)
    const flushScheduledRef    = useRef(false);

    const rowsRef = useRef(rows);
    rowsRef.current = rows;
    // Ref pour éviter le stale closure sur onRowsChange et onAdd (arePropsEqual bloque le re-render
    // quand seul onRowsChange/onAdd change, donc useCallback ne se met pas à jour)
    const onRowsChangeRef = useRef(onRowsChange);
    onRowsChangeRef.current = onRowsChange;
    const onAddRef = useRef(onAdd);
    onAddRef.current = onAdd;

    // ID unique pour la persistance des colonnes
    const gridId = useMemo(() => {
        if (gridKey) return `${STORAGE_PREFIX}${gridKey}`;
        if (projectId) return `${STORAGE_PREFIX}prod_${projectId}_${title || 'grid'}`;
        if (minuteId) return `${STORAGE_PREFIX}minute_${minuteId}_${title || 'grid'}`;
        return `${STORAGE_PREFIX}${title || 'default'}`;
    }, [gridKey, projectId, minuteId, title]);

    // Clé Supabase (sans le préfixe localStorage)
    const supabaseGridKey = gridId.replace(STORAGE_PREFIX, '');
    const { data: sharedState, loaded: sharedStateLoaded, save: saveSharedState } = useSharedGridState(supabaseGridKey);
    const sharedStateRef = useRef(null);
    sharedStateRef.current = sharedState;

    // Largeurs stables — initialisées une seule fois au chargement Supabase pour éviter la boucle infinie
    // (columnDefs ne doit pas dépendre de sharedState directement, sinon chaque save recompute les cols)
    const [initialWidths, setInitialWidths] = useState({});
    useEffect(() => {
        if (sharedStateLoaded && sharedState?.widths) {
            setInitialWidths(sharedState.widths);
        }
    }, [sharedStateLoaded]); // intentionnellement sans sharedState dans les deps

    // Persistance : restauration au démarrage
    // Les largeurs viennent de columnDefs (baked depuis schema + _widths localStorage).
    // On restaure ici uniquement l'ordre. La visibilité est toujours pilotée par
    // initialVisibilityModel (prioritaire) ou le localStorage si pas de modèle défini.
    // Applique l'état partagé Supabase à la grille (appelé après chargement async)
    const applySharedState = useCallback((api, state) => {
        const hasVisibilityModel = initialVisibilityModel && Object.keys(initialVisibilityModel).length > 0;
        const { columnState, v } = state ?? {};

        // Restaurer les largeurs sauvegardées. initialWidth (dans columnDefs) ne s'applique qu'à
        // la création des colonnes, or Supabase répond en asynchrone après ce point : on applique
        // donc les largeurs ici via applyColumnState.
        if (state?.widths && Object.keys(state.widths).length > 0) {
            api.applyColumnState({
                state: Object.entries(state.widths).map(([colId, width]) => ({ colId, width })),
            });
        }

        if (columnState && v === GRID_STATE_VERSION) {
            // Toujours restaurer visibilité + ordre depuis l'état sauvegardé (override sur initialVisibilityModel)
            api.applyColumnState({
                // rowGroupIndex : restaure aussi le regroupement (colonnes glissées dans le panneau)
                state: columnState.map(cs => ({ colId: cs.colId, hide: cs.hide, pinned: cs.pinned, rowGroupIndex: cs.rowGroupIndex })),
                applyOrder: true,
            });
            const visMap = {};
            columnState.forEach(cs => { if (cs.colId) visMap[cs.colId] = !cs.hide; });
            setColVisibility(visMap);
        } else if (hasVisibilityModel) {
            const stateToApply = Object.entries(initialVisibilityModel)
                .filter(([, visible]) => !visible)
                .map(([field]) => ({ colId: field, hide: true }));
            if (stateToApply.length > 0) api.applyColumnState({ state: stateToApply });
            setColVisibility(initialVisibilityModel);
        }

        // Meca et conf depuis l'état partagé
        const savedMeca = state?.meca;
        const savedConf = state?.conf;
        if (savedMeca && mecaGroups?.length > 0) {
            setLocalMeca(savedMeca);
            const mecaState = [];
            mecaGroups.forEach(group => {
                const isActive = savedMeca[group.id] !== false;
                group.fields.forEach(field => mecaState.push({ colId: field, hide: !isActive }));
            });
            api.applyColumnState({ state: mecaState });
        }
        if (savedConf && confGroups?.length > 0) {
            setLocalConf(savedConf);
            const confState = [];
            confGroups.forEach(group => {
                const isActive = savedConf[group.id] !== false;
                group.fields.forEach(field => confState.push({ colId: field, hide: !isActive }));
            });
            api.applyColumnState({ state: confState });
        }
    }, [initialVisibilityModel, mecaGroups, confGroups]);

    const onGridReady = useCallback((params) => {
        isGridReadyRef.current = true;

        // Si Supabase a déjà répondu, on applique directement
        if (sharedStateRef.current !== null || sharedStateLoaded) {
            applySharedState(params.api, sharedStateRef.current);
        }
        // Sinon, le useEffect ci-dessous prendra le relais dès que loaded=true

        // Appliquer les matières sauvegardées (override par-dessus initialVisibilityModel)
        if (matiereGroups?.length > 0) {
            const currentMatieres = localMatieresRef.current;
            const matiereState = [];
            matiereGroups.forEach(group => {
                const isActive = currentMatieres[group.id] !== false;
                group.fields.forEach(field => {
                    matiereState.push({ colId: field, hide: !isActive });
                });
            });
            params.api.applyColumnState({ state: matiereState });
        }

        // Appliquer méca et conf sauvegardés
        if (mecaGroups?.length > 0) {
            const mecaState = [];
            mecaGroups.forEach(group => {
                const isActive = localMecaRef.current[group.id] !== false;
                group.fields.forEach(field => mecaState.push({ colId: field, hide: !isActive }));
            });
            params.api.applyColumnState({ state: mecaState });
        }
        if (confGroups?.length > 0) {
            const confState = [];
            confGroups.forEach(group => {
                const isActive = localConfRef.current[group.id] !== false;
                group.fields.forEach(field => confState.push({ colId: field, hide: !isActive }));
            });
            params.api.applyColumnState({ state: confState });
        }
    }, [gridId, initialVisibilityModel, matiereGroups, mecaGroups, confGroups]);

    // Appliquer l'état partagé quand Supabase répond après que la grille est prête.
    // On utilise sharedStateRef (pas sharedState) pour ne déclencher qu'une fois au chargement
    // et éviter la boucle infinie (chaque save mettrait à jour sharedState → re-apply → re-save…)
    useEffect(() => {
        if (!sharedStateLoaded) return;
        const api = gridRef.current?.api;
        if (!api || !isGridReadyRef.current) return;
        applySharedState(api, sharedStateRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sharedStateLoaded]); // intentionnellement sans sharedState dans les deps

    // Charger les agrégations sauvegardées depuis sharedState
    useEffect(() => {
        if (sharedState?.agg) setColAggregations(sharedState.agg);
    }, [sharedState]);

    // Efface la sélection de cellules quand l'utilisateur clique hors du tableau
    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (!gridContainerRef.current) return;
            if (!gridContainerRef.current.contains(e.target)) {
                gridRef.current?.api?.clearCellSelection();
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    const onCellClicked = useCallback((params) => {
        // Ligne de totaux : ouvre le menu d'agrégation
        if (params.node.rowPinned === 'bottom') {
            const field = params.colDef?.field;
            if (!field) return;
            const schemaCol = schema.find(s => s.key === field);
            if (!schemaCol) return;
            if (NON_NUMERIC_TYPES.has(schemaCol.type) || field === 'detail' || field === 'sel') return;
            const cellEl = params.event?.target?.closest('[comp-id]') || params.event?.target;
            const rect = cellEl?.getBoundingClientRect?.();
            const x = rect ? rect.left : params.event.clientX;
            const y = rect ? rect.bottom + 4 : params.event.clientY + 4;
            setAggMenu({ field, x, y });
            return;
        }

        // singleClickEdit pour les cellules non-select (les selects s'éditent au double-clic)
        if (readOnly || params.node.rowPinned) return;
        if (params.colDef?.cellEditor === 'agSelectCellEditor') return;
        const isEditable = typeof params.colDef?.editable === 'function'
            ? params.colDef.editable(params)
            : params.colDef?.editable;
        if (!isEditable) return;
        params.api.startEditingCell({ rowIndex: params.rowIndex, colKey: params.column.getColId() });
    }, [schema, readOnly]);

    const onAggregationChange = useCallback((field, aggType) => {
        setColAggregations(prev => {
            const next = { ...prev, [field]: aggType };
            saveSharedState({ agg: next });
            return next;
        });
    }, [saveSharedState]);

    // Persistance : sauvegarde dans Supabase (partagée)
    const saveColumnState = useCallback((api) => {
        const columnState = api.getColumnState();
        saveSharedState({ columnState, v: GRID_STATE_VERSION });
    }, [saveSharedState]);

    // Sync activeMatieres prop → état local + AG Grid (chargement async Supabase)
    useEffect(() => {
        if (activeMatieres == null || !matiereGroups?.length) return;
        setLocalMatieres(activeMatieres);
        if (!isGridReadyRef.current) return;
        const api = gridRef.current?.api;
        if (!api) return;
        const matiereState = [];
        matiereGroups.forEach(group => {
            const isActive = activeMatieres[group.id] !== false;
            group.fields.forEach(field => {
                matiereState.push({ colId: field, hide: !isActive });
            });
        });
        api.applyColumnState({ state: matiereState });
    }, [activeMatieres, matiereGroups]);

    // Toggle d'un groupe matière
    const handleToggleMatiere = useCallback((groupId, active) => {
        const api = gridRef.current?.api;
        const group = matiereGroups?.find(g => g.id === groupId);
        if (!api || !group) return;

        api.setColumnsVisible(group.fields, active);
        saveColumnState(api);

        setLocalMatieres(prev => {
            const next = { ...prev, [groupId]: active };
            onMatiereChange?.(next);
            return next;
        });
    }, [matiereGroups, saveColumnState, onMatiereChange]);

    const handleToggleMeca = useCallback((groupId, active) => {
        const api = gridRef.current?.api;
        const group = mecaGroups?.find(g => g.id === groupId);
        if (!api || !group) return;
        api.setColumnsVisible(group.fields, active);
        saveColumnState(api);
        setLocalMeca(prev => {
            const next = { ...prev, [groupId]: active };
            saveSharedState({ meca: next });
            return next;
        });
    }, [mecaGroups, saveColumnState, saveSharedState]);

    const handleToggleConf = useCallback((groupId, active) => {
        const api = gridRef.current?.api;
        const group = confGroups?.find(g => g.id === groupId);
        if (!api || !group) return;
        api.setColumnsVisible(group.fields, active);
        saveColumnState(api);
        setLocalConf(prev => {
            const next = { ...prev, [groupId]: active };
            saveSharedState({ conf: next });
            return next;
        });
    }, [confGroups, saveColumnState, saveSharedState]);

    const onColumnResized = useCallback((params) => {
        if (!params.column) return;
        const width = Math.round(params.column.getActualWidth());
        const name = params.column.getColDef().headerName || params.column.getColId();
        setResizeInfo(params.finished ? null : { name, width });
        if (params.finished) {
            const colId = params.column.getColId();
            const currentWidths = sharedStateRef.current?.widths ?? {};
            saveSharedState({ widths: { ...currentWidths, [colId]: width } });
            saveColumnState(params.api);
        }
    }, [gridId, saveColumnState]);

    const onColumnVisible = useCallback((params) => {
        saveColumnState(params.api);
    }, [saveColumnState]);

    const onColumnMoved = useCallback((params) => {
        if (params.finished) saveColumnState(params.api);
    }, [saveColumnState]);

    // Persiste le regroupement (colonnes glissées dans le panneau de regroupement)
    const onColumnRowGroupChanged = useCallback((params) => {
        saveColumnState(params.api);
    }, [saveColumnState]);

    // Ouvrir le panneau de détail
    const handleOpenDetail = useCallback((row) => {
        if (onRowClick) onRowClick(row.id);
    }, [onRowClick]);

    // Upload photo
    const handlePhotoChange = useCallback((id, field, value) => {
        const authorName = resolvedUser?.name || resolvedUser?.email || 'Utilisateur';
        const newRows = rowsRef.current.map(r => {
            if (r.id !== id) return r;
            let updatedRow = { ...r, [field]: value };

            // Si c'est photos_sur_site, on crée aussi une entrée dans l'activité
            // (sauf pour les photos pending offline — l'activité sera créée après sync)
            if (field === 'photos_sur_site' && Array.isArray(value) && value.length > 0) {
                const newPhoto = value[value.length - 1];
                if (!newPhoto.pending) {
                    const newActivity = {
                        id: Date.now(),
                        content: newPhoto.url,
                        type: 'image',
                        createdAt: new Date().toISOString(),
                        date: Date.now(),
                        author: authorName
                    };
                    const updatedComments = r.comments ? [...r.comments, newActivity] : [newActivity];
                    updatedRow = { ...updatedRow, comments: updatedComments };
                }
            }

            return updatedRow;
        });
        onRowsChange(newRows);
    }, [onRowsChange, resolvedUser]);

    // Mettre à jour un champ lien (embout_meca_link, support_link, etc.)
    const handleLinkUpdate = useCallback((id, field, value) => {
        const newRows = rowsRef.current.map(r =>
            r.id !== id ? r : { ...r, [field]: value }
        );
        onRowsChange(newRows);
    }, [onRowsChange]);

    // Ajouter une ligne
    const handleAddRow = useCallback(() => {
        if (onAddRef.current) { onAddRef.current(); return; }
        const newRow = { id: uid(), ...Object.fromEntries(schema.map(col => [col.key, ''])) };
        onRowsChangeRef.current([...rowsRef.current, newRow]);
    }, [schema]);

    // Supprimer les lignes sélectionnées
    const handleDeleteRows = useCallback(() => {
        const api = gridRef.current?.api;
        if (!api) return;
        const selectedIds = new Set(api.getSelectedRows().map(r => r.id));
        // Cascade : si on supprime un parent décentré, on supprime aussi ses 2 enfants
        const deletedParentPairs = new Set(
            rowsRef.current
                .filter(r => selectedIds.has(r.id) && r.pair_role === 'parent')
                .map(r => r.pair_id)
        );
        const newRows = rowsRef.current.filter(r =>
            !selectedIds.has(r.id) &&
            !(r.pair_role && r.pair_role !== 'parent' && deletedParentPairs.has(r.pair_id))
        );
        onRowsChange(newRows);
        setSelectedCount(0);
        setSelectedRows([]);
    }, [onRowsChange]);

    const onSelectionChanged = useCallback((params) => {
        const rows = params.api.getSelectedRows();
        setSelectedCount(rows.length);
        setSelectedRows(rows);
    }, []);

    // Export Excel (natif AG Grid Enterprise) — lignes cochées + colonnes visibles
    const handleExportExcel = useCallback(() => {
        const api = gridRef.current?.api;
        if (!api) return;
        // Colonnes affichées, hors colonnes techniques (case, bouton détail, photos)
        const columnKeys = api.getAllDisplayedColumns()
            .map(c => c.getColId())
            .filter(colId => !['sel', 'detail'].includes(colId) && !/photo|croquis/i.test(colId));
        const safeName = String(title || 'export').replace(/[^\w\-À-ÿ ]+/g, '').trim() || 'export';
        api.exportDataAsExcel({
            onlySelected: true,
            columnKeys,
            fileName: `${safeName}.xlsx`,
            sheetName: safeName.slice(0, 28),
        });
    }, [title]);

    // ── Mise à jour en masse ──
    const [showBulkUpdate, setShowBulkUpdate] = useState(false);
    const [bulkField, setBulkField] = useState('');
    const [bulkValue, setBulkValue] = useState('');

    const bulkStatutCols = useMemo(() => {
        if (selectedRows.length === 0) return [];
        return schema
            .filter(c => c.key.startsWith('statut_'))
            .map(c => {
                // Exclure si readOnly pour au moins une ligne sélectionnée
                const allApplicable = selectedRows.every(r =>
                    typeof c.readOnly === 'function' ? !c.readOnly(r) : !c.readOnly
                );
                if (!allApplicable) return null;

                // Résoudre les options via optionsFn si disponible
                const resolvedOptions = c.optionsFn
                    ? c.optionsFn(selectedRows[0])
                    : c.options;
                if (!Array.isArray(resolvedOptions) || resolvedOptions.length === 0) return null;

                return { ...c, _resolvedOptions: resolvedOptions };
            })
            .filter(Boolean);
    }, [schema, selectedRows]);

    const applyBulkUpdate = useCallback(() => {
        if (!bulkField || !bulkValue) return;
        const api = gridRef.current?.api;
        if (!api) return;
        const selectedIds = new Set(api.getSelectedRows().map(r => r.id));
        const col = schema.find(c => c.key === bulkField);
        const next = rowsRef.current.map(r => {
            if (!selectedIds.has(r.id)) return r;
            // Ne pas écraser si le champ est readOnly pour cette ligne
            if (col?.readOnly && (typeof col.readOnly === 'function' ? col.readOnly(r) : col.readOnly)) return r;
            return { ...r, [bulkField]: bulkValue };
        });
        onRowsChangeRef.current(next);
        setShowBulkUpdate(false);
        setBulkField('');
        setBulkValue('');
    }, [bulkField, bulkValue, schema]);

    // Panneau de visibilité des colonnes
    const [colPanelPos, setColPanelPos] = useState(null);

    // Recalcule la position du panel colonnes lors du scroll (position: fixed doit suivre le bouton)
    useEffect(() => {
        if (!colPanelOpen) return;
        const updatePos = () => {
            const rect = colBtnRef.current?.getBoundingClientRect();
            if (rect) setColPanelPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
        };
        window.addEventListener('scroll', updatePos, true);
        return () => window.removeEventListener('scroll', updatePos, true);
    }, [colPanelOpen]);

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
            setColSearch('');
            const rect = colBtnRef.current?.getBoundingClientRect();
            if (rect) setColPanelPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
        }
        setColPanelOpen(prev => !prev);
    }, [colPanelOpen]);

    const handleToggleAllColumns = useCallback((visible) => {
        const api = gridRef.current?.api;
        if (!api) return;
        const ids = schema.filter(col => col.key !== 'sel' && !col.hidden).map(col => col.key);
        api.setColumnsVisible(ids, visible);
        saveColumnState(api);
        const newVis = {};
        ids.forEach(id => { newVis[id] = visible; });
        setColVisibility(prev => ({ ...prev, ...newVis }));
    }, [schema, saveColumnState]);

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
        const savedWidths = initialWidths;

        const canEditLinks = ['admin', 'sales', 'ordo', 'op'].includes(resolvedUser?.role?.toLowerCase());
        const cols = schemaToGridCols(
            schema, enableCellFormulas, handleOpenDetail,
            catalog, railOptions, handlePhotoChange,
            onDuplicateRow, hideCroquis, readOnly, title,
            projectId,
            handleLinkUpdate, canEditLinks
        );

        const withWidths = cols.map(col => {
            const schemaWidth = col.initialWidth ?? col.width ?? 120;
            const w = savedWidths[col.field] ?? schemaWidth;
            // Agrégation des lignes de groupe : réutilise le réglage par colonne (colAggregations)
            // qui pilote déjà la ligne de totaux, pour rester cohérent.
            const aggType = colAggregations[col.field];
            const aggFunc = ['sum', 'avg', 'min', 'max', 'count'].includes(aggType) ? aggType : undefined;
            return {
                ...col,
                // initialWidth (et non width) : la largeur n'est posée qu'à la création de la colonne.
                // Utiliser `width` (propriété managée) la ré-appliquerait à chaque recompute des
                // columnDefs et écraserait le resize de l'utilisateur (bug du « retour à la largeur initiale »).
                // Les largeurs sauvegardées sont restaurées après coup via applyColumnState (chargement async Supabase).
                width: undefined,
                initialWidth: w,
                aggFunc,
                // Chevron déplier/replier + indentation sur la colonne identité (paire décentrée)
                ...(enableDecentree && col.field === 'zone' ? { cellRenderer: decentreeZoneRenderer } : {}),
                // « voir parent » sur les colonnes techniques du rail pour les lignes enfants
                ...(enableDecentree && DECENTREE_PARENT_ONLY_TECH.includes(col.field) ? { cellRenderer: decentreeParentOnlyRenderer } : {}),
                headerClass: () => activeFilterFieldsRef.current.has(col.field) ? 'filter-col-active' : '',
            };
        });

        // Colonne expédition toujours présente (pinned right)
        const EXPEDITION_STYLES = {
            'Non expédié':           { bg: '#F3F4F6', color: '#6B7280' },
            'En préparation':        { bg: '#FEF3C7', color: '#92400E' },
            'Expédié':               { bg: '#D1FAE5', color: '#065F46' },
            'Rail expédié':          { bg: '#DBEAFE', color: '#1E40AF' },
            'Rideau expédié':        { bg: '#EDE9FE', color: '#5B21B6' },
            'Rail + Rideau expédié': { bg: '#D1FAE5', color: '#065F46' },
        };
        const ALL_EXPEDITION_STATUTS = Object.keys(EXPEDITION_STYLES);

        const expeditionCol = {
            field: 'statut_expedition',
            headerName: 'Expédition',
            initialWidth: savedWidths['statut_expedition'] ?? 170,
            editable: !readOnly,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: { values: ALL_EXPEDITION_STATUTS },
            pinned: 'right',
            cellRenderer: (params) => {
                const val = params.value || 'Non expédié';
                const s = EXPEDITION_STYLES[val] || EXPEDITION_STYLES['Non expédié'];
                return React.createElement('span', {
                    style: { display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }
                }, val);
            },
        };

        if (isMobile) {
            const mobileKeys = ['piece', 'produit', 'statut_cotes', 'statut_prepa', 'statut_conf', 'statut_pose', 'detail'];
            const base = withWidths.filter(c => mobileKeys.includes(c.field) || c.checkboxSelection);
            return showExpeditionCol ? [...base, expeditionCol] : base;
        }

        return showExpeditionCol ? [...withWidths, expeditionCol] : withWidths;
    }, [schema, enableCellFormulas, handleOpenDetail, catalog, railOptions, handlePhotoChange, handleLinkUpdate, onDuplicateRow, hideCroquis, readOnly, title, isMobile, gridId, showExpeditionCol, resolvedUser, colAggregations, enableDecentree, decentreeZoneRenderer, decentreeParentOnlyRenderer]);

    const isExternalFilterPresent = useCallback(() => {
        return filterConditionsRef.current.some(isConditionActive) || collapsedPairsRef.current.size > 0;
    }, []);

    const doesExternalFilterPass = useCallback((node) => {
        const row = node.data;
        // Masquer les enfants d'une paire décentrée repliée
        if (row && (row.pair_role === 'left' || row.pair_role === 'right')
            && collapsedPairsRef.current.has(row.pair_id)) {
            return false;
        }
        const conditions = filterConditionsRef.current.filter(isConditionActive);
        if (conditions.length === 0) return true;
        let result = evaluateCondition(conditions[0], node.data);
        for (let i = 1; i < conditions.length; i++) {
            const cond = conditions[i];
            const condResult = evaluateCondition(cond, node.data);
            result = cond.logic === 'ou' ? result || condResult : result && condResult;
        }
        return result;
    }, []);

    const defaultColDef = useMemo(() => ({
        resizable: true,
        sortable: true,
        // Set Filter (Excel-like) : liste de valeurs cochables + recherche, dans chaque colonne.
        // L'entonnoir (showFilter) ouvre le filtre ; le menu ⋮ (showColumnMenu) garde tri/pin/groupe.
        // Les colonnes d'action (boutons/cases) sont coupées dans schemaToGridCols.
        filter: 'agSetColumnFilter',
        minWidth: 60,
        enableRowGroup: true, // permet de glisser n'importe quelle colonne dans le panneau de regroupement
    }), []);

    // Colonne de regroupement (affichée à gauche quand on regroupe), avec compteur (n)
    const autoGroupColumnDef = useMemo(() => ({
        headerName: 'Groupe',
        minWidth: 250,
        pinned: 'left',
        resizable: true,
        cellRendererParams: { suppressCount: false },
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

        // ── Éclatement « Paire décentrée » ───────────────────────────────────
        // Quand on passe une ligne normale à « Paire décentrée », on la remplace
        // par un parent (localisation + rail) + 2 enfants vides (pan gauche/droit).
        if (enableDecentree && changedKey === 'paire_ou_un_seul_pan'
            && newVal === PAIRE_DECENTREE && !params.data?.pair_role) {
            const source = { ...params.data, paire_ou_un_seul_pan: newVal };
            const triplet = createDecentreePair(source, schema).map(r => {
                try { return recomputeRow(r, schema, formulaCtx); } catch { return r; }
            });
            const next = [];
            (rowsRef.current || []).forEach(r => {
                if (String(r.id) === String(params.data.id)) next.push(...triplet);
                else next.push(r);
            });
            onRowsChangeRef.current(next);
            return;
        }


        // Avec getRowId, AG Grid ne mute PAS params.data — la nouvelle valeur est dans params.newValue.
        const oldRow = { ...params.data, [changedKey]: oldVal };
        let updatedRow = { ...params.data, [changedKey]: newVal };

        const cellFx = { ...(oldRow.__cellFormulas || {}) };
        let hasOverride = false;

        // 0. Sans Méca — vider modèle, PA et PV mécanisme
        if (changedKey === 'type_mecanisme' && newVal === 'Sans Méca') {
            updatedRow.modele_mecanisme = '';
            updatedRow.pa_mecanisme = 0;
            updatedRow.pv_mecanisme = 0;
        }

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
        const author = resolvedUser?.name || resolvedUser?.email || 'Utilisateur';
        const logs = generateRowLogs(oldRow, updatedRow, schema, author);
        if (logs.length > 0) {
            const prevComments = Array.isArray(oldRow.comments) ? oldRow.comments : [];
            updatedRow.comments = [...prevComments, ...logs];
        }

        // 5. Recompute formulas avec le schema de la section
        try {
            const recomputed = recomputeRow(updatedRow, schema, formulaCtx);

            // Batch : accumule les mises à jour et flush en un seul rendu React.
            // Nécessaire pour paste/fill Enterprise qui appelle onCellValueChanged
            // pour chaque cellule en séquence — sans batch, seule la dernière survit.
            pendingRowUpdatesRef.current[String(recomputed.id)] = recomputed;
            if (!flushScheduledRef.current) {
                flushScheduledRef.current = true;
                Promise.resolve().then(() => {
                    flushScheduledRef.current = false;
                    const updates = { ...pendingRowUpdatesRef.current };
                    pendingRowUpdatesRef.current = {};
                    const api = gridRef.current?.api;
                    if (!api) return;
                    const newAllRows = [];
                    api.forEachNode(node => {
                        if (!node.rowPinned)
                            newAllRows.push(updates[String(node.data.id)] ?? node.data);
                    });
                    onRowsChangeRef.current(newAllRows);
                });
            }
        } catch (e) {
            console.error('Erreur calcul', e);
        }
    }, [schema, formulaCtx, catalog, resolvedUser, enableCellFormulas, enableDecentree]);

    // Valide la valeur avant de l'appliquer via clipboard/fill.
    // Pour les selects, rejette toute valeur absente des options autorisées.
    const processCellFromClipboard = useCallback((params) => {
        const colDef = params.column?.getColDef?.();
        if (!colDef) return params.value;

        if (colDef.cellEditor === 'agSelectCellEditor') {
            const editorParams = typeof colDef.cellEditorParams === 'function'
                ? colDef.cellEditorParams({ data: params.node?.data, node: params.node })
                : colDef.cellEditorParams;
            const allowed = editorParams?.values;
            if (Array.isArray(allowed) && !allowed.includes(params.value)) {
                // Valeur invalide pour ce select → on conserve la valeur actuelle
                return params.node?.data?.[colDef.field] ?? params.value;
            }
        }

        return params.value;
    }, []);

    const isLargeGrid = rows.length > 100;

    // Ligne de totaux interactive (valeurs calculées selon colAggregations)
    const pinnedBottomRowData = useMemo(() => {
        if (rows.length === 0) return [];
        // Filtrer les lignes selon les conditions actives (cohérent avec doesExternalFilterPass)
        const activeConditions = filterConditions.filter(isConditionActive);
        const filteredRows = activeConditions.length === 0
            ? rows
            : rows.filter(r => {
                let result = evaluateCondition(activeConditions[0], r);
                for (let i = 1; i < activeConditions.length; i++) {
                    const cond = activeConditions[i];
                    const condResult = evaluateCondition(cond, r);
                    result = cond.logic === 'ou' ? result || condResult : result && condResult;
                }
                return result;
            });
        const totals = { _isPinnedTotal: true };
        schema.forEach(col => {
            // Exclure les types clairement non-numériques
            if (NON_NUMERIC_TYPES.has(col.type)) return;
            if (col.key === 'detail' || col.key === 'sel') return;
            const aggType = colAggregations[col.key] || 'none';
            if (aggType === 'none') return;
            const values = filteredRows.map(r => {
                if (col.valueGetter) {
                    try { return col.valueGetter({ row: r }); } catch { return r[col.key]; }
                }
                return r[col.key];
            });
            const result = computeAgg(values, aggType);
            if (result !== null) totals[col.key] = result;
        });
        return [totals];
    }, [rows, schema, colAggregations, filterConditions]);

    // Vue mobile (cards)
    if (isMobile) {
        const MobileCard = ({ row }) => {
            let mainStatus = { label: '—', bg: '#F3F4F6', color: '#6B7280' };
            if (row.statut_pose === 'Terminé') mainStatus = { label: 'Posé', bg: '#ECFDF5', color: '#065F46' };
            else if (row.statut_conf === 'Terminé') mainStatus = { label: 'Confectionné', bg: '#FDF2F8', color: '#9D174D' };
            else if (row.statut_prepa === 'Terminé') mainStatus = { label: 'Prêt', bg: '#F5F3FF', color: '#5B21B6' };
            else if (row.statut_cotes === 'Validé par chef de projet') mainStatus = { label: 'Côte validée', bg: '#EFF6FF', color: '#1E40AF' };
            else if (row.statut_cotes === 'Définitive') mainStatus = { label: 'Coté', bg: '#DBEAFE', color: '#1D4ED8' };
            else if (row.statut_cotes === 'Déduction restante à faire') mainStatus = { label: 'Déduction', bg: '#FEF3C7', color: '#92400E' };
            return (
                <div onClick={() => handleOpenDetail(row)} style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{row.piece || 'Sans pièce'}</div>
                            <div style={{ fontSize: 13, color: '#4B5563', marginTop: 2 }}>{row.produit || '—'}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                            <div style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: mainStatus.bg, color: mainStatus.color, textTransform: 'uppercase' }}>{mainStatus.label}</div>
                            {row.statut_expedition && row.statut_expedition !== 'Non expédié' && (() => {
                                const EXP_MOBILE = {
                                    'En préparation':        { bg: '#FEF3C7', color: '#92400E', label: '📦 En prépa' },
                                    'Expédié':               { bg: '#D1FAE5', color: '#065F46', label: '🚚 Expédié' },
                                    'Rail expédié':          { bg: '#DBEAFE', color: '#1E40AF', label: '🚚 Rail exp.' },
                                    'Rideau expédié':        { bg: '#EDE9FE', color: '#5B21B6', label: '🚚 Rideau exp.' },
                                    'Rail + Rideau expédié': { bg: '#D1FAE5', color: '#065F46', label: '🚚 Tout exp.' },
                                };
                                const s = EXP_MOBILE[row.statut_expedition];
                                if (!s) return null;
                                return <div style={{ padding: '2px 6px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</div>;
                            })()}
                        </div>
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

    useEffect(() => {
        const activeFields = new Set(filterConditions.filter(isConditionActive).map(c => c.field));
        activeFilterFieldsRef.current = activeFields;
        if (!isGridReadyRef.current || !gridRef.current?.api) return;
        gridRef.current.api.onFilterChanged();
        gridRef.current.api.refreshHeader();
    }, [filterConditions]);

    // Rafraîchit les cellules AG Grid quand rowData change (ex: mise à jour prix catalog ML)
    useEffect(() => {
        if (!isGridReadyRef.current || !gridRef.current?.api) return;
        gridRef.current.api.refreshCells({ force: true });
    }, [rows]);

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
                {selectedCount > 0 && (
                    <button onClick={handleExportExcel} style={{ cursor: 'pointer', padding: '5px 10px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                        <FileSpreadsheet size={14} /> Export Excel ({selectedCount})
                    </button>
                )}
                {selectedCount > 0 && !readOnly && bulkStatutCols.length > 0 && (
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowBulkUpdate(s => !s)}
                            style={{ cursor: 'pointer', padding: '5px 10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                        >
                            <Edit2 size={14} /> Mettre à jour ({selectedCount})
                        </button>
                        {showBulkUpdate && (
                            <div style={{
                                position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 999,
                                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                                boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '14px 16px',
                                minWidth: 260, display: 'flex', flexDirection: 'column', gap: 10,
                            }}>
                                <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>
                                    Mettre à jour {selectedCount} ligne{selectedCount > 1 ? 's' : ''}
                                </div>
                                <select
                                    style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, width: '100%' }}
                                    value={bulkField}
                                    onChange={e => { setBulkField(e.target.value); setBulkValue(''); }}
                                >
                                    <option value="">— Choisir un statut —</option>
                                    {bulkStatutCols.map(c => (
                                        <option key={c.key} value={c.key}>{c.label}</option>
                                    ))}
                                </select>
                                {bulkField && (
                                    <select
                                        style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, width: '100%' }}
                                        value={bulkValue}
                                        onChange={e => setBulkValue(e.target.value)}
                                    >
                                        <option value="">— Choisir une valeur —</option>
                                        {(bulkStatutCols.find(c => c.key === bulkField)?._resolvedOptions ?? []).map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                )}
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={() => setShowBulkUpdate(false)}
                                        style={{ padding: '5px 10px', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: 12, background: '#fff' }}
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        onClick={applyBulkUpdate}
                                        disabled={!bulkField || !bulkValue}
                                        style={{ padding: '5px 10px', background: !bulkField || !bulkValue ? '#93c5fd' : '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: !bulkField || !bulkValue ? 'not-allowed' : 'pointer', fontSize: 12 }}
                                    >
                                        Appliquer
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {/* Recherche rapide */}
                <input
                    type="text"
                    placeholder="Rechercher..."
                    value={quickFilter}
                    onChange={e => setQuickFilter(e.target.value)}
                    style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, width: 160, outline: 'none' }}
                />
                {/* Bouton Filtrer */}
                {(() => {
                    const activeFields = [...new Set(
                        filterConditions.filter(isConditionActive)
                            .map(c => schema.find(s => s.key === c.field)?.label || c.field)
                    )];
                    const hasActive = activeFields.length > 0;
                    const label = hasActive ? `Filtré par ${activeFields.join(' et ')}` : 'Filtrer';
                    return (
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => { setFilterPanelOpen(o => !o); setColPanelOpen(false); setMatierePanelOpen(false); }}
                                style={{
                                    cursor: 'pointer', padding: '5px 10px',
                                    background: hasActive ? '#dcfce7' : (filterPanelOpen ? '#eff6ff' : 'white'),
                                    color: hasActive ? '#15803d' : '#374151',
                                    border: `1px solid ${hasActive ? '#86efac' : (filterPanelOpen ? '#2563eb' : '#d1d5db')}`,
                                    borderRadius: 4, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
                                    fontWeight: hasActive ? 600 : 400,
                                }}
                            >
                                <Filter size={14} /> {label}
                            </button>
                            {filterPanelOpen && (
                                <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: 4, zIndex: 1001 }}>
                                    <FilterPanel
                                        schema={schema}
                                        conditions={filterConditions}
                                        onChange={setFilterConditions}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })()}
                {filterPanelOpen && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }} onClick={() => setFilterPanelOpen(false)} />
                )}
                {/* Bouton Configuration (Matières + Méca + Conf) */}
                {matiereGroups?.length > 0 && (
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => { setMatierePanelOpen(prev => !prev); setColPanelOpen(false); }}
                            style={{ cursor: 'pointer', padding: '5px 10px', background: matierePanelOpen ? '#eff6ff' : 'white', color: '#374151', border: `1px solid ${matierePanelOpen ? '#2563eb' : '#d1d5db'}`, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                        >
                            <Layers size={14} /> Configuration
                        </button>
                        {matierePanelOpen && (
                            <div style={{
                                position: 'absolute', left: 0, top: '100%', marginTop: 4,
                                background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
                                boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 1000,
                                padding: 8, display: 'flex', gap: 0,
                            }}>
                                {/* Colonne Matières actives */}
                                <div style={{ minWidth: 180, paddingRight: mecaGroups.length > 0 || confGroups.length > 0 ? 12 : 0, borderRight: mecaGroups.length > 0 || confGroups.length > 0 ? '1px solid #f3f4f6' : 'none' }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', padding: '4px 8px 8px', borderBottom: '1px solid #f3f4f6', marginBottom: 4 }}>
                                        Matières actives
                                    </div>
                                    {matiereGroups.map(group => (
                                        <label key={group.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <input type="checkbox" checked={localMatieres[group.id] !== false} onChange={e => handleToggleMatiere(group.id, e.target.checked)} style={{ accentColor: '#2563eb', width: 14, height: 14 }} />
                                            <span>{group.label}</span>
                                        </label>
                                    ))}
                                </div>

                                {/* Colonne Méca actifs */}
                                {mecaGroups.length > 0 && (
                                    <div style={{ minWidth: 150, paddingLeft: 12, paddingRight: confGroups.length > 0 ? 12 : 0, borderRight: confGroups.length > 0 ? '1px solid #f3f4f6' : 'none' }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', padding: '4px 8px 8px', borderBottom: '1px solid #f3f4f6', marginBottom: 4 }}>
                                            Méca actifs
                                        </div>
                                        {mecaGroups.map(group => (
                                            <label key={group.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
                                                onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <input type="checkbox" checked={localMeca[group.id] !== false} onChange={e => handleToggleMeca(group.id, e.target.checked)} style={{ accentColor: '#2563eb', width: 14, height: 14 }} />
                                                <span>{group.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}

                                {/* Colonne Conf actifs */}
                                {confGroups.length > 0 && (
                                    <div style={{ minWidth: 150, paddingLeft: 12 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', padding: '4px 8px 8px', borderBottom: '1px solid #f3f4f6', marginBottom: 4 }}>
                                            Conf actifs
                                        </div>
                                        {confGroups.map(group => (
                                            <label key={group.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
                                                onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <input type="checkbox" checked={localConf[group.id] !== false} onChange={e => handleToggleConf(group.id, e.target.checked)} style={{ accentColor: '#2563eb', width: 14, height: 14 }} />
                                                <span>{group.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
                {matierePanelOpen && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setMatierePanelOpen(false)} />
                )}

                {/* Bouton colonnes */}
                <div style={{ position: 'relative', marginLeft: 'auto' }}>
                    <button
                        ref={colBtnRef}
                        onClick={handleToggleColPanel}
                        style={{ cursor: 'pointer', padding: '5px 10px', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                    >
                        <Columns size={14} /> Colonnes
                    </button>
                </div>
                {/* Fermer le panneau colonnes en cliquant ailleurs */}
                {colPanelOpen && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setColPanelOpen(false)} />
                )}
                {/* Panel colonnes en position fixed pour ne pas être rogné par les overflow parents */}
                {colPanelOpen && colPanelPos && (
                    <div
                        style={{
                            position: 'fixed',
                            top: colPanelPos.top,
                            right: colPanelPos.right,
                            background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
                            boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 1000,
                            maxHeight: 'calc(100vh - ' + colPanelPos.top + 'px - 16px)',
                            display: 'flex', flexDirection: 'column',
                            width: 'min(720px, calc(100vw - 32px))',
                        }}
                    >
                        {/* En-tête fixe */}
                        <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', padding: '0 4px 6px' }}>Afficher / Masquer</div>
                            {/* Barre de recherche */}
                            <div style={{ position: 'relative', marginBottom: 6 }}>
                                <input
                                    type="text"
                                    placeholder="Rechercher une colonne…"
                                    value={colSearch}
                                    onChange={e => setColSearch(e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                    style={{ width: '100%', boxSizing: 'border-box', padding: '5px 8px 5px 26px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, outline: 'none' }}
                                />
                                <svg style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            </div>
                            {/* Tout cocher / décocher */}
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                    onClick={e => { e.stopPropagation(); handleToggleAllColumns(true); }}
                                    style={{ flex: 1, padding: '4px 6px', fontSize: 11, cursor: 'pointer', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 4, fontWeight: 600 }}
                                >Tout afficher</button>
                                <button
                                    onClick={e => { e.stopPropagation(); handleToggleAllColumns(false); }}
                                    style={{ flex: 1, padding: '4px 6px', fontSize: 11, cursor: 'pointer', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, fontWeight: 600 }}
                                >Tout masquer</button>
                            </div>
                        </div>
                        {/* Grille multi-colonnes */}
                        <div style={{ overflowY: 'auto', padding: '8px 12px 12px' }}>
                            {(() => {
                                const filtered = schemaCols.filter(col => !colSearch || col.label.toLowerCase().includes(colSearch.toLowerCase()));
                                if (filtered.length === 0) {
                                    return <div style={{ padding: '8px 4px', fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>Aucune colonne trouvée</div>;
                                }
                                const COLS = 3;
                                const perCol = Math.ceil(filtered.length / COLS);
                                const columns = Array.from({ length: COLS }, (_, i) => filtered.slice(i * perCol, (i + 1) * perCol));
                                return (
                                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: '0 16px' }}>
                                        {columns.map((group, gi) => (
                                            <div key={gi}>
                                                {group.map(col => (
                                                    <label key={col.field} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
                                                        onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={colVisibility[col.field] !== false}
                                                            onChange={e => handleToggleColumn(col.field, e.target.checked)}
                                                            style={{ accentColor: '#2563eb', flexShrink: 0 }}
                                                        />
                                                        <span>{col.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
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
            <div ref={gridContainerRef} className="ag-theme-alpine" style={{ width: '100%', height: isLargeGrid ? 600 : undefined }}>
                <AgGridReact
                    ref={gridRef}
                    rowData={rows}
                    cellSelection={readOnly ? false : { handle: { mode: 'fill' } }}
                    pinnedBottomRowData={pinnedBottomRowData}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    autoGroupColumnDef={autoGroupColumnDef}
                    rowGroupPanelShow="always"
                    groupDefaultExpanded={0}
                    suppressAggFuncInHeader={true}
                    onColumnRowGroupChanged={onColumnRowGroupChanged}
                    context={{ colAggregations, onAggregationChange }}
                    getRowStyle={(params) => {
                        if (params.node.rowPinned === 'bottom') {
                            return { background: '#f0fdf4', borderTop: '2px solid #10b981' };
                        }
                        const role = params.data?.pair_role;
                        if (role === 'parent') return { background: '#eef2ff', fontWeight: 600 };
                        if (role === 'left' || role === 'right') return { background: '#f8fafc' };
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
                    onCellClicked={onCellClicked}
                    onCellValueChanged={onCellValueChanged}
                    processCellFromClipboard={processCellFromClipboard}
                    onGridReady={onGridReady}
                    onColumnResized={onColumnResized}
                    onColumnVisible={onColumnVisible}
                    onColumnMoved={onColumnMoved}
                    isExternalFilterPresent={isExternalFilterPresent}
                    doesExternalFilterPass={doesExternalFilterPass}
                    localeText={AG_GRID_LOCALE_FR}
                    theme="legacy"
                    animateRows={false}
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
