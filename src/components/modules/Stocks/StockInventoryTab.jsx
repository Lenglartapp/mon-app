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
import { Download, Upload, Map as MapIcon, Filter as FilterIcon, ChevronDown } from 'lucide-react';
import { exportInventoryToExcel, processInventoryClearanceImport } from '../../../lib/utils/inventoryExcelUtils';
import { useAuth } from '../../../auth';
import WarehouseMap from './WarehouseMap';
import { itemMetaColumns } from './stockColumns';
import LocationChips from './LocationChips';
import { ToolbarSearch, ToolbarButton, TonePill } from '../../ui/ToolbarControls';
import FilterPanel, { isConditionActive, evaluateCondition } from '../../FilterPanel';
import FitGridFrame from '../../ui/FitGridFrame';
import { DATAGRID_DA_SX } from '../../../lib/constants/daStyles';
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
function stockStatusCodeOf(projectName, projects) {
    if (!projectName) return 'LIBRE';
    const proj = projects.find(p => p.name === projectName);
    if (!proj) return '';
    return STOCK_STATUS[proj.status] ? proj.status : (STATUS_FROM_LABEL[String(proj.status || '').toLowerCase()] || '');
}
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
    // Filtres : conditions du panneau « Filtrer » (même module que les tableaux du chiffrage)
    const [filterConditions, setFilterConditions] = useState([]);
    const [filterPanelOpen, setFilterPanelOpen] = useState(false);
    // Note flottante « réceptions à compléter » : repliée par défaut, filtre à la demande
    const [onlyToComplete, setOnlyToComplete] = useState(false);
    const [toCompleteOpen, setToCompleteOpen] = useState(false);

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

    // Champs proposés dans le panneau « Filtrer »
    const filterSchema = [
        { key: 'fournisseur', label: 'Fournisseur', type: 'text' },
        { key: 'ref', label: 'Référence', type: 'text' },
        { key: 'coloris', label: 'Coloris', type: 'text' },
        { key: 'laize', label: 'Laize', type: 'number' },
        { key: 'category', label: 'Type', type: 'select', options: CATEGORIES.filter(c => c !== 'ALL') },
        { key: 'location', label: 'Emplacement', type: 'select', options: locations.filter(l => l !== 'ALL') },
        { key: 'project', label: 'Affectation', type: 'select', options: [...new Set(inventory.map(i => i.project).filter(Boolean))].sort() },
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

    const activeConditions = filterConditions.filter(isConditionActive);
    const filteredRows = inventory.filter(item => {
        if (item.qty === 0) return false; // quantités nulles masquées
        const q = search.toLowerCase();
        if (search && ![item.product, item.ref, item.fournisseur, item.coloris].some(v => (v || '').toLowerCase().includes(q))) return false;
        if (onlyToComplete && !splitLocations(item.location).includes(LOC_A_COMPLETER)) return false;
        if (activeConditions.length === 0) return true;
        const flat = { ...item, project: item.project || '', status: stockStatusCodeOf(item.project, projects) };
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
                        onClick={() => { setSearch(''); setFilterConditions([]); setOnlyToComplete(false); }}
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

            {/* Note flottante bas-droite (comme « pièces en double » du chiffrage) : réceptions dont
                l'emplacement reste à compléter. Repliée par défaut ; filtre le tableau à la demande. */}
            {toCompleteCount > 0 && (
                <div style={{
                    // En bas à GAUCHE : la pagination du tableau occupe le bas à droite
                    position: 'fixed', bottom: 24, left: 24, zIndex: 1200,
                    background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 10,
                    fontSize: 13, color: '#92400E', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxWidth: 360,
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
                        <div style={{ borderTop: '1px solid #FCD34D', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ fontSize: 12, opacity: 0.9 }}>
                                Articles reçus via Odoo dont l'emplacement de rangement n'est pas encore renseigné.
                            </div>
                            <button
                                onClick={() => setOnlyToComplete(v => !v)}
                                style={{ alignSelf: 'flex-start', border: '1px solid #F59E0B', background: onlyToComplete ? '#92400E' : 'white', color: onlyToComplete ? 'white' : '#92400E', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
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
                    rows={groupedRows}
                    columns={columns}
                    density="comfortable"
                    disableSelectionOnClick
                    onRowDoubleClick={handleRowDoubleClick}
                    localeText={frFR.components.MuiDataGrid.defaultProps.localeText}
                    sx={DATAGRID_DA_SX}
                />
            </FitGridFrame>

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
