// src/components/AddressAutocomplete.jsx
// Autocomplétion d'adresse via Nominatim (OpenStreetMap) — aucune clé API requise
import React, { useRef, useState } from 'react';

const formatAddress = (a) => {
    const parts = [];
    if (a.house_number && a.road) parts.push(`${a.house_number} ${a.road}`);
    else if (a.road) parts.push(a.road);
    else if (a.amenity || a.tourism || a.building) parts.push(a.amenity || a.tourism || a.building);
    const city = a.city || a.town || a.village || a.municipality;
    if (a.postcode && city) parts.push(`${a.postcode} ${city}`);
    else if (city) parts.push(city);
    return parts.join(", ") || null;
};

/**
 * Champ adresse avec autocomplétion Nominatim.
 * Props:
 *   value       – valeur courante (string)
 *   onChange    – (string) => void  appelé à chaque frappe ET à la sélection
 *   placeholder – texte gris
 *   style       – style inline pour l'<input>
 *   inputStyle  – alias de style (accepté aussi)
 */
export default function AddressAutocomplete({ value, onChange, placeholder = "Ex: 20 rue du Renard, Paris…", style, inputStyle }) {
    const [suggestions, setSuggestions] = useState([]);
    const [open, setOpen] = useState(false);
    const timerRef = useRef(null);

    const fetchSuggestions = (q) => {
        clearTimeout(timerRef.current);
        if (q.length < 3) { setSuggestions([]); setOpen(false); return; }
        timerRef.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1`,
                    { headers: { "Accept-Language": "fr" } }
                );
                const data = await res.json();
                const opts = data
                    .map(d => formatAddress(d.address))
                    .filter(Boolean)
                    .filter((v, i, arr) => arr.indexOf(v) === i);
                setSuggestions(opts);
                setOpen(opts.length > 0);
            } catch { /* ignore réseau */ }
        }, 350);
    };

    const pick = (addr) => {
        onChange(addr);
        setSuggestions([]);
        setOpen(false);
    };

    return (
        <div style={{ position: 'relative', ...style }}>
            <input
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
