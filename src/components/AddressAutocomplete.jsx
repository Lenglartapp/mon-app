// src/components/AddressAutocomplete.jsx
// Autocomplétion d'adresse via Google Places API (New)
import React, { useEffect, useRef, useState } from 'react';
import { X, MapPin } from 'lucide-react';

const GKEY = import.meta.env.VITE_GOOGLE_PLACES_KEY;

async function fetchPlaces(q) {
    try {
        const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GKEY,
            },
            body: JSON.stringify({ input: q, languageCode: 'fr' }),
        });
        const data = await res.json();
        return (data.suggestions ?? []).map(s => s.placePrediction?.text?.text).filter(Boolean);
    } catch { return []; }
}

/**
 * Champ adresse avec autocomplétion Google Places (New).
 * Après sélection dans la liste, l'adresse s'affiche sous forme de chip.
 * Props:
 *   value       – valeur courante (string)
 *   onChange    – (string) => void
 *   placeholder – texte gris
 *   style       – style inline pour le wrapper <div>
 *   inputStyle  – style inline pour le <input> intérieur
 */
export default function AddressAutocomplete({ value, onChange, placeholder = "Ex: 20 rue du Renard, Paris…", style, inputStyle }) {
    const [suggestions, setSuggestions] = useState([]);
    const [open, setOpen] = useState(false);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const inputRef = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
        if (!value) setIsConfirmed(false);
    }, [value]);

    const fetchSuggestions = (q) => {
        clearTimeout(timerRef.current);
        if (q.length < 3) { setSuggestions([]); setOpen(false); return; }
        timerRef.current = setTimeout(async () => {
            const results = await fetchPlaces(q);
            setSuggestions(results);
            setOpen(results.length > 0);
        }, 250);
    };

    const pick = (addr) => {
        onChange(addr);
        setIsConfirmed(true);
        setSuggestions([]);
        setOpen(false);
    };

    const clear = () => {
        onChange('');
        setIsConfirmed(false);
        setSuggestions([]);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    // ── Vue chip (adresse confirmée) ──────────────────────────────────────────
    if (isConfirmed && value) {
        return (
            <div style={{ position: 'relative', ...style }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%' }}>
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 8px 3px 7px', borderRadius: 999,
                        border: '1px solid #D1D5DB', background: '#fff',
                        fontSize: 12, color: '#374151', fontWeight: 500,
                        maxWidth: '100%', overflow: 'hidden',
                    }}>
                        <MapPin size={11} color="#9CA3AF" style={{ flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {value}
                        </span>
                        <button
                            type="button"
                            onClick={clear}
                            style={{
                                border: 'none', background: 'none', cursor: 'pointer',
                                padding: 0, display: 'flex', alignItems: 'center',
                                color: '#9CA3AF', flexShrink: 0, marginLeft: 2,
                            }}
                        >
                            <X size={12} />
                        </button>
                    </span>
                </div>
            </div>
        );
    }

    // ── Vue input (saisie en cours) ───────────────────────────────────────────
    return (
        <div style={{ position: 'relative', ...style }}>
            <input
                ref={inputRef}
                value={value}
                placeholder={placeholder}
                onChange={e => { onChange(e.target.value); fetchSuggestions(e.target.value); }}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onFocus={() => suggestions.length > 0 && setOpen(true)}
                autoComplete="off"
                style={{
                    border: 'none', background: 'transparent',
                    color: '#374151', fontSize: 13, fontFamily: 'inherit',
                    outline: 'none', width: '100%',
                    ...inputStyle,
                }}
            />
            {open && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 1000,
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.10)', maxHeight: 220, overflowY: 'auto',
                }}>
                    {suggestions.map((s, i) => (
                        <div
                            key={i}
                            onMouseDown={() => pick(s)}
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f1f5f9' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                        >
                            {s}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
