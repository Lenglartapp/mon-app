import React, { useState } from 'react';
import Box from '@mui/material/Box';
import { DataGrid } from '@mui/x-data-grid';
import { frFR } from '@mui/x-data-grid/locales';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import HistoryIcon from '@mui/icons-material/History';
import ProductHistoryModal from './ProductHistoryModal';
import EditStockItemModal from './EditStockItemModal';
import { useMemo } from 'react';
import { Download, Upload, Map as MapIcon, Filter as FilterIcon, ChevronDown } from 'lucide-react';
import { stockSortCompare } from '../../../lib/inventory/stockImport';
import StockImportDialog from './StockImportDialog';
import StockExportDialog from './StockExportDialog';
import WarehouseMap from './WarehouseMap';
import { itemMetaColumns } from './stockColumns';
import LocationChips from './LocationChips';
import { ToolbarButton, TonePill } from '../../ui/ToolbarControls';
import CategorySearch, { SEARCH_ALL } from '../../ui/CategorySearch';
import GridTotalsFooter from '../../ui/GridTotalsFooter';
import FilterPanel, { isConditionActive, evaluateCondition } from '../../FilterPanel';
import FitGridFrame from '../../ui/FitGridFrame';
import { DATAGRID_DA_SX } from '../../../lib/constants/daStyles';
import { LOC_A_COMPLETER, splitLocations } from '../../../lib/inventory/stockFields';
import { itemStatusOf, itemStatusCodeOf, itemGroupOf, STOCK_GROUPS } from '../../../lib/inventory/stockStatus';

// Recherche par catégorie : la barre propose où chercher (« Partout » = toutes ces colonnes).
const SEARCH_CATEGORIES = [
    { key: 'fournisseur', label: 'Fournisseur' },
    { key: 'ref', label: 'Référence' },
    { key: 'coloris', label: 'Coloris' },
    { key: 'project', label: 'Affectation' },
    { key: 'location', label: 'Emplacement' },
];
const searchTexts = (item, key) => {
    if (key === 'ref') return [item.ref, item.product];
    if (key === SEARCH_ALL) return [item.product, ...SEARCH_CATEGORIES.map(c => item[c.key])];
    return [item[key]];
};
const matchesSearch = (item, key, text) => {
    const q = String(text || '').trim().toLowerCase();
    return !q || searchTexts(item, key).some(v => String(v ?? '').toLowerCase().includes(q));
};

// Ligne « Total » : préférences de calcul gardées sur le poste (vide par défaut).
const TOTALS_STORAGE_KEY = 'df.stock.inventory.totals';
const readTotals = () => { try { return JSON.parse(localStorage.getItem(TOTALS_STORAGE_KEY)) || {}; } catch { return {}; } };

export default function StockInventoryTab({ inventory, projects = [], movements = [], onBulkMovement, onImportStock, onUpdateItem, zones = [], embedded = false, preset = null, canEditStatus = false }) {
    const [search, setSearch] = useState('');
    const [searchField, setSearchField] = useState(SEARCH_ALL);
    const [totals, setTotals] = useState(readTotals);
    const saveTotals = (next) => { setTotals(next); try { localStorage.setItem(TOTALS_STORAGE_KEY, JSON.stringify(next)); } catch { /* stockage indisponible */ } };
    const [showMap, setShowMap] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);

    // Filtres : conditions du panneau « Filtrer » (même module que les tableaux du chiffrage)
    // preset : ouverture depuis la Ventilation du stock (filtre Famille + tri par volume), le
    // temps de cette visite seulement — le module ne le repasse plus ensuite.
    const [filterConditions, setFilterConditions] = useState(() => (preset?.group
        ? [{ id: 'preset-group', logic: 'et', field: 'group', operator: 'equals', value: preset.group }] : []));
    const [filterPanelOpen, setFilterPanelOpen] = useState(false);
    // Note flottante « réceptions à compléter » : repliée par défaut, filtre à la demande
    const [onlyToComplete, setOnlyToComplete] = useState(false);
    const [toCompleteOpen, setToCompleteOpen] = useState(false);

    // History Modal State
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyProduct, setHistoryProduct] = useState(null);
    const [editItem, setEditItem] = useState(null);

    // Une ligne = une entrée de stock : double-clic → sa fiche (sinon, lecture seule, son historique)
    const handleRowDoubleClick = (params) => {
        if (onUpdateItem) {
            setEditItem(params.row._item);
            return;
        }
        setHistoryProduct(params.row);
        setHistoryOpen(true);
    };

    const CATEGORIES = ['ALL', 'Tissu', 'Rail', 'Consommable', 'Mécanisme', 'Divers'];

    const STATUSES = [
        { key: 'ALL', label: 'Tous' },
        { key: 'TODO', label: 'Réservé' },
        { key: 'IN_PROGRESS', label: 'En cours' },
        { key: 'DONE', label: 'Reliquat' },
        { key: 'SAV', label: 'SAV' },
        { key: 'ARCHIVED', label: 'Stock mort' },
        { key: 'LIBRE', label: 'Stock libre' }
    ];

    // Extract unique locations for filter
    const allLocs = new Set(inventory.flatMap(i => splitLocations(i.location)));
    const locations = ['ALL', ...(allLocs.has(LOC_A_COMPLETER) ? [LOC_A_COMPLETER] : []), ...[...allLocs].filter(l => l !== LOC_A_COMPLETER).sort()];

    // Champs proposés dans le panneau « Filtrer »
    const filterSchema = [
        { key: 'fournisseur', label: 'Fournisseur', type: 'text' },
        { key: 'ref', label: 'Référence', type: 'text' },
        { key: 'coloris', label: 'Coloris', type: 'text' },
        { key: 'laize', label: 'Laize', type: 'number' },
        { key: 'category', label: 'Type', type: 'select', options: CATEGORIES.filter(c => c !== 'ALL') },
        { key: 'location', label: 'Emplacement', type: 'select', options: locations.filter(l => l !== 'ALL') },
        // Affectation : saisie libre (contient / ne contient pas…) — trop de dossiers pour une liste
        { key: 'project', label: 'Affectation', type: 'text' },
        { key: 'group', label: 'Famille', type: 'select', options: STOCK_GROUPS.map(g => ({ value: g.key, label: g.label })) },
        { key: 'status', label: 'Statut', type: 'select', options: STATUSES.filter(st => st.key !== 'ALL').map(st => ({ value: st.key, label: st.label })) },
        { key: 'qty', label: 'Stock dispo', type: 'number' },
    ];
    const toCompleteCount = inventory.filter(i => i.qty !== 0 && splitLocations(i.location).includes(LOC_A_COMPLETER)).length;

    const columns = useMemo(() => [
        ...itemMetaColumns(),
        {
            field: 'category',
            headerName: 'Type',
            width: 120,
            renderCell: (params) => <span style={{ color: 'var(--df-text-2)' }}>{params.value || 'Divers'}</span>
        },
        {
            field: 'location',
            headerName: 'Emplacement',
            width: 160,
            renderCell: (params) => <LocationChips value={params.value} unit={params.row.unit} />
        },
        {
            field: 'project',
            headerName: 'Affectation',
            width: 180,
            renderCell: (params) => params.value
                ? <span title={params.value} style={{ color: 'var(--df-text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{params.value}</span>
                : <span style={{ color: 'var(--df-faint)' }}>Stock libre</span>
        },
        {
            field: 'stockStatus',
            headerName: 'Statut',
            width: 140,
            renderCell: (params) => {
                const s = itemStatusOf(params.row, projects);
                return <TonePill tone={s.tone}>{s.label}</TonePill>;
            }
        },
        {
            field: 'qty',
            headerName: 'Stock Dispo',
            width: 150,
            align: 'right',
            headerAlign: 'right',
            renderCell: (params) => {
                const piecesCount = Array.isArray(params.row.pieces) ? params.row.pieces.length : 0;
                return (
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: params.value > 0 ? '#059669' : 'var(--df-danger)' }}>
                            {params.value} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--df-muted)' }}>{params.row.unit}</span>
                        </div>
                        {piecesCount > 0 && (
                            <div style={{ fontSize: 10, color: '#6366F1', fontWeight: 600 }}>
                                ({piecesCount} pièce{piecesCount > 1 ? 's' : ''})
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            field: '_history',
            headerName: '',
            width: 56,
            sortable: false,
            filterable: false,
            renderCell: (params) => (
                <IconButton
                    size="small"
                    title="Historique des mouvements"
                    onClick={(e) => { e.stopPropagation(); setHistoryProduct(params.row); setHistoryOpen(true); }}
                >
                    <HistoryIcon fontSize="small" />
                </IconButton>
            )
        },
    ], [projects]);

    // Ligne « Total » : colonnes chiffrées (Stock dispo par unité) ; Statut lu comme affiché
    const totalsColumns = {
        qty: { numeric: true, unitField: 'unit' },
        laize: { numeric: true },
        project: { getValue: (row) => row.project || '' },
        stockStatus: { getValue: (row) => itemStatusOf(row, projects).label },
    };

    const activeConditions = filterConditions.filter(isConditionActive);
    // Tous les filtres sauf la recherche (sert aussi aux compteurs du menu de recherche)
    const passesFilters = (item) => {
        if (item.qty === 0) return false; // quantités nulles masquées
        if (onlyToComplete && !splitLocations(item.location).includes(LOC_A_COMPLETER)) return false;
        if (activeConditions.length === 0) return true;
        const flat = { ...item, project: item.project || '', status: itemStatusCodeOf(item, projects), group: itemGroupOf(item, projects) };
        const test = (cond) => {
            // Emplacement : un article peut être à plusieurs endroits (« ATELIER, B3 ») → « est » = l'un d'eux
            if (cond.field === 'location' && (cond.operator === 'equals' || cond.operator === 'notEqual')) {
                const has = splitLocations(item.location).some(l => l.toLowerCase() === String(cond.value).toLowerCase());
                return cond.operator === 'equals' ? has : !has;
            }
            return evaluateCondition(cond, flat);
        };
        let ok = test(activeConditions[0]);
        for (let i = 1; i < activeConditions.length; i++) {
            const v = test(activeConditions[i]);
            ok = activeConditions[i].logic === 'ou' ? ok || v : ok && v;
        }
        return ok;
    };
    const baseRows = inventory.filter(passesFilters);
    const filteredRows = baseRows.filter(item => matchesSearch(item, searchField, search));
    // Nombre de lignes du tableau trouvées dans une catégorie
    const searchCount = (key, text) => baseRows.filter(item => matchesSearch(item, key, text)).length;

    // Une ligne = une entrée de stock (une réception, une affectation) : deux entrées de la même
    // référence restent séparées (autre dossier, autre bain…). Seules les pièces d'une même
    // entrée sont ensemble. Anciens articles rangés « par pièce » : leurs emplacements remontent.
    // Ordre : réceptions « À compléter » d'abord, puis par emplacement (A1, A2… A10, B1).
    const rows = useMemo(() => filteredRows.map(item => {
        const pieceLocs = (Array.isArray(item.pieces) ? item.pieces : []).map(p => p.location).filter(Boolean);
        return {
            ...item,
            project: item.project || '',
            location: [...new Set([...splitLocations(item.location), ...pieceLocs])].sort().join(', '),
            _item: item,
        };
    }).sort(stockSortCompare), [filteredRows]);

    return (
        <Box>
            {/* Barre de filtres (sans cadre, style des listes Chiffrages / Projets) : filtres à gauche, actions à droite */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                <CategorySearch
                    value={search}
                    field={searchField}
                    onChange={({ value, field }) => { setSearch(value); setSearchField(field); }}
                    categories={SEARCH_CATEGORIES}
                    countFor={searchCount}
                    placeholder="Fournisseur, référence, coloris…"
                    width={280}
                />
                <div style={{ position: 'relative' }}>
                    <ToolbarButton
                        icon={<FilterIcon size={16} />}
                        active={activeConditions.length > 0}
                        onClick={() => setFilterPanelOpen(o => !o)}
                    >
                        {activeConditions.length > 0 ? `Filtré (${activeConditions.length})` : 'Filtrer'}
                    </ToolbarButton>
                    {filterPanelOpen && (
                        <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }} onClick={() => setFilterPanelOpen(false)} />
                            <div style={{ position: 'absolute', left: 0, top: 'calc(100% + 4px)', zIndex: 1001 }}>
                                <FilterPanel schema={filterSchema} conditions={filterConditions} onChange={setFilterConditions} />
                            </div>
                        </>
                    )}
                </div>

                {(search || activeConditions.length > 0 || onlyToComplete) && (
                    <button
                        onClick={() => { setSearch(''); setSearchField(SEARCH_ALL); setFilterConditions([]); setOnlyToComplete(false); }}
                        style={{ border: 'none', background: 'none', color: 'var(--df-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', padding: '0 4px', fontFamily: 'inherit' }}
                    >
                        Réinitialiser
                    </button>
                )}

                <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <ToolbarButton icon={<MapIcon size={16} />} active={showMap} onClick={() => setShowMap(v => !v)}>
                        Vue entrepôt
                    </ToolbarButton>
                    <ToolbarButton icon={<Download size={16} />} onClick={() => setExportOpen(true)} title="Exporter le stock en Excel : réimport, feuille de comptage ou état à envoyer">
                        Exporter
                    </ToolbarButton>
                    {(onImportStock || onBulkMovement) && (
                        <ToolbarButton icon={<Upload size={16} />} onClick={() => setImportOpen(true)} title="Ajouter de l'ancien stock ou mettre à jour le stock depuis Excel">
                            Importer
                        </ToolbarButton>
                    )}
                </div>
            </div>

            {exportOpen && (
                <StockExportDialog
                    onClose={() => setExportOpen(false)}
                    allItems={inventory}
                    shownItems={filteredRows}
                    filtered={!!(search || activeConditions.length || onlyToComplete)}
                    statusOf={(it) => itemStatusOf(it, projects).label}
                />
            )}

            {importOpen && (
                <StockImportDialog
                    onClose={() => setImportOpen(false)}
                    inventory={inventory}
                    exportItems={filteredRows}
                    zones={zones}
                    onImport={onImportStock}
                    onUpdate={onBulkMovement}
                />
            )}

            {/* Note flottante bas-droite (comme « pièces en double » du chiffrage) : réceptions dont
                l'emplacement reste à compléter. Repliée par défaut ; filtre le tableau à la demande. */}
            {toCompleteCount > 0 && (
                <div style={{
                    // En bas à GAUCHE : la pagination du tableau occupe le bas à droite.
                    // Dans une fenêtre (stock d'un dossier) : posée dans le flux, au-dessus du tableau.
                    ...(embedded ? { display: 'inline-block', marginBottom: 12 } : { position: 'fixed', bottom: 24, left: 24, zIndex: 1200 }),
                    background: 'var(--df-amber-bg)', border: '1px solid #F59E0B', borderRadius: 10,
                    fontSize: 13, color: 'var(--df-warn-text)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxWidth: 360,
                }}>
                    <button
                        onClick={() => setToCompleteOpen(o => !o)}
                        aria-expanded={toCompleteOpen}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 14px', font: 'inherit', color: 'inherit', textAlign: 'left' }}
                    >
                        <span style={{ fontSize: 16, lineHeight: 1 }}>📍</span>
                        <span style={{ fontWeight: 700, flex: 1 }}>
                            {toCompleteCount} réception{toCompleteCount > 1 ? 's' : ''} à compléter
                        </span>
                        <ChevronDown size={16} style={{ transform: toCompleteOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease', flexShrink: 0, opacity: .8 }} />
                    </button>
                    {toCompleteOpen && (
                        <div style={{ borderTop: '1px solid var(--df-x-FCD34D)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ fontSize: 12, opacity: 0.9 }}>
                                Articles reçus via Odoo dont l'emplacement de rangement n'est pas encore renseigné.
                            </div>
                            <button
                                onClick={() => setOnlyToComplete(v => !v)}
                                style={{ alignSelf: 'flex-start', border: '1px solid #F59E0B', background: onlyToComplete ? 'var(--df-warn-text)' : 'var(--df-bg)', color: onlyToComplete ? 'white' : 'var(--df-warn-text)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                                {onlyToComplete ? 'Afficher tout le stock' : 'Afficher uniquement ces réceptions'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* VUE ENTREPÔT */}
            {showMap && (
                <Box sx={{ mb: 3 }}>
                    <WarehouseMap zones={zones} inventory={inventory} />
                </Box>
            )}

            {/* INVENTORY GRID */}
            {/* Tablette (< 1200 px) : le tableau occupe la hauteur d'écran disponible au lieu de 600 px fixes
                (en portrait on ne voyait que 7 lignes, avec un grand vide dessous). */}
            <FitGridFrame>
                <DataGrid
                    rows={rows}
                    columns={columns}
                    density="comfortable"
                    disableSelectionOnClick
                    onRowDoubleClick={handleRowDoubleClick}
                    localeText={frFR.components.MuiDataGrid.defaultProps.localeText}
                    sx={DATAGRID_DA_SX}
                    initialState={preset?.sortByQty ? { sorting: { sortModel: [{ field: 'qty', sort: 'desc' }] } } : undefined}
                    slots={{ footer: GridTotalsFooter }}
                    slotProps={{ footer: { totals, onTotalsChange: saveTotals, columnsConfig: totalsColumns } }}
                />
            </FitGridFrame>

            {/* HISTORY MODAL */}
            {editItem && (
                <EditStockItemModal
                    item={editItem}
                    zones={zones}
                    projects={projects}
                    canEditStatus={canEditStatus}
                    onClose={() => setEditItem(null)}
                    onSave={async (patch, operator, reason) => {
                        const r = await onUpdateItem(editItem.id, patch, { operator, reason });
                        if (!r || r.success !== false) setEditItem(null);
                    }}
                />
            )}

            {historyOpen && (
                <ProductHistoryModal
                    open={historyOpen}
                    onClose={() => setHistoryOpen(false)}
                    product={historyProduct}
                    movements={movements}
                />
            )}
        </Box>
    );
}
