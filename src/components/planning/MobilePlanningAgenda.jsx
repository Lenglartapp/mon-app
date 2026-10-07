import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO, startOfWeek, addDays, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ChevronDown, MapPin, Users, StickyNote, ClipboardList, BedDouble, X, FolderOpen, Navigation } from 'lucide-react';
import { productionGroup } from '../../lib/authz';
import { TonePill } from '../ui/ToolbarControls';
import { useFillViewportHeight } from '../../lib/hooks/useFillViewportHeight';

// Agenda Pose sur téléphone (lecture seule), à la DA : Roboto, bleu nuit, bleu ciel, gris.
//  - s'ouvre sur aujourd'hui ; « Moi » par défaut pour un poseur ;
//  - une carte par chantier et par jour (les poseurs du chantier en dessous) ;
//  - horaire affiché seulement s'il sort de la journée type (08:00 – 17:00) ;
//  - toucher une carte ouvre son détail (itinéraire, note, prise de cotes, fiche projet) ;
//  - glisser vers la gauche / droite change de semaine.

const ROBOTO = 'Roboto, system-ui, sans-serif';
const NAVY = '#1E2447';
const STANDARD_TIME = '08:00 – 17:00';

const eventTime = (e) => {
    if (!e.meta?.start || !e.meta?.end) return null;
    try {
        return `${format(new Date(e.meta.start), 'HH:mm')} – ${format(new Date(e.meta.end), 'HH:mm')}`;
    } catch { return null; }
};

const mapsUrl = (loc) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`;
const wazeUrl = (loc) => `https://waze.com/ul?q=${encodeURIComponent(loc)}&navigate=yes`;

const BTN = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 38, minWidth: 38, padding: '0 10px', borderRadius: 8, boxSizing: 'border-box',
    border: '1px solid #E0DED9', background: 'white', color: '#374151',
    fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
};

const fullName = (u) => (u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : '') || '—';

export default function MobilePlanningAgenda({
    events = [], projects = [], users = [], poseMembers = [], canViewAs = false, currentUser,
    currentDate, onChangeDate, onBack, onOpenPrise, onOpenProject,
}) {
    // Un poseur arrive sur SON agenda ; les autres profils sur l'équipe.
    const isPoseur = productionGroup(currentUser?.role) === 'pose';
    const [myView, setMyView] = useState(isPoseur && !canViewAs);
    const [viewAsId, setViewAsId] = useState(null); // ordo / admin : agenda « en tant que » un poseur
    const focusId = canViewAs ? viewAsId : (myView ? currentUser?.id : null);
    const [detail, setDetail] = useState(null);     // carte ouverte (bas d'écran)

    // Hauteur = espace sous l'en-tête de l'appli : seule la liste défile, la page ne bouge pas.
    const rootRef = useRef(null);
    const fillHeight = useFillViewportHeight(rootRef, { bottomGap: 0, min: 360 });
    const listRef = useRef(null);
    const dayRefs = useRef({});
    const touch = useRef(null);

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
    const weekEnd = days[6];
    const todayIdx = days.findIndex(d => isSameDay(d, new Date()));

    const projectMap = useMemo(() => new Map((projects || []).map(p => [p.id, p])), [projects]);
    const userMap = useMemo(() => new Map((users || []).map(u => [u.id, u])), [users]);

    // Créneaux Pose de la semaine regroupés par jour PUIS par chantier.
    const byDay = useMemo(() => {
        const out = days.map(() => new Map());
        const all = days.map(() => new Map()); // tous les poseurs du chantier (pour « Avec … » en vue Moi)
        (events || []).forEach(e => {
            if (e.type !== 'pose') return;
            const idx = days.findIndex(d => isSameDay(parseISO(e.date), d));
            if (idx === -1) return;
            const key = e.meta?.projectId || e.title || e.id;
            if (!all[idx].has(key)) all[idx].set(key, new Set());
            all[idx].get(key).add(e.resourceId);
            if (focusId && e.resourceId !== focusId) return;
            if (!out[idx].has(key)) out[idx].set(key, { key, title: e.title || '(sans dossier)', projectId: e.meta?.projectId, events: [] });
            out[idx].get(key).events.push(e);
        });
        const me = focusId || currentUser?.id;
        return out.map((map, idx) => [...map.values()].map(g => {
            // Un poseur avec plusieurs créneaux sur le chantier = une seule ligne (« 08:00 – 12:00 · 13:00 – 17:00 »).
            const byMember = new Map();
            [...g.events].sort((x, y) => ((x.meta?.start || '') < (y.meta?.start || '') ? -1 : 1)).forEach(e => {
                const t = eventTime(e);
                if (!byMember.has(e.resourceId)) byMember.set(e.resourceId, { id: e.resourceId, name: fullName(userMap.get(e.resourceId)), times: [] });
                if (t) byMember.get(e.resourceId).times.push(t);
            });
            const members = [...byMember.values()]
                .map(m => ({ ...m, time: m.times.join(' · ') || null }))
                .sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : a.name.localeCompare(b.name)));
            const times = [...new Set(members.map(m => m.time).filter(Boolean))];
            const notes = [...new Set(g.events.map(e => (e.meta?.description || '').trim()).filter(Boolean))];
            const others = [...(all[idx].get(g.key) || [])].filter(id => !g.events.some(e => e.resourceId === id));
            return {
                ...g,
                members,
                project: projectMap.get(g.projectId),
                // Une seule plage pour tout le chantier → on l'affiche sur la carte si elle sort de l'ordinaire.
                time: times.length === 1 && times[0] !== STANDARD_TIME ? times[0] : null,
                mixedTimes: times.length > 1,
                decouche: g.events.some(e => e.meta?.decouche),
                notes,
                withNames: others.map(id => fullName(userMap.get(id))),
                mine: g.events.some(e => e.resourceId === currentUser?.id),
                start: g.events.map(e => e.meta?.start || '').sort()[0] || '',
            };
        }).sort((a, b) => (a.mine !== b.mine ? (a.mine ? -1 : 1) : a.start < b.start ? -1 : a.start > b.start ? 1 : a.title.localeCompare(b.title))));
    }, [events, days, focusId, currentUser, userMap, projectMap]);

    const total = byDay.reduce((s, l) => s + l.length, 0);

    // Faire défiler la liste jusqu'à un jour (sans faire bouger la page).
    const scrollToDay = (i, smooth = true) => {
        const el = dayRefs.current[i];
        const list = listRef.current;
        if (el && list) list.scrollTo({ top: Math.max(0, el.offsetTop - 8), behavior: smooth ? 'smooth' : 'auto' });
    };
    // Ouverture / changement de semaine : on se place sur aujourd'hui s'il est dans la semaine.
    useEffect(() => {
        const id = requestAnimationFrame(() => {
            if (todayIdx >= 0) scrollToDay(todayIdx, false);
            else if (listRef.current) listRef.current.scrollTop = 0;
        });
        return () => cancelAnimationFrame(id);
        // (relancé aussi quand les créneaux arrivent : la liste est vide au premier affichage)
    }, [weekStart.getTime(), focusId, total > 0]); // eslint-disable-line react-hooks/exhaustive-deps

    const goWeek = (delta) => onChangeDate(addDays(weekStart, delta * 7));
    const goToday = () => {
        if (todayIdx >= 0) scrollToDay(todayIdx);
        else onChangeDate(new Date());
    };

    // Glisser horizontalement sur la liste = semaine précédente / suivante.
    const onTouchStart = (e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; };
    const onTouchEnd = (e) => {
        const s = touch.current; touch.current = null;
        if (!s) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - s.x, dy = t.clientY - s.y;
        if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2) goWeek(dx < 0 ? 1 : -1);
    };

    const emptyText = viewAsId
        ? `Aucun créneau pour ${fullName(userMap.get(viewAsId))} cette semaine.`
        : focusId ? 'Aucun créneau pour vous cette semaine.' : 'Aucun créneau de pose cette semaine.';

    return (
        <div ref={rootRef} style={{ height: fillHeight ?? '100dvh', display: 'flex', flexDirection: 'column', background: '#F4F4F4', fontFamily: ROBOTO }}>
            {/* En-tête fixe */}
            <div style={{ flexShrink: 0, background: 'white', borderBottom: '1px solid #E0DED9', padding: '12px 16px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    {onBack && (
                        <button onClick={onBack} aria-label="Retour" style={{ ...BTN, padding: 0, width: 38 }}>
                            <ChevronLeft size={18} />
                        </button>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 24, fontWeight: 400, color: '#111827', lineHeight: 1.1 }}>Planning</div>
                        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Pose</div>
                    </div>
                    {canViewAs ? (
                        <label style={{ ...BTN, position: 'relative', maxWidth: 170, background: viewAsId ? NAVY : 'white', color: viewAsId ? 'white' : '#374151', borderColor: viewAsId ? NAVY : '#E0DED9' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {viewAsId ? fullName(userMap.get(viewAsId)) : 'Équipe'}
                            </span>
                            <ChevronDown size={14} />
                            <select
                                value={viewAsId || ''}
                                onChange={(e) => setViewAsId(e.target.value || null)}
                                aria-label="Voir l'agenda de"
                                style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', cursor: 'pointer' }}
                            >
                                <option value="">Équipe</option>
                                {poseMembers.map(m => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
                            </select>
                        </label>
                    ) : (
                        <div style={{ display: 'flex', gap: 2, background: '#F4F4F4', borderRadius: 99, padding: 3 }}>
                            {[[true, 'Moi'], [false, 'Équipe']].map(([v, label]) => (
                                <button key={label} onClick={() => setMyView(v)} style={{
                                    height: 32, padding: '0 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
                                    fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                                    background: myView === v ? NAVY : 'transparent', color: myView === v ? 'white' : '#4B5563',
                                }}>{label}</button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Navigation semaine */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <button onClick={() => goWeek(-1)} aria-label="Semaine précédente" style={{ ...BTN, padding: 0, width: 38 }}><ChevronLeft size={18} /></button>
                    <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 500, color: '#111827' }}>Semaine {format(weekStart, 'I')}</div>
                        <div style={{ fontSize: 12, color: '#6B7280' }}>{format(weekStart, 'd MMM', { locale: fr })} – {format(weekEnd, 'd MMM', { locale: fr })}</div>
                    </div>
                    <button onClick={() => goWeek(1)} aria-label="Semaine suivante" style={{ ...BTN, padding: 0, width: 38 }}><ChevronRight size={18} /></button>
                    <button onClick={goToday} style={BTN}>Aujourd'hui</button>
                </div>

                {/* Bande des 7 jours (toucher = aller au jour) */}
                <div style={{ display: 'flex', gap: 4 }}>
                    {days.map((d, i) => {
                        const isToday = i === todayIdx;
                        const weekend = i >= 5;
                        const count = byDay[i].length;
                        return (
                            <button
                                key={i}
                                onClick={() => scrollToDay(i)}
                                style={{
                                    flex: 1, border: 'none', borderRadius: 10, padding: '6px 0 5px', cursor: 'pointer', fontFamily: 'inherit',
                                    background: isToday ? NAVY : 'transparent',
                                    color: isToday ? 'white' : weekend ? '#9B9A97' : '#374151',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                                }}
                            >
                                <span style={{ fontSize: 11 }}>{format(d, 'EEE', { locale: fr }).replace('.', '')}</span>
                                <span style={{ fontSize: 16, fontWeight: 500 }}>{format(d, 'd')}</span>
                                {/* Point = au moins un chantier ce jour-là */}
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: count ? (isToday ? '#A8C2EC' : NAVY) : 'transparent' }} />
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Liste des jours */}
            <div
                ref={listRef}
                className="df-noscrollbar"
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 40px', position: 'relative' }}
            >
                {total === 0 && (
                    <div style={{ padding: '48px 20px', textAlign: 'center', color: '#9B9A97', fontSize: 14 }}>{emptyText}</div>
                )}

                {days.map((d, i) => {
                    const groups = byDay[i];
                    const isToday = i === todayIdx;
                    if (total === 0) return null;
                    return (
                        <div key={i} ref={(el) => { dayRefs.current[i] = el; }} style={{ paddingTop: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <span style={{ fontSize: 16, fontWeight: 500, color: '#111827' }}>
                                    {(() => { const s = format(d, 'EEEE d MMMM', { locale: fr }); return s.charAt(0).toUpperCase() + s.slice(1); })()}
                                </span>
                                {isToday && <TonePill tone={0}>Aujourd'hui</TonePill>}
                            </div>

                            {groups.length === 0 ? (
                                <div style={{ fontSize: 13, color: '#9B9A97', padding: '0 2px 4px' }}>Rien de prévu</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {groups.map(g => (
                                        <AgendaCard key={g.key} g={g} me={currentUser?.id} showMembers={!focusId} onOpen={() => setDetail({ ...g, day: d })} />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {detail && (
                <DetailSheet
                    g={detail}
                    me={currentUser?.id}
                    onClose={() => setDetail(null)}
                    onOpenPrise={onOpenPrise}
                    onOpenProject={onOpenProject}
                />
            )}
        </div>
    );
}

// Carte d'un chantier pour un jour : nom, poseurs, adresse, nuit sur place, note.
function AgendaCard({ g, me, showMembers, onOpen }) {
    const location = g.project?.location;
    return (
        <button
            onClick={onOpen}
            style={{
                width: '100%', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer',
                background: 'white', borderRadius: 12, padding: '12px 14px',
                border: `1px solid ${g.mine ? '#A8C2EC' : '#E0DED9'}`,
                display: 'flex', alignItems: 'center', gap: 10,
            }}
        >
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#111827', lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {g.title}
                    </span>
                    {g.time && <span style={{ flexShrink: 0 }}><TonePill tone={5}>{g.time}</TonePill></span>}
                </div>

                {showMembers ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {g.members.map(m => (
                            <TonePill key={m.id} tone={m.id === me ? 0 : 5}>
                                {m.id === me ? 'Moi' : m.name}{g.mixedTimes && m.time ? ` · ${m.time}` : ''}
                            </TonePill>
                        ))}
                    </div>
                ) : g.withNames.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#4B5563' }}>
                        <Users size={14} color="#9B9A97" style={{ flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Avec {g.withNames.join(', ')}</span>
                    </div>
                )}

                {location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B7280' }}>
                        <MapPin size={14} color="#9B9A97" style={{ flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{location}</span>
                    </div>
                )}

                {(g.decouche || g.notes.length > 0) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        {g.decouche && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 22, padding: '0 10px', borderRadius: 99, background: '#EEF4FD', color: '#111827', fontSize: 12, fontWeight: 600 }}>
                                <BedDouble size={13} /> Nuit sur place
                            </span>
                        )}
                        {g.notes.length > 0 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0, maxWidth: '100%', fontSize: 12, color: '#6B7280' }}>
                                <StickyNote size={13} color="#9B9A97" style={{ flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.notes[0]}</span>
                            </span>
                        )}
                    </div>
                )}
            </div>
            <ChevronRight size={18} color="#C9C7C2" style={{ flexShrink: 0 }} />
        </button>
    );
}

// Détail d'un chantier (feuille en bas d'écran) : tout lire, partir en itinéraire, ouvrir le dossier.
function DetailSheet({ g, me, onClose, onOpenPrise, onOpenProject }) {
    const location = g.project?.location;
    const dayLabel = (() => { const s = format(g.day, 'EEEE d MMMM', { locale: fr }); return s.charAt(0).toUpperCase() + s.slice(1); })();
    const section = { fontSize: 12, color: '#9B9A97', marginBottom: 6 };
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(17,24,39,0.4)' }} />
            <div style={{
                position: 'relative', background: 'white', borderRadius: '16px 16px 0 0', maxHeight: '85dvh',
                display: 'flex', flexDirection: 'column', fontFamily: ROBOTO, boxShadow: '0 -10px 30px rgba(17,24,39,0.15)',
                paddingBottom: 'env(safe-area-inset-bottom)',
            }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E0DED9', margin: '8px auto 0' }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 20px 12px', borderBottom: '1px solid #E8E6E2' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 20, fontWeight: 400, color: '#111827', lineHeight: 1.25 }}>{g.title}</div>
                        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>{dayLabel}</div>
                    </div>
                    <button onClick={onClose} aria-label="Fermer" style={{ border: 'none', background: 'none', color: '#9B9A97', padding: 4, display: 'flex', cursor: 'pointer' }}><X size={20} /></button>
                </div>

                <div className="df-noscrollbar" style={{ overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div>
                        <div style={section}>Équipe</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {g.members.map(m => (
                                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14, color: '#111827' }}>
                                    <span>{m.name}{m.id === me ? ' (moi)' : ''}</span>
                                    <span style={{ fontSize: 13, color: '#6B7280' }}>{m.time || ''}</span>
                                </div>
                            ))}
                            {g.withNames.length > 0 && (
                                <div style={{ fontSize: 13, color: '#6B7280' }}>Avec {g.withNames.join(', ')}</div>
                            )}
                        </div>
                    </div>

                    {location && (
                        <div>
                            <div style={section}>Adresse</div>
                            <div style={{ fontSize: 14, color: '#111827', marginBottom: 10 }}>{location}</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <a href={mapsUrl(location)} target="_blank" rel="noopener noreferrer" style={{ ...BTN, flex: 1, textDecoration: 'none' }}>
                                    <Navigation size={15} /> Google Maps
                                </a>
                                <a href={wazeUrl(location)} target="_blank" rel="noopener noreferrer" style={{ ...BTN, flex: 1, textDecoration: 'none' }}>
                                    <Navigation size={15} /> Waze
                                </a>
                            </div>
                        </div>
                    )}

                    {g.decouche && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#111827', background: '#EEF4FD', borderRadius: 8, padding: '10px 12px' }}>
                            <BedDouble size={16} /> Nuit sur place
                        </div>
                    )}

                    {g.notes.length > 0 && (
                        <div>
                            <div style={section}>Note</div>
                            <div style={{ fontSize: 14, color: '#111827', background: '#F4F4F4', borderRadius: 8, padding: '10px 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {g.notes.join('\n\n')}
                            </div>
                        </div>
                    )}
                </div>

                {g.project && (onOpenPrise || onOpenProject) && (
                    <div style={{ display: 'flex', gap: 8, padding: '12px 20px 16px', borderTop: '1px solid #E8E6E2' }}>
                        {onOpenProject && (
                            <button onClick={() => onOpenProject(g.project)} style={{ ...BTN, flex: 1, height: 44 }}>
                                <FolderOpen size={16} /> Fiche projet
                            </button>
                        )}
                        {onOpenPrise && (
                            <button onClick={() => onOpenPrise(g.project)} style={{ ...BTN, flex: 1, height: 44, background: NAVY, borderColor: NAVY, color: 'white' }}>
                                <ClipboardList size={16} /> Prise de cotes
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
