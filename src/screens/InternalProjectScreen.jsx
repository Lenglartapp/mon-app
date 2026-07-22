// src/screens/InternalProjectScreen.jsx
//
// Écran dédié au dossier « Interne Lenglart ». Volontairement minimal : ce dossier n'a
// ni ouvrages, ni BPF, ni prise de cotes, ni heures vendues — l'écran de production
// habituel n'afficherait que des onglets vides, ce qui laisse croire qu'il manque
// quelque chose. Ici on ne montre que ce qui existe vraiment :
//   1. les heures collectées, ventilées par chapitre et filtrables par période ;
//   2. le statut de chaque chapitre (en cours / terminé) ;
//   3. le transfert des heures d'un chapitre vers un vrai dossier (ordo & admin).
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ArrowLeft, Search, X, Check, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '../auth';
import { can } from '../lib/authz';
import {
    computeChapterStats, eventsOfChapter, setChapterStatus, configWithTransfer,
    isInternalProject, totalsOfEvents,
} from '../lib/planning/internalProject';

const fmtH = (n) => `${Math.round((n || 0) * 10) / 10}`.replace('.', ',');

const S = {
    page: { padding: '24px 32px', maxWidth: 1100, margin: '0 auto' },
    card: { background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' },
    th: { textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4, padding: '10px 16px', borderBottom: '1px solid #E5E7EB' },
    td: { padding: '12px 16px', fontSize: 14, color: '#111827', borderBottom: '1px solid #F3F4F6' },
    btn: { padding: '7px 14px', borderRadius: 8, border: '1px solid #D1D5DB', background: 'white', fontSize: 13, cursor: 'pointer', fontWeight: 500, color: '#374151' },
    input: { padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit' },
    select: { border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 10px', fontSize: 13, outline: 'none', background: 'white', color: '#374151', fontFamily: 'inherit', cursor: 'pointer' },
    filterLabel: { fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4, display: 'block' },
    statLabel: { fontSize: 12, color: '#6B7280', fontWeight: 600 },
    subTh: { textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4, padding: '4px 8px' },
    subTd: { padding: '4px 8px', fontSize: 13, color: '#4B5563' },
};

// Ventilation prépa / conf / pose sous un total — répond à « ces heures, c'est quoi ? »
function ServiceBreakdown({ value }) {
    if (!value || !value.total) return null;
    const parts = SERVICES.filter(sv => value[sv.key] > 0);
    if (parts.length === 0) return null;
    return (
        <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            {parts.map(sv => (
                <span key={sv.key} style={{ fontSize: 12, color: '#6B7280' }}>
                    {sv.label} <b style={{ color: '#374151' }}>{fmtH(value[sv.key])}h</b>
                </span>
            ))}
        </div>
    );
}

// Sélecteur de période — repris du module Performance pour garder la même DA.
function PeriodeDropdown({ preset, custom, onPreset, onCustom }) {
    const [open, setOpen] = useState(false);
    const [tempFrom, setTempFrom] = useState(custom.from || '');
    const [tempTo, setTempTo] = useState(custom.to || '');
    const ref = useRef();

    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const currentLabel = PERIODE_PRESETS.find(p => p.key === preset)?.label
        || (preset === 'custom' ? 'Période perso.' : 'Tout');

    const applyCustom = () => {
        if (tempFrom && tempTo) { onCustom({ from: tempFrom, to: tempTo }); onPreset('custom'); setOpen(false); }
    };

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button onClick={() => setOpen(v => !v)} style={{
                background: 'white', border: '1px solid #E5E7EB', borderRadius: 8,
                padding: '6px 12px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8, color: '#374151',
                boxShadow: open ? '0 0 0 2px #E0E7FF' : 'none',
            }}>
                {currentLabel} <ChevronDown size={14} color="#9CA3AF" />
            </button>
            {open && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 90, background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', width: 220, padding: 4 }}>
                    <div style={{ paddingBottom: 4, borderBottom: '1px solid #F3F4F6' }}>
                        {PERIODE_PRESETS.map(o => (
                            <div key={o.key} onClick={() => { onPreset(o.key); setOpen(false); }} style={{
                                padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 4,
                                background: preset === o.key ? '#EFF6FF' : 'transparent',
                                color: preset === o.key ? '#2563EB' : '#374151',
                                fontWeight: preset === o.key ? 600 : 400,
                            }}>{o.label}</div>
                        ))}
                    </div>
                    <div style={{ padding: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Période personnalisée</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                            <input type="date" value={tempFrom} onChange={e => setTempFrom(e.target.value)}
                                style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #E5E7EB', borderRadius: 6, padding: '5px 8px', fontSize: 12, outline: 'none' }} />
                            <input type="date" value={tempTo} onChange={e => setTempTo(e.target.value)}
                                style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #E5E7EB', borderRadius: 6, padding: '5px 8px', fontSize: 12, outline: 'none' }} />
                        </div>
                        <button onClick={applyCustom} style={{ width: '100%', background: '#1E2447', color: 'white', border: 'none', borderRadius: 6, padding: '6px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Appliquer</button>
                    </div>
                </div>
            )}
        </div>
    );
}

const SERVICES = [
    { key: 'prepa', label: 'Préparation' },
    { key: 'conf', label: 'Confection' },
    { key: 'pose', label: 'Pose' },
];

// Périodes — mêmes présélections et même dropdown que le module Performance.
// ATTENTION : un planning regarde DEVANT. Borner la période à aujourd'hui masquerait
// les créneaux déjà posés sur les jours à venir (c'est ce qui faisait afficher 0 h sur
// « cette année » alors que « depuis toujours » comptait bien 7,8 h).
const PERIODE_PRESETS = [
    { key: 'month', label: 'Ce mois' },
    { key: '6', label: '6 mois' },
    { key: 'year', label: 'Cette année' },
    { key: 'all', label: 'Tout' },
];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const rangeOfPreset = (preset, custom) => {
    const now = new Date();
    if (preset === 'month') {
        return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    }
    if (preset === '6') {
        // 6 mois glissants, fin de mois courant incluse (créneaux à venir compris).
        return { from: iso(new Date(now.getFullYear(), now.getMonth() - 5, 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    }
    if (preset === 'year') return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
    if (preset === 'custom') return { from: custom.from || null, to: custom.to || null };
    return { from: null, to: null };
};

export default function InternalProjectScreen({ project, projects = [], events = [], onUpdateProject, onUpdateEvent, onBack, currentUser: propUser }) {
    // Même convention que LineDetailPanel : la prop l'emporte, sinon le contexte.
    const { currentUser: ctxUser } = useAuth();
    const currentUser = propUser || ctxUser;
    const canTransfer = can(currentUser, 'planning.transfer_internal');

    const [preset, setPreset] = useState('all');
    const [custom, setCustom] = useState({ from: '', to: '' });
    const [service, setService] = useState('');
    const [expanded, setExpanded] = useState({});
    const [transferChapter, setTransferChapter] = useState(null);

    const range = useMemo(() => rangeOfPreset(preset, custom), [preset, custom]);

    const { chapters, totals } = useMemo(
        () => computeChapterStats(project, events, { ...range, service }),
        [project, events, range, service]
    );

    const setStatus = (row, next) => {
        onUpdateProject?.(project.id, { config: setChapterStatus(project, row.name, next) });
    };

    // Le transfert ne déplace pas les créneaux : ils restent sur la même personne, le même
    // jour, avec les mêmes heures. Seul le dossier rattaché change — ce temps rejoint le
    // dossier auquel il appartenait depuis le début.
    const doTransfer = (target) => {
        const moved = eventsOfChapter(project, events, transferChapter.name);
        const movedTotals = totalsOfEvents(moved);
        moved.forEach(evt => {
            onUpdateEvent?.({
                ...evt,
                title: target.name,
                meta: {
                    ...evt.meta,
                    projectId: target.id,
                    internalChapter: null,
                    // Trace : sans elle, un total interne passé qui change deviendrait
                    // inexplicable pour la personne qui l'avait relevé.
                    transferredFrom: { chapter: transferChapter.name, at: new Date().toISOString() },
                },
            });
        });
        onUpdateProject?.(project.id, { config: configWithTransfer(project, transferChapter.name, target, movedTotals) });
        setTransferChapter(null);
    };

    if (!project || !isInternalProject(project)) return null;

    return (
        <div style={S.page}>
            <button onClick={onBack} style={{ ...S.btn, border: 'none', background: 'transparent', padding: 0, marginBottom: 16, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ArrowLeft size={16} /> Retour
            </button>

            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#111827', margin: 0 }}>{project.name}</h1>
            <p style={{ color: '#6B7280', fontSize: 14, marginTop: 6, marginBottom: 24, maxWidth: 720 }}>
                Recueil du temps passé hors dossier client — prototypes, études, ouvrages caritatifs,
                cotes anticipées. Pas d'heures vendues : ce dossier ne se compare à aucun budget.
            </p>

            {/* FILTRES — même présentation que le module Performance */}
            <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end' }}>
                <div>
                    <label style={S.filterLabel}>Période</label>
                    <PeriodeDropdown preset={preset} custom={custom} onPreset={setPreset} onCustom={setCustom} />
                </div>
                <div>
                    <label style={S.filterLabel}>Service</label>
                    <select style={S.select} value={service} onChange={e => setService(e.target.value)}>
                        <option value="">Tous</option>
                        {SERVICES.map(sv => <option key={sv.key} value={sv.key}>{sv.label}</option>)}
                    </select>
                </div>
            </div>

            {/* TOTAUX — avec la ventilation par service, sinon « 7,8h » ne dit pas d'où
                elles viennent (atelier ? préparation ? pose ?) */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ ...S.card, padding: 16, flex: '1 1 260px' }}>
                    <div style={S.statLabel}>Heures réalisées</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#111827' }}>{fmtH(totals.done.total)}h</div>
                    <ServiceBreakdown value={totals.done} />
                </div>
                <div style={{ ...S.card, padding: 16, flex: '1 1 260px' }}>
                    <div style={S.statLabel}>Encore programmées</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#EA580C' }}>{fmtH(totals.planned.total)}h</div>
                    <ServiceBreakdown value={totals.planned} />
                </div>
                <div style={{ ...S.card, padding: 16, flex: '0 0 160px' }}>
                    <div style={S.statLabel}>Chapitres</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#111827' }}>{chapters.length}</div>
                </div>
            </div>

            {/* CHAPITRES — une ligne par chapitre, dépliable sur la ventilation par service */}
            <div style={{ ...S.card, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                            <th style={{ ...S.th, width: 36 }} />
                            <th style={S.th}>Chapitre</th>
                            <th style={S.th}>Statut</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>Réalisé</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>Programmé</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>Créneaux</th>
                            <th style={S.th} />
                        </tr>
                    </thead>
                    <tbody>
                        {chapters.length === 0 && (
                            <tr><td style={{ ...S.td, color: '#9CA3AF', textAlign: 'center', padding: 32 }} colSpan={7}>
                                Aucune heure interne sur cette période.
                            </td></tr>
                        )}
                        {chapters.map(row => {
                            const isDone = row.status === 'done';
                            const isOpen = !!expanded[row.name];
                            return (
                                <React.Fragment key={row.name}>
                                    <tr
                                        onClick={() => setExpanded(e => ({ ...e, [row.name]: !isOpen }))}
                                        style={{ cursor: 'pointer', background: isOpen ? '#F9FAFB' : 'white' }}
                                    >
                                        <td style={{ ...S.td, paddingRight: 0, color: '#9CA3AF' }}>
                                            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                        </td>
                                        <td style={{ ...S.td, fontWeight: 600 }}>{row.name}</td>
                                        <td style={S.td} onClick={e => e.stopPropagation()}>
                                            <select
                                                value={row.status}
                                                onChange={e => setStatus(row, e.target.value)}
                                                title="Un chapitre terminé n'est plus proposé à la saisie"
                                                style={{
                                                    ...S.select, padding: '4px 8px', fontSize: 12, fontWeight: 600,
                                                    background: isDone ? '#F3F4F6' : '#ECFDF5',
                                                    color: isDone ? '#6B7280' : '#065F46',
                                                    borderColor: isDone ? '#E5E7EB' : '#A7F3D0',
                                                }}
                                            >
                                                <option value="active">En cours</option>
                                                <option value="done">Terminé</option>
                                            </select>
                                        </td>
                                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{fmtH(row.done.total)}h</td>
                                        <td style={{ ...S.td, textAlign: 'right', color: '#EA580C' }}>{fmtH(row.planned.total)}h</td>
                                        <td style={{ ...S.td, textAlign: 'right', color: '#6B7280' }}>{row.count}</td>
                                        <td style={{ ...S.td, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                            {canTransfer && row.count > 0 && (
                                                <button onClick={() => setTransferChapter({ ...row, moved: totalsOfEvents(eventsOfChapter(project, events, row.name)) })} style={{ ...S.btn, fontSize: 12 }}>
                                                    Transférer…
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                    {isOpen && (
                                        <tr>
                                            <td colSpan={7} style={{ background: '#F9FAFB', borderBottom: '1px solid #F3F4F6', padding: '4px 16px 14px 52px' }}>
                                                <table style={{ width: '100%', maxWidth: 520, borderCollapse: 'collapse' }}>
                                                    <thead>
                                                        <tr>
                                                            <th style={S.subTh}>Service</th>
                                                            <th style={{ ...S.subTh, textAlign: 'right' }}>Réalisé</th>
                                                            <th style={{ ...S.subTh, textAlign: 'right' }}>Programmé</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {SERVICES.map(sv => (
                                                            <tr key={sv.key}>
                                                                <td style={S.subTd}>{sv.label}</td>
                                                                <td style={{ ...S.subTd, textAlign: 'right', fontWeight: 600 }}>{fmtH(row.done[sv.key])}h</td>
                                                                <td style={{ ...S.subTd, textAlign: 'right', color: '#EA580C' }}>{fmtH(row.planned[sv.key])}h</td>
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

            <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 12 }}>
                Seuls les chapitres ayant des heures sur la période et le service filtrés sont listés.
                Un chapitre terminé n'est plus proposé à la saisie, mais ses heures restent comptées ici.
            </p>

            {transferChapter && (
                <TransferDialog
                    chapter={transferChapter}
                    projects={projects}
                    onCancel={() => setTransferChapter(null)}
                    onConfirm={doTransfer}
                />
            )}
        </div>
    );
}

function TransferDialog({ chapter, projects, onCancel, onConfirm }) {
    const [search, setSearch] = useState('');
    const [target, setTarget] = useState(null);

    const results = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return [];
        return (projects || [])
            .filter(p => !isInternalProject(p) && (p.name || '').toLowerCase().includes(q))
            .slice(0, 8);
    }, [projects, search]);

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ ...S.card, width: 520, padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Transférer les heures</h3>
                    <button onClick={onCancel} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6B7280' }}><X size={18} /></button>
                </div>

                <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: 12, fontSize: 13, color: '#374151', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: '#111827' }}>
                        <Clock size={14} /> {chapter.name}
                    </div>
                    <div style={{ marginTop: 6 }}>
                        {chapter.moved.count} créneau(x) — {fmtH(chapter.moved.done)}h réalisées, {fmtH(chapter.moved.planned)}h programmées
                    </div>
                    <div style={{ marginTop: 8, color: '#6B7280' }}>
                        Les créneaux ne bougent pas : même personne, même date, mêmes heures.
                        Seul le dossier rattaché change. Le total interne des périodes passées
                        diminuera d'autant.
                    </div>
                </div>

                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Dossier de destination</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #D1D5DB', borderRadius: 8, padding: '8px 10px' }}>
                    <Search size={16} color="#9CA3AF" />
                    <input
                        autoFocus
                        value={target ? target.name : search}
                        onChange={e => { setSearch(e.target.value); setTarget(null); }}
                        placeholder="Rechercher un dossier..."
                        style={{ border: 'none', outline: 'none', width: '100%', fontSize: 14, fontFamily: 'inherit' }}
                    />
                    {target && <Check size={16} color="#10B981" />}
                </div>
                {!target && results.length > 0 && (
                    <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, marginTop: 4, maxHeight: 180, overflowY: 'auto' }}>
                        {results.map(p => (
                            <div key={p.id} onClick={() => { setTarget(p); setSearch(p.name); }}
                                style={{ padding: '9px 12px', fontSize: 14, cursor: 'pointer', borderBottom: '1px solid #F9FAFB' }}>
                                {p.name}
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                    <button onClick={onCancel} style={S.btn}>Annuler</button>
                    <button
                        onClick={() => target && onConfirm(target)}
                        disabled={!target}
                        style={{ ...S.btn, background: '#111827', color: 'white', borderColor: '#111827', opacity: target ? 1 : 0.45, cursor: target ? 'pointer' : 'not-allowed' }}
                    >
                        Transférer
                    </button>
                </div>
            </div>
        </div>
    );
}
