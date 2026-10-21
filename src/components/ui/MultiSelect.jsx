import React, { useState } from 'react';
import Popover from '@mui/material/Popover';
import { ChevronDown, Check as CheckIcon, Lock } from 'lucide-react';

// Menu déroulant à choix multiples, au format d'un champ de la DA : le bouton résume la
// sélection (« Toutes (9) », « A, B, D », « 5 sur 12 ») ; cases à cocher + Tout / Aucun.
// options : [{ value, label, count?, locked? }] ; `value` = valeurs cochées.
export default function MultiSelect({ options, value, onChange, allLabel = 'Toutes', single = false, width }) {
    const [anchor, setAnchor] = useState(null);
    const [q, setQ] = useState('');
    const searchable = options.length > 12;
    const fold = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const shown = q ? options.filter(o => fold(o.label).includes(fold(q))) : options;
    const on = (v) => value.includes(v);
    const picked = options.filter(o => on(o.value) || o.locked);
    const summary = single ? (options.find(o => on(o.value))?.label || '—')
        : picked.length === options.length ? `${allLabel} (${options.length})`
        : picked.length === 0 ? 'Aucune'
        : picked.length <= 3 ? picked.map(o => o.label).join(', ')
        : `${picked.length} sur ${options.length}`;
    const toggle = (o) => {
        if (o.locked) return;
        if (single) { onChange([o.value]); setAnchor(null); return; }
        onChange(on(o.value) ? value.filter(v => v !== o.value) : [...value, o.value]);
    };
    return (
        <>
            <button
                type="button"
                onClick={(e) => setAnchor(e.currentTarget)}
                style={{
                    width: width || '100%', height: 38, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', boxSizing: 'border-box',
                    border: `1px solid ${anchor ? 'var(--df-primary)' : 'var(--df-border)'}`, borderRadius: 8, background: 'var(--df-bg)', cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 14, color: 'var(--df-text)', textAlign: 'left',
                }}
            >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>
                <ChevronDown size={16} color="var(--df-muted)" />
            </button>
            <Popover
                open={!!anchor}
                anchorEl={anchor}
                onClose={() => { setAnchor(null); setQ(''); }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                PaperProps={{ sx: { mt: 0.5, borderRadius: '8px', border: '1px solid var(--df-border)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', minWidth: anchor?.offsetWidth || 220, maxHeight: 360, p: 0.5 } }}
            >
                {searchable && (
                    <input
                        autoFocus
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Rechercher…"
                        style={{ width: '100%', boxSizing: 'border-box', height: 32, margin: '2px 0 4px', padding: '0 10px', border: '1px solid var(--df-border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                    />
                )}
                {!single && options.length > 3 && (
                    <div style={{ display: 'flex', gap: 12, padding: '6px 10px 8px', borderBottom: '1px solid var(--df-border-soft)', marginBottom: 4 }}>
                        {[['Tout', options.map(o => o.value)], ['Aucun', options.filter(o => o.locked).map(o => o.value)]].map(([t, v]) => (
                            <button key={t} type="button" onClick={() => onChange(v)} style={{ border: 'none', background: 'none', padding: 0, color: 'var(--df-primary-text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{t}</button>
                        ))}
                    </div>
                )}
                {shown.map(o => {
                    const checked = on(o.value) || o.locked;
                    return (
                        <div key={o.value} onClick={() => toggle(o)} title={o.locked ? 'Nécessaire pour réimporter le fichier' : undefined}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 6, fontSize: 13, color: 'var(--df-text)', cursor: o.locked ? 'default' : 'pointer', background: checked && !single ? 'var(--df-selected)' : 'transparent' }}>
                            {!single && (
                                <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${checked ? 'var(--df-primary)' : 'var(--df-border-hover)'}`, background: checked ? 'var(--df-primary)' : 'var(--df-bg)', opacity: o.locked ? 0.6 : 1 }}>
                                    {checked && <CheckIcon size={11} color="white" strokeWidth={3} />}
                                </span>
                            )}
                            <span style={{ flex: 1 }}>{o.label}</span>
                            {o.locked && <Lock size={12} color="var(--df-faint)" />}
                            {o.count != null && <span style={{ color: 'var(--df-faint)', fontSize: 12 }}>{o.count}</span>}
                            {single && checked && <CheckIcon size={14} color="var(--df-primary-text)" />}
                        </div>
                    );
                })}
            </Popover>
        </>
    );
}

