import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Scale } from 'lucide-react';
import { buildComparison, IGNORE_MATCH, JUSTE_MARGIN } from '../../lib/stock/projectStock';
import { Stat } from './ProjectNeedsTab';

// Onglet « Comparatif » : besoin BPF / commandé (liste de courses Odoo) / reçu, par tissu.
// Le rattachement d'une ligne de courses à un tissu est automatique (ressemblance des noms)
// et corrigeable à la main (mémorisé sur la ligne : `besoin_match`).

const STATUS = {
    ok: { label: 'OK', icon: '✅', bg: '#ECFDF5', color: '#047857' },
    juste: { label: 'Juste', icon: '🟠', bg: '#FFF7ED', color: '#C2410C' },
    short: { label: 'Court', icon: '🔴', bg: '#FEF2F2', color: '#B91C1C' },
    missing: { label: 'Pas commandé', icon: '⚪', bg: '#F3F4F6', color: '#374151' },
};
const STATUT_ODOO = {
    a_commander: 'À commander', verifier_stock: 'Vérifier stock', en_stock: 'En stock', achete_client: 'Acheté client',
    commande_passee: 'Commandée', receptionne: 'Réceptionné', probleme: 'Problème',
};

const th = { padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6B7280', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' };
const td = { padding: '10px 12px', borderBottom: '1px solid #F3F4F6', verticalAlign: 'middle' };
const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const lineTitle = (l) => [l.fournisseur, l.reference, l.coloris].filter(Boolean).join(' · ');

function Badge({ status }) {
    const s = STATUS[status];
    if (!s) return null;
    return <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, background: s.bg, color: s.color, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{s.icon} {s.label}</span>;
}

/** Sélecteur de rattachement d'une ligne de courses (auto / tissu / ne pas compter). */
function MatchSelect({ line, needs, onSetMatch, saving }) {
    const value = line.besoin_match || '';
    return (
        <select
            value={value}
            disabled={saving}
            onChange={(e) => onSetMatch(line, e.target.value || null)}
            style={{ fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid #D1D5DB', maxWidth: 260, background: 'white' }}
        >
            <option value="">Automatique</option>
            {needs.map((n) => <option key={n.key} value={n.key}>→ {n.name}</option>)}
            <option value={IGNORE_MATCH}>Ne pas compter</option>
        </select>
    );
}

function CourseLinesTable({ lines, matches, needs, onSetMatch, savingId }) {
    return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
                <tr>
                    <th style={th}>Ligne de courses (Odoo)</th>
                    <th style={th}>Statut</th>
                    <th style={{ ...th, textAlign: 'right' }}>Qté</th>
                    <th style={th}>Rattachement</th>
                </tr>
            </thead>
            <tbody>
                {lines.map((l) => {
                    const m = matches.get(l.odoo_id);
                    return (
                        <tr key={l.odoo_id}>
                            <td style={{ ...td, padding: '6px 12px' }}>
                                {lineTitle(l)}
                                {m?.mode === 'auto' && <span style={{ marginLeft: 6, fontSize: 11, color: '#9CA3AF' }}>(auto · {Math.round(m.score * 100)} %)</span>}
                            </td>
                            <td style={{ ...td, padding: '6px 12px', color: l.statut === 'probleme' ? '#B91C1C' : '#6B7280' }}>
                                {STATUT_ODOO[l.statut] || l.statut || '—'}{l.statut === 'probleme' ? ' (non compté)' : ''}
                            </td>
                            <td style={{ ...td, padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt(l.quantite)} {l.unite || ''}</td>
                            <td style={{ ...td, padding: '6px 12px' }}>
                                <MatchSelect line={l} needs={needs} onSetMatch={onSetMatch} saving={savingId === l.odoo_id} />
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

export default function ProjectComparisonTab({ needs, courseLines, loading, error, onSetMatch, savingId }) {
    const [open, setOpen] = useState(() => new Set());
    const toggle = (key) => setOpen((prev) => {
        const s = new Set(prev);
        if (s.has(key)) s.delete(key); else s.add(key);
        return s;
    });

    const { rows, unmatched, matches } = useMemo(() => buildComparison(needs, courseLines), [needs, courseLines]);
    const ignored = unmatched.filter((l) => matches.get(l.odoo_id)?.mode === 'ignored');
    const orphans = unmatched.filter((l) => matches.get(l.odoo_id)?.mode !== 'ignored');
    const count = (st) => rows.filter((r) => r.status === st).length;

    if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF' }}>Chargement…</div>;
    if (!needs.length && !courseLines.length) {
        return (
            <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}>
                <Scale size={28} />
                <div style={{ marginTop: 8 }}>Ni besoin dans le BPF, ni liste de courses : rien à comparer.</div>
            </div>
        );
    }

    return (
        <div>
            {error && <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: '#FEF2F2', color: '#B91C1C', fontSize: 13 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                <Stat label="✅ OK" value={count('ok')} color="#047857" />
                <Stat label="🟠 Juste" value={count('juste')} color="#C2410C" />
                <Stat label="🔴 Court" value={count('short')} color="#B91C1C" bg={count('short') ? '#FEF2F2' : 'white'} />
                <Stat label="⚪ Pas commandé" value={count('missing')} color="#374151" />
                <Stat label="🔵 Commandé sans besoin" value={orphans.length} color="#1D4ED8" />
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
                Commandé = toutes les lignes de courses sauf « Problème ». Juste = écart dans ±{Math.round(JUSTE_MARGIN * 100)} % du besoin.
            </div>

            <div style={{ border: '1px solid #E0DED9', borderRadius: 12, overflow: 'hidden', background: 'white' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead style={{ background: '#F4F4F4' }}>
                        <tr>
                            <th style={{ ...th, width: 32 }} />
                            <th style={th}>Tissu</th>
                            <th style={{ ...th, textAlign: 'right' }}>Besoin BPF</th>
                            <th style={{ ...th, textAlign: 'right' }}>Commandé</th>
                            <th style={{ ...th, textAlign: 'right' }}>Reçu</th>
                            <th style={{ ...th, textAlign: 'right' }}>Écart</th>
                            <th style={th}>Statut</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => {
                            const isOpen = open.has(r.need.key);
                            return (
                                <React.Fragment key={r.need.key}>
                                    <tr onClick={() => toggle(r.need.key)} style={{ cursor: 'pointer', background: isOpen ? '#F5F7FF' : 'white' }}>
                                        <td style={td}>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                                        <td style={td}>
                                            <span style={{ fontWeight: 600 }}>{r.need.name}</span>
                                            <span style={{ marginLeft: 8, fontSize: 12, color: '#9CA3AF' }}>{r.linked.length} ligne(s) de courses</span>
                                        </td>
                                        <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmt(r.need.total)} ml</td>
                                        <td style={{ ...td, textAlign: 'right' }}>
                                            <div style={{ fontWeight: 700 }}>{fmt(r.ordered)} ml</div>
                                            {r.toOrder > 0 && <div style={{ fontSize: 11, color: '#B45309' }}>dont {fmt(r.toOrder)} à commander</div>}
                                        </td>
                                        <td style={{ ...td, textAlign: 'right', color: '#047857', fontWeight: 600 }}>{fmt(r.received)} ml</td>
                                        <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: r.diff < 0 ? '#B91C1C' : '#374151' }}>
                                            {r.diff > 0 ? '+' : ''}{fmt(r.diff)} ml
                                        </td>
                                        <td style={td}><Badge status={r.status} /></td>
                                    </tr>
                                    {isOpen && (
                                        <tr>
                                            <td />
                                            <td colSpan={6} style={{ padding: '4px 12px 12px' }}>
                                                {r.linked.length
                                                    ? <CourseLinesTable lines={r.linked} matches={matches} needs={needs} onSetMatch={onSetMatch} savingId={savingId} />
                                                    : <div style={{ fontSize: 13, color: '#6B7280', padding: '6px 0' }}>Aucune ligne de courses rattachée. Si elle existe sous un autre nom, rattache-la depuis « Commandé sans besoin » ci-dessous.</div>}
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {orphans.length > 0 && (
                <div style={{ marginTop: 20 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6, color: '#1D4ED8' }}>🔵 Commandé sans besoin ({orphans.length})</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>
                        Lignes de courses (tissu) qui ne correspondent à aucun tissu du BPF. Souvent un nom saisi différemment : rattache-les au bon tissu.
                    </div>
                    <div style={{ border: '1px solid #DBEAFE', borderRadius: 12, overflow: 'hidden', background: 'white' }}>
                        <CourseLinesTable lines={orphans} matches={matches} needs={needs} onSetMatch={onSetMatch} savingId={savingId} />
                    </div>
                </div>
            )}

            {ignored.length > 0 && (
                <div style={{ marginTop: 20 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6, color: '#6B7280' }}>Lignes non comptées ({ignored.length})</div>
                    <div style={{ border: '1px solid #E0DED9', borderRadius: 12, overflow: 'hidden', background: 'white' }}>
                        <CourseLinesTable lines={ignored} matches={matches} needs={needs} onSetMatch={onSetMatch} savingId={savingId} />
                    </div>
                </div>
            )}
        </div>
    );
}
