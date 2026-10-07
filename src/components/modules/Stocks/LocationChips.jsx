import React from 'react';
import { LOC_A_COMPLETER, splitLocations } from '../../../lib/inventory/stockFields';

/** Emplacements en texte ; la sentinelle « À COMPLÉTER » ressort en orange. */
/** `breakdown` = [{loc, qty}] : affiche « ATELIER · 18 ml » par emplacement quand l'article est réparti. */
export default function LocationChips({ value, breakdown, unit }) {
    const entries = breakdown
        ? breakdown.map(({ loc, qty }) => ({ key: loc || '—', locs: splitLocations(loc), suffix: ` · ${qty} ${unit || ''}`.trimEnd() }))
        : splitLocations(value).map((loc) => ({ key: loc, locs: [loc], suffix: '' }));
    if (entries.length === 0) return <span style={{ color: '#9CA3AF' }}>—</span>;
    // Texte simple (plus d'étiquettes) ; la sentinelle « À compléter » reste signalée en orange.
    return (
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '2px 8px', fontSize: 13, color: '#374151', lineHeight: 1.4 }}>
            {entries.map(({ key, locs, suffix }) => {
                const todo = locs.includes(LOC_A_COMPLETER);
                return (
                    <span key={key} style={todo ? { color: '#C2410C', fontWeight: 600 } : undefined}>
                        {todo ? '📍 À compléter' : (locs.join(', ') || 'sans empl.')}{suffix}
                    </span>
                );
            })}
        </span>
    );
}
