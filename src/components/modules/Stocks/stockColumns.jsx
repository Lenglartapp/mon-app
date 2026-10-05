import React from 'react';

// Colonnes partagées État du stock / Journal : Fournisseur | Référence | Coloris | Laize.
// Référence retombe sur le nom du produit pour les articles saisis à la main (sans réf).

const dash = <span style={{ color: '#9CA3AF' }}>—</span>;

/** Libellé secondaire : le nom produit quand il n'est pas déjà « réf — coloris ». */
const productSubtitle = (row) => {
    if (!row.ref || !row.product) return null;
    const derived = [row.ref, row.coloris].filter(Boolean).join(' — ');
    return row.product === row.ref || row.product === derived ? null : row.product;
};

export const itemMetaColumns = () => [
    {
        field: 'fournisseur',
        headerName: 'Fournisseur',
        width: 150,
        renderCell: (params) => params.value
            ? <span style={{ fontWeight: 600, color: '#374151' }}>{params.value}</span>
            : dash,
    },
    {
        field: 'ref',
        headerName: 'Référence',
        flex: 1,
        minWidth: 200,
        valueGetter: (value, row) => value || row.product,
        renderCell: (params) => {
            const sub = productSubtitle(params.row);
            return (
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', lineHeight: 1.2 }}>
                    <span style={{ fontWeight: 600, color: '#111827' }}>{params.value || '—'}</span>
                    {sub && <span style={{ fontSize: 11, color: '#6B7280' }}>{sub}</span>}
                </div>
            );
        },
    },
    { field: 'coloris', headerName: 'Coloris', width: 140, renderCell: (params) => params.value || dash },
    { field: 'laize', headerName: 'Laize', width: 80, renderCell: (params) => params.value || dash },
];
