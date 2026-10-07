import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DataGrid } from '@mui/x-data-grid';
import { frFR } from '@mui/x-data-grid/locales';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import InputBase from '@mui/material/InputBase';
import { itemMetaColumns } from './stockColumns';
import { ToolbarSearch, TonePill } from '../../ui/ToolbarControls';
import FitGridFrame from '../../ui/FitGridFrame';
import { DATAGRID_DA_SX, FLUX_TONES } from '../../../lib/constants/daStyles';
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

// Flux : mêmes couleurs que les boutons Entrée / Changer d'emplacement / Sortie (FLUX_TONES) ;
// l'édition manuelle, sans bouton, reste en gris neutre.
const FLUX = {
    IN: { label: 'Entrée', tone: FLUX_TONES.IN },
    OUT: { label: 'Sortie', tone: FLUX_TONES.OUT },
    MOVE: { label: 'Déplacement', tone: FLUX_TONES.MOVE },
    ADJUST: { label: 'Édition', tone: null },
};

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
        // Flux dans le nuancier bleu : entrée (bleu nuit) → édition (bleu ciel)
        renderCell: (params) => {
            const f = FLUX[params.value] || FLUX.OUT;
            if (f.tone == null) return <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', borderRadius: 99, background: '#F4F4F4', color: '#374151', fontSize: 12, fontWeight: 600 }}>{f.label}</span>;
            return <TonePill tone={f.tone}>{f.label}</TonePill>;
        }
    },
    ...itemMetaColumns(),
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
        renderCell: (params) => params.value
            ? <span title={params.value} style={{ color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis' }}>{params.value}</span>
            : <span style={{ color: '#9CA3AF' }}>Stock libre</span>
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
        field: 'user_name',
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

export default function StockMovementsTab({ movements, onAddMovement, projects = [], inventory = [], canEdit = false, actions = null }) {
    const [search, setSearch] = useState('');

    const filteredMovements = movements.filter(m => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
            (m.product || '').toLowerCase().includes(s) ||
            (m.ref || '').toLowerCase().includes(s) ||
            (m.fournisseur || '').toLowerCase().includes(s) ||
            (m.coloris || '').toLowerCase().includes(s) ||
            (m.project || '').toLowerCase().includes(s) ||
            (m.location || '').toLowerCase().includes(s) ||
            (m.user_name || '').toLowerCase().includes(s) ||
            (m.reason || '').toLowerCase().includes(s) ||
            (m.pieces_names || '').toLowerCase().includes(s)
        );
    }).map(m => m.id ? m : { ...m, id: `log_${m.date}_${Math.random()}` });

    return (
        <Box>
            {/* Barre d'outils (sans cadre) : recherche à gauche, actions de mouvement à droite */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                <ToolbarSearch
                    value={search}
                    onChange={setSearch}
                    placeholder="Fournisseur, référence, projet, opérateur…"
                    width={420}
                />
                {actions && <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>{actions}</div>}
            </div>

            {/* Journal — même contour que les listes Chiffrages / Projets.
                Tablette (< 1200 px) : le tableau occupe la hauteur d'écran disponible au lieu de 600 px fixes. */}
            <FitGridFrame>
                <DataGrid
                    rows={filteredMovements}
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
                    sx={DATAGRID_DA_SX}
                />
            </FitGridFrame>
        </Box>
    );
}
