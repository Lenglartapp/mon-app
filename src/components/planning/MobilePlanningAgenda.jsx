import React, { useMemo, useRef, useState } from 'react';
import { format, parseISO, startOfWeek, addDays, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, MapPin, User, Users, StickyNote, ClipboardList } from 'lucide-react';
import { PLANNING_COLORS } from './constants';

const POSE = PLANNING_COLORS.pose;

// Horaire d'un créneau à partir de meta.start / meta.end.
const eventTime = (e) => {
    if (!e.meta?.start || !e.meta?.end) return null;
    try {
        return `${format(new Date(e.meta.start), 'HH:mm')} – ${format(new Date(e.meta.end), 'HH:mm')}`;
    } catch { return null; }
};

const mapsUrl = (loc) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`;

export default function MobilePlanningAgenda({
    events = [], projects = [], users = [], currentUser,
    currentDate, onChangeDate, onBack, onOpenPrise,
}) {
    const [myView, setMyView] = useState(false);
    const dayRefs = useRef({});

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
    const weekEnd = days[6];

    const projectMap = useMemo(() => {
        const m = new Map();
        (projects || []).forEach(p => m.set(p.id, p));
        return m;
    }, [projects]);

    const userMap = useMemo(() => {
        const m = new Map();
        (users || []).forEach(u => m.set(u.id, u));
        return m;
    }, [users]);

    const userName = (id) => {
        const u = userMap.get(id);
        const n = u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : '';
        return n || '—';
    };

    // Créneaux Pose de la semaine, groupés par jour (option : uniquement les miens).
    const byDay = useMemo(() => {
        const out = days.map(() => []);
        (events || []).forEach(e => {
            if (e.type !== 'pose') return;
            if (myView && e.resourceId !== currentUser?.id) return;
            const idx = days.findIndex(d => isSameDay(parseISO(e.date), d));
            if (idx === -1) return;
            out[idx].push(e);
        });
        out.forEach(list => list.sort((a, b) => {
            // Mes créneaux d'abord, puis par heure de début
            const am = a.resourceId === currentUser?.id ? 0 : 1;
            const bm = b.resourceId === currentUser?.id ? 0 : 1;
            if (am !== bm) return am - bm;
            return (a.meta?.start || '') < (b.meta?.start || '') ? -1 : 1;
        }));
        return out;
    }, [events, days, myView, currentUser]);

    const total = byDay.reduce((s, l) => s + l.length, 0);

    const jumpToDay = (i) => {
        const el = dayRefs.current[i];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const btn = {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid #E5E7EB', background: 'white', borderRadius: 10,
        width: 40, height: 40, cursor: 'pointer', flexShrink: 0,
    };

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#F9FAFB' }}>
            {/* En-tête fixe */}
            <div style={{ flexShrink: 0, background: 'white', borderBottom: '1px solid #E5E7EB', padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {onBack && (
                        <button onClick={onBack} style={{ ...btn, width: 'auto', padding: '0 10px', gap: 4, fontSize: 13, fontWeight: 600, color: '#6B7280' }}>
                            <ChevronLeft size={16} />
                        </button>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>Planning Pose</div>
                    </div>
                    <button
                        onClick={() => setMyView(v => !v)}
                        style={{
                            ...btn, width: 'auto', padding: '0 12px', gap: 6, fontSize: 13, fontWeight: 700,
                            background: myView ? '#2563EB' : 'white', color: myView ? 'white' : '#374151',
                            borderColor: myView ? '#2563EB' : '#E5E7EB',
                        }}
                    >
                        {myView ? <User size={15} /> : <Users size={15} />}
                        {myView ? 'Moi' : 'Équipe'}
                    </button>
                </div>

                {/* Navigation semaine */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <button onClick={() => onChangeDate(addDays(weekStart, -7))} style={btn}><ChevronLeft size={18} /></button>
                    <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#374151' }}>
                        Semaine du {format(weekStart, 'd MMM', { locale: fr })} au {format(weekEnd, 'd MMM', { locale: fr })}
                    </div>
                    <button onClick={() => onChangeDate(addDays(weekStart, 7))} style={btn}><ChevronRight size={18} /></button>
                </div>

                {/* Bande des 7 jours */}
                <div style={{ display: 'flex', gap: 4 }}>
                    {days.map((d, i) => {
                        const isToday = isSameDay(d, new Date());
                        const count = byDay[i].length;
                        return (
                            <button
                                key={i}
                                onClick={() => jumpToDay(i)}
                                style={{
                                    flex: 1, border: 'none', borderRadius: 8, padding: '6px 0', cursor: 'pointer',
                                    background: isToday ? '#111827' : '#F3F4F6',
                                    color: isToday ? 'white' : '#374151',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                                }}
                            >
                                <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', opacity: 0.8 }}>{format(d, 'EEEEE', { locale: fr })}</span>
                                <span style={{ fontSize: 15, fontWeight: 800 }}>{format(d, 'd')}</span>
                                <span style={{
                                    fontSize: 9, fontWeight: 700, minHeight: 12,
                                    color: count ? (isToday ? '#93C5FD' : POSE.text) : 'transparent',
                                }}>{count ? `${count}` : '·'}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Liste des jours */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 32px' }}>
                {total === 0 && (
                    <div style={{ padding: '48px 20px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
                        {myView ? "Aucun créneau pour vous cette semaine." : "Aucun créneau de pose cette semaine."}
                    </div>
                )}

                {days.map((d, i) => {
                    const list = byDay[i];
                    const isToday = isSameDay(d, new Date());
                    return (
                        <div key={i} ref={(el) => { dayRefs.current[i] = el; }} style={{ marginTop: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', marginBottom: 6 }}>
                                <span style={{ fontSize: 14, fontWeight: 800, color: isToday ? '#2563EB' : '#111827', textTransform: 'capitalize' }}>
                                    {format(d, 'EEEE d MMMM', { locale: fr })}
                                </span>
                                {isToday && <span style={{ fontSize: 10, fontWeight: 700, color: 'white', background: '#2563EB', borderRadius: 4, padding: '1px 6px' }}>AUJOURD'HUI</span>}
                            </div>

                            {list.length === 0 ? (
                                <div style={{ fontSize: 13, color: '#9CA3AF', padding: '2px 2px 4px' }}>Rien de prévu</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {list.map(evt => {
                                        const isMine = evt.resourceId === currentUser?.id;
                                        const proj = projectMap.get(evt.meta?.projectId);
                                        const location = proj?.location;
                                        const note = (evt.meta?.description || '').trim();
                                        const time = eventTime(evt);
                                        return (
                                            <div key={evt.id} style={{
                                                background: 'white', borderRadius: 12,
                                                border: `1px solid ${isMine ? POSE.border : '#E5E7EB'}`,
                                                borderLeft: `5px solid ${POSE.border}`,
                                                boxShadow: isMine ? `0 0 0 2px ${POSE.bg}` : '0 1px 2px rgba(0,0,0,0.05)',
                                                padding: '10px 12px',
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                                        <span style={{ fontSize: 14, fontWeight: 800, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {userName(evt.resourceId)}
                                                        </span>
                                                        {isMine && <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, color: 'white', background: '#2563EB', borderRadius: 4, padding: '1px 6px' }}>MOI</span>}
                                                    </div>
                                                    {time && <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: POSE.text, background: POSE.bg, borderRadius: 6, padding: '2px 8px' }}>{time}</span>}
                                                </div>

                                                <div style={{ fontSize: 14, color: '#1F2937', fontWeight: 600, marginBottom: (location || note) ? 4 : 0 }}>
                                                    {evt.title || '(sans dossier)'}
                                                </div>

                                                {location && (
                                                    <a
                                                        href={mapsUrl(location)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#2563EB', textDecoration: 'none' }}
                                                    >
                                                        <MapPin size={14} />
                                                        <span style={{ textDecoration: 'underline' }}>{location}</span>
                                                    </a>
                                                )}

                                                {note && (
                                                    <div style={{ display: 'flex', gap: 6, marginTop: 8, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 10px' }}>
                                                        <StickyNote size={15} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />
                                                        <span style={{ fontSize: 13, color: '#78350F', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{note}</span>
                                                    </div>
                                                )}

                                                {proj && onOpenPrise && (
                                                    <button
                                                        onClick={() => onOpenPrise(proj)}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                                            width: '100%', marginTop: 10, minHeight: 44,
                                                            background: '#111827', color: 'white', border: 'none', borderRadius: 10,
                                                            fontSize: 14, fontWeight: 700, cursor: 'pointer',
                                                        }}
                                                    >
                                                        <ClipboardList size={16} /> Ouvrir la prise de cotes
                                                    </button>
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
