import React from 'react';
import Dialog from '@mui/material/Dialog';
import { X } from 'lucide-react';

const ROBOTO = 'Roboto, system-ui, sans-serif';

// Coque de fenêtre à la DA (comme le simulateur « Objectif » de la moulinette) :
// titre Roboto + sous-titre, croix de fermeture, trait fin sous l'en-tête et au-dessus du pied.
//  - `headerExtra` : contenu à droite du titre (bouton d'action…)
//  - `tabs`        : rangée d'onglets sous l'en-tête (cf. DaTabs)
//  - `footer`      : pied (boutons) ; omis = pas de pied
export default function DaDialog({ open, onClose, title, subtitle, headerExtra, tabs, footer, children, maxWidth = 'sm', height, bodyPadding = '20px 28px' }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth
      PaperProps={{ sx: { borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(17,24,39,0.18)', fontFamily: ROBOTO, ...(height ? { height } : {}) } }}
      slotProps={{ backdrop: { sx: { background: 'rgba(17,24,39,0.4)' } } }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '22px 28px 16px', borderBottom: tabs ? 'none' : '1px solid #E8E6E2' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 400, color: '#111827', fontFamily: ROBOTO, lineHeight: 1.2 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>{subtitle}</div>}
        </div>
        {headerExtra && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{headerExtra}</div>}
        <button onClick={onClose} title="Fermer" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9B9A97', display: 'flex', padding: 4 }}>
          <X size={20} />
        </button>
      </div>
      {tabs && <div style={{ padding: '0 28px 14px', borderBottom: '1px solid #E8E6E2' }}>{tabs}</div>}
      <div style={{ flex: 1, overflowY: 'auto', padding: bodyPadding }}>{children}</div>
      {footer && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 28px', borderTop: '1px solid #E8E6E2' }}>{footer}</div>
      )}
    </Dialog>
  );
}

// Onglets à la DA (mêmes pastilles que Minutes / Liste Achats / Moulinette).
export function DaTabs({ tabs, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => !t.disabled && onChange(t.key)}
            disabled={t.disabled}
            style={{
              opacity: t.disabled ? 0.4 : 1,
              padding: '7px 16px', borderRadius: 99, border: 'none', cursor: t.disabled ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 500,
              fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
              background: active ? '#1E2447' : 'transparent', color: active ? '#FFFFFF' : '#4B5563',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
