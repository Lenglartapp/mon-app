import React from 'react';
import Popover from '@mui/material/Popover';

// Liste dépliée de la colonne « Utilisé » : les lignes qui utilisent l'article.
export default function UsagePopover({ anchor, list = [], onClose, where = 'du chiffrage' }) {
    return (
        <Popover
            open={!!anchor}
            anchorEl={anchor?.el}
            onClose={onClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            PaperProps={{ sx: { borderRadius: '8px', border: '1px solid var(--df-border)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', maxWidth: 420 } }}
        >
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--df-border-soft)' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--df-text)' }}>{anchor?.name}</div>
                <div style={{ fontSize: 12, color: 'var(--df-muted)', marginTop: 2 }}>Utilisé sur {list.length} ligne{list.length > 1 ? 's' : ''} {where}</div>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto', padding: '4px 0' }}>
                {list.map((u, i) => (
                    <div key={u.id || i} style={{ display: 'flex', gap: 10, justifyContent: 'space-between', padding: '6px 14px', fontSize: 13, color: 'var(--df-text-2)' }}>
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.label}</span>
                        <span style={{ color: 'var(--df-muted)', whiteSpace: 'nowrap' }}>{u.fields.join(', ')}</span>
                    </div>
                ))}
            </div>
        </Popover>
    );
}
