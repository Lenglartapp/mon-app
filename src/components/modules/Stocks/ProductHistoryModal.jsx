import React, { useMemo } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { frFR } from '@mui/x-data-grid/locales';
import Avatar from '@mui/material/Avatar';
import DaDialog from '../../ui/DaDialog';
import { TonePill } from '../../ui/ToolbarControls';
import LocationChips from './LocationChips';
import { DATAGRID_DA_SX, FLUX_TONES, TABLE_FRAME_STYLE } from '../../../lib/constants/daStyles';
import { LOC_A_COMPLETER, splitLocations } from '../../../lib/inventory/stockFields';

// Fiche de vie d'un article du stock : état actuel (quantité, pièces, emplacement) et
// historique de ses mouvements, à la DA (mêmes pastilles de flux que le Journal).

function stringToColor(string) {
    if (!string) return '#ccc';
    let hash = 0;
    for (let i = 0; i < string.length; i++) hash = string.charCodeAt(i) + ((hash << 5) - hash);
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
}

const FLUX = {
    IN: { label: 'Entrée', tone: FLUX_TONES.IN },
    OUT: { label: 'Sortie', tone: FLUX_TONES.OUT },
    MOVE: { label: 'Déplacement', tone: FLUX_TONES.MOVE },
    ADJUST: { label: 'Édition', tone: null },
};

const COLUMNS = [
    {
        field: 'date', headerName: 'Date / Heure', width: 120,
        valueFormatter: (value) => (value ? new Date(value).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''),
    },
    {
        field: 'type', headerName: 'Flux', width: 120,
        renderCell: (params) => { const f = FLUX[params.value] || FLUX.OUT; return <TonePill tone={f.tone}>{f.label}</TonePill>; },
    },
    {
        field: 'qty', headerName: 'Quantité', width: 100, align: 'right', headerAlign: 'right',
        renderCell: (params) => (
            <span style={{ fontWeight: 600 }}>
                {params.value} <span style={{ fontSize: 11, fontWeight: 400, color: '#6B7280' }}>{params.row.unit}</span>
            </span>
        ),
    },
    { field: 'location', headerName: 'Emplacement', width: 120 },
    {
        field: 'reason', headerName: 'Motif / Détail', flex: 1, minWidth: 200,
        renderCell: (params) => <span title={params.value || ''} style={{ fontSize: 13, color: '#4B5563', overflow: 'hidden', textOverflow: 'ellipsis' }}>{params.value || '—'}</span>,
    },
    {
        field: 'pieces_names', headerName: 'Pièce', width: 110,
        renderCell: (params) => <span style={{ fontSize: 13, color: '#374151' }}>{params.value || '—'}</span>,
    },
    {
        field: 'user_name', headerName: 'Opérateur', width: 160,
        renderCell: (params) => (params.value ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <Avatar sx={{ width: 24, height: 24, fontSize: 11, bgcolor: stringToColor(params.value) }}>{params.value[0]}</Avatar>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{params.value}</span>
            </div>
        ) : <span style={{ color: '#9B9A97' }}>—</span>),
    },
];

const norm = (v) => String(v ?? '').trim().toLowerCase();

export default function ProductHistoryModal({ open, onClose, product, movements = [] }) {
    // Mouvements de CET article : même libellé, et même dossier (les lignes sans dossier,
    // plus anciennes, sont gardées). Du plus récent au plus ancien.
    const rows = useMemo(() => {
        if (!product) return [];
        const proj = norm(product.project);
        return movements
            .filter(m => m.product === product.product && (!norm(m.project) || norm(m.project) === proj))
            .map(m => ({ ...m, user_name: m.user_name || m.user, id: m.id ?? `log_${m.date}_${m.type}_${m.qty}_${m.pieces_names || ''}` }))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [movements, product]);

    if (!product) return null;

    const pieces = Array.isArray(product.pieces) ? product.pieces : [];
    const displayQty = pieces.length > 0 ? pieces.reduce((sum, p) => sum + Number(p.qty || 0), 0) : product.qty;
    const name = product.ref ? [product.ref, product.coloris].filter(Boolean).join(' — ') : product.product;
    const title = [product.fournisseur, name].filter(Boolean).join(' · ') || 'Article';
    const subtitle = ['Fiche de vie', product.project || 'Stock libre', product.laize && `laize ${product.laize}`].filter(Boolean).join(' · ');
    const locs = splitLocations(product.location).filter(l => l !== LOC_A_COMPLETER);

    return (
        <DaDialog
            open={open}
            onClose={onClose}
            title={title}
            subtitle={subtitle}
            maxWidth="lg"
            height="85vh"
            headerExtra={<TonePill tone={Number(displayQty) > 0 ? 0 : null}>Stock : {displayQty} {product.unit}</TonePill>}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%', fontFamily: 'Roboto, system-ui, sans-serif' }}>
                {/* État actuel : pièces + emplacement */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
                    {pieces.length > 0 && (
                        <div>
                            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 8 }}>Pièces en stock ({pieces.length})</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {pieces.map((p, idx) => (
                                    <TonePill key={p.id || idx} tone={Number(p.qty) > 0 ? 5 : null}>{p.name || `Pièce ${idx + 1}`} · {p.qty} {product.unit}</TonePill>
                                ))}
                            </div>
                        </div>
                    )}
                    <div>
                        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 8 }}>Emplacement</div>
                        {locs.length ? <LocationChips value={product.location} /> : <span style={{ fontSize: 13, color: '#9B9A97' }}>À compléter</span>}
                    </div>
                </div>

                {/* Historique */}
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: 17, fontWeight: 500, color: '#111827', marginBottom: 10 }}>
                        Historique <span style={{ fontSize: 13, fontWeight: 400, color: '#9B9A97' }}>{rows.length} mouvement{rows.length > 1 ? 's' : ''}</span>
                    </div>
                    {/* Le tableau occupe la place restante de la fenêtre (il défile à l'intérieur) */}
                    <div style={{ ...TABLE_FRAME_STYLE, flex: 1, minHeight: 260 }}>
                        <DataGrid
                            rows={rows}
                            columns={COLUMNS}
                            density="comfortable"
                            disableRowSelectionOnClick
                            initialState={{ sorting: { sortModel: [{ field: 'date', sort: 'desc' }] } }}
                            localeText={{ ...frFR.components.MuiDataGrid.defaultProps.localeText, noRowsLabel: 'Aucun mouvement enregistré pour cet article.' }}
                            sx={DATAGRID_DA_SX}
                        />
                    </div>
                </div>
            </div>
        </DaDialog>
    );
}
