import React from 'react';
import { Layers } from 'lucide-react';
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
        field: 'reason',
        headerName: 'Motif / Détail',
        width: 250,
        renderCell: (params) => (
            <span style={{ fontSize: 13, color: '#4B5563' }}>{params.value || '-'}</span>
        )
    },
    {
        field: 'pieces_names',
        headerName: 'Pièce / Rouleau',
        width: 150,
        renderCell: (params) => (
            <span style={{ fontSize: 12, fontWeight: 700, color: '#4338CA' }}>{params.value || '-'}</span>
        )
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
        .map(m => m.id ? m : { ...m, id: `log_${m.date}_${Math.random()}` })
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

            <DialogContent sx={{ p: 0, height: 700, display: 'flex', flexDirection: 'column' }}>
                {/* ÉTAT ACTUEL DES PIÈCES */}
                {Array.isArray(product.pieces) && product.pieces.length > 0 && (
                    <Box sx={{ p: 2, bgcolor: '#EEF2FF', borderBottom: '1px solid #E0E7FF' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#4338CA', mb: 1, textTransform: 'uppercase', fontSize: 11 }}>
                            Pièces en stock actuellement ({product.pieces.length})
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {product.pieces.map((p, idx) => (
                                <Box 
                                    key={p.id || idx} 
                                    sx={{ 
                                        bgcolor: 'white', 
                                        p: 1, 
                                        borderRadius: 2, 
                                        border: '1px solid #C7D2FE',
                                        minWidth: 120,
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                    }}
                                >
                                    <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>
                                        {p.name || `Pièce ${idx + 1}`}
                                    </Typography>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#059669' }}>{p.qty} {product.unit}</Typography>
                                        <Typography sx={{ fontSize: 11, color: '#6B7280' }}>({p.location || '?'})</Typography>
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    </Box>
                )}

                <Box sx={{ flex: 1 }}>
                    <DataGrid
                        rows={productMovements}
                        columns={COLUMNS}
                        density="comfortable"
                        disableSelectionOnClick
                        localeText={frFR.components.MuiDataGrid.defaultProps.localeText}
                        sx={{ border: 'none' }}
                    />
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 2, borderTop: '1px solid #E5E7EB' }}>
                <Button onClick={onClose} variant="contained" color="primary">
                    Fermer
                </Button>
            </DialogActions>
        </Dialog>
    );
}
