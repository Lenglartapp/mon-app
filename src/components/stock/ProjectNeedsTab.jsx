import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Ruler } from 'lucide-react';

// Onglet « Besoins du projet » : total ML par tissu calculé depuis le BPF,
// dépliable pour voir quelles lignes génèrent ce besoin.

const th = { padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6B7280', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' };
const td = { padding: '10px 12px', borderBottom: '1px solid #F3F4F6', verticalAlign: 'middle' };
const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 });

export default function ProjectNeedsTab({ needs }) {
    const [open, setOpen] = useState(() => new Set());
    const toggle = (key) => setOpen((prev) => {
        const s = new Set(prev);
        if (s.has(key)) s.delete(key); else s.add(key);
        return s;
    });

    if (!needs.length) {
        return (
            <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}>
                <Ruler size={28} />
                <div style={{ marginTop: 8 }}>Aucun métrage de tissu dans le BPF de ce dossier.</div>
            </div>
        );
    }

    const total = needs.reduce((s, n) => s + n.total, 0);
    return (
        <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                <Stat label="Tissus" value={needs.length} />
                <Stat label="Métrage total" value={`${fmt(total)} ml`} />
                <Stat label="Lignes BPF concernées" value={new Set(needs.flatMap((n) => n.sources.map((s) => s.rowId))).size} />
            </div>
            <div style={{ border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', background: 'white' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead style={{ background: '#F9FAFB' }}>
                        <tr>
                            <th style={{ ...th, width: 32 }} />
                            <th style={th}>Tissu</th>
                            <th style={{ ...th, textAlign: 'right' }}>Lignes</th>
                            <th style={{ ...th, textAlign: 'right' }}>Besoin</th>
                        </tr>
                    </thead>
                    <tbody>
                        {needs.map((n) => {
                            const isOpen = open.has(n.key);
                            return (
                                <React.Fragment key={n.key}>
                                    <tr onClick={() => toggle(n.key)} style={{ cursor: 'pointer', background: isOpen ? '#F5F7FF' : 'white' }}>
                                        <td style={td}>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                                        <td style={td}>
                                            <span style={{ fontWeight: 600, color: '#111827' }}>{n.name}</span>
                                            {!n.inMaterials && (
                                                <span title="Nom saisi directement dans le BPF, absent de la matériothèque du dossier" style={{ marginLeft: 8, fontSize: 11, padding: '1px 6px', borderRadius: 999, background: '#FEF3C7', color: '#92400E', fontWeight: 600 }}>
                                                    hors matériothèque
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ ...td, textAlign: 'right', color: '#6B7280' }}>{n.sources.length}</td>
                                        <td style={{ ...td, textAlign: 'right', fontWeight: 800, fontSize: 15 }}>{fmt(n.total)} ml</td>
                                    </tr>
                                    {isOpen && (
                                        <tr>
                                            <td />
                                            <td colSpan={3} style={{ padding: '4px 12px 12px' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                                    <thead>
                                                        <tr>
                                                            <th style={th}>Généré par</th>
                                                            <th style={th}>Zone</th>
                                                            <th style={th}>Rôle</th>
                                                            <th style={{ ...th, textAlign: 'right' }}>ML</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {n.sources.map((s, i) => (
                                                            <tr key={`${s.rowId}-${s.role}-${i}`}>
                                                                <td style={{ ...td, padding: '6px 12px' }}>{s.label}</td>
                                                                <td style={{ ...td, padding: '6px 12px', color: '#6B7280' }}>{s.zone || '—'}</td>
                                                                <td style={{ ...td, padding: '6px 12px', color: '#6B7280' }}>{s.role}</td>
                                                                <td style={{ ...td, padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt(s.ml)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function Stat({ label, value, color = '#111827', bg = 'white' }) {
    return (
        <div style={{ padding: '10px 16px', border: '1px solid #E5E7EB', borderRadius: 12, background: bg, minWidth: 140 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 2 }}>{value}</div>
        </div>
    );
}
