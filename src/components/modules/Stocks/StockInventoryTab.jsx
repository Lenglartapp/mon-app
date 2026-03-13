import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import { DataGrid } from '@mui/x-data-grid';
import { frFR } from '@mui/x-data-grid/locales';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import SearchIcon from '@mui/icons-material/Search';
import InputAdornment from '@mui/material/InputAdornment';
import Autocomplete from '@mui/material/Autocomplete';
import ProductHistoryModal from './ProductHistoryModal';
import { useMemo, useRef } from 'react';
import Button from '@mui/material/Button';
import { Download, Upload, FileSpreadsheet } from 'lucide-react';
import { exportInventoryToExcel, processInventoryClearanceImport } from '../../../lib/utils/inventoryExcelUtils';
import { useAuth } from '../../../auth';

export default function StockInventoryTab({ inventory, projects = [], movements = [], onBulkMovement }) {
    const { currentUser } = useAuth();
    const fileInputRef = useRef(null);
    const [search, setSearch] = useState('');

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

    const handleRowDoubleClick = (params) => {
        setHistoryProduct(params.row);
        setHistoryOpen(true);
    };

    const CATEGORIES = ['ALL', 'Tissu', 'Rail', 'Consommable', 'Mécanisme', 'Divers'];

    const STATUSES = [
        { key: 'ALL', label: 'Tous' },
        { key: 'TODO', label: 'RÉSERVÉ' },
        { key: 'IN_PROGRESS', label: 'EN COURS' },
        { key: 'DONE', label: 'RELIQUAT' },
        { key: 'ARCHIVED', label: 'STOCK MORT' },
        { key: 'LIBRE', label: 'STOCK LIBRE' }
    ];

    // Extract unique locations for filter
    const locations = ['ALL', ...new Set(inventory.map(i => i.location).filter(Boolean))];

    const columns = useMemo(() => [
        {
            field: 'product',
            headerName: 'Produit',
            flex: 1,
            minWidth: 200,
            renderCell: (params) => (
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#111827' }}>{params.value}</span>
                    <span style={{ fontSize: 11, color: '#6B7280' }}>Réf: {params.row.ref || '—'}</span>
                </div>
            )
        },
        {
            field: 'category',
            headerName: 'Type',
            width: 120,
            renderCell: (params) => {
                let color = '#E5E7EB';
                let text = '#374151';
                const cat = params.value || 'Divers';
                if (cat === 'Tissu') { color = '#DBEAFE'; text = '#1E40AF'; }
                if (cat === 'Rail' || cat === 'Tringle') { color = '#F3F4F6'; text = '#1F2937'; }
                if (cat === 'Mécanisme') { color = '#FEF3C7'; text = '#92400E'; }
                if (cat === 'Mercerie') { color = '#FCE7F3'; text = '#9D174D'; }
                return <Chip label={cat} size="small" sx={{ bgcolor: color, color: text, fontWeight: 700, borderRadius: 1 }} />;
            }
        },
        {
            field: 'location',
            headerName: 'Emplacement',
            width: 160,
            renderCell: (params) => {
                // params.value is already "Loc1, Loc2" from groupedRows
                const allLocs = (params.value || '').split(', ').filter(Boolean);
                
                if (allLocs.length === 0) return <span style={{ color: '#9CA3AF' }}>-</span>;
                
                return (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', py: 1 }}>
                        {allLocs.map(loc => (
                            <Chip 
                                key={loc} 
                                label={loc} 
                                size="small" 
                                sx={{ bgcolor: '#F3F4F6', fontSize: 10, fontWeight: 700, color: '#374151', borderRadius: 1, height: 20 }} 
                            />
                        ))}
                    </Box>
                );
            }
        },
        {
            field: 'project',
            headerName: 'Affectation',
            width: 180,
            renderCell: (params) => params.value ? (
                <Chip label={params.value} size="small" variant="outlined" sx={{ borderColor: '#6366F1', color: '#4F46E5', bgcolor: '#EEF2FF' }} />
            ) : <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Stock Libre</span>
        },
        {
            field: 'stockStatus',
            headerName: 'Statut Stock',
            width: 140,
            renderCell: (params) => {
                const pName = params.row.project;
                if (!pName) return <Chip label="LIBRE" size="small" sx={{ bgcolor: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }} />;

                // Find project
                const proj = projects.find(p => p.name === pName || p.nom_dossier === pName);
                // Si pas trouvé, on affiche un Chip neutre avec le statut ou '?'
                if (!proj) return <Chip label="?" size="small" sx={{ bgcolor: '#F3F4F6' }} />;

                // Map Status
                const map = {
                    'TODO': { label: 'RÉSERVÉ', color: '#B91C1C', bg: '#FEE2E2', border: '#FECACA' }, // Rouge
                    'IN_PROGRESS': { label: 'EN COURS', color: '#15803D', bg: '#DCFCE7', border: '#86EFAC' }, // Vert
                    'DONE': { label: 'RELIQUAT', color: '#7C3AED', bg: '#F3E8FF', border: '#D8B4FE' }, // Violet
                    'SAV': { label: 'SAV', color: '#B45309', bg: '#FEF3C7', border: '#FDE68A' }, // Orange
                    'ARCHIVED': { label: 'STOCK MORT', color: '#374151', bg: '#F9FAFB', border: '#E5E7EB' } // Gris
                };

                const config = map[proj.status] || { label: proj.status || '?', color: '#4B5563', bg: '#F3F4F6' };

                return (
                    <Chip
                        label={config.label}
                        size="small"
                        sx={{
                            bgcolor: config.bg,
                            color: config.color,
                            fontWeight: 800,
                            letterSpacing: 0.5,
                            border: `1px solid ${config.border || 'transparent'}`
                        }}
                    />
                );
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
    ], [projects]);

    const filteredRows = inventory.filter(item => {
        // 1. Text Search
        const matchSearch = !search ||
            item.product.toLowerCase().includes(search.toLowerCase()) ||
            (item.ref || '').toLowerCase().includes(search.toLowerCase());

        // 2. Exact Filters
        const matchLoc = filterLoc === 'ALL' || item.location === filterLoc;
        const matchCat = filterCat === 'ALL' || item.category === filterCat;

        // 3. Project Filter (Partial Match allowed if free text, or exact if selected)
        const matchProj = !filterProj || (item.project && item.project.includes(filterProj));

        // 4. Status Filter
        let matchStatus = true;
        if (filterStatus !== 'ALL') {
            if (filterStatus === 'LIBRE') {
                matchStatus = !item.project;
            } else {
                const proj = projects.find(p => p.name === item.project || p.nom_dossier === item.project);
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
                    allLocations: new Set([item.location, ...pieceLocs].filter(Boolean)),
                    allProjects: new Set([item.project].filter(Boolean)),
                    allPieces: [...itemPieces]
                };
            } else {
                groups[key].qty += item.qty;
                if (item.location) groups[key].allLocations.add(item.location);
                pieceLocs.forEach(l => groups[key].allLocations.add(l));
                if (item.project) groups[key].allProjects.add(item.project);
                groups[key].allPieces = [...groups[key].allPieces, ...itemPieces];
            }
        });
        
        return Object.values(groups).map(g => ({
            ...g,
            location: Array.from(g.allLocations).sort().join(', '),
            project: Array.from(g.allProjects).sort().join(', '),
            pieces: g.allPieces
        }));
    }, [filteredRows]);

    return (
        <Box>
            {/* FILTERS TOOLBAR */}
            <Card sx={{ mb: 3, p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* 1. Global Search */}
                <TextField
                    placeholder="Recherche rapide (Nom, Réf)..."
                    size="small"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    sx={{ width: 250 }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon color="action" />
                            </InputAdornment>
                        ),
                    }}
                />

                {/* 2. Project Filter (Autocomplete) */}
                <Autocomplete
                    options={projects.map(p => p.name || p.nom_dossier)}
                    value={filterProj}
                    onChange={(e, val) => setFilterProj(val)}
                    renderInput={(params) => <TextField {...params} label="Filtrer par Projet" size="small" />}
                    sx={{ width: 250 }}
                    freeSolo // Users might want to type a manual project name to filter
                />

                {/* 3. Category Filter */}
                <TextField
                    select
                    label="Catégorie"
                    size="small"
                    value={filterCat}
                    onChange={(e) => setFilterCat(e.target.value)}
                    sx={{ width: 150 }}
                >
                    {CATEGORIES.map(c => (
                        <MenuItem key={c} value={c}>{c === 'ALL' ? 'Toutes' : c}</MenuItem>
                    ))}
                </TextField>

                {/* 4. Location Filter */}
                <TextField
                    select
                    label="Emplacement"
                    size="small"
                    value={filterLoc}
                    onChange={(e) => setFilterLoc(e.target.value)}
                    sx={{ width: 150 }}
                >
                    {locations.map(loc => (
                        <MenuItem key={loc} value={loc}>{loc === 'ALL' ? 'Tous' : loc}</MenuItem>
                    ))}
                </TextField>

                {/* 5. Status Filter */}
                <TextField
                    select
                    label="Statut"
                    size="small"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    sx={{ width: 150 }}
                >
                    {STATUSES.map(s => (
                        <MenuItem key={s.key} value={s.key}>{s.label}</MenuItem>
                    ))}
                </TextField>

                {/* Reset Button */}
                {(search || filterLoc !== 'ALL' || filterProj || filterCat !== 'ALL' || filterStatus !== 'ALL') && (
                    <Chip
                        label="Réinitialiser"
                        onDelete={() => { 
                            setSearch(''); 
                            setFilterLoc('ALL'); 
                            setFilterProj(null); 
                            setFilterCat('ALL'); 
                            setFilterStatus('ALL');
                        }}
                        color="default"
                        size="small"
                    />
                )}

                <Box sx={{ flexGrow: 1 }} />

                {/* BULK ACTIONS */}
                <Stack direction="row" spacing={1}>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Download size={16} />}
                        onClick={handleExport}
                        sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                    >
                        Exporter le Stock (Solde)
                    </Button>
                    <Button
                        variant="contained"
                        size="small"
                        color="secondary"
                        startIcon={<Upload size={16} />}
                        onClick={handleImportClick}
                        sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: '#4F46E5', '&:hover': { bgcolor: '#4338CA' } }}
                    >
                        Importer Mise à jour (Solde)
                    </Button>
                </Stack>

                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".xlsx, .xls"
                    onChange={handleImportFile}
                />
            </Card>

            {/* INVENTORY GRID */}
            <Card sx={{ height: 600, width: '100%', borderRadius: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <DataGrid
                    rows={groupedRows}
                    columns={columns}
                    density="comfortable"
                    disableSelectionOnClick
                    onRowDoubleClick={handleRowDoubleClick}
                    localeText={frFR.components.MuiDataGrid.defaultProps.localeText}
                    sx={{ border: 'none' }}
                />
            </Card>

            {/* HISTORY MODAL */}
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
