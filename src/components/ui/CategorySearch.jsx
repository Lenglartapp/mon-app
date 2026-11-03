// src/components/ui/CategorySearch.jsx
// -----------------------------------------------------------------------------
// Barre de recherche qui propose OÙ chercher : dès qu'on tape, un menu liste les catégories
// (Fournisseur, Référence…) avec le nombre de résultats de chacune, plus « Partout ».
// La catégorie choisie s'affiche en étiquette dans le champ (× pour revenir à « Partout »).
// Sans choix, la recherche porte partout, comme une barre classique.
// -----------------------------------------------------------------------------
import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

export const SEARCH_ALL = 'all';

/**
 * @param value       texte cherché
 * @param field       catégorie choisie (SEARCH_ALL = partout)
 * @param categories  [{ key, label }]
 * @param countFor    (key, text) => nombre de résultats (key = SEARCH_ALL pour partout)
 */
export default function CategorySearch({ value, field, onChange, categories, countFor, placeholder, width = 320 }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const options = [...categories, { key: SEARCH_ALL, label: 'Partout' }];
  const current = categories.find((c) => c.key === field);
  const showMenu = open && !!value && !current;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const choose = (key) => { onChange({ value, field: key }); setOpen(false); inputRef.current?.focus(); };
  const onKeyDown = (e) => {
    if (e.key === 'Backspace' && !value && current) { onChange({ value, field: SEARCH_ALL }); return; }
    if (!showMenu) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % options.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + options.length) % options.length); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(options[active].key); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', width }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, height: 38, boxSizing: 'border-box',
        background: 'var(--df-bg)', border: '1px solid var(--df-border)', borderRadius: 8, padding: '0 10px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)', fontSize: 13, color: 'var(--df-text)',
      }}>
        <Search size={16} color="var(--df-faint)" style={{ flexShrink: 0 }} />
        {current && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: 'var(--df-surface)', border: '1px solid var(--df-border)', borderRadius: 99, padding: '1px 2px 1px 8px', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {current.label}
            <button type="button" title="Chercher partout" onClick={() => onChange({ value, field: SEARCH_ALL })}
              style={{ border: 'none', background: 'none', padding: '0 3px', cursor: 'pointer', color: 'var(--df-faint)', display: 'flex' }}>
              <X size={12} />
            </button>
          </span>
        )}
        <input
          ref={inputRef}
          value={value || ''}
          placeholder={placeholder}
          onChange={(e) => { onChange({ value: e.target.value, field }); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--df-text)', fontFamily: 'inherit', padding: 0 }}
        />
        {(value || current) && (
          <button type="button" title="Effacer" onClick={() => onChange({ value: '', field: SEARCH_ALL })}
            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--df-faint)', display: 'flex' }}>
            <X size={14} />
          </button>
        )}
      </div>
      {showMenu && (
        <div role="listbox" style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: '100%', minWidth: 240, zIndex: 1100,
          background: 'var(--df-bg)', border: '1px solid var(--df-border)', borderRadius: 8,
          boxShadow: '0 12px 32px rgba(17,24,39,.14)', padding: 4, fontFamily: 'Roboto, system-ui, sans-serif',
        }}>
          <div style={{ fontSize: 11, color: 'var(--df-muted)', padding: '6px 8px 4px' }}>Chercher « {value} » dans :</div>
          {options.map((c, i) => {
            const n = countFor(c.key, value);
            return (
              <button
                type="button" key={c.key} role="option" aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(c.key)}
                style={{
                  display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  border: 'none', borderRadius: 6, padding: '7px 8px', cursor: 'pointer', textAlign: 'left',
                  background: i === active ? 'var(--df-hover)' : 'transparent', fontSize: 13,
                  color: n ? 'var(--df-text)' : 'var(--df-faint)', fontWeight: c.key === SEARCH_ALL ? 500 : 400,
                  borderTop: c.key === SEARCH_ALL ? '1px solid var(--df-border-soft)' : 'none',
                }}
              >
                <span>{c.label}</span>
                <span style={{ fontSize: 12, color: 'var(--df-muted)', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
