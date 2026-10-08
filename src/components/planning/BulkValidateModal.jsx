import React, { useMemo, useState } from 'react';
import { format, parseISO, startOfWeek, addDays, getISOWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import DaDialog from '../ui/DaDialog';
import { DaField, ChoicePill } from '../ui/DaForm';
import { DA_INPUT_STYLE } from '../../lib/constants/daStyles';

const NAVY = '#1E2447';
const BTN = { height: 38, padding: '0 16px', borderRadius: 8, border: '1px solid #E0DED9', background: 'white', color: '#374151', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' };
const BTN_PRIMARY = { ...BTN, border: 'none', background: NAVY, color: 'white' };
const chk = (checked) => ({ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${checked ? NAVY : '#C9C7C2'}`, background: checked ? NAVY : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 });

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

    const reset = () => setConfirmOpen(false);
    const plural = matching.length > 1;

    // ── Écran de succès ────────────────────────────────────────────────
    if (doneCount !== null) {
        return (
            <DaDialog open={isOpen} onClose={onClose} title="Temps validés" maxWidth="xs"
                footer={<button onClick={onClose} style={{ ...BTN_PRIMARY, marginLeft: 'auto' }}>Fermer</button>}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '6px 0' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#EEF4FD', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Check size={24} color={NAVY} />
                    </div>
                    <div style={{ fontSize: 14, color: '#374151' }}>
                        {doneCount} créneau{doneCount > 1 ? 'x' : ''} {doneCount > 1 ? 'ont' : 'a'} bien été validé{doneCount > 1 ? 's' : ''}.
                    </div>
                </div>
            </DaDialog>
        );
    }

    return (
        <>
            <DaDialog
                open={isOpen}
                onClose={onClose}
                title="Validation en masse"
                subtitle="Passe en « validé » les créneaux d'un service sur une période."
                footer={(
                    <>
                        <button onClick={onClose} style={{ ...BTN, marginLeft: 'auto' }}>Annuler</button>
                        <button
                            onClick={() => setConfirmOpen(true)}
                            disabled={matching.length === 0}
                            style={{ ...BTN_PRIMARY, opacity: matching.length ? 1 : 0.4, cursor: matching.length ? 'pointer' : 'not-allowed' }}
                        >
                            Valider {matching.length || ''} créneau{plural ? 'x' : ''}
                        </button>
                    </>
                )}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Services */}
                    <DaField label="Services">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {SERVICES.map(svc => {
                                const isOn = services.has(svc.key);
                                const isExp = expanded.has(svc.key);
                                const members = membersByService[svc.key] || [];
                                const activeCount = members.filter(u => !excluded.has(u.id)).length;
                                return (
                                    <div key={svc.key} style={{ border: `1px solid ${isOn ? '#A8C2EC' : '#E0DED9'}`, borderRadius: 8, overflow: 'hidden' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', background: isOn ? '#EEF4FD' : 'white' }}>
                                            <div onClick={() => toggleService(svc.key)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1, minWidth: 0 }}>
                                                <div style={chk(isOn)}>{isOn && <Check size={12} color="white" strokeWidth={3} />}</div>
                                                <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{svc.label}</span>
                                                <span style={{ fontSize: 12, color: '#9B9A97' }}>
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
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 12px 10px 40px', background: 'white', borderTop: '1px solid #E8E6E2' }}>
                                                {members.map(u => {
                                                    const on = !excluded.has(u.id);
                                                    return (
                                                        <div key={u.id} onClick={() => toggleMember(u.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer' }}>
                                                            <div style={chk(on)}>{on && <Check size={12} color="white" strokeWidth={3} />}</div>
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
                    </DaField>

                    {/* Période — par semaine ou plage de dates libre */}
                    <DaField label="Période">
                        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                            {[['week', 'Par semaine'], ['range', 'Plage de dates']].map(([m, lbl]) => (
                                <ChoicePill key={m} active={mode === m} onClick={() => { reset(); setMode(m); }}>{lbl}</ChoicePill>
                            ))}
                        </div>
                        {mode === 'week' ? (
                            <select
                                value={weekStartISO}
                                onChange={(e) => { reset(); setWeekStart(parseISO(e.target.value)); }}
                                style={{ ...DA_INPUT_STYLE, cursor: 'pointer' }}
                            >
                                {weekOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        ) : (
                            <div style={{ display: 'flex', gap: 10 }}>
                                <label style={{ flex: 1, fontSize: 12, color: '#9B9A97' }}>Du
                                    <input type="date" value={rangeStart} onChange={(e) => { reset(); setRangeStart(e.target.value); }} style={{ ...DA_INPUT_STYLE, marginTop: 4 }} />
                                </label>
                                <label style={{ flex: 1, fontSize: 12, color: '#9B9A97' }}>Au
                                    <input type="date" value={rangeEnd} min={rangeStart} onChange={(e) => { reset(); setRangeEnd(e.target.value); }} style={{ ...DA_INPUT_STYLE, marginTop: 4 }} />
                                </label>
                            </div>
                        )}
                    </DaField>

                    {/* Aperçu + détail dépliable */}
                    <div style={{ borderRadius: 8, background: matching.length ? '#EEF4FD' : '#F4F4F4', overflow: 'hidden' }}>
                        <div
                            onClick={() => matching.length && setShowDetail(v => !v)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 14px', cursor: matching.length ? 'pointer' : 'default' }}
                        >
                            {matching.length > 0 ? (
                                <span style={{ fontSize: 14, color: '#111827' }}>
                                    <b>{matching.length}</b> créneau{plural ? 'x' : ''} · <b>{totalHours} h</b> à valider
                                </span>
                            ) : (
                                <span style={{ fontSize: 14, color: '#6B7280' }}>Aucun créneau à valider pour cette sélection.</span>
                            )}
                            {matching.length > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600, color: NAVY }}>
                                    {showDetail ? 'Masquer' : 'Détail'} {showDetail ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                </span>
                            )}
                        </div>
                        {showDetail && matching.length > 0 && (
                            <div style={{ maxHeight: 220, overflowY: 'auto', background: 'white', border: '1px solid #E0DED9', borderRadius: '0 0 8px 8px' }}>
                                {matching.map(e => (
                                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 14px', borderBottom: '1px solid #E8E6E2' }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {memberName(userMap.get(e.resourceId))} · {e.title || '(sans dossier)'}
                                            </div>
                                            <div style={{ fontSize: 12, color: '#6B7280' }}>{format(parseISO(e.date), 'EEEE d MMM', { locale: fr })}</div>
                                        </div>
                                        <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: '#374151' }}>{eventHours(e)} h</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </DaDialog>

            {/* Confirmation (par-dessus) */}
            <DaDialog
                open={isOpen && confirmOpen}
                onClose={() => setConfirmOpen(false)}
                title="Valider les temps ?"
                maxWidth="xs"
                footer={(
                    <>
                        <button onClick={() => setConfirmOpen(false)} style={{ ...BTN, marginLeft: 'auto' }}>Annuler</button>
                        <button
                            onClick={() => { const n = matching.length; if (onConfirm) onConfirm(matching); setConfirmOpen(false); setDoneCount(n); }}
                            style={BTN_PRIMARY}
                        >
                            Oui, valider
                        </button>
                    </>
                )}
            >
                <div style={{ fontSize: 14, color: '#4B5563' }}>
                    Voulez-vous vraiment valider <b>{matching.length}</b> créneau{plural ? 'x' : ''} ({totalHours} h) ? Tous ces temps passeront en <b>validé</b>.
                </div>
            </DaDialog>
        </>
    );
}
