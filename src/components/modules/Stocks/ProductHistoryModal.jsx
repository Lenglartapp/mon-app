import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
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
        width: 150,
        valueFormatter: (value) => {
            if (!value) return '';
            return new Date(value).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        }
    },
    {
        field: 'type',
        headerName: 'Type',
        width: 100,
        renderCell: (params) => {
            const isIn = params.value === 'IN';
            return (
                <Chip
                    label={isIn ? 'ENTRÉE' : 'SORTIE'}
                    size="small"
                    sx={{
                        bgcolor: isIn ? '#D1FAE5' : '#FEE2E2',
                        color: isIn ? '#065F46' : '#991B1B',
                        fontWeight: 700
                    }}
                />
            );
        }
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
    { field: 'location', headerName: 'Emplacement', width: 130 },
    {
        field: 'project',
        headerName: 'Affectation',
        width: 160,
        renderCell: (params) => params.value ? (
            <Chip label={params.value} size="small" variant="outlined" sx={{ borderColor: '#E5E7EB', color: '#4B5563' }} />
        ) : <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>-</span>
    },
    {
        field: 'user',
        headerName: 'Opérateur',
        width: 150,
        renderCell: (params) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar sx={{ width: 24, height: 24, fontSize: 11, bgcolor: stringToColor(params.value) }}>
                    {params.value?.[0]}
                </Avatar>
                <span>{params.value}</span>
            </div>
        )
    }
];

export default function ProductHistoryModal({ open, onClose, product, movements = [] }) {
    if (!product) return null;

    // Filter movements for this product and sort descending
    const productMovements = movements
        .filter(m => m.product === product.product)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#111827' }}>
                        Fiche de Vie : {product.product}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6B7280' }}>
                        Réf: {product.ref || 'N/A'}
                    </Typography>
                </Box>
                <Chip
                    label={`Stock Actuel : ${product.qty} ${product.unit}`}
                    color={product.qty > 0 ? "success" : "error"}
                    sx={{ fontWeight: 700 }}
                />
            </DialogTitle>

            <DialogContent sx={{ p: 0, height: 500 }}>
                <DataGrid
                    rows={productMovements}
                    columns={COLUMNS}
                    density="comfortable"
                    disableSelectionOnClick
                    localeText={frFR.components.MuiDataGrid.defaultProps.localeText}
                    sx={{ border: 'none' }}
                />
            </DialogContent>

            <DialogActions sx={{ p: 2, borderTop: '1px solid #E5E7EB' }}>
                <Button onClick={onClose} variant="contained" color="primary">
                    Fermer
                </Button>
            </DialogActions>
        </Dialog>
    );
}
