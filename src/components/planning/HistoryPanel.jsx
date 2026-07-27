import React, { useMemo, useState } from 'react';
import { X, Search, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { format, parseISO, getISOWeek, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PLANNING_COLORS } from './constants';

// Les 3 services affichés dans l'historique (les absences ne sont pas liées à un projet).
const SERVICES = [
    { key: 'prepa', label: 'Préparation' },
    { key: 'conf', label: 'Confection' },
    { key: 'pose', label: 'Pose' },
];

// Heures d'un créneau : durée explicite, sinon calcul depuis start/end.
const eventHours = (e) => {
    if (typeof e.meta?.durationHours === 'number') return e.meta.durationHours;
    if (typeof e.hours === 'number') return e.hours;
    if (e.meta?.start && e.meta?.end) {
        const m = differenceInMinutes(new Date(e.meta.end), new Date(e.meta.start));
        if (m > 0) return Math.round(m / 6) / 10; // précision 0,1 h
    }
    return null;
};

export default function HistoryPanel({ isOpen, onClose, projects = [], events = [], users = [], onJump }) {
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(null); // projet choisi
    const [collapsed, setCollapsed] = useState({}); // sections repliées

    const userMap = useMemo(() => {
        const m = new Map();
        (users || []).forEach(u => m.set(u.id, u));
        return m;
    }, [users]);

    const userName = (id) => {
        if (id === 'backlog_confection') return 'Programme semaine';
        const u = userMap.get(id);
        const name = u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : '';
        return name || '—';
    };

    // Suggestions de projets (inclut les archivés — c'est le but des archives).
    const suggestions = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return (projects || [])
            .filter(p => (p.name || '').toLowerCase().includes(q))
            .slice(0, 12);
    }, [query, projects]);

    // Créneaux du projet sélectionné, regroupés par service (tout l'historique).
    const grouped = useMemo(() => {
        const out = { prepa: [], conf: [], pose: [] };
        if (!selected) return out;
        const matched = (events || []).filter(e => {
            if (e.type === 'absence') return false;
            if (!out[e.type]) return false; // uniquement prepa/conf/pose
            if (e.meta?.projectId) return e.meta.projectId === selected.id;
            // Créneaux hérités sans projectId : repli sur le titre
            return (e.title || '').toLowerCase().includes((selected.name || '').toLowerCase());
        });
        // Plus récent en premier
        matched.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        matched.forEach(e => out[e.type].push(e));
        return out;
    }, [selected, events]);

    const totalCount = grouped.prepa.length + grouped.conf.length + grouped.pose.length;

    // Somme d'heures d'une liste de créneaux (les heures inconnues comptent 0).
    const sumHours = (list) => Math.round(list.reduce((s, e) => s + (eventHours(e) || 0), 0) * 10) / 10;
    const totalHours = sumHours([...grouped.prepa, ...grouped.conf, ...grouped.pose]);

    if (!isOpen) return null;

    const pick = (p) => { setSelected(p); setQuery(''); };
    const reset = () => { setSelected(null); setQuery(''); };

    return (
        <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, maxWidth: '92vw',
            background: 'white', borderLeft: '1px solid #E5E7EB',
            boxShadow: '-8px 0 24px rgba(0,0,0,0.08)', zIndex: 1200,
            display: 'flex', flexDirection: 'column',
        }}>
            {/* En-tête */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={18} color="#111827" />
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Historique</span>
                </div>
                <button onClick={onClose} title="Fermer" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6B7280', display: 'flex' }}>
                    <X size={20} />
                </button>
            </div>

            {/* Recherche projet */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #F3F4F6' }}>
                {!selected ? (
                    <div style={{ position: 'relative' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                            <input
                                autoFocus
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Rechercher un dossier…"
                                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px 9px 32px', fontSize: 14, border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none' }}
                            />
                        </div>
                        {suggestions.length > 0 && (
                            <div style={{ marginTop: 6, border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden', maxHeight: 260, overflowY: 'auto' }}>
                                {suggestions.map(p => (
                                    <div
                                        key={p.id}
                                        onClick={() => pick(p)}
                                        style={{ padding: '9px 12px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottom: '1px solid #F9FAFB' }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                    >
                                        <span style={{ color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                                        {p.status === 'ARCHIVED' && (
                                            <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: '#6B7280', background: '#F3F4F6', borderRadius: 4, padding: '2px 6px' }}>Archivé</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        {query.trim() && suggestions.length === 0 && (
                            <div style={{ marginTop: 8, fontSize: 12, color: '#9CA3AF' }}>Aucun dossier trouvé.</div>
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.name}</div>
                            <div style={{ fontSize: 12, color: '#6B7280' }}>{totalCount} créneau{totalCount > 1 ? 'x' : ''} · {totalHours}h au total</div>
                        </div>
                        <button onClick={reset} style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: '#2563EB', background: 'transparent', border: 'none', cursor: 'pointer' }}>Changer</button>
                    </div>
                )}
            </div>

            {/* Liste des créneaux */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 24px' }}>
                {!selected && (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                        Tapez le nom d'un dossier pour voir tous ses créneaux passés, puis double-cliquez sur l'un d'eux pour revenir à sa semaine.
                    </div>
                )}

                {selected && totalCount === 0 && (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                        Aucun créneau planning pour ce dossier.
                    </div>
                )}

                {selected && totalCount > 0 && SERVICES.map(svc => {
                    const list = grouped[svc.key];
                    if (list.length === 0) return null;
                    const col = PLANNING_COLORS[svc.key] || PLANNING_COLORS.default;
                    const isCollapsed = collapsed[svc.key];
                    return (
                        <div key={svc.key} style={{ marginBottom: 12 }}>
                            <div
                                onClick={() => setCollapsed(prev => ({ ...prev, [svc.key]: !prev[svc.key] }))}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 6px', cursor: 'pointer', userSelect: 'none' }}
                            >
                                {isCollapsed ? <ChevronRight size={15} color="#6B7280" /> : <ChevronDown size={15} color="#6B7280" />}
                                <span style={{ width: 10, height: 10, borderRadius: 3, background: col.bg, border: `1.5px solid ${col.border}` }} />
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{svc.label}</span>
                                <span style={{ fontSize: 12, color: '#9CA3AF' }}>· {list.length}</span>
                                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: col.text, background: col.bg, border: `1px solid ${col.border}`, borderRadius: 6, padding: '2px 8px' }}>{sumHours(list)}h</span>
                            </div>

                            {!isCollapsed && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
                                    {list.map(evt => {
                                        const d = parseISO(evt.date);
                                        const h = eventHours(evt);
                                        return (
                                            <div
                                                key={evt.id}
                                                onDoubleClick={() => onJump && onJump(evt, selected.id)}
                                                title="Double-cliquez pour aller à cette semaine"
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                    padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                                                    background: '#FAFAFA', border: '1px solid #F3F4F6',
                                                    borderLeft: `3px solid ${col.border}`,
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
                                                onMouseLeave={e => e.currentTarget.style.background = '#FAFAFA'}
                                            >
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                                                        {format(d, 'EEE d MMM yyyy', { locale: fr })}
                                                        <span style={{ fontSize: 11, fontWeight: 500, color: '#9CA3AF', marginLeft: 6 }}>sem. {getISOWeek(d)}</span>
                                                    </div>
                                                    <div style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {userName(evt.resourceId)}
                                                    </div>
                                                </div>
                                                {h != null && (
                                                    <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: col.text, background: col.bg, borderRadius: 6, padding: '2px 8px' }}>
                                                        {h}h
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
