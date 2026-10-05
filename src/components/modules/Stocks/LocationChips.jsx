import React from 'react';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import { LOC_A_COMPLETER, splitLocations } from '../../../lib/inventory/stockFields';

/** Chips d'emplacement ; la sentinelle « À COMPLÉTER » ressort en orange. */
/** `breakdown` = [{loc, qty}] : affiche « ATELIER · 18 ml » par emplacement quand l'article est réparti. */
export default function LocationChips({ value, breakdown, unit }) {
    const entries = breakdown
        ? breakdown.map(({ loc, qty }) => ({ key: loc || '—', locs: splitLocations(loc), suffix: ` · ${qty} ${unit || ''}`.trimEnd() }))
        : splitLocations(value).map((loc) => ({ key: loc, locs: [loc], suffix: '' }));
    if (entries.length === 0) return <span style={{ color: '#9CA3AF' }}>—</span>;
    return (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', py: 1 }}>
            {entries.map(({ key, locs, suffix }) => {
                const todo = locs.includes(LOC_A_COMPLETER);
                const atelier = locs.includes('ATELIER');
                const label = `${todo ? '📍 ' : ''}${locs.join(', ') || 'sans empl.'}${suffix}`;
                return (
                    <Chip
                        key={key}
                        label={label}
                        size="small"
                        sx={{
                            bgcolor: todo ? '#FFEDD5' : atelier ? '#DBEAFE' : '#F3F4F6',
                            color: todo ? '#9A3412' : atelier ? '#1E40AF' : '#374151',
                            border: todo ? '1px solid #FDBA74' : 'none',
                            fontSize: 10, fontWeight: 700, borderRadius: 1, height: 20,
                        }}
                    />
                );
            })}
        </Box>
    );
}
