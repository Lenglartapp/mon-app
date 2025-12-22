import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import { DataGrid } from '@mui/x-data-grid';
import { frFR } from '@mui/x-data-grid/locales';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import SearchIcon from '@mui/icons-material/Search';
import InputAdornment from '@mui/material/InputAdornment';

const COLUMNS = [
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
            let color = '#E5E7EB'; // Default gray
            let text = '#374151';

            const cat = params.value || 'Divers';
            if (cat === 'Tissu') { color = '#DBEAFE'; text = '#1E40AF'; }
            if (cat === 'Rail' || cat === 'Tringle') { color = '#F3F4F6'; text = '#1F2937'; }
            if (cat === 'Mécanisme') { color = '#FEF3C7'; text = '#92400E'; }
            if (cat === 'Mercerie') { color = '#FCE7F3'; text = '#9D174D'; }

            return (
                <Chip
                    label={cat}
                    size="small"
                    sx={{ bgcolor: color, color: text, fontWeight: 700, borderRadius: 1 }}
                />
            );
        }
    },
    {
        field: 'location',
        headerName: 'Emplacement',
        width: 150,
        renderCell: (params) => (
            <Chip
                label={params.value}
                size="small"
                sx={{ bgcolor: '#F3F4F6', fontWeight: 600, color: '#374151', borderRadius: 1 }}
            />
        )
    },
    {
        field: 'project',
        headerName: 'Affectation',
        width: 200,
        renderCell: (params) => params.value ? (
            <Chip label={params.value} size="small" variant="outlined" sx={{ borderColor: '#6366F1', color: '#4F46E5', bgcolor: '#EEF2FF' }} />
        ) : <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Stock Libre</span>
    },
    {
        field: 'qty',
        headerName: 'Stock Dispo',
        width: 150,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => (
            <div style={{ fontWeight: 700, fontSize: 15, color: params.value > 0 ? '#059669' : '#EF4444' }}>
                {params.value} <span style={{ fontSize: 11, fontWeight: 400, color: '#6B7280' }}>{params.row.unit}</span>
            </div>
        )
    },
];

import Autocomplete from '@mui/material/Autocomplete';
import ProductHistoryModal from './ProductHistoryModal';

export default function StockInventoryTab({ inventory, projects = [], movements = [] }) {
    const [search, setSearch] = useState('');
    const [filterLoc, setFilterLoc] = useState('ALL');
    const [filterProj, setFilterProj] = useState(null); // Project Name or null
    const [filterCat, setFilterCat] = useState('ALL');

    // History Modal State
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyProduct, setHistoryProduct] = useState(null);

    const handleRowDoubleClick = (params) => {
        setHistoryProduct(params.row);
        setHistoryOpen(true);
    };

    const CATEGORIES = ['ALL', 'Tissu', 'Rail', 'Tringle', 'Mécanisme', 'Mercerie', 'Divers'];

    // Extract unique locations for filter
    const locations = ['ALL', ...new Set(inventory.map(i => i.location).filter(Boolean))];

    const filteredRows = inventory.filter(item => {
        // 1. Text Search
        const matchSearch = !search ||
            item.product.toLowerCase().includes(search.toLowerCase()) ||
            (item.ref || '').toLowerCase().includes(search.toLowerCase());

        // 2. Exact Filters
        const matchLoc = filterLoc === 'ALL' || item.location === filterLoc;
        const matchCat = filterCat === 'ALL' || item.category === filterCat;

        // 3. Project Filter (Partial Match allowed if free text, or exact if selected)
        // If filterProj is set, we check if item.project INCLUDES the string (safer) OR equals
        const matchProj = !filterProj || (item.project && item.project.includes(filterProj));

        return matchSearch && matchLoc && matchCat && matchProj;
    });

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
                    sx={{ width: 180 }}
                >
                    {locations.map(loc => (
                        <MenuItem key={loc} value={loc}>{loc === 'ALL' ? 'Tous' : loc}</MenuItem>
                    ))}
                </TextField>

                {/* Reset Button */}
                {(search || filterLoc !== 'ALL' || filterProj || filterCat !== 'ALL') && (
                    <Chip
                        label="Réinitialiser"
                        onDelete={() => { setSearch(''); setFilterLoc('ALL'); setFilterProj(null); setFilterCat('ALL'); }}
                        color="default"
                    />
                )}
            </Card>

            {/* INVENTORY GRID */}
            <Card sx={{ height: 600, width: '100%', borderRadius: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <DataGrid
                    rows={filteredRows}
                    columns={COLUMNS}
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
