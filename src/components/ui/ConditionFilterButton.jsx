import React, { useState } from 'react';
import { Filter } from 'lucide-react';
import FilterPanel, { isConditionActive } from '../FilterPanel';
import FitPanel from './FitPanel';

// Bouton « Filtrer » des listes (Chiffrages, Projets, Programmation) : ouvre le panneau de
// conditions « Lorsque [champ] [opérateur] [valeur] » (ET / OU). Même rendu et même comportement
// partout — référence : la liste Projets. `align` : côté où s'ouvre le panneau.
export default function ConditionFilterButton({ schema, conditions, onChange, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const activeCount = conditions.filter(isConditionActive).length;
  const hasActive = activeCount > 0;
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          cursor: 'pointer', padding: '5px 12px', height: 38,
          background: hasActive ? 'var(--df-green-bg-2)' : (open ? 'var(--df-selected)' : 'var(--df-bg)'),
          color: hasActive ? 'var(--df-x-15803D)' : 'var(--df-text-2)',
          border: `1px solid ${hasActive ? 'var(--df-x-86EFAC)' : (open ? 'var(--df-blue)' : 'var(--df-border-strong)')}`,
          borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
          fontWeight: hasActive ? 600 : 400, fontFamily: 'inherit', whiteSpace: 'nowrap',
        }}
      >
        <Filter size={14} />
        Filtrer
        {hasActive && (
          <span style={{ background: '#16a34a', color: 'white', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '0 6px', lineHeight: '18px' }}>
            {activeCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }} onClick={() => setOpen(false)} />
          <FitPanel style={{ position: 'absolute', top: 'calc(100% + 4px)', [align]: 0, zIndex: 1001 }}>
            <FilterPanel schema={schema} conditions={conditions} onChange={onChange} />
          </FitPanel>
        </>
      )}
    </div>
  );
}
