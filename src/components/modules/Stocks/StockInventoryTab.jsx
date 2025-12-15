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

export default function StockInventoryTab({ inventory }) {
    const [search, setSearch] = useState('');
    const [filterLoc, setFilterLoc] = useState('ALL');

    // Extract unique locations for filter
    const locations = ['ALL', ...new Set(inventory.map(i => i.location).filter(Boolean))];

    const filteredRows = inventory.filter(item => {
        const matchSearch = !search ||
            item.product.toLowerCase().includes(search.toLowerCase()) ||
            (item.ref || '').toLowerCase().includes(search.toLowerCase()) ||
            (item.project || '').toLowerCase().includes(search.toLowerCase());

        const matchLoc = filterLoc === 'ALL' || item.location === filterLoc;

        return matchSearch && matchLoc;
    });

    return (
        <Box>
            {/* FILTERS */}
            <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
                <TextField
                    placeholder="Rechercher un produit, réf, projet..."
                    size="small"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    sx={{ flex: 1, bgcolor: 'white' }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon color="action" />
                            </InputAdornment>
                        ),
                    }}
                />
                <TextField
                    select
                    label="Emplacement"
                    size="small"
                    value={filterLoc}
                    onChange={(e) => setFilterLoc(e.target.value)}
                    sx={{ width: 200, bgcolor: 'white' }}
                >
                    {locations.map(loc => (
                        <MenuItem key={loc} value={loc}>{loc === 'ALL' ? 'Tous les emplacements' : loc}</MenuItem>
                    ))}
                </TextField>
            </Box>

            {/* INVENTORY GRID */}
            <Card sx={{ height: 600, width: '100%', borderRadius: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <DataGrid
                    rows={filteredRows}
                    columns={COLUMNS}
                    density="comfortable"
                    disableSelectionOnClick
                    localeText={frFR.components.MuiDataGrid.defaultProps.localeText}
                    sx={{ border: 'none' }}
                />
            </Card>
        </Box>
    );
}
