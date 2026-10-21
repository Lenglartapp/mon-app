import React from 'react';
import { ChevronDown } from 'lucide-react';
import TextNumberEditCell from './TextNumberEditCell';

/**
 * Colonne « Utilisé » (DataGrid) : nombre de lignes qui utilisent l'article,
 * pastille cliquable qui déplie la liste (UsagePopover).
 */
export function usageColumn(usage, onOpen, where = 'du chiffrage') {
    return {
        field: '__usage',
        headerName: 'Utilisé',
        description: `Nombre de lignes ${where} qui utilisent l'article (cliquer pour les voir)`,
        width: 90,
        type: 'number',
        align: 'right',
        headerAlign: 'right',
        editable: false,
        valueGetter: (_v, row) => usage.get(row?.name)?.length || 0,
        renderCell: (params) => {
            const n = params.value || 0;
            if (!n) return <span style={{ color: 'var(--df-border-strong)' }}>—</span>;
            return (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOpen({ el: e.currentTarget, name: params.row.name }); }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 24, padding: '0 8px', borderRadius: 99, border: 'none', background: 'var(--df-navy-bg)', color: 'var(--df-primary-text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                    {n} <ChevronDown size={12} />
                </button>
            );
        },
    };
}

/** Colonne numérique éditée dans un champ texte (curseur plaçable, virgule acceptée). */
export function withTextNumberEditor(col) {
    if (col.type !== 'number' || !col.editable) return col;
    return { ...col, renderEditCell: (params) => <TextNumberEditCell {...params} /> };
}
