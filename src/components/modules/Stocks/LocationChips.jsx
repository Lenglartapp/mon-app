import React from 'react';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import { LOC_A_COMPLETER, splitLocations } from '../../../lib/inventory/stockFields';

/** Chips d'emplacement ; la sentinelle « À COMPLÉTER » ressort en orange. */
export default function LocationChips({ value }) {
    const locs = splitLocations(value);
    if (locs.length === 0) return <span style={{ color: '#9CA3AF' }}>—</span>;
    return (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', py: 1 }}>
            {locs.map((loc) => {
                const todo = loc === LOC_A_COMPLETER;
                return (
                    <Chip
                        key={loc}
                        label={todo ? `📍 ${loc}` : loc}
                        size="small"
                        sx={{
                            bgcolor: todo ? '#FFEDD5' : '#F3F4F6',
                            color: todo ? '#9A3412' : '#374151',
                            border: todo ? '1px solid #FDBA74' : 'none',
                            fontSize: 10, fontWeight: 700, borderRadius: 1, height: 20,
                        }}
                    />
                );
            })}
        </Box>
    );
}
