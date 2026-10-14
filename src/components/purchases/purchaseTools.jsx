// Composants partagés des tableaux d'achats (Liste Achats + Moulinette) : filtre d'en-tête
// par valeurs et bouton « Copier pour demande de prix » (cf. lib/purchases/supplierInfo).
import React, { useMemo, useState } from 'react';
import Popover from '@mui/material/Popover';
import { ChevronDown, Filter, Copy, Check } from 'lucide-react';
import { EMPTY_VALUE, valueOf, copyItemsForSupplier } from '../../lib/purchases/supplierInfo';

// Nombre lu dans une valeur affichée (« 1 591 ml » → 1591) pour ranger les quantités.
const numberOf = (v) => Number(String(v).replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;

// Filtre par valeurs (cases à cocher) + tri, en bouton de barre (`button`) ou en entonnoir d'en-tête (`icon`).
// value : Set des valeurs retenues, ou null = toutes. sort / onSort : tri de la colonne { key, dir }
// (sortKey = clé triée, ex. « qty » pour la colonne Quantité filtrée sur « qtyLabel »).
export function ValueFilter({ label, items, field, value, onChange, variant = 'button', numeric = false, sortKey = field, sort, onSort }) {
    const [anchor, setAnchor] = useState(null);
    const [q, setQ] = useState('');
    const options = useMemo(() => {
        const counts = new Map();
        (items || []).forEach(it => { const v = valueOf(it, field); counts.set(v, (counts.get(v) || 0) + 1); });
        return [...counts.entries()].sort((a, b) => (numeric
            ? numberOf(b[0]) - numberOf(a[0])
            : a[0].localeCompare(b[0], 'fr', { numeric: true })));
    }, [items, field, numeric]);
    const sorted = sort?.key === sortKey ? sort.dir : null;
    const active = !!value;
    const shown = options.filter(([v]) => !q || v.toLowerCase().includes(q.toLowerCase()));
    const toggle = (v) => {
        const next = new Set(value || options.map(([o]) => o));
        if (next.has(v)) next.delete(v); else next.add(v);
        onChange(next.size === options.length ? null : next);
    };
    const close = () => { setAnchor(null); setQ(''); };

    return (
        <>
            {variant === 'icon' ? (
                <button type="button" title={`Filtrer par ${label.toLowerCase()}`} onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); }}
                    style={{ display: 'inline-flex', border: 'none', background: active ? '#1E2447' : 'transparent', color: active ? 'white' : '#9B9A97', borderRadius: 4, padding: 2, cursor: 'pointer' }}>
                    <Filter size={12} />
                    {sorted && <span style={{ fontSize: 11, lineHeight: '12px', marginLeft: 1 }}>{sorted === 'desc' ? '↓' : '↑'}</span>}
                </button>
            ) : (
                <button type="button" onClick={(e) => setAnchor(e.currentTarget)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px', borderRadius: 8, border: `1px solid ${active ? '#1E2447' : '#E0DED9'}`, background: active ? '#1E2447' : 'white', color: active ? 'white' : '#111827', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
                    {label}{active ? ` (${value.size})` : ''} <ChevronDown size={14} />
                </button>
            )}
            <Popover
                open={!!anchor}
                anchorEl={anchor}
                onClose={close}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                PaperProps={{ sx: { borderRadius: '8px', border: '1px solid #E0DED9', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', width: 280 } }}
            >
                {onSort && (
                    <div style={{ display: 'flex', gap: 6, padding: 8, borderBottom: '1px solid #E8E6E2' }}>
                        {[['desc', numeric ? 'Plus grand d\'abord' : 'Z → A'], ['asc', numeric ? 'Plus petit d\'abord' : 'A → Z']].map(([dir, txt]) => (
                            <button key={dir} type="button" onClick={() => onSort({ key: sortKey, dir })}
                                style={{ flex: 1, height: 28, borderRadius: 6, border: `1px solid ${sorted === dir ? '#1E2447' : '#E0DED9'}`, background: sorted === dir ? '#1E2447' : 'white', color: sorted === dir ? 'white' : '#374151', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}>
                                {txt}
                            </button>
                        ))}
                    </div>
                )}
                <div style={{ padding: 8, borderBottom: '1px solid #E8E6E2' }}>
                    <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Rechercher (${label.toLowerCase()})…`}
                        style={{ width: '100%', boxSizing: 'border-box', height: 32, padding: '0 8px', borderRadius: 6, border: '1px solid #E0DED9', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                </div>
                <div style={{ maxHeight: 300, overflowY: 'auto', padding: 4 }}>
                    {shown.map(([v, n]) => {
                        const on = !value || value.has(v);
                        return (
                            <div key={v} onClick={() => toggle(v)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
                                <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${on ? '#1E2447' : '#C9C7C2'}`, background: on ? '#1E2447' : 'white' }}>
                                    {on && <Check size={11} color="white" strokeWidth={3} />}
                                </span>
                                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: v === EMPTY_VALUE ? '#9CA3AF' : '#111827' }}>{v}</span>
                                <span style={{ fontSize: 11, color: '#9CA3AF' }}>{n}</span>
                                <button type="button" title="Seulement celui-ci" onClick={(e) => { e.stopPropagation(); onChange(new Set([v])); }}
                                    style={{ border: 'none', background: 'none', color: '#1E2447', fontSize: 11, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>seul</button>
                            </div>
                        );
                    })}
                    {shown.length === 0 && <div style={{ padding: 8, fontSize: 13, color: '#9CA3AF' }}>Aucune valeur.</div>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderTop: '1px solid #E8E6E2' }}>
                    <button type="button" onClick={() => onChange(null)} style={{ border: 'none', background: 'none', color: '#1E2447', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Tout</button>
                    <button type="button" onClick={() => onChange(new Set())} style={{ border: 'none', background: 'none', color: '#6B7280', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Aucun</button>
                </div>
            </Popover>
        </>
    );
}

// Copie du tableau (articles affichés) pour une demande de prix — dans l'en-tête, à gauche du total.
export function CopyTableButton({ items }) {
    const [done, setDone] = useState(false);
    const copy = async () => {
        if (await copyItemsForSupplier(items)) {
            setDone(true);
            setTimeout(() => setDone(false), 2000);
        } else {
            window.alert("La copie n'a pas pu se faire. Sélectionnez le tableau à la souris puis Cmd+C / Ctrl+C.");
        }
    };
    return (
        <button
            type="button"
            onClick={copy}
            title="Copier ce tableau en liste à puces pour une demande de prix (fournisseur, référence, coloris, laize, quantité — sans prix)"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px', marginRight: 10, borderRadius: 8, border: '1px solid #E0DED9', background: done ? '#1E2447' : 'white', color: done ? 'white' : '#374151', fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
            {done ? <Check size={14} /> : <Copy size={14} />}
            {done ? `${items.length} copié${items.length > 1 ? 's' : ''}` : 'Copier pour demande de prix'}
        </button>
    );
}
