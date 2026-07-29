import React, { useMemo, useState } from 'react';
import { format, parseISO, startOfWeek, addDays, getISOWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { X, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { PLANNING_COLORS } from './constants';

const SERVICES = [
    { key: 'prepa', label: 'Préparation' },
    { key: 'conf', label: 'Confection' },
    { key: 'pose', label: 'Pose' },
];

const WEEKS_BACK = 16;
const WEEKS_FORWARD = 12;

const memberName = (u) => u ? (`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || '—') : '—';

const eventHours = (e) => {
    if (typeof e.meta?.durationHours === 'number') return e.meta.durationHours;
    if (e.meta?.start && e.meta?.end) {
        const m = (new Date(e.meta.end) - new Date(e.meta.start)) / 60000;
        if (m > 0) return Math.round(m / 6) / 10;
    }
    return 0;
};

export default function BulkValidateModal({ isOpen, onClose, membersByService = {}, events = [], defaultWeekStart, onConfirm }) {
    const baseMonday = defaultWeekStart || startOfWeek(new Date(), { weekStartsOn: 1 });

    const [services, setServices] = useState(new Set());       // services cochés (= tout le service)
    const [excluded, setExcluded] = useState(new Set());       // personnes décochées
    const [expanded, setExpanded] = useState(new Set());       // services dont la liste est dépliée
    const [weekStart, setWeekStart] = useState(baseMonday);    // lundi de la semaine choisie
    const [mode, setMode] = useState('week');                  // 'week' | 'range'
    const [rangeStart, setRangeStart] = useState(format(baseMonday, 'yyyy-MM-dd'));
    const [rangeEnd, setRangeEnd] = useState(format(addDays(baseMonday, 6), 'yyyy-MM-dd'));
    const [showDetail, setShowDetail] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [doneCount, setDoneCount] = useState(null);          // succès : nb de créneaux validés

    const weekEnd = addDays(weekStart, 6);
    const weekStartISO = format(weekStart, 'yyyy-MM-dd');
    const weekEndISO = format(weekEnd, 'yyyy-MM-dd');
    // Plage effective : soit la semaine choisie, soit la plage de dates libre.
    const startISO = mode === 'week' ? weekStartISO : rangeStart;
    const endISO = mode === 'week' ? weekEndISO : rangeEnd;

    const weekOptions = useMemo(() => {
        const opts = [];
        for (let i = -WEEKS_BACK; i <= WEEKS_FORWARD; i++) {
            const mon = addDays(baseMonday, i * 7);
            opts.push({
                value: format(mon, 'yyyy-MM-dd'),
                label: `Semaine ${getISOWeek(mon)} · ${format(mon, 'd MMM', { locale: fr })} → ${format(addDays(mon, 6), 'd MMM', { locale: fr })}`,
            });
        }
        return opts;
    }, [baseMonday]);

    const userMap = useMemo(() => {
        const m = new Map();
        Object.values(membersByService).flat().forEach(u => m.set(u.id, u));
        return m;
    }, [membersByService]);

    const toggleService = (key) => {
        setConfirmOpen(false);
        setServices(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
    };
    const toggleExpand = (key) => setExpanded(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
    const toggleMember = (id) => {
        setConfirmOpen(false);
        setExcluded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    };

    const selectedMemberIds = useMemo(() => {
        const s = new Set();
        services.forEach(svc => (membersByService[svc] || []).forEach(u => { if (!excluded.has(u.id)) s.add(u.id); }));
        return s;
    }, [services, excluded, membersByService]);

    const matching = useMemo(() => {
        if (selectedMemberIds.size === 0) return [];
        return events
            .filter(e =>
                e.type !== 'absence' &&
                e.resourceId !== 'backlog_confection' &&
                e.meta?.status !== 'validated' &&
                selectedMemberIds.has(e.resourceId) &&
                e.date >= startISO && e.date <= endISO
            )
            .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : memberName(userMap.get(a.resourceId)).localeCompare(memberName(userMap.get(b.resourceId)))));
    }, [events, selectedMemberIds, startISO, endISO, userMap]);

    const totalHours = useMemo(() => Math.round(matching.reduce((s, e) => s + eventHours(e), 0) * 10) / 10, [matching]);

    if (!isOpen) return null;

    const chk = (checked) => ({ width: 18, height: 18, borderRadius: 5, border: `2px solid ${checked ? '#2563EB' : '#CBD5E1'}`, background: checked ? '#2563EB' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 });
    const card = { background: 'white', borderRadius: 14, width: 'min(560px, 94vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' };

    // ── Écran de succès ────────────────────────────────────────────────
    if (doneCount !== null) {
        return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                <div style={{ ...card, maxWidth: 420, alignItems: 'center', textAlign: 'center', padding: '36px 28px' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                        <CheckCircle2 size={38} color="#059669" />
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 6 }}>Temps validés</div>
                    <div style={{ fontSize: 14, color: '#4B5563', marginBottom: 24 }}>
                        {doneCount} créneau{doneCount > 1 ? 'x' : ''} {doneCount > 1 ? 'ont' : 'a'} bien été validé{doneCount > 1 ? 's' : ''}.
                    </div>
                    <button onClick={onClose} style={{ padding: '10px 28px', borderRadius: 8, border: 'none', background: '#059669', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Fermer</button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={card}>
                {/* En-tête */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckCircle2 size={20} color="#059669" />
                        <span style={{ fontSize: 17, fontWeight: 800, color: '#111827' }}>Validation en masse</span>
                    </div>
                    <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6B7280', display: 'flex' }}><X size={20} /></button>
                </div>

                {/* Corps */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                    {/* Services */}
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Services</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                        {SERVICES.map(svc => {
                            const isOn = services.has(svc.key);
                            const isExp = expanded.has(svc.key);
                            const col = PLANNING_COLORS[svc.key] || PLANNING_COLORS.default;
                            const members = membersByService[svc.key] || [];
                            const activeCount = members.filter(u => !excluded.has(u.id)).length;
                            return (
                                <div key={svc.key} style={{ border: `1px solid ${isOn ? col.border : '#E5E7EB'}`, borderRadius: 10, overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', background: isOn ? col.bg : 'white' }}>
                                        <div onClick={() => toggleService(svc.key)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1, minWidth: 0 }}>
                                            <div style={chk(isOn)}>{isOn && <CheckCircle2 size={12} color="white" />}</div>
                                            <span style={{ width: 10, height: 10, borderRadius: 3, background: col.bg, border: `1.5px solid ${col.border}` }} />
                                            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{svc.label}</span>
                                            <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                                                · {isOn && activeCount !== members.length ? `${activeCount}/${members.length}` : members.length} pers.
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => toggleExpand(svc.key)}
                                            disabled={members.length === 0}
                                            title="Choisir certaines personnes"
                                            style={{ border: 'none', background: 'transparent', cursor: members.length ? 'pointer' : 'default', color: '#6B7280', display: 'flex', alignItems: 'center', opacity: members.length ? 1 : 0.3 }}
                                        >
                                            {isExp ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        </button>
                                    </div>
                                    {isExp && members.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 12px 10px 42px', background: 'white' }}>
                                            {members.map(u => {
                                                const on = !excluded.has(u.id);
                                                return (
                                                    <div key={u.id} onClick={() => toggleMember(u.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer' }}>
                                                        <div style={chk(on)}>{on && <CheckCircle2 size={12} color="white" />}</div>
                                                        <span style={{ fontSize: 13, color: on ? '#374151' : '#9CA3AF' }}>{memberName(u)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Période — par semaine ou plage de dates libre */}
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Période</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                        {[['week', 'Par semaine'], ['range', 'Plage de dates']].map(([m, lbl]) => (
                            <button
                                key={m}
                                onClick={() => { setConfirmOpen(false); setMode(m); }}
                                style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: `1px solid ${mode === m ? '#2563EB' : '#E5E7EB'}`, background: mode === m ? '#EFF6FF' : 'white', color: mode === m ? '#2563EB' : '#6B7280', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                            >
                                {lbl}
                            </button>
                        ))}
                    </div>
                    {mode === 'week' ? (
                        <select
                            value={weekStartISO}
                            onChange={(e) => { setConfirmOpen(false); setWeekStart(parseISO(e.target.value)); }}
                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14, marginBottom: 20, background: 'white', cursor: 'pointer' }}
                        >
                            {weekOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    ) : (
                        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                            <label style={{ flex: 1, fontSize: 12, color: '#6B7280' }}>Du
                                <input type="date" value={rangeStart} onChange={(e) => { setConfirmOpen(false); setRangeStart(e.target.value); }} style={{ width: '100%', marginTop: 4, padding: '9px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14 }} />
                            </label>
                            <label style={{ flex: 1, fontSize: 12, color: '#6B7280' }}>Au
                                <input type="date" value={rangeEnd} min={rangeStart} onChange={(e) => { setConfirmOpen(false); setRangeEnd(e.target.value); }} style={{ width: '100%', marginTop: 4, padding: '9px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14 }} />
                            </label>
                        </div>
                    )}

                    {/* Aperçu + détail dépliable */}
                    <div style={{ borderRadius: 10, background: matching.length ? '#ECFDF5' : '#F9FAFB', border: `1px solid ${matching.length ? '#A7F3D0' : '#E5E7EB'}`, overflow: 'hidden' }}>
                        <div
                            onClick={() => matching.length && setShowDetail(v => !v)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 14px', cursor: matching.length ? 'pointer' : 'default' }}
                        >
                            {matching.length > 0 ? (
                                <span style={{ fontSize: 14, color: '#065F46' }}>
                                    <b>{matching.length}</b> créneau{matching.length > 1 ? 'x' : ''} · <b>{totalHours} h</b> à valider
                                </span>
                            ) : (
                                <span style={{ fontSize: 14, color: '#6B7280' }}>Aucun créneau à valider pour cette sélection.</span>
                            )}
                            {matching.length > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600, color: '#059669' }}>
                                    {showDetail ? 'Masquer' : 'Détail'} {showDetail ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                </span>
                            )}
                        </div>
                        {showDetail && matching.length > 0 && (
                            <div style={{ borderTop: '1px solid #A7F3D0', maxHeight: 220, overflowY: 'auto', background: 'white' }}>
                                {matching.map(e => (
                                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 14px', borderBottom: '1px solid #F3F4F6' }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {memberName(userMap.get(e.resourceId))} · {e.title || '(sans dossier)'}
                                            </div>
                                            <div style={{ fontSize: 12, color: '#6B7280', textTransform: 'capitalize' }}>{format(parseISO(e.date), 'EEEE d MMM', { locale: fr })}</div>
                                        </div>
                                        <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#065F46' }}>{eventHours(e)} h</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Pied */}
                <div style={{ borderTop: '1px solid #F3F4F6', padding: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button onClick={onClose} style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #D1D5DB', background: 'white', color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Annuler</button>
                    <button
                        onClick={() => setConfirmOpen(true)}
                        disabled={matching.length === 0}
                        style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: matching.length ? '#059669' : '#9CA3AF', color: 'white', fontWeight: 700, fontSize: 14, cursor: matching.length ? 'pointer' : 'not-allowed' }}
                    >
                        Valider {matching.length || ''} créneau{matching.length > 1 ? 'x' : ''}
                    </button>
                </div>
            </div>

            {/* Pop-up de confirmation (par-dessus) */}
            {confirmOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div style={{ background: 'white', borderRadius: 14, width: 'min(400px, 92vw)', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        <div style={{ fontSize: 17, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Valider les temps ?</div>
                        <div style={{ fontSize: 14, color: '#4B5563', marginBottom: 22 }}>
                            Voulez-vous vraiment valider <b>{matching.length}</b> créneau{matching.length > 1 ? 'x' : ''} ({totalHours} h) ? Tous ces temps passeront en <b>validé</b>.
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button onClick={() => setConfirmOpen(false)} style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #D1D5DB', background: 'white', color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Annuler</button>
                            <button
                                onClick={() => { const n = matching.length; if (onConfirm) onConfirm(matching); setConfirmOpen(false); setDoneCount(n); }}
                                style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#059669', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                            >
                                Oui, valider
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
