import React, { useMemo, useState } from 'react';
import { X, Package, MapPin } from 'lucide-react';

// ── Dimensions de la grille ──────────────────────────────────
const CELL_W  = 74;   // largeur d'une cellule (px)
const CELL_H  = 58;   // hauteur d'une cellule (px)
const GAP     = 5;    // espace entre cellules
const COLS    = 13;
const ROWS    = 11;

const TOTAL_W = COLS * (CELL_W + GAP) - GAP;
const TOTAL_H = ROWS * (CELL_H + GAP) - GAP;

// Position absolue d'une zone dans le canvas
const zoneRect = (z) => ({
    left:   (z.map_col  - 1) * (CELL_W + GAP),
    top:    (z.map_row  - 1) * (CELL_H + GAP),
    width:  (z.map_col_span  || 1) * (CELL_W + GAP) - GAP,
    height: (z.map_row_span  || 1) * (CELL_H + GAP) - GAP,
});

// Couleur d'une zone selon son taux de remplissage
const fillColor = (pct) => {
    if (pct <= 0)  return { bg: '#1E3A5F', border: '#2563EB22', text: '#3B82F6', bar: '#2563EB' };
    if (pct < 40)  return { bg: '#14532D', border: '#16A34A55', text: '#4ADE80', bar: '#22C55E' };
    if (pct < 75)  return { bg: '#78350F', border: '#D9770055', text: '#FCD34D', bar: '#F59E0B' };
    return               { bg: '#7F1D1D', border: '#EF444455', text: '#FCA5A5', bar: '#EF4444' };
};

const TYPE_LABELS = {
    rouleaux:    '🧵 Rouleaux',
    palettes:    '📦 Palettes',
    consommable: '🔧 Consommable',
    reception:   '📥 Réceptions',
};

// Zones qui constituent l'allée (visuellement des couloirs)
const AISLE_ROWS = [5, 6]; // lignes 5 et 6 = allée centrale

export default function WarehouseMap({ zones = [], inventory = [] }) {
    const [selectedCode, setSelectedCode] = useState(null);

    // ── Calcul d'occupation par zone ────────────────────────
    const occByZone = useMemo(() => {
        const result = {};
        zones.forEach(z => {
            const items = inventory.filter(i => i.location === z.code);
            const rouleaux = items.reduce((acc, item) => {
                if (item.category === 'Tissu')
                    return acc + (Array.isArray(item.pieces) ? item.pieces.length : 1);
                return acc + 1;
            }, 0);
            const cap = z.type === 'palettes'
                ? (z.capacite || 0) * 10
                : (z.capacite || 0);
            const pct = cap > 0
                ? Math.min(Math.round((rouleaux / cap) * 100), 100)
                : (items.length > 0 ? 50 : 0);
            result[z.code] = { rouleaux, cap, pct, items };
        });
        return result;
    }, [zones, inventory]);

    // Ensemble des cellules couvertes par des zones (pour ne pas les dessiner en "sol")
    const coveredCells = useMemo(() => {
        const set = new Set();
        zones.forEach(z => {
            const cs = z.map_col_span || 1;
            const rs = z.map_row_span || 1;
            for (let r = 0; r < rs; r++) {
                for (let c = 0; c < cs; c++) {
                    set.add(`${z.map_row + r}-${z.map_col + c}`);
                }
            }
        });
        return set;
    }, [zones]);

    const selectedZone = zones.find(z => z.code === selectedCode);
    const selectedOcc  = selectedCode ? occByZone[selectedCode] : null;

    return (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

            {/* ══ CARTE ══════════════════════════════════════ */}
            <div style={{
                flex: 1, minWidth: 0,
                background: '#0B1220',
                borderRadius: 16,
                padding: '20px 24px 20px',
                overflowX: 'auto',
            }}>
                {/* En-tête */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <div>
                        <div style={{ color: '#E2E8F0', fontWeight: 800, fontSize: 16, letterSpacing: '-0.3px' }}>
                            Plan de l'Entrepôt
                        </div>
                        <div style={{ color: '#475569', fontSize: 12, marginTop: 3 }}>
                            Cliquez sur une zone pour voir son contenu
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        {[
                            { bg: '#1E3A5F', border: '#2563EB22', label: 'Vide' },
                            { bg: '#14532D', border: '#16A34A55', label: '< 40 %' },
                            { bg: '#78350F', border: '#D9770055', label: '40–75 %' },
                            { bg: '#7F1D1D', border: '#EF444455', label: '> 75 %' },
                        ].map(l => (
                            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{
                                    width: 14, height: 14, borderRadius: 3,
                                    background: l.bg,
                                    border: `2px solid ${l.border}`,
                                    boxShadow: `0 0 0 1px ${l.border}`,
                                }} />
                                <span style={{ color: '#64748B', fontSize: 11, fontWeight: 600 }}>{l.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Canvas du plan ── */}
                <div style={{ overflowX: 'auto' }}>
                    <div style={{ position: 'relative', width: TOTAL_W, height: TOTAL_H }}>

                        {/* Tuiles "sol" pour les cellules non-couvertes */}
                        {Array.from({ length: ROWS }, (_, row) =>
                            Array.from({ length: COLS }, (_, col) => {
                                const key = `${row + 1}-${col + 1}`;
                                if (coveredCells.has(key)) return null;
                                const isAisle = AISLE_ROWS.includes(row + 1);
                                return (
                                    <div key={key} style={{
                                        position: 'absolute',
                                        left: col * (CELL_W + GAP),
                                        top:  row * (CELL_H + GAP),
                                        width: CELL_W,
                                        height: CELL_H,
                                        background: isAisle ? 'transparent' : '#0D1825',
                                        borderRadius: 4,
                                        border: isAisle ? 'none' : '1px solid #111E2E',
                                    }} />
                                );
                            })
                        )}

                        {/* Bande "allée centrale" */}
                        <div style={{
                            position: 'absolute',
                            left: 0, right: 0,
                            top:  (AISLE_ROWS[0] - 1) * (CELL_H + GAP),
                            height: AISLE_ROWS.length * (CELL_H + GAP) - GAP,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <div style={{
                                color: '#1E3A5F',
                                fontSize: 10,
                                fontWeight: 700,
                                letterSpacing: 4,
                                textTransform: 'uppercase',
                                borderTop: '1px dashed #1E2D40',
                                borderBottom: '1px dashed #1E2D40',
                                width: '100%',
                                textAlign: 'center',
                                padding: '6px 0',
                            }}>
                                · · · Allée centrale · · ·
                            </div>
                        </div>

                        {/* Zones */}
                        {zones.map(zone => {
                            const occ        = occByZone[zone.code] || {};
                            const isSelected = selectedCode === zone.code;
                            const isStructure = zone.type === 'structure';
                            const rect       = zoneRect(zone);
                            const colors     = isStructure
                                ? { bg: '#0A1220', border: '#1E293B', text: '#334155', bar: '#1E293B' }
                                : fillColor(occ.pct || 0);

                            return (
                                <div
                                    key={zone.code}
                                    onClick={() => !isStructure && setSelectedCode(
                                        isSelected ? null : zone.code
                                    )}
                                    style={{
                                        position: 'absolute',
                                        ...rect,
                                        background: colors.bg,
                                        border: isSelected
                                            ? '2px solid #60A5FA'
                                            : `2px solid ${colors.border}`,
                                        borderRadius: 7,
                                        cursor: isStructure ? 'default' : 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: isStructure ? 'center' : 'space-between',
                                        padding: isStructure ? '4px 6px' : '7px 9px',
                                        boxShadow: isSelected
                                            ? '0 0 0 3px rgba(96,165,250,0.25)'
                                            : 'none',
                                        transition: 'border-color 0.15s, box-shadow 0.15s',
                                        overflow: 'hidden',
                                        userSelect: 'none',
                                    }}
                                >
                                    {isStructure ? (
                                        <div style={{
                                            fontSize: 9,
                                            fontWeight: 700,
                                            color: colors.text,
                                            textAlign: 'center',
                                            textTransform: 'uppercase',
                                            letterSpacing: 0.5,
                                            lineHeight: 1.4,
                                        }}>
                                            {zone.label_carte}
                                        </div>
                                    ) : (
                                        <>
                                            {/* Code zone */}
                                            <div style={{
                                                fontSize: 12,
                                                fontWeight: 800,
                                                color: colors.text,
                                                lineHeight: 1,
                                            }}>
                                                {zone.code}
                                            </div>

                                            {/* % si rempli */}
                                            <div style={{
                                                fontSize: occ.pct > 0 ? 18 : 11,
                                                fontWeight: 800,
                                                color: occ.pct > 0 ? colors.text : '#1E3A5F',
                                                lineHeight: 1,
                                                opacity: occ.pct > 0 ? 1 : 0.6,
                                            }}>
                                                {occ.pct > 0 ? `${occ.pct}%` : zone.capacite
                                                    ? `${zone.capacite} ${zone.capacite_unite || ''}`
                                                    : '—'}
                                            </div>

                                            {/* Barre */}
                                            {zone.capacite && (
                                                <div style={{
                                                    height: 3,
                                                    background: 'rgba(255,255,255,0.07)',
                                                    borderRadius: 2,
                                                    overflow: 'hidden',
                                                }}>
                                                    <div style={{
                                                        width: `${occ.pct || 0}%`,
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

                        {/* Labels axes — Allées Nord */}
                        {['D','E','F','G','H'].map((l, i) => (
                            <div key={l} style={{
                                position: 'absolute',
                                left: i * (CELL_W + GAP),
                                top: -22,
                                width: CELL_W,
                                textAlign: 'center',
                                color: '#2563EB',
                                fontSize: 11,
                                fontWeight: 800,
                            }}>
                                {l}
                            </div>
                        ))}
                        {/* Labels axes — Allées Sud */}
                        {['C','B','A'].map((l, i) => (
                            <div key={l} style={{
                                position: 'absolute',
                                left: i * (CELL_W + GAP),
                                top: 7 * (CELL_H + GAP) - 22,
                                width: CELL_W,
                                textAlign: 'center',
                                color: '#7C3AED',
                                fontSize: 11,
                                fontWeight: 800,
                            }}>
                                {l}
                            </div>
                        ))}
                        {/* Labels niveaux Nord */}
                        {['4','3','2','1'].map((n, i) => (
                            <div key={`N${n}`} style={{
                                position: 'absolute',
                                left: -22,
                                top: i * (CELL_H + GAP) + CELL_H / 2 - 8,
                                color: '#1E3A5F',
                                fontSize: 10,
                                fontWeight: 700,
                                width: 20,
                                textAlign: 'right',
                            }}>
                                {n}
                            </div>
                        ))}
                        {/* Labels niveaux Sud */}
                        {['4','3','2','1'].map((n, i) => (
                            <div key={`S${n}`} style={{
                                position: 'absolute',
                                left: -22,
                                top: (6 + i) * (CELL_H + GAP) + CELL_H / 2 - 8,
                                color: '#3B0764',
                                fontSize: 10,
                                fontWeight: 700,
                                width: 20,
                                textAlign: 'right',
                            }}>
                                {n}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Pieds de page */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    marginTop: 14, paddingTop: 10,
                    borderTop: '1px solid #1E293B',
                }}>
                    <span style={{ color: '#1E3A5F', fontSize: 11, fontWeight: 600 }}>
                        ↑ Section Nord · Allées D – H · Rouleaux + Palettes
                    </span>
                    <span style={{ color: '#3B0764', fontSize: 11, fontWeight: 600 }}>
                        Section Sud · Allées A – C + Consommables K ↓
                    </span>
                </div>
            </div>

            {/* ══ PANNEAU LATÉRAL ══════════════════════════ */}
            <div style={{
                width: 272,
                flexShrink: 0,
                background: 'white',
                borderRadius: 16,
                border: '1px solid #E5E7EB',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 440,
            }}>
                {selectedZone && selectedOcc ? (
                    <>
                        {/* Header */}
                        <div style={{
                            background: selectedOcc.pct > 75 ? '#FEF2F2'
                                : selectedOcc.pct > 40 ? '#FFFBEB' : '#F0FDF4',
                            padding: '18px 18px 14px',
                            borderBottom: '1px solid #F3F4F6',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontSize: 30, fontWeight: 900, color: '#0F172A', letterSpacing: '-1px' }}>
                                        {selectedZone.code}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                                        {TYPE_LABELS[selectedZone.type] || selectedZone.type}
                                        {selectedZone.niveau_label && ` · ${selectedZone.niveau_label}`}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedCode(null)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4, borderRadius: 6 }}
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {selectedZone.capacite && (
                                <div style={{ marginTop: 14 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 700 }}>OCCUPATION</span>
                                        <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                                            {selectedOcc.pct} %
                                        </span>
                                    </div>
                                    <div style={{ height: 8, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${selectedOcc.pct || 0}%`,
                                            height: '100%',
                                            background: selectedOcc.pct > 75 ? '#EF4444'
                                                : selectedOcc.pct > 40 ? '#F59E0B' : '#10B981',
                                            borderRadius: 4,
                                            transition: 'width 0.5s',
                                        }} />
                                    </div>
                                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 5 }}>
                                        {selectedOcc.rouleaux} / {selectedZone.capacite} {selectedZone.capacite_unite}
                                        {selectedZone.type === 'palettes' && (
                                            <span> · {selectedOcc.cap} rouleaux éq.</span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Articles */}
                        <div style={{ padding: '12px 16px', flex: 1, overflowY: 'auto' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 10 }}>
                                {selectedOcc.items.length} référence{selectedOcc.items.length !== 1 ? 's' : ''}
                            </div>
                            {selectedOcc.items.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '32px 0', color: '#D1D5DB' }}>
                                    <Package size={30} style={{ marginBottom: 10, display: 'block', margin: '0 auto 8px' }} />
                                    <div style={{ fontSize: 13, color: '#9CA3AF' }}>Zone vide</div>
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
                                                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>Réf: {item.ref}</div>
                                            )}
                                            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                                                {item.project && (
                                                    <span style={{
                                                        background: '#EFF6FF', color: '#1E40AF',
                                                        padding: '2px 8px', borderRadius: 4,
                                                        fontSize: 11, fontWeight: 700,
                                                    }}>
                                                        {item.project}
                                                    </span>
                                                )}
                                                <span style={{
                                                    background: '#F3F4F6', color: '#374151',
                                                    padding: '2px 8px', borderRadius: 4,
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
                        <MapPin size={38} style={{ marginBottom: 14, opacity: 0.2 }} />
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>
                            Sélectionnez une zone
                        </div>
                        <div style={{ fontSize: 12, marginTop: 6, color: '#9CA3AF', lineHeight: 1.6 }}>
                            Cliquez sur une zone colorée pour voir son contenu et son taux d'occupation.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
