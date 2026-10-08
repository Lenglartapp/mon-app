import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Ruler } from 'lucide-react';

// Onglet « Besoins du projet » : total ML par tissu calculé depuis le BPF,
// dépliable pour voir quelles lignes génèrent ce besoin.

// Tableaux au style des listes (en-têtes gris 13/600, traits #E8E6E2)
const th = { padding: '10px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151', borderBottom: '1px solid #E0DED9', whiteSpace: 'nowrap' };
const td = { padding: '10px 12px', borderBottom: '1px solid #E8E6E2', verticalAlign: 'middle' };
const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 });

// Note sur la fiabilité des besoins, selon l'état des cotes des rideaux du dossier.
const BASIS_NOTE = {
    validated: { tone: '#EEF4FD', title: 'Toutes les cotes sont validées', text: 'Les besoins sont calculés avec les formules du BPF sur les cotes de pose validées : on peut s’y fier.' },
    complete: { tone: '#EEF4FD', title: 'Toutes les cotes sont prises', text: 'Les besoins sont calculés avec les formules du BPF sur les cotes de pose (pas encore toutes validées).' },
    partial: { tone: '#FDF6E7', title: 'Attention : cotes prises en partie', text: 'Mélange de cotes de pose et de cotes du plan (chiffrage) : les lignes sans cotes sont estimées sur le plan.' },
    plan: { tone: '#FDF6E7', title: 'Attention : aucune cote de pose prise', text: 'Les besoins sont estimés sur les cotes du plan, c’est-à-dire ce qui a été pris en compte au chiffrage.' },
};

export function NeedsBasisNote({ basis }) {
    const n = basis?.state && BASIS_NOTE[basis.state];
    if (!n) return null;
    const detail = basis.state === 'partial' ? ` (${basis.withCotes} rideau${basis.withCotes > 1 ? 'x' : ''} sur ${basis.total} avec cotes)` : '';
    return (
        <div style={{ background: n.tone, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#374151', fontFamily: 'Roboto, system-ui, sans-serif' }}>
            <b style={{ color: '#111827', fontWeight: 600 }}>{n.title}</b>{detail} — {n.text}
        </div>
    );
}

const BASIS_LABEL = { cotes: 'cotes de pose', plan: 'cotes du plan', saisie: 'métrage saisi' };

export default function ProjectNeedsTab({ needs, basis }) {
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
                <div style={{ marginTop: 8 }}>Aucun métrage de tissu calculé dans le BPF de ce dossier.</div>
            </div>
        );
    }

    const total = needs.reduce((s, n) => s + n.total, 0);
    return (
        <div>
            <NeedsBasisNote basis={basis} />
            <div style={{ display: 'flex', gap: 40, marginBottom: 20, flexWrap: 'wrap' }}>
                <Stat label="Tissus" value={needs.length} />
                <Stat label="Métrage total" value={`${fmt(total)} ml`} />
                <Stat label="Lignes BPF concernées" value={new Set(needs.flatMap((n) => n.sources.map((s) => s.rowId))).size} />
            </div>
            <div style={{ border: '1px solid #E0DED9', borderRadius: 8, overflow: 'hidden', background: 'white' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead style={{ background: '#F4F4F4' }}>
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
                                    <tr onClick={() => toggle(n.key)} style={{ cursor: 'pointer', background: isOpen ? '#F7F7F5' : 'white' }}>
                                        <td style={{ ...td, color: '#9B9A97' }}>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                                        <td style={td}>
                                            <span style={{ fontWeight: 500, color: '#111827' }}>{n.name}</span>
                                            {!n.inMaterials && (
                                                <span title="Nom saisi directement dans le BPF, absent de la matériothèque du dossier" style={{ marginLeft: 8, fontSize: 11, padding: '1px 6px', borderRadius: 999, background: '#FEF3C7', color: '#92400E', fontWeight: 600 }}>
                                                    hors matériothèque
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ ...td, textAlign: 'right', color: '#6B7280' }}>{n.sources.length}</td>
                                        <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{fmt(n.total)} ml</td>
                                    </tr>
                                    {isOpen && (
                                        <tr>
                                            <td />
                                            <td colSpan={3} style={{ padding: '4px 12px 12px', background: '#F7F7F5' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                                    <thead>
                                                        <tr>
                                                            <th style={th}>Généré par</th>
                                                            <th style={th}>Zone</th>
                                                            <th style={th}>Rôle</th>
                                                            <th style={th}>Calculé sur</th>
                                                            <th style={{ ...th, textAlign: 'right' }}>ML</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {n.sources.map((s, i) => (
                                                            <tr key={`${s.rowId}-${s.role}-${i}`}>
                                                                <td style={{ ...td, padding: '6px 12px' }}>{s.label}</td>
                                                                <td style={{ ...td, padding: '6px 12px', color: '#6B7280' }}>{s.zone || '—'}</td>
                                                                <td style={{ ...td, padding: '6px 12px', color: '#6B7280' }}>{s.role}</td>
                                                                <td style={{ ...td, padding: '6px 12px', color: s.basis === 'plan' ? '#92400E' : '#6B7280' }}>{BASIS_LABEL[s.basis] || '—'}</td>
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

// Chiffre clé (même rendu que le bandeau de la moulinette) : libellé gris, grand chiffre Roboto fin.
export function Stat({ label, value, color = '#111827' }) {
    return (
        <div style={{ minWidth: 110 }}>
            <div style={{ fontSize: 13, color: '#9B9A97', fontFamily: 'Roboto, system-ui, sans-serif' }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 300, color, fontFamily: 'Roboto, system-ui, sans-serif', lineHeight: 1.15, marginTop: 2 }}>{value}</div>
        </div>
    );
}
