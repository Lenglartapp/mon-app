import React, { useMemo, useState } from 'react';
import { X, Package, MapPin } from 'lucide-react';

const GRID_COLS = 13;
const GRID_ROWS = 11;

// Couleur de zone selon taux de remplissage
const zoneColors = (pct, isSelected) => {
    if (pct === null) return { bg: '#1A2332', border: '#243044', label: '#475569', bar: '#334155' };
    if (pct === 0)   return { bg: '#1A2332', border: isSelected ? '#60A5FA' : '#243044', label: '#64748B', bar: '#334155' };
    if (pct < 40)    return { bg: '#0A2F1E', border: isSelected ? '#60A5FA' : '#166534', label: '#4ADE80', bar: '#22C55E' };
    if (pct < 75)    return { bg: '#2D1A00', border: isSelected ? '#60A5FA' : '#92400E', label: '#FBBF24', bar: '#F59E0B' };
    return             { bg: '#2D0A0A', border: isSelected ? '#60A5FA' : '#991B1B', label: '#F87171', bar: '#EF4444' };
};

const TYPE_LABELS = {
    rouleaux:    '🧵 Rouleaux',
    palettes:    '📦 Palettes',
    consommable: '🔧 Consommable',
    reception:   '📥 Réceptions',
    structure:   null,
};

export default function WarehouseMap({ zones = [], inventory = [] }) {
    const [selectedCode, setSelectedCode] = useState(null);

    // Calcul occupation par zone
    const occByZone = useMemo(() => {
        const result = {};
        zones.forEach(z => {
            const items = inventory.filter(i => i.location === z.code);
            const rouleaux = items.reduce((acc, item) => {
                if (item.category === 'Tissu') return acc + (Array.isArray(item.pieces) ? item.pieces.length : 1);
                return acc + 1;
            }, 0);
            const cap = z.type === 'palettes' ? (z.capacite || 0) * 10 : (z.capacite || 0);
            const pct = cap > 0 ? Math.min(Math.round((rouleaux / cap) * 100), 100) : (items.length > 0 ? 50 : 0);
            result[z.code] = { rouleaux, cap, pct: z.is_storage ? pct : null, items };
        });
        return result;
    }, [zones, inventory]);

    const selectedZone = zones.find(z => z.code === selectedCode);
    const selectedOcc  = selectedCode ? occByZone[selectedCode] : null;

    const handleClick = (zone) => {
        if (zone.type === 'structure') return;
        setSelectedCode(prev => prev === zone.code ? null : zone.code);
    };

    return (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', minHeight: 520 }}>

            {/* ── CARTE ─────────────────────────────────── */}
            <div style={{
                flex: 1, minWidth: 0,
                background: '#0F172A',
                borderRadius: 16,
                padding: '20px 20px 16px',
                overflowX: 'auto',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                        <div style={{ color: '#F1F5F9', fontWeight: 800, fontSize: 16 }}>Plan de l'Entrepôt</div>
                        <div style={{ color: '#475569', fontSize: 12, marginTop: 2 }}>Cliquez sur une zone pour voir le contenu</div>
                    </div>
                    {/* Légende */}
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                        {[
                            { color: '#243044', label: 'Vide' },
                            { color: '#22C55E', label: '< 40%' },
                            { color: '#F59E0B', label: '40–75%' },
                            { color: '#EF4444', label: '> 75%' },
                        ].map(l => (
                            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color, border: '1px solid rgba(255,255,255,0.15)' }} />
                                <span style={{ color: '#64748B', fontSize: 11 }}>{l.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Étiquette section nord */}
                <div style={{ color: '#334155', fontSize: 10, fontWeight: 700, letterSpacing: 2, marginBottom: 6, paddingLeft: 2 }}>
                    ▲ SECTION NORD — ALLÉES D · E · F · G · H
                </div>

                {/* Grille */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${GRID_COLS}, minmax(52px, 1fr))`,
                    gridTemplateRows: `repeat(${GRID_ROWS}, minmax(46px, auto))`,
                    gap: 3,
                    minWidth: GRID_COLS * 56,
                }}>
                    {/* Séparateur allée centrale (lignes 5-6) */}
                    <div style={{
                        gridColumn: '1 / span 10',
                        gridRow: '5 / span 2',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderTop: '1px dashed #1E293B',
                        borderBottom: '1px dashed #1E293B',
                    }}>
                        <span style={{ color: '#1E293B', fontSize: 10, fontWeight: 700, letterSpacing: 3 }}>· · · ALLÉE CENTRALE · · ·</span>
                    </div>

                    {zones.map(zone => {
                        const occ = occByZone[zone.code];
                        const isSelected = selectedCode === zone.code;
                        const isStructure = zone.type === 'structure';
                        const colors = isStructure
                            ? { bg: '#111827', border: isSelected ? '#60A5FA' : '#1F2937', label: '#374151', bar: '#1F2937' }
                            : zoneColors(occ?.pct ?? 0, isSelected);

                        return (
                            <div
                                key={zone.code}
                                onClick={() => handleClick(zone)}
                                style={{
                                    gridColumn: `${zone.map_col} / span ${zone.map_col_span || 1}`,
                                    gridRow: `${zone.map_row} / span ${zone.map_row_span || 1}`,
                                    background: colors.bg,
                                    border: `2px solid ${colors.border}`,
                                    borderRadius: 7,
                                    padding: isStructure ? '4px 6px' : '6px 8px',
                                    cursor: isStructure ? 'default' : 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    transition: 'border-color 0.15s, box-shadow 0.15s',
                                    boxShadow: isSelected ? `0 0 0 2px rgba(96,165,250,0.4)` : 'none',
                                    overflow: 'hidden',
                                    position: 'relative',
                                }}
                            >
                                {isStructure ? (
                                    <div style={{
                                        fontSize: 9, fontWeight: 700, color: colors.label,
                                        textAlign: 'center', textTransform: 'uppercase',
                                        letterSpacing: 0.5, lineHeight: 1.3,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        height: '100%',
                                    }}>
                                        {zone.label_carte}
                                    </div>
                                ) : (
                                    <>
                                        {/* Code zone */}
                                        <div style={{ fontSize: 11, fontWeight: 800, color: colors.label, lineHeight: 1 }}>
                                            {zone.code}
                                        </div>

                                        {/* % si rempli */}
                                        {occ && occ.pct > 0 && (
                                            <div style={{ fontSize: 15, fontWeight: 800, color: colors.label, lineHeight: 1 }}>
                                                {occ.pct}%
                                            </div>
                                        )}

                                        {/* Barre d'occupation */}
                                        {zone.capacite && (
                                            <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginTop: 'auto' }}>
                                                <div style={{
                                                    width: `${occ?.pct || 0}%`,
                                                    height: '100%',
                                                    background: colors.bar,
                                                    borderRadius: 2,
                                                    transition: 'width 0.6s ease',
                                                }} />
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Étiquette section sud */}
                <div style={{ color: '#334155', fontSize: 10, fontWeight: 700, letterSpacing: 2, marginTop: 8, paddingLeft: 2 }}>
                    ▼ SECTION SUD — ALLÉES A · B · C + CONSOMMABLES
                </div>
            </div>

            {/* ── PANNEAU LATÉRAL ───────────────────────── */}
            <div style={{
                width: 268,
                flexShrink: 0,
                background: 'white',
                borderRadius: 16,
                border: '1px solid #E5E7EB',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 400,
            }}>
                {selectedZone && selectedOcc ? (
                    <>
                        {/* En-tête panneau */}
                        <div style={{
                            background: selectedOcc.pct > 75 ? '#FEF2F2' : selectedOcc.pct > 40 ? '#FFFBEB' : '#F0FDF4',
                            padding: '16px 16px 12px',
                            borderBottom: '1px solid #F3F4F6',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontSize: 28, fontWeight: 900, color: '#111827', lineHeight: 1 }}>
                                        {selectedZone.code}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                                        {TYPE_LABELS[selectedZone.type] || selectedZone.type}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedCode(null)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Jauge */}
                            {selectedZone.capacite && (
                                <div style={{ marginTop: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                        <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>OCCUPATION</span>
                                        <span style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>
                                            {selectedOcc.pct}%
                                        </span>
                                    </div>
                                    <div style={{ height: 8, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${selectedOcc.pct || 0}%`,
                                            height: '100%',
                                            background: selectedOcc.pct > 75 ? '#EF4444' : selectedOcc.pct > 40 ? '#F59E0B' : '#10B981',
                                            borderRadius: 4,
                                            transition: 'width 0.5s',
                                        }} />
                                    </div>
                                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 5 }}>
                                        {selectedOcc.rouleaux} / {selectedZone.capacite} {selectedZone.capacite_unite || 'rouleaux'}
                                        {selectedZone.type === 'palettes' && ' (×10 = ' + selectedOcc.cap + ' rouleaux éq.)'}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Liste des articles */}
                        <div style={{ padding: '12px 16px', flex: 1, overflowY: 'auto' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 10 }}>
                                Contenu · {selectedOcc.items.length} référence{selectedOcc.items.length !== 1 ? 's' : ''}
                            </div>

                            {selectedOcc.items.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF' }}>
                                    <Package size={28} style={{ marginBottom: 8, opacity: 0.3 }} />
                                    <div style={{ fontSize: 13 }}>Zone vide</div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {selectedOcc.items.map((item, i) => (
                                        <div key={i} style={{
                                            background: '#F9FAFB',
                                            borderRadius: 8,
                                            padding: '10px 12px',
                                            border: '1px solid #F3F4F6',
                                        }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                                                {item.product || item.name || '—'}
                                            </div>
                                            {item.ref && (
                                                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                                                    Réf: {item.ref}
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                                                {item.project && (
                                                    <span style={{
                                                        background: '#EFF6FF', color: '#1E40AF',
                                                        padding: '2px 7px', borderRadius: 4,
                                                        fontSize: 11, fontWeight: 600,
                                                    }}>
                                                        {item.project}
                                                    </span>
                                                )}
                                                <span style={{
                                                    background: '#F3F4F6', color: '#374151',
                                                    padding: '2px 7px', borderRadius: 4,
                                                    fontSize: 11, fontWeight: 600,
                                                }}>
                                                    {Number(item.qty).toLocaleString()} {item.unit}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div style={{
                        flex: 1, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        padding: 24, color: '#9CA3AF', textAlign: 'center',
                    }}>
                        <MapPin size={36} style={{ marginBottom: 12, opacity: 0.25 }} />
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#6B7280' }}>
                            Sélectionnez une zone
                        </div>
                        <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
                            Cliquez sur une zone de stockage pour voir son contenu et son taux d'occupation.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
