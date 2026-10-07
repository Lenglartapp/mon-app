// src/components/AddressAutocomplete.jsx
// Autocomplétion d'adresse, sans clé d'API :
//  1. France  — Base Adresse Nationale (api-adresse.data.gouv.fr, service de l'État) ;
//  2. Monde   — Photon (photon.komoot.io, données OpenStreetMap).
// La France passe en premier, puis le reste du monde. (Avant : Google Places, dont la clé
// était refusée en prod — « permission refusée » — d'où l'absence de suggestions.)
import React, { useEffect, useRef, useState } from 'react';
import { X, MapPin } from 'lucide-react';

async function fetchFrance(q) {
    try {
        const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`);
        const data = await res.json();
        return (data.features ?? []).map(f => ({ label: f.properties?.label, sub: f.properties?.context })).filter(s => s.label);
    } catch { return []; }
}

async function fetchWorld(q) {
    try {
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=fr`);
        const data = await res.json();
        return (data.features ?? []).map(f => {
            const p = f.properties || {};
            const street = [p.housenumber, p.street].filter(Boolean).join(' ');
            const first = p.name && p.name !== p.street ? p.name : street;
            const line = [first, p.name && street && p.name !== street ? street : null, [p.postcode, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
            return { label: line, sub: p.country, country: p.countrycode };
        }).filter(s => s.label);
    } catch { return []; }
}

// France d'abord, puis le monde (hors France si la France a déjà répondu), sans doublons.
async function fetchPlaces(q) {
    const [fr, world] = await Promise.all([fetchFrance(q), fetchWorld(q)]);
    const others = world.filter(w => !(fr.length && w.country === 'FR'));
    const seen = new Set();
    return [...fr, ...others].filter(s => (seen.has(s.label) ? false : seen.add(s.label))).slice(0, 8);
}

/**
 * Champ adresse avec autocomplétion (France puis monde).
 * Une adresse renseignée s'affiche en texte précédé d'une petite icône de localisation.
 * Props:
 *   value       – valeur courante (string)
 *   onChange    – (string) => void
 *   placeholder – texte gris
 *   style       – style inline pour le wrapper <div>
 *   inputStyle  – style inline pour le <input> intérieur
 *   onCommit    – (string) => void, optionnel : appelé seulement quand la saisie est
 *                 « validée » (sélection, effacement, sortie du champ). Permet de
 *                 persister une seule fois au lieu d'écrire en base à chaque frappe.
 */
export default function AddressAutocomplete({ value, onChange, onCommit, placeholder = "Ex: 20 rue du Renard, Paris…", style, inputStyle }) {
    const [suggestions, setSuggestions] = useState([]);
    const [open, setOpen] = useState(false);
    // Adresse déjà renseignée (enregistrée) : affichée comme confirmée dès l'ouverture
    const [isConfirmed, setIsConfirmed] = useState(() => Boolean(value));
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

    const pick = (s) => {
        const addr = s.label;
        onChange(addr);
        onCommit?.(addr);
        setIsConfirmed(true);
        setSuggestions([]);
        setOpen(false);
    };

    const clear = () => {
        onChange('');
        onCommit?.('');
        setIsConfirmed(false);
        setSuggestions([]);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    // ── Vue confirmée : petite icône de localisation + adresse (clic = modifier) ────
    if (isConfirmed && value) {
        return (
            <div style={{ position: 'relative', ...style }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', fontSize: 13, color: '#111827', fontWeight: 500 }}>
                    <MapPin size={13} color="#1E2447" style={{ flexShrink: 0 }} />
                    <span
                        onClick={() => { setIsConfirmed(false); setTimeout(() => inputRef.current?.focus(), 50); }}
                        title="Modifier l'adresse"
                        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }}
                    >
                        {value}
                    </span>
                    <button
                        type="button"
                        onClick={clear}
                        title="Effacer l'adresse"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#9CA3AF', flexShrink: 0 }}
                    >
                        <X size={12} />
                    </button>
                </span>
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
                onBlur={(e) => { const v = e.target.value; setTimeout(() => setOpen(false), 150); onCommit?.(v); }}
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
                    background: '#fff', border: '1px solid #E0DED9', borderRadius: 8,
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', maxHeight: 280, overflowY: 'auto', minWidth: 320,
                }}>
                    {suggestions.map((s, i) => (
                        <div
                            key={i}
                            onMouseDown={() => pick(s)}
                            style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: i < suggestions.length - 1 ? '1px solid #E8E6E2' : 'none' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#F7F7F5'}
                            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                        >
                            <MapPin size={13} color="#9B9A97" style={{ flexShrink: 0, marginTop: 2 }} />
                            <div style={{ minWidth: 0 }}>
                                <div style={{ color: '#111827' }}>{s.label}</div>
                                {s.sub && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{s.sub}</div>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
