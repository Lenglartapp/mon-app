import React, { useState } from 'react';
import Box from '@mui/material/Box';
import { DataGrid } from '@mui/x-data-grid';
import { frFR } from '@mui/x-data-grid/locales';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import HistoryIcon from '@mui/icons-material/History';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ProductHistoryModal from './ProductHistoryModal';
import EditStockItemModal from './EditStockItemModal';
import { useMemo, useRef } from 'react';
import { Download, Upload, Map as MapIcon } from 'lucide-react';
import { exportInventoryToExcel, processInventoryClearanceImport } from '../../../lib/utils/inventoryExcelUtils';
import { useAuth } from '../../../auth';
import WarehouseMap from './WarehouseMap';
import { itemMetaColumns } from './stockColumns';
import LocationChips from './LocationChips';
import { ToolbarSearch, ToolbarSelect, ToolbarButton, TonePill } from '../../ui/ToolbarControls';
import { DATAGRID_DA_SX, TABLE_FRAME_STYLE } from '../../../lib/constants/daStyles';
import { LOC_A_COMPLETER, splitLocations } from '../../../lib/inventory/stockFields';

// Statut du stock d'après le dossier affecté : une pastille du nuancier bleu, du plus engagé
// (réservé, bleu nuit) au plus libre (bleu ciel). Codes anglais ou libellés français acceptés.
const STOCK_STATUS = {
    TODO: { label: 'Réservé', tone: 0 },
    IN_PROGRESS: { label: 'En cours', tone: 1 },
    DONE: { label: 'Reliquat', tone: 2 },
    SAV: { label: 'SAV', tone: 3 },
    ARCHIVED: { label: 'Stock mort', tone: 4 },
    LIBRE: { label: 'Libre', tone: 5 },
};
const STATUS_FROM_LABEL = { 'à commencer': 'TODO', 'réservé': 'TODO', 'en cours': 'IN_PROGRESS', 'terminé': 'DONE', 'reliquat': 'DONE', 'sav': 'SAV', 'archivé': 'ARCHIVED', 'stock mort': 'ARCHIVED' };
function stockStatusOf(projectName, projects) {
    if (!projectName) return STOCK_STATUS.LIBRE;
    const proj = projects.find(p => p.name === projectName);
    if (!proj) return { label: '?', tone: 4 };
    const code = STOCK_STATUS[proj.status] ? proj.status : STATUS_FROM_LABEL[String(proj.status || '').toLowerCase()];
    return STOCK_STATUS[code] || { label: proj.status || '?', tone: 4 };
}

export default function StockInventoryTab({ inventory, projects = [], movements = [], onBulkMovement, onUpdateItem, zones = [] }) {
    const { currentUser } = useAuth();
    const fileInputRef = useRef(null);
    const [search, setSearch] = useState('');
    const [showMap, setShowMap] = useState(false);

    const handleExport = async () => {
        try {
            await exportInventoryToExcel(inventory);
        } catch (err) {
            alert("Erreur lors de l'export: " + err.message);
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleImportFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const updates = await processInventoryClearanceImport(file, inventory);
            if (updates.length === 0) {
                alert("Aucun changement (quantité ou emplacement) détecté dans le fichier.");
                return;
            }

            const qtyChanges = updates.filter(u => u.hasQtyChange).length;
            const locChanges = updates.filter(u => u.hasLocChange).length;

            let confirmMsg = `Import Excel : \n- ${qtyChanges} sortie(s) de stock\n- ${locChanges} déplacement(s) d'emplacement\n\nConfirmer la mise à jour ?`;
            
            if (window.confirm(confirmMsg)) {
                const res = await onBulkMovement(updates, currentUser?.name || 'Administrateur');
                if (res.success) {
                    alert(`Succès : ${updates.length} articles mis à jour.`);
                }
            }
        } catch (err) {
            alert("Erreur lors de l'import: " + err.message);
        } finally {
            e.target.value = ''; // Reset input
        }
    };
    const [filterLoc, setFilterLoc] = useState('ALL');
    const [filterProj, setFilterProj] = useState(null); // Project Name or null
    const [filterCat, setFilterCat] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');

    // History Modal State
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyProduct, setHistoryProduct] = useState(null);
    const [editItem, setEditItem] = useState(null);
    const [pickSources, setPickSources] = useState(null); // ligne groupée → choix de l'entrée à éditer

    const handleRowDoubleClick = (params) => {
        const src = params.row._sourceItems || [];
        // Article simple (une seule entrée sous-jacente) → édition ; plusieurs → choisir laquelle
        if (src.length === 1 && onUpdateItem) {
            setEditItem(src[0]);
            return;
        }
        if (src.length > 1 && onUpdateItem) {
            setPickSources(src);
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
        { key: 'ARCHIVED', label: 'Stock mort' },
        { key: 'LIBRE', label: 'Stock libre' }
    ];

    // Extract unique locations for filter
    const allLocs = new Set(inventory.flatMap(i => splitLocations(i.location)));
    const locations = ['ALL', ...(allLocs.has(LOC_A_COMPLETER) ? [LOC_A_COMPLETER] : []), ...[...allLocs].filter(l => l !== LOC_A_COMPLETER).sort()];
    const toCompleteCount = inventory.filter(i => i.qty !== 0 && splitLocations(i.location).includes(LOC_A_COMPLETER)).length;

    const columns = useMemo(() => [
        ...itemMetaColumns(),
        {
            field: 'category',
            headerName: 'Type',
            width: 120,
            renderCell: (params) => <span style={{ color: '#374151' }}>{params.value || 'Divers'}</span>
        },
        {
            field: 'location',
            headerName: 'Emplacement',
            width: 160,
            renderCell: (params) => <LocationChips value={params.value} breakdown={params.row.locBreakdown} unit={params.row.unit} />
        },
        {
            field: 'project',
            headerName: 'Affectation',
            width: 180,
            renderCell: (params) => params.value
                ? <span title={params.value} style={{ color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis' }}>{params.value}</span>
                : <span style={{ color: '#9CA3AF' }}>Stock libre</span>
        },
        {
            field: 'stockStatus',
            headerName: 'Statut',
            width: 140,
            renderCell: (params) => {
                const s = stockStatusOf(params.row.project, projects);
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
                        <div style={{ fontWeight: 700, fontSize: 15, color: params.value > 0 ? '#059669' : '#EF4444' }}>
                            {params.value} <span style={{ fontSize: 11, fontWeight: 400, color: '#6B7280' }}>{params.row.unit}</span>
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

    const filteredRows = inventory.filter(item => {
        // 1. Text Search
        const q = search.toLowerCase();
        const matchSearch = !search ||
            [item.product, item.ref, item.fournisseur, item.coloris].some(v => (v || '').toLowerCase().includes(q));

        // 2. Exact Filters
        const matchLoc = filterLoc === 'ALL' || splitLocations(item.location).includes(filterLoc);
        const matchCat = filterCat === 'ALL' || item.category === filterCat;

        // 3. Project Filter (Partial Match allowed if free text, or exact if selected)
        const matchProj = !filterProj || (item.project && item.project.includes(filterProj));

        // 4. Status Filter
        let matchStatus = true;
        if (filterStatus !== 'ALL') {
            if (filterStatus === 'LIBRE') {
                matchStatus = !item.project;
            } else {
                const proj = projects.find(p => p.name === item.project);
                matchStatus = proj?.status === filterStatus;
            }
        }

        // 5. Hide 0 quantity
        const isNonZero = item.qty !== 0;

        return matchSearch && matchLoc && matchCat && matchProj && matchStatus && isNonZero;
    });

    const groupedRows = useMemo(() => {
        const groups = {};
        filteredRows.forEach(item => {
            const key = `${item.product}-${item.ref || ''}`;
            const itemPieces = Array.isArray(item.pieces) ? item.pieces : [];
            const pieceLocs = itemPieces.map(p => p.location).filter(Boolean);
            
            if (!groups[key]) {
                groups[key] = {
                    ...item,
                    id: key,
                    allLocations: new Set([...splitLocations(item.location), ...pieceLocs]),
                    allProjects: new Set([item.project].filter(Boolean)),
                    allPieces: [...itemPieces],
                    _sourceItems: [item]
                };
            } else {
                groups[key].qty += item.qty;
                splitLocations(item.location).forEach(l => groups[key].allLocations.add(l));
                pieceLocs.forEach(l => groups[key].allLocations.add(l));
                if (item.project) groups[key].allProjects.add(item.project);
                groups[key].allPieces = [...groups[key].allPieces, ...itemPieces];
                groups[key]._sourceItems.push(item);
            }
        });
        
        return Object.values(groups).map(g => ({
            ...g,
            location: Array.from(g.allLocations).sort().join(', '),
            // Répartition en mètres par emplacement quand l'article est à plusieurs endroits (ex. ATELIER + B3)
            locBreakdown: (() => {
                const m = new Map();
                g._sourceItems.forEach(it => { const k = it.location || ''; m.set(k, (m.get(k) || 0) + Number(it.qty || 0)); });
                return m.size > 1 ? [...m].map(([loc, qty]) => ({ loc, qty: Math.round(qty * 100) / 100 })) : null;
            })(),
            project: Array.from(g.allProjects).sort().join(', '),
            pieces: g.allPieces
        }));
    }, [filteredRows]);

    return (
        <Box>
            {/* Barre de filtres (sans cadre, style des listes Chiffrages / Projets) : filtres à gauche, actions à droite */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                <ToolbarSearch
                    value={search}
                    onChange={setSearch}
                    placeholder="Fournisseur, référence, coloris…"
                    width={220}
                />
                <ToolbarSearch
                    value={filterProj || ''}
                    onChange={(v) => setFilterProj(v || null)}
                    placeholder="Projet"
                    width={150}
                    list="df-stock-projects"
                    icon={false}
                />
                <datalist id="df-stock-projects">
                    {projects.map(p => <option key={p.id || p.name} value={p.name} />)}
                </datalist>
                <ToolbarSelect
                    label="Catégorie"
                    value={filterCat}
                    onChange={setFilterCat}
                    options={CATEGORIES.map(c => ({ value: c, label: c === 'ALL' ? 'Toutes' : c }))}
                />
                <ToolbarSelect
                    label="Emplacement"
                    value={filterLoc}
                    onChange={setFilterLoc}
                    options={locations.map(loc => ({ value: loc, label: loc === 'ALL' ? 'Tous' : loc }))}
                />
                <ToolbarSelect
                    label="Statut"
                    value={filterStatus}
                    onChange={setFilterStatus}
                    options={STATUSES.map(st => ({ value: st.key, label: st.label }))}
                />

                {toCompleteCount > 0 && (
                    <Chip
                        label={`📍 ${toCompleteCount} réception${toCompleteCount > 1 ? 's' : ''} à compléter`}
                        onClick={() => setFilterLoc(filterLoc === LOC_A_COMPLETER ? 'ALL' : LOC_A_COMPLETER)}
                        size="small"
                        sx={{
                            fontWeight: 700, cursor: 'pointer',
                            bgcolor: filterLoc === LOC_A_COMPLETER ? '#9A3412' : '#FFEDD5',
                            color: filterLoc === LOC_A_COMPLETER ? 'white' : '#9A3412',
                            border: '1px solid #FDBA74',
                            '&:hover': { bgcolor: filterLoc === LOC_A_COMPLETER ? '#7C2D12' : '#FED7AA' },
                        }}
                    />
                )}

                {(search || filterLoc !== 'ALL' || filterProj || filterCat !== 'ALL' || filterStatus !== 'ALL') && (
                    <button
                        onClick={() => {
                            setSearch('');
                            setFilterLoc('ALL');
                            setFilterProj(null);
                            setFilterCat('ALL');
                            setFilterStatus('ALL');
                        }}
                        style={{ border: 'none', background: 'none', color: '#6B7280', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', padding: '0 4px', fontFamily: 'inherit' }}
                    >
                        Réinitialiser
                    </button>
                )}

                <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <ToolbarButton icon={<MapIcon size={16} />} active={showMap} onClick={() => setShowMap(v => !v)}>
                        Vue entrepôt
                    </ToolbarButton>
                    <ToolbarButton icon={<Download size={16} />} onClick={handleExport} title="Exporter le stock (solde) en Excel">
                        Exporter
                    </ToolbarButton>
                    <ToolbarButton icon={<Upload size={16} />} onClick={handleImportClick} title="Importer une mise à jour du stock (solde)">
                        Importer
                    </ToolbarButton>
                </div>

                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".xlsx, .xls"
                    onChange={handleImportFile}
                />
            </div>

            {/* VUE ENTREPÔT */}
            {showMap && (
                <Box sx={{ mb: 3 }}>
                    <WarehouseMap zones={zones} inventory={inventory} />
                </Box>
            )}

            {/* INVENTORY GRID */}
            {/* Tablette (< 1200 px) : le tableau occupe la hauteur d'écran disponible au lieu de 600 px fixes
                (en portrait on ne voyait que 7 lignes, avec un grand vide dessous). */}
            <Box sx={{ ...TABLE_FRAME_STYLE, height: { xs: 'max(480px, calc(100vh - 400px))', lg: 600 } }}>
                <DataGrid
                    rows={groupedRows}
                    columns={columns}
                    density="comfortable"
                    disableSelectionOnClick
                    onRowDoubleClick={handleRowDoubleClick}
                    localeText={frFR.components.MuiDataGrid.defaultProps.localeText}
                    sx={DATAGRID_DA_SX}
                />
            </Box>

            {/* CHOIX DE L'ENTRÉE (ligne regroupant plusieurs articles) */}
            {pickSources && (
                <Dialog open onClose={() => setPickSources(null)} maxWidth="xs" fullWidth>
                    <DialogTitle>Quelle entrée éditer ?</DialogTitle>
                    <List dense sx={{ pb: 2 }}>
                        {pickSources.map(it => (
                            <ListItemButton key={it.id} onClick={() => { setPickSources(null); setEditItem(it); }}>
                                <ListItemText
                                    primary={`${it.qty} ${it.unit || ''} — ${it.project || 'Stock libre'}`}
                                    secondary={splitLocations(it.location).join(', ') || 'Sans emplacement'}
                                    secondaryTypographyProps={splitLocations(it.location).includes(LOC_A_COMPLETER) ? { sx: { color: '#9A3412', fontWeight: 700 } } : undefined}
                                />
                            </ListItemButton>
                        ))}
                    </List>
                </Dialog>
            )}

            {/* HISTORY MODAL */}
            {editItem && (
                <EditStockItemModal
                    item={editItem}
                    zones={zones}
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
