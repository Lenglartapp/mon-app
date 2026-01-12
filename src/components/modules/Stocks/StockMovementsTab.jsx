import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import { DataGrid } from '@mui/x-data-grid';
import { frFR } from '@mui/x-data-grid/locales';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
// Helper for avatar color
function stringToColor(string) {
    if (!string) return '#ccc';
    let hash = 0;
    for (let i = 0; i < string.length; i++) {
        hash = string.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return '#' + "00000".substring(0, 6 - c.length) + c;
}

const COLUMNS = [
    {
        field: 'date',
        headerName: 'Date / Heure',
        width: 160,
        valueFormatter: (value) => {
            if (!value) return '';
            return new Date(value).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        }
    },
    {
        field: 'type',
        headerName: 'Flux',
        width: 120,
        renderCell: (params) => {
            const type = params.value; // IN, OUT, MOVE
            let label = 'SORTIE';
            let bg = '#FEE2E2';
            let color = '#991B1B';

            if (type === 'IN') {
                label = 'ENTRÉE';
                bg = '#D1FAE5';
                color = '#065F46';
            } else if (type === 'MOVE') {
                label = 'DÉPLACEMENT';
                bg = '#DBEAFE'; // Blue Light
                color = '#1E40AF'; // Blue Dark
            }

            return (
                <Chip
                    label={label}
                    size="small"
                    sx={{
                        bgcolor: bg,
                        color: color,
                        fontWeight: 700
                    }}
                />
            );
        }
    },
    {
        field: 'product',
        headerName: 'Produit',
        flex: 1,
        minWidth: 200,
        renderCell: (params) => (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontWeight: 500, lineHeight: 1.2 }}>{params.value}</span>
                <span style={{ fontSize: 11, color: '#6B7280' }}>Réf: {params.row.ref || '—'}</span>
            </div>
        )
    },
    {
        field: 'qty',
        headerName: 'Quantité',
        width: 100,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => (
            <span style={{ fontWeight: 600 }}>
                {params.value} <span style={{ fontSize: 11, fontWeight: 400, color: '#6B7280' }}>{params.row.unit}</span>
            </span>
        )
    },
    { field: 'location', headerName: 'Emplacement', width: 150 },
    {
        field: 'project',
        headerName: 'Affectation',
        width: 180,
        renderCell: (params) => params.value ? (
            <Chip label={params.value} size="small" variant="outlined" sx={{ borderColor: '#E5E7EB', color: '#4B5563' }} />
        ) : <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Stock Libre</span>
    },
    {
        field: 'user',
        headerName: 'Opérateur',
        width: 180,
        renderCell: (params) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar sx={{ width: 24, height: 24, fontSize: 11, bgcolor: stringToColor(params.value) }}>
                    {params.value?.[0]}
                </Avatar>
                <span>{params.value}</span>
            </div>
        )
    },
];

export default function StockMovementsTab({ movements, onAddMovement, projects = [], inventory = [], canEdit = false }) {
    // Buttons/Modal Lifted to Parent
    return (
        <Box>
            {/* HISTORY GRID */}
            <Card sx={{ height: 600, width: '100%', borderRadius: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <DataGrid
                    rows={movements}
                    columns={COLUMNS}
                    density="comfortable"
                    disableSelectionOnClick
                    sortingOrder={['desc', 'asc']}
                    initialState={{
                        sorting: {
                            sortModel: [{ field: 'date', sort: 'desc' }],
                        },
                    }}
                    localeText={frFR.components.MuiDataGrid.defaultProps.localeText}
                    sx={{ border: 'none' }}
                />
            </Card>

        </Box>
    );
}
