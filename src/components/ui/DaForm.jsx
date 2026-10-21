import React from 'react';

const ROBOTO = 'Roboto, system-ui, sans-serif';

// Champ de formulaire à la DA : libellé gris au-dessus, aide éventuelle en dessous.
export function DaField({ label, hint, children }) {
  return (
    <div>
      <div style={{ fontFamily: ROBOTO, fontSize: 13, color: 'var(--df-muted)', marginBottom: 6 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 12, color: 'var(--df-faint)', marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

// Choix en pastille (cases à cocher, choix exclusifs) : blanc à trait fin, bleu nuit si actif.
export function ChoicePill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 34, padding: '0 14px', borderRadius: 99, cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
        background: active ? 'var(--df-primary)' : 'var(--df-bg)', color: active ? 'white' : 'var(--df-text-2)',
        border: `1px solid ${active ? 'var(--df-primary)' : 'var(--df-border)'}`,
      }}
    >
      {children}
    </button>
  );
}
