import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight as ChevronRightIcon, CheckCircle, X, Plus as PlusIcon, BedDouble, Moon } from 'lucide-react';
import { format, isSameDay, startOfMonth, startOfDay, endOfMonth, eachDayOfInterval, isWeekend, differenceInMinutes, addDays, parseISO, getHours, getMinutes, getISOWeek, addWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PLANNING_COLORS, getProjectColor, ROW_HEIGHT, PROGRAMME_ROW_HEIGHT, HEADER_HEIGHT_1, HEADER_HEIGHT_2, TOTAL_WORK_MINUTES, WORK_START_HOUR, WORK_END_HOUR, DEFAULT_DAILY_HOURS, ATELIER_HOURS_PER_DAY, dailyHoursForGroup, isMemberActiveOnDay } from './constants';
import { uid } from '../../lib/utils/uid';
import { stripMarks } from '../../lib/utils/richText';
import { computeProjectHours } from '../../lib/projectMetrics';

// Intervention de nuit : la plage 18h → 8h est dessinée dans la même case que la journée.
const NIGHT_START = 18 * 60;
const NIGHT_SPAN = 14 * 60;
const isNightEvent = (e) => {
    if (e.meta?.night) return true;
    if (e.type === 'absence' || !e.meta?.start || !e.meta?.end) return false;
    return format(new Date(e.meta.start), 'yyyy-MM-dd') !== format(new Date(e.meta.end), 'yyyy-MM-dd');
};
const nightRange = (e) => {
    const s = new Date(e.meta.start);
    const from = ((getHours(s) * 60 + getMinutes(s)) - NIGHT_START + 1440) % 1440;
    const dur = Math.min(NIGHT_SPAN - from, Math.max(1, differenceInMinutes(new Date(e.meta.end), s)));
    const k = TOTAL_WORK_MINUTES / NIGHT_SPAN;
    return [Math.min(TOTAL_WORK_MINUTES - 1, from * k), Math.min(TOTAL_WORK_MINUTES, (from + dur) * k)];
};

// --- STICKY CELLS ---
const ROBOTO = 'Roboto, system-ui, sans-serif';
const StickyLeftCell = ({ children, bg = 'white', borderBottom = true, onClick, style }) => (
    <div onClick={onClick} style={{ position: 'sticky', left: 0, zIndex: 50, background: bg, borderRight: '2px solid #E5E7EB', borderBottom: borderBottom ? '1px solid #E5E7EB' : 'none', display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: 13, fontWeight: 600, color: '#374151', cursor: onClick ? 'pointer' : 'default', height: style?.height ?? ROW_HEIGHT, minWidth: 260, maxWidth: 260, ...style }}>
        {children}
    </div>
);
const StickyTopCell = ({ children, bg = 'white', style }) => (
    <div style={{ position: 'sticky', top: 0, zIndex: 40, background: bg, borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: ROBOTO, fontSize: 13, fontWeight: 500, color: '#4B5563', ...style }}>
        {children}
    </div>
);
const StickyCorner = ({ children, style }) => (
    <div style={{ position: 'sticky', left: 0, top: 0, zIndex: 60, background: 'white', borderRight: '2px solid #E5E7EB', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', paddingLeft: 16, fontWeight: 700, fontSize: 13, color: '#111827', minWidth: 260, maxWidth: 260, ...style }}>
        {children}
    </div>
);

const PlanningGrid = ({
    days, columns: gridCols, superHeaders, view,
    filteredGroups, expandedGroups, onToggleGroup, onToggleMembers,
    events, projects = [], hiddenResources,
    closures = [], // fermetures de l'entreprise : capacité nulle ces jours-là
    highlightProjectId = null,
    onCellClick, onEventClick, onDeleteEvent, onUpdateEvent,
    onDragStart, onDragOver, onDrop,
    hoveredEventId, onHoverEvent,
    onResizeStart,
    getCellContent,
    showGauges = true,
    readOnly = false,
    isVertical = false,
    // Vues empilées (2 semaines / mois) : une grille par semaine dans une zone de défilement commune.
    embedded = false,
    allEvents = null,
    projectHours = null,
    showTotal = true,
    stickyTop = 0,          // hauteur d'un éventuel bandeau collant au-dessus
    cornerLabel = null,     // en-tête allégé : « Semaine 42 » à gauche de la ligne des jours
    hideGroupLabel = false, // service déjà nommé dans le bandeau : la ligne devient « Charge »
    isPast = false,         // semaine passée : fond hachuré, pour information
    landedIds = null        // créneaux qui viennent d'être déposés (petite animation d'atterrissage)
}) => {
    // --- Glisser-déposer : carte « soulevée », place d'origine estompée, case visée éclairée ---
    const [draggingId, setDraggingId] = useState(null);
    const [dropCell, setDropCell] = useState(null);
    const startDrag = (e, evt) => {
        const card = e.currentTarget;
        try {
            const r = card.getBoundingClientRect();
            const wrap = document.createElement('div');
            wrap.style.cssText = 'position:fixed;top:-2000px;left:-2000px;padding:16px;pointer-events:none;';
            const ghost = card.cloneNode(true);
            ghost.style.cssText += `;position:relative;inset:auto;top:auto;left:auto;width:${r.width}px;height:${r.height}px;opacity:1;transform:rotate(-2deg) scale(1.04);box-shadow:0 12px 26px rgba(17,24,39,0.24),0 2px 6px rgba(17,24,39,0.12);`;
            wrap.appendChild(ghost);
            document.body.appendChild(wrap);
            e.dataTransfer.setDragImage(wrap, e.clientX - r.left + 16, e.clientY - r.top + 16);
            setTimeout(() => wrap.remove(), 0);
        } catch { /* image de glisser par défaut */ }
        e.dataTransfer.effectAllowed = 'move';
        setDraggingId(evt.meta?.seriesId || evt.id);
        onDragStart(e, evt);
    };
    const endDrag = () => { setDraggingId(null); setDropCell(null); };
    // Le créneau déplacé quitte sa case au dépôt : son « dragend » n'arrive alors jamais.
    // On termine donc le glisser sur n'importe quel dépôt ou fin de glisser de la page.
    useEffect(() => {
        if (!draggingId && !dropCell) return;
        const clear = () => { setDraggingId(null); setDropCell(null); };
        document.addEventListener('drop', clear, true);
        document.addEventListener('dragend', clear, true);
        return () => {
            document.removeEventListener('drop', clear, true);
            document.removeEventListener('dragend', clear, true);
        };
    }, [draggingId, dropCell]);
    const isDragged = (evt) => draggingId && (evt.id === draggingId || evt.meta?.seriesId === draggingId);
    const findEvent = (id) => (allEvents || events).find(ev => ev.id === id);

    const MIN_WIDTH = view === 'year' ? 80 : (view === 'quarter' || view === 'month' ? 40 : 120);

    const [dragTarget, setDragTarget] = useState(null); // { id: string, pos: 'left' | 'right' }

    const renderEventsForCell = (memberId, dayDate) => {
        // Filtrer les événements pour ce jour et cette ressource
        // Jour de fermeture : les absences individuelles (congés, RTT…) ne sont pas
        // affichées, le grisé « Fermeture · … » suffit. Elles restent en base.
        const closedDay = view !== 'year' && closureOfDay(format(dayDate, 'yyyy-MM-dd'));
        const dayEvents = events.filter(e =>
            e.resourceId === memberId &&
            isSameDay(parseISO(e.date), dayDate) &&
            !(closedDay && e.type === 'absence')
        );

        if (dayEvents.length === 0) return null;

        const isBacklog = memberId === 'backlog_confection';

        // --- MODE DURÉE : conf & prepa (hors backlog) ---
        // Si tous les events du jour ont durationHours OU si le type est conf/prepa
        const isHourMode = !isBacklog && dayEvents.every(e => e.type === 'conf' || e.type === 'prepa');

        if (isHourMode) {
            // Trier par ordre d'insertion (createdAt, ou start en fallback pour les anciens events)
            const sorted = [...dayEvents].sort((a, b) => {
                const ta = a.meta?.createdAt || a.meta?.start || '';
                const tb = b.meta?.createdAt || b.meta?.start || '';
                return ta < tb ? -1 : ta > tb ? 1 : 0;
            });

            const totalDh = sorted.reduce((sum, e) => sum + (e.meta?.durationHours ?? ATELIER_HOURS_PER_DAY), 0);
            const baseDh = Math.max(ATELIER_HOURS_PER_DAY, totalDh); // 7,8h = largeur de référence d'une journée atelier

            return (
                <div key="hour-mode-wrapper" style={{
                    position: 'absolute', inset: '4px 2px',
                    display: 'flex', gap: 2, overflow: 'hidden'
                }}>
                    {sorted.map(evt => {
                        const dh = evt.meta?.durationHours ?? ATELIER_HOURS_PER_DAY;
                        const widthPct = (dh / baseDh) * 100;
                        const evtStyle = getProjectColor(evt.meta?.projectId) || PLANNING_COLORS[evt.type] || PLANNING_COLORS.default;
                        const isValidated = evt.meta?.status === 'validated';
                        const isHighlighted = highlightProjectId && evt.meta?.projectId === highlightProjectId;

                        return (
                            <div
                                key={evt.id}
                                draggable={!readOnly}
                                onMouseEnter={() => onHoverEvent && onHoverEvent(evt.id)}
                                onMouseLeave={() => onHoverEvent && onHoverEvent(null)}
                                onDragStart={(e) => startDrag(e, evt)}
                                onDragEnd={endDrag}
                                className={landedIds?.has(evt.id) ? 'df-landed' : undefined}
                                onClick={(e) => { e.stopPropagation(); onEventClick(evt); }}
                                title={`${evt.title} — ${dh}h`}
                                style={{
                                    width: `${widthPct}%`,
                                    flexShrink: 0,
                                    height: '100%',
                                    backgroundColor: evtStyle.bg,
                                    borderTop: `1px ${isValidated ? 'solid' : 'dashed'} ${evtStyle.border}`,
                                    borderRight: `1px ${isValidated ? 'solid' : 'dashed'} ${evtStyle.border}`,
                                    borderBottom: `1px ${isValidated ? 'solid' : 'dashed'} ${evtStyle.border}`,
                                    borderLeft: `4px solid ${evtStyle.border}`,
                                    borderRadius: 6,
                                    padding: '2px 4px',
                                    overflow: 'hidden',
                                    cursor: 'grab',
                                    opacity: isDragged(evt) ? 0.3 : (isHighlighted ? 1 : (isValidated ? 1 : 0.9)),
                                    transition: 'opacity .15s ease',
                                    outline: isHighlighted ? '2px solid #111827' : 'none',
                                    outlineOffset: isHighlighted ? '1px' : 0,
                                    zIndex: isHighlighted ? 5 : 'auto',
                                    boxShadow: isHighlighted ? '0 0 0 3px rgba(17,24,39,0.15)' : '0 1px 2px rgba(0,0,0,0.1)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    position: 'relative',
                                    minWidth: 0
                                }}
                            >
                                <div style={{ fontSize: 11, fontWeight: isValidated ? 700 : 500, color: evtStyle.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {evt.title}
                                </div>
                                {evt.meta?.description && (
                                    <div style={{ fontSize: 10, fontStyle: 'italic', color: evtStyle.text, opacity: 0.65, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {evt.meta.description.split('\n')[0]}
                                    </div>
                                )}
                                {isValidated && (
                                    <CheckCircle size={10} color={evtStyle.text} style={{ position: 'absolute', bottom: 2, right: 2 }} />
                                )}
                            </div>
                        );
                    })}
                </div>
            );
        }

        // --- MODE STANDARD : pose, absences, backlog ---
        // Empilement des créneaux qui se chevauchent dans le temps : chaque créneau
        // reçoit une "lane" (rangée) au sein de son groupe de chevauchement, pour
        // qu'aucun créneau n'en masque un autre.
        const slotMinutes = (e) => {
            if (!e.meta?.start || !e.meta?.end) return [0, TOTAL_WORK_MINUTES];
            if (isNightEvent(e)) return nightRange(e);
            const s = new Date(e.meta.start);
            const en = new Date(e.meta.end);
            const sMin = Math.max(0, getHours(s) * 60 + getMinutes(s) - WORK_START_HOUR * 60);
            const eMin = Math.max(sMin + 1, Math.min(TOTAL_WORK_MINUTES, getHours(en) * 60 + getMinutes(en) - WORK_START_HOUR * 60));
            return [sMin, eMin];
        };
        const sortedDayEvents = [...dayEvents].sort((a, b) => slotMinutes(a)[0] - slotMinutes(b)[0] || slotMinutes(b)[1] - slotMinutes(a)[1]);
        const eventLayout = new Map(); // evt.id -> { lane, cluster }
        const clusterLaneCounts = [];
        let laneEnds = [];
        let clusterEnd = -1;
        sortedDayEvents.forEach(e => {
            const [s, en] = slotMinutes(e);
            if (s >= clusterEnd) { laneEnds = []; clusterLaneCounts.push(0); }
            clusterEnd = Math.max(clusterEnd, en);
            let lane = laneEnds.findIndex(end => end <= s);
            if (lane === -1) { lane = laneEnds.length; laneEnds.push(en); } else { laneEnds[lane] = en; }
            const cluster = clusterLaneCounts.length - 1;
            clusterLaneCounts[cluster] = Math.max(clusterLaneCounts[cluster], laneEnds.length);
            eventLayout.set(e.id, { lane, cluster });
        });

        return sortedDayEvents.map(evt => {
            const style = evt.type === 'absence'
                ? PLANNING_COLORS.absence
                : (getProjectColor(evt.meta?.projectId) || PLANNING_COLORS[evt.type] || PLANNING_COLORS.default);
            const isValidated = evt.meta?.status === 'validated';
            const fontWeight = isBacklog ? 800 : (isValidated ? 700 : 500);
            const opacity = isValidated || isBacklog ? 1 : 0.9;
            const isHighlighted = highlightProjectId && evt.meta?.projectId === highlightProjectId;

            // --- BACKLOG SPECIFIC LOGIC ---
            let plannedHours = 0;
            let totalHours = 0;
            let childEvents = [];

            if (isBacklog) {
                let viewStart = new Date();
                let viewEnd = new Date();

                if (typeof gridCols !== 'undefined' && gridCols && gridCols.length > 0) {
                    viewStart = startOfDay(gridCols[0]);
                    const lastCol = gridCols[gridCols.length - 1];
                    viewEnd = view === 'year'
                        ? endOfMonth(lastCol)
                        : new Date(lastCol.getFullYear(), lastCol.getMonth(), lastCol.getDate(), 23, 59, 59);
                }

                childEvents = events.filter(e => {
                    if (e.resourceId === 'backlog_confection') return false;
                    let isMatch = false;
                    if (evt.meta?.projectId && e.meta?.projectId) {
                        isMatch = e.meta.projectId === evt.meta.projectId;
                    } else {
                        const normalize = s => s ? s.toLowerCase().trim() : '';
                        isMatch = normalize(e.title) === normalize(evt.title);
                    }
                    if (!isMatch) return false;
                    const eventStart = new Date(e.meta?.start || e.date);
                    const eventEnd = new Date(e.meta?.end || e.date);
                    return (eventStart < viewEnd && eventEnd > viewStart);
                });

                const minutes = childEvents.reduce((acc, child) => {
                    // Priorité : utiliser durationHours si disponible (conf/prepa)
                    if (child.meta?.durationHours != null) {
                        return acc + child.meta.durationHours * 60;
                    }
                    const s = new Date(child.meta.start);
                    const e = new Date(child.meta.end);
                    let duration = differenceInMinutes(e, s);
                    const lunchStart = new Date(s); lunchStart.setHours(12, 0, 0, 0);
                    const lunchEnd = new Date(s); lunchEnd.setHours(13, 0, 0, 0);
                    if (s < lunchStart && e > lunchEnd) {
                        duration -= 60;
                    } else if (s < lunchEnd && e > lunchStart) {
                        const overlapStart = s < lunchStart ? lunchStart : s;
                        const overlapEnd = e > lunchEnd ? lunchEnd : e;
                        if (overlapStart < overlapEnd) {
                            duration -= differenceInMinutes(overlapEnd, overlapStart);
                        }
                    }
                    return acc + Math.max(0, duration);
                }, 0);

                plannedHours = Math.round(minutes / 60);

                if (evt.meta?.budgetHours) {
                    totalHours = evt.meta.budgetHours;
                } else {
                    const masterS = new Date(evt.meta.start);
                    const masterE = new Date(evt.meta.end);
                    totalHours = Math.round(differenceInMinutes(masterE, masterS) / 60);
                }
            }

            const startStr = evt.meta?.start ? format(new Date(evt.meta.start || evt.date), 'HH:mm') : '08:00';
            const endStr = evt.meta?.end ? format(new Date(evt.meta.end || evt.date), 'HH:mm') : '17:00';
            const labelTime = `${startStr}-${endStr}`;

            // Calcul Position Horizontale (mode créneau)
            let leftPercent = 0;
            let widthPercent = 100;

            if (evt.meta?.start && evt.meta?.end && isNightEvent(evt)) {
                const [a, b] = nightRange(evt);
                leftPercent = (a / TOTAL_WORK_MINUTES) * 100;
                widthPercent = ((b - a) / TOTAL_WORK_MINUTES) * 100;
            } else if (evt.meta?.start && evt.meta?.end) {
                const s = new Date(evt.meta.start);
                const e = new Date(evt.meta.end);
                const sMinutes = getHours(s) * 60 + getMinutes(s);
                const startWorkMinutes = 8 * 60;
                const relativeStart = Math.max(0, sMinutes - startWorkMinutes);
                leftPercent = (relativeStart / TOTAL_WORK_MINUTES) * 100;
                const duration = Math.min(TOTAL_WORK_MINUTES, Math.max(0, differenceInMinutes(e, s)));
                widthPercent = (duration / TOTAL_WORK_MINUTES) * 100;
            }

            // La barre de la carte = avancement de CONSOMMATION du projet sur son budget
            // vendu (consommé / budget). Rouge dès qu'on dépasse le budget.
            const cardProg = projectHoursById[evt.meta?.projectId];
            const cardConsumed = cardProg ? Math.round(cardProg.consumed.conf) : 0;
            const cardBudget = cardProg ? Math.round(cardProg.budget.conf) : 0;
            const cardPct = cardBudget > 0 ? (cardConsumed / cardBudget) * 100 : 0;

            const renderBacklogContent = () => (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <span style={{ fontWeight: 800, fontSize: 11 }}>{evt.title}</span>
                        <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.8)', padding: '1px 4px', borderRadius: 4, color: cardPct > 100 ? '#B91C1C' : undefined }}>
                            {cardConsumed}h / {cardBudget}h
                        </span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'rgba(0,0,0,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(cardPct, 100)}%`, background: cardPct > 100 ? '#EF4444' : '#10B981', height: '100%' }} />
                    </div>
                </div>
            );

            const { lane = 0, cluster = 0 } = eventLayout.get(evt.id) || {};
            const laneCount = clusterLaneCounts[cluster] || 1;

            return (
                <div key={evt.id} draggable={!readOnly && !isBacklog}
                    onMouseEnter={() => onHoverEvent && onHoverEvent(evt.id)}
                    onMouseLeave={() => onHoverEvent && onHoverEvent(null)}
                    onDragStart={(e) => startDrag(e, evt)}
                    onDragEnd={endDrag}
                    className={landedIds?.has(evt.id) ? 'df-landed' : undefined}
                    onClick={(e) => { e.stopPropagation(); onEventClick(evt); }}
                    title={isBacklog ? `ID:${evt.id} | Enfants:${childEvents.length} | Backlog: ${plannedHours}h / ${totalHours}h planifié` : `${evt.title} (${labelTime})`}
                    style={{
                        position: 'absolute',
                        top: `calc(${(lane / laneCount) * 100}% + 3px)`,
                        height: `calc(${100 / laneCount}% - 6px)`,
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                        backgroundColor: isBacklog ? '#FFF1F2' : style.bg,
                        borderTop: `1px ${!isBacklog && !isValidated ? 'dashed' : 'solid'} ${isBacklog ? '#BE123C' : style.border}`,
                        borderRight: `1px ${!isBacklog && !isValidated ? 'dashed' : 'solid'} ${isBacklog ? '#BE123C' : style.border}`,
                        borderBottom: `1px ${!isBacklog && !isValidated ? 'dashed' : 'solid'} ${isBacklog ? '#BE123C' : style.border}`,
                        borderLeft: `4px solid ${isBacklog ? '#BE123C' : style.border}`,
                        borderRadius: 8,
                        zIndex: isHighlighted ? 30 : (evt.meta?.seriesId ? 20 : 10),
                        padding: '2px 4px',
                        overflow: 'hidden',
                        cursor: 'grab',
                        opacity: isDragged(evt) ? 0.3 : (isHighlighted ? 1 : opacity),
                        transition: 'opacity .15s ease',
                        outline: isHighlighted ? '2px solid #111827' : 'none',
                        outlineOffset: isHighlighted ? '1px' : 0,
                        boxShadow: isHighlighted ? '0 0 0 3px rgba(17,24,39,0.15)' : '0 1px 2px rgba(0,0,0,0.1)',
                        backgroundImage: isBacklog
                            ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(190, 18, 60, 0.05) 10px, rgba(190, 18, 60, 0.05) 20px)'
                            : (style.pattern ? 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.05) 5px, rgba(0,0,0,0.05) 10px)' : 'none')
                    }}
                >
                    {isBacklog ? renderBacklogContent() : (
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', gap: 1, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, overflow: 'hidden' }}>
                                {isNightEvent(evt) && <Moon size={12} color={style.text} style={{ flexShrink: 0 }} aria-label="Intervention de nuit" />}
                                {evt.meta?.decouche && <BedDouble size={12} color={style.text} style={{ flexShrink: 0 }} aria-label="Découché — nuit sur place" />}
                                <div style={{ fontSize: 11, fontWeight: fontWeight, color: style.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {evt.title}
                                </div>
                            </div>
                            {/* Heures début-fin : uniquement pour la pose (conf/prepa raisonnent en durée) */}
                            {evt.meta?.start && evt.meta?.end && evt.type !== 'conf' && evt.type !== 'prepa' && (
                                <div style={{ fontSize: 10, fontWeight: 500, color: style.text, opacity: 0.75, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>
                                    {labelTime}
                                </div>
                            )}
                            {evt.meta?.description && (
                                <div style={{ fontSize: 10, fontStyle: 'italic', color: style.text, opacity: 0.65, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>
                                    {evt.meta.description.split('\n')[0]}
                                </div>
                            )}
                        </div>
                    )}
                    {!isBacklog && isValidated && (
                        <CheckCircle size={10} color={style.text} style={{ position: 'absolute', bottom: 2, right: 2 }} />
                    )}
                </div>
            );
        });
    };

    // Helper to access latest events in loop if needed, but here we pass events prop
    const localEventsRef = (evts) => evts;

    if (isVertical) {
        const V_START = 6;
        const V_END = 19;
        const hourHeight = 60;
        const totalHeight = (V_END - V_START) * 60;

        return (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'white' }}>
                {/* Header Dates */}
                <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', paddingLeft: 60 }}>
                    {gridCols.map(col => (
                        <div key={col.toString()} style={{ flex: 1, textAlign: 'center', padding: '12px', fontFamily: ROBOTO, fontWeight: 500, fontSize: 14, color: '#374151', textTransform: 'capitalize' }}>
                            {format(col, 'EEEE d', { locale: fr })}
                        </div>
                    ))}
                </div>

                {/* Body */}
                <div className="df-noscrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', position: 'relative' }}>
                    {/* Time Sidebar */}
                    <div style={{ width: 60, flexShrink: 0, borderRight: '1px solid #E5E7EB', background: '#F4F4F4' }}>
                        {Array.from({ length: V_END - V_START + 1 }).map((_, i) => (
                            <div key={i} style={{ height: hourHeight, borderBottom: '1px solid #E5E7EB', position: 'relative', overflow: 'visible' }}>
                                <span style={{ position: 'absolute', top: -10, right: 8, fontSize: 11, color: '#9CA3AF', background: '#F4F4F4', padding: '0 4px', zIndex: 10 }}>
                                    {V_START + i}:00
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Day Columns */}
                    {gridCols.map(col => (
                        <div key={col.toString()} style={{ flex: 1, borderRight: '1px solid #E5E7EB', position: 'relative', height: totalHeight, minHeight: totalHeight }}>
                            {/* Grid Lines */}
                            {Array.from({ length: V_END - V_START }).map((_, i) => (
                                <div key={i} style={{ position: 'absolute', top: (i + 1) * hourHeight, left: 0, right: 0, borderTop: '1px solid #F3F4F6', pointerEvents: 'none' }} />
                            ))}

                            {/* Events */}
                            {(() => {
                                const colEvents = Object.values(filteredGroups).flatMap(g => g.members)
                                    .flatMap(member => events.filter(e => e.resourceId === member.id && isSameDay(parseISO(e.date), col)));

                                // Répartition en colonnes (lanes) des créneaux qui se chevauchent
                                const vSlot = (e) => {
                                    const s = new Date(e.meta?.start || e.date);
                                    const en = new Date(e.meta?.end || e.date);
                                    const sMin = getHours(s) * 60 + getMinutes(s);
                                    return [sMin, Math.max(sMin + 15, getHours(en) * 60 + getMinutes(en))];
                                };
                                const sortedColEvents = [...colEvents].sort((a, b) => vSlot(a)[0] - vSlot(b)[0] || vSlot(b)[1] - vSlot(a)[1]);
                                const vLayout = new Map();
                                const vClusterLanes = [];
                                let vLaneEnds = [];
                                let vClusterEnd = -1;
                                sortedColEvents.forEach(e => {
                                    const [s, en] = vSlot(e);
                                    if (s >= vClusterEnd) { vLaneEnds = []; vClusterLanes.push(0); }
                                    vClusterEnd = Math.max(vClusterEnd, en);
                                    let lane = vLaneEnds.findIndex(end => end <= s);
                                    if (lane === -1) { lane = vLaneEnds.length; vLaneEnds.push(en); } else { vLaneEnds[lane] = en; }
                                    const cluster = vClusterLanes.length - 1;
                                    vClusterLanes[cluster] = Math.max(vClusterLanes[cluster], vLaneEnds.length);
                                    vLayout.set(e.id, { lane, cluster });
                                });

                                return sortedColEvents.map(evt => {
                                    const style = evt.type === 'absence'
                                        ? PLANNING_COLORS.absence
                                        : (getProjectColor(evt.meta?.projectId) || PLANNING_COLORS[evt.type] || PLANNING_COLORS.default);
                                    const start = new Date(evt.meta?.start || evt.date);
                                    const end = new Date(evt.meta?.end || evt.date);

                                    const sMinutes = getHours(start) * 60 + getMinutes(start);
                                    const eMinutes = getHours(end) * 60 + getMinutes(end);
                                    const startWorkMinutes = V_START * 60;

                                    const top = Math.max(0, sMinutes - startWorkMinutes);
                                    const duration = Math.max(15, eMinutes - sMinutes);
                                    const { lane = 0, cluster = 0 } = vLayout.get(evt.id) || {};
                                    const laneCount = vClusterLanes[cluster] || 1;

                                    return (
                                        <div key={evt.id}
                                            onClick={(e) => { e.stopPropagation(); onEventClick(evt); }}
                                            style={{
                                                position: 'absolute',
                                                top: top,
                                                height: duration,
                                                left: `calc(${(lane / laneCount) * 100}% + 4px)`,
                                                width: `calc(${100 / laneCount}% - 8px)`,
                                                background: style.bg,
                                                border: `1px solid ${style.border}`,
                                                borderLeft: `4px solid ${style.border}`,
                                                borderRadius: 4,
                                                padding: '4px 8px',
                                                fontSize: 12,
                                                color: style.text,
                                                cursor: 'pointer',
                                                overflow: 'hidden',
                                                zIndex: 10,
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                            }}
                                        >
                                            <div style={{ fontWeight: 700 }}>{evt.title}</div>
                                            <div>{format(start, 'HH:mm')} - {format(end, 'HH:mm')}</div>
                                            {evt.meta?.description && <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>{evt.meta.description}</div>}
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // --- UTILS CALCULATION ---
    // Heures contractuelles/jour par membre : 7,8h atelier (conf/prepa), 8h ailleurs
    const memberDailyHours = useMemo(() => {
        const map = {};
        Object.entries(filteredGroups).forEach(([key, group]) => {
            const h = dailyHoursForGroup(key);
            group.members.forEach(m => { map[m.id] = h; });
        });
        return map;
    }, [filteredGroups]);
    // (calcul simple, pas un hook : ce bloc vient après un return anticipé)
    const memberById = {};
    Object.values(filteredGroups).forEach(g => g.members.forEach(m => { memberById[m.id] = m; }));
    // Jour fermé (fermeture de l'entreprise) — même règle que la vue Capacité.
    const closureOfDay = (dayStr) => closures.find(c => {
        const s = c.meta?.start ? format(new Date(c.meta.start), 'yyyy-MM-dd') : c.date;
        const e = c.meta?.end ? format(new Date(c.meta.end), 'yyyy-MM-dd') : s;
        return s && s <= dayStr && e >= dayStr;
    });
    const isClosedDay = (dayStr) => !!closureOfDay(dayStr);
    // Fermeture d'une colonne jour (rien en vue année : colonnes = mois).
    const closureOfCol = (col) => (view === 'year' ? null : closureOfDay(format(col, 'yyyy-MM-dd')));
    // Libellé d'une fermeture : posé sur la première colonne de la période visible,
    // étalé sur toutes ses colonnes. Renvoie { closure, span } ou null.
    const closureLabelAt = (colIndex) => {
        const closure = closureOfCol(gridCols[colIndex]);
        if (!closure) return null;
        if (colIndex > 0 && closureOfCol(gridCols[colIndex - 1])?.id === closure.id) return null;
        let span = 1;
        while (colIndex + span < gridCols.length && closureOfCol(gridCols[colIndex + span])?.id === closure.id) span++;
        return { closure, span };
    };
    const CLOSED_BG = 'repeating-linear-gradient(135deg, rgba(17,24,39,0.06) 0 1px, transparent 1px 8px), #F4F4F4';
    // Capacité d'un jour : heures contractuelles des membres sous contrat ce jour-là,
    // 0 le week-end et les jours de fermeture (alignée sur la vue Capacité).
    const dayCapacity = (memberIds, day) => {
        if (isWeekend(day)) return 0;
        const dayStr = format(day, 'yyyy-MM-dd');
        if (isClosedDay(dayStr)) return 0;
        return memberIds
            .filter(id => id !== 'backlog_confection')
            .filter(id => !memberById[id] || isMemberActiveOnDay(memberById[id], dayStr))
            .reduce((sum, id) => sum + (memberDailyHours[id] ?? DEFAULT_DAILY_HOURS), 0);
    };

    // Avancement (consommé / budget) par projet — source unique partagée avec le
    // dossier. Sert aux barres des cartes du Programme semaine.
    const projectHoursById = useMemo(() => {
        if (projectHours) return projectHours;
        const map = {};
        (projects || []).forEach(p => { map[p.id] = computeProjectHours(p, events); });
        return map;
    }, [projects, events, projectHours]);

    const getStats = (memberIds, dateRange, allEvents) => {
        let totalAbsenceHours = 0;
        let totalLoadHours = 0;
        let theoreticalCapacity = 0;
        let activeMemberCount = 0;

        // On peut optimiser en ne faisant le calcul que si memberIds > 0
        if (memberIds.length === 0) return { load: 0, cap: 0, percent: 0 };

        dateRange.forEach(col => {
            const isMonthColumn = view === 'year';
            const colStart = isMonthColumn ? startOfMonth(col) : startOfDay(col);
            const colEnd = isMonthColumn ? endOfMonth(col) : new Date(col.getFullYear(), col.getMonth(), col.getDate(), 23, 59, 59);

            // Capacité de la colonne (jour ou mois) : jour par jour, sans week-ends ni jours
            // de fermeture, membres sous contrat seulement. Avant : toute la semaine était
            // comptée ouverte (ex. fermeture du 15/12 ignorée → 390h affichées au lieu de 78h).
            const colDays = isMonthColumn ? eachDayOfInterval({ start: colStart, end: colEnd }) : [colStart];
            colDays.forEach(d => { theoreticalCapacity += dayCapacity(memberIds, d); });
        });

        activeMemberCount = memberIds.length;

        // Loop events once? Or per member?
        // Using existing logic structure: per event check is safest given data structure
        allEvents.forEach(evt => {
            if (!memberIds.includes(evt.resourceId)) return;
            // EXCLUDE BACKLOG FROM LOAD
            if (evt.resourceId === 'backlog_confection') return;

            // Check if event intersects with ANY of the dateRange?
            // Actually, we process ALL events against ALL columns? That's O(N*M).
            // Better: loop events, calculate duration within the total range defined by columns[0] and columns[end].
            // BUT: weekends must be excluded from calculation if 'theoreticalCapacity' excludes them?
            // Yes, theoreticalCapacity excludes weekends.
            // So if an event spans a weekend, does it count as load? 
            // In the grid cell loop, we iterate by column, so weekend columns (if hidden) are skipped.
            // If shown, they might have 0 capacity (if workDaysCount=0 for weekend).
            // Let's stick to the column iteration method to be consistency with detailed cells.

            dateRange.forEach(col => {
                const isMonthColumn = view === 'year';
                const colStart = isMonthColumn ? startOfMonth(col) : startOfDay(col);
                const colEnd = isMonthColumn ? endOfMonth(col) : new Date(col.getFullYear(), col.getMonth(), col.getDate(), 23, 59, 59);

                // Quick check bounds
                const evtS = new Date(evt.meta?.start || evt.date);
                const evtE = new Date(evt.meta?.end || evt.date);
                if (evtE <= colStart || evtS >= colEnd) return;


                const interStart = evtS < colStart ? colStart : evtS;
                const interEnd = evtE > colEnd ? colEnd : evtE;
                const rawDurationMinutes = differenceInMinutes(interEnd, interStart);

                let effectiveMinutes = rawDurationMinutes;
                if (!isMonthColumn) {
                    const lunchStart = new Date(colStart); lunchStart.setHours(12, 0, 0, 0);
                    const lunchEnd = new Date(colStart); lunchEnd.setHours(13, 0, 0, 0);
                    const lStart = interStart < lunchStart ? lunchStart : interStart;
                    const lEnd = interEnd > lunchEnd ? lunchEnd : interEnd;
                    if (lStart < lEnd) effectiveMinutes -= differenceInMinutes(lEnd, lStart);
                }

                const hours = effectiveMinutes / 60;
                const isAbsence = ['Congés', 'RTT', 'Maladie', 'Autre', 'absence'].includes(evt.type) || ['Congés', 'RTT', 'Maladie', 'Autre'].includes(evt.title);

                // Absence un jour déjà sans capacité (fermeture, week-end) : rien à retirer.
                if (isAbsence) { if (isMonthColumn || dayCapacity(memberIds, colStart) > 0) totalAbsenceHours += hours; }
                else totalLoadHours += hours;
            });
        });

        const realCapacity = Math.max(0, theoreticalCapacity - totalAbsenceHours);
        const percent = realCapacity > 0 ? (totalLoadHours / realCapacity) * 100 : 0;

        return { load: totalLoadHours, cap: realCapacity, percent };
    };

    // Affiche les heures avec au plus 1 décimale (7,8 reste 7,8, 78 reste 78)
    const fmtHours = (n) => {
        const r = Math.round(n * 10) / 10;
        return Number.isInteger(r) ? `${r}` : `${r}`.replace('.', ',');
    };

    // Helper to render a Gauge Cell
    const renderGaugeCell = (load, cap, percent, keyPrefix) => {
        let barColor = '#10B981';
        if (percent >= 80) barColor = '#F59E0B';
        if (percent > 100) barColor = '#EF4444';

        return (
            <div key={keyPrefix} style={{
                borderRight: '1px solid #E5E7EB',
                borderBottom: '1px solid #E5E7EB',
                background: 'transparent',
                height: ROW_HEIGHT,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '0 8px'
            }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{fmtHours(load)}h <span style={{ color: '#9CA3AF', fontWeight: 400 }}>/ {fmtHours(cap)}h</span></span>
                </div>
                <div style={{ width: '100%', height: 6, background: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(percent, 100)}%`, height: '100%', background: barColor, transition: 'width 0.3s ease' }} />
                </div>
            </div>
        );
    };


    return (
        <div style={embedded ? { padding: '0 24px' } : { flex: 1, overflow: 'hidden', padding: '0 24px 24px', display: 'flex', flexDirection: 'column' }}>
            <div className="df-noscrollbar" style={embedded
                // overflow « clip » : coupe les cases aux coins arrondis sans créer de zone de défilement
                // (les en-têtes restent collants dans la zone de défilement commune).
                ? { background: 'white', border: '1px solid #E0DED9', borderRadius: 12, position: 'relative', overflow: 'clip' }
                : { height: 'fit-content', maxHeight: '100%', overflow: 'auto', background: 'white', border: '1px solid #E0DED9', borderRadius: 12, position: 'relative' }}>
                <style>{`
                    @keyframes dfLand { 0% { transform: scale(0.88); box-shadow: 0 12px 26px rgba(17,24,39,0.24); } 60% { transform: scale(1.04); } 100% { transform: scale(1); } }
                    .df-landed { animation: dfLand .38s cubic-bezier(.2,.8,.3,1.2); }
                    @media (prefers-reduced-motion: reduce) { .df-landed { animation: none; } }
                `}</style>
                {isPast && (
                    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 35, pointerEvents: 'none', borderRadius: 12, background: 'repeating-linear-gradient(135deg, rgba(17,24,39,0.045) 0 1px, transparent 1px 9px), rgba(244,244,244,0.35)' }} />
                )}
                <div style={{ display: 'grid', gridTemplateColumns: `260px repeat(${gridCols.length}, minmax(${MIN_WIDTH}px, 1fr))`, gridAutoRows: 'max-content', width: (view === 'year' || view === 'quarter' || view === 'month') ? 'max-content' : '100%', minWidth: '100%' }}>
                    {!cornerLabel && <StickyCorner style={{ top: stickyTop, height: HEADER_HEIGHT_1, borderBottom: 'none' }} />}
                    {!cornerLabel && superHeaders.map((header, i) => (<div key={i} style={{ gridColumn: `span ${header.span}`, position: 'sticky', top: stickyTop, zIndex: 40, background: 'white', borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: ROBOTO, fontSize: 13, fontWeight: 500, color: '#6B7280' }}>{header.label}</div>))}
                    <StickyCorner style={{ top: cornerLabel ? stickyTop : stickyTop + HEADER_HEIGHT_1, height: HEADER_HEIGHT_2, fontFamily: ROBOTO, fontWeight: 500, fontSize: 14, ...(cornerLabel && { background: '#F4F4F4' }) }}>
                        {cornerLabel}
                        {cornerLabel && isPast && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: '#9CA3AF' }}>passée</span>}
                    </StickyCorner>
                    {gridCols.map(col => {
                        // Jour actuel : pastille bleu nuit de la charte autour du libellé.
                        const today = view !== 'year' && isSameDay(col, new Date());
                        const closure = closureOfCol(col);
                        return (
                            <StickyTopCell key={col.toString()} style={{ top: cornerLabel ? stickyTop : stickyTop + HEADER_HEIGHT_1, height: HEADER_HEIGHT_2, background: cornerLabel ? '#F4F4F4' : 'white', color: closure ? '#9CA3AF' : '#4B5563' }}>
                                {today
                                    ? <span style={{ background: '#1E2447', color: 'white', borderRadius: 99, padding: '4px 12px', fontWeight: 600 }}>{getCellContent(col)}</span>
                                    : getCellContent(col)}
                            </StickyTopCell>
                        );
                    })}

                    {Object.entries(filteredGroups).map(([key, group]) => {
                        const activeMembers = group.members.filter(m => !hiddenResources.includes(m.id));
                        // Calc Global Stats for Header
                        const groupStats = getStats(activeMembers.map(m => m.id), gridCols, events);

                        return (
                            <React.Fragment key={key}>
                                {hideGroupLabel ? (showGauges && (
                                    <>
                                        <StickyLeftCell style={{ fontFamily: ROBOTO, fontWeight: 500, fontSize: 13, color: '#6B7280', paddingLeft: 42 }}>
                                            <div style={{ flex: 1 }}>Charge</div>
                                            <div style={{ fontSize: 11, fontWeight: 600, color: groupStats.percent > 100 ? '#EF4444' : '#6B7280', background: '#F4F4F4', padding: '2px 6px', borderRadius: 4 }}>
                                                {Math.round(groupStats.percent)}%
                                            </div>
                                        </StickyLeftCell>
                                        {gridCols.map(col => {
                                            const cellStats = getStats(activeMembers.map(m => m.id), [col], events);
                                            return renderGaugeCell(cellStats.load, cellStats.cap, cellStats.percent, col.toString());
                                        })}
                                    </>
                                )) : (<>
                                <StickyLeftCell onClick={() => onToggleGroup(key)} bg={group.bg} style={{ fontFamily: ROBOTO, fontWeight: 500, fontSize: 17, color: '#111827' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                        {expandedGroups[key] > 0 ? <ChevronDown size={14} style={{ marginRight: 8 }} /> : <ChevronRightIcon size={14} style={{ marginRight: 8 }} />}
                                        {group.label}
                                    </div>
                                    {showGauges && (
                                        <div style={{ fontSize: 11, fontWeight: 600, color: groupStats.percent > 100 ? '#EF4444' : '#6B7280', background: 'rgba(255,255,255,0.5)', padding: '2px 6px', borderRadius: 4 }}>
                                            {Math.round(groupStats.percent)}%
                                        </div>
                                    )}
                                </StickyLeftCell>

                                {/* LIGNE DE CAPACITÉ (Jauges) */}
                                {gridCols.map(col => {
                                    if (!showGauges) {
                                        return (
                                            <div key={col.toString()} style={{
                                                borderRight: '1px solid #E5E7EB',
                                                borderBottom: '1px solid #E5E7EB',
                                                background: group.bg,
                                                height: ROW_HEIGHT
                                            }} />
                                        );
                                    }
                                    // Reuse calculation per cell
                                    const cellStats = getStats(activeMembers.map(m => m.id), [col], events);
                                    return (
                                        <div key={col.toString()} style={{ background: group.bg }}>
                                            {renderGaugeCell(cellStats.load, cellStats.cap, cellStats.percent, col.toString())}
                                        </div>
                                    )
                                })}
                                </>)}

                                {expandedGroups[key] > 0 && group.members
                                .filter(member => expandedGroups[key] >= 2 || member.id === 'backlog_confection')
                                .map((member, _i, shown) => (
                                    <React.Fragment key={member.id}>
                                        <StickyLeftCell style={{ paddingLeft: 42, color: member.id === 'backlog_confection' ? '#BE123C' : '#4B5563', fontWeight: 500, display: 'flex', ...(member.id === 'backlog_confection'
                                            ? { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 4, fontFamily: ROBOTO, minHeight: PROGRAMME_ROW_HEIGHT, height: 'auto', alignSelf: 'stretch' }
                                            : { justifyContent: 'space-between', alignItems: 'center', height: ROW_HEIGHT }) }}>
                                            {member.id === 'backlog_confection' ? (
                                                <>
                                                    {/* Titre aligné sur les prénoms ; la flèche se place à sa gauche */}
                                                    <span style={{ position: 'relative', fontSize: 14 }}>
                                                        <span
                                                            onClick={(e) => { e.stopPropagation(); onToggleMembers?.(key); }}
                                                            title={expandedGroups[key] >= 2 ? 'Masquer la répartition par personne' : 'Afficher la répartition par personne'}
                                                            style={{ position: 'absolute', left: -20, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
                                                        >
                                                            {expandedGroups[key] >= 2 ? <ChevronDown size={14} /> : <ChevronRightIcon size={14} />}
                                                        </span>
                                                        Programme
                                                    </span>
                                                    <span style={{ fontSize: 13, color: '#6B7280' }}>
                                                        {(() => {
                                                            const weeks = [...new Set(gridCols.map(c => getISOWeek(c)))];
                                                            return weeks.length > 1 ? `Semaines ${weeks[0]} – ${weeks[weeks.length - 1]}` : `Semaine ${weeks[0]}`;
                                                        })()}
                                                    </span>
                                                </>
                                            ) : (
                                                <span>{`${member.first_name}${member.last_name ? ` ${member.last_name.charAt(0)}.` : ''}`}</span>
                                            )}

                                            {member.id === 'backlog_confection' && (() => {
                                                // Calculate Total Backlog Hours for this view
                                                const viewS = startOfDay(gridCols[0]);
                                                const lastC = gridCols[gridCols.length - 1];
                                                const viewE = view === 'year'
                                                    ? endOfMonth(lastC)
                                                    : new Date(lastC.getFullYear(), lastC.getMonth(), lastC.getDate(), 23, 59, 59);

                                                const backlogMinutes = events
                                                    .filter(e => {
                                                        if (e.resourceId !== 'backlog_confection') return false;
                                                        const s = new Date(e.meta?.start || e.date);
                                                        const end = new Date(e.meta?.end || e.date);
                                                        return s < viewE && end > viewS;
                                                    })
                                                    .reduce((acc, e) => {
                                                        // Priority: Use defined Budget (Volume)
                                                        if (e.meta?.budgetHours) {
                                                            return acc + (parseFloat(e.meta.budgetHours) * 60);
                                                        }

                                                        const s = new Date(e.meta?.start || e.date);
                                                        const end = new Date(e.meta?.end || e.date);
                                                        let dur = differenceInMinutes(end, s);

                                                        // Deduct Lunch
                                                        const lStart = new Date(s); lStart.setHours(12, 0, 0, 0);
                                                        const lEnd = new Date(s); lEnd.setHours(13, 0, 0, 0);
                                                        if (s < lStart && end > lEnd) dur -= 60;

                                                        return acc + Math.max(0, dur);
                                                    }, 0);

                                                const bHours = Math.round(backlogMinutes / 60);
                                                const cHours = Math.round(groupStats.cap); // Group Capacity

                                                return (
                                                    <span style={{ fontSize: 12, fontWeight: 600, background: '#FFE4E6', color: '#BE123C', padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap', marginTop: 10 }}>
                                                        {bHours}h / {cHours}h
                                                    </span>
                                                );
                                            })()}
                                        </StickyLeftCell>
                                        {member.id === 'backlog_confection' ? (
                                            <>
                                                {(() => {
                                                    // 1. Group gridCols into Weeks
                                                    const weeklyBins = [];
                                                    let currentBin = [];

                                                    gridCols.forEach((col) => {
                                                        if (currentBin.length === 0) {
                                                            currentBin.push(col);
                                                        } else {
                                                            const prev = currentBin[currentBin.length - 1];
                                                            // Check if same ISO week
                                                            if (getISOWeek(col) === getISOWeek(prev)) {
                                                                currentBin.push(col);
                                                            } else {
                                                                weeklyBins.push(currentBin);
                                                                currentBin = [col];
                                                            }
                                                        }
                                                    });
                                                    if (currentBin.length > 0) weeklyBins.push(currentBin);

                                                    return weeklyBins.map((weekDays, binIndex) => {
                                                        const binStart = startOfDay(weekDays[0]);
                                                        const lastDay = weekDays[weekDays.length - 1];
                                                        const binEnd = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate(), 23, 59, 59);
                                                        const weekNum = getISOWeek(binStart);

                                                        // 2. Local Stats for this Week
                                                        const groupMembers = group.members.filter(m => m.id !== 'backlog_confection');
                                                        const groupMemberIds = groupMembers.map(m => m.id);
                                                        const binStats = getStats(groupMemberIds, weekDays, events);

                                                        // 3. Filter Backlog Events for this bin
                                                        const binEvents = events
                                                            .filter(e => {
                                                                if (e.resourceId !== 'backlog_confection') return false;
                                                                const s = new Date(e.meta?.start || e.date);
                                                                const end = new Date(e.meta?.end || e.date);
                                                                return s < binEnd && end > binStart;
                                                            })
                                                            .sort((a, b) => {
                                                                const ordA = a.meta?.backlogOrder ?? 9999;
                                                                const ordB = b.meta?.backlogOrder ?? 9999;
                                                                if (ordA !== ordB) return ordA - ordB;
                                                                return new Date(a.date) - new Date(b.date);
                                                            });

                                                        const binBacklogMinutes = binEvents.reduce((acc, e) => {
                                                            if (e.meta?.budgetHours) return acc + (parseFloat(e.meta.budgetHours) * 60);
                                                            const s = new Date(e.meta?.start || e.date);
                                                            const end = new Date(e.meta?.end || e.date);
                                                            let dur = differenceInMinutes(end, s);
                                                            if (dur > 300) dur -= 60;
                                                            return acc + Math.max(0, dur);
                                                        }, 0);
                                                        const binLoadHours = Math.round(binBacklogMinutes / 60);
                                                        const binCapHours = Math.round(binStats.cap);
                                                        const isOverloaded = binLoadHours > binCapHours;

                                                        return (
                                                            <div
                                                                key={`bin-${binIndex}`}
                                                                style={{
                                                                    gridColumn: `span ${weekDays.length}`,
                                                                    minHeight: PROGRAMME_ROW_HEIGHT,
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    background: 'white', // sans fond : les cartes suffisent
                                                                    borderBottom: '1px solid #E5E7EB',
                                                                    borderRight: '1px solid #E5E7EB',
                                                                    position: 'relative',
                                                                    overflow: 'hidden'
                                                                }}
                                                                onDragOver={(e) => {
                                                                    e.preventDefault();
                                                                    e.dataTransfer.dropEffect = 'move';
                                                                    e.currentTarget.style.background = '#FCE7F3';
                                                                }}
                                                                onDragLeave={(e) => {
                                                                    e.currentTarget.style.background = 'white';
                                                                }}
                                                                onDrop={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    e.currentTarget.style.background = 'white';

                                                                    const type = e.dataTransfer.getData('type');
                                                                    if (type !== 'backlog-sort') return;
                                                                    const sourceId = e.dataTransfer.getData('text/plain');

                                                                    const evt = findEvent(sourceId);
                                                                    if (!evt) return;

                                                                    // Update Date to start of this week bin (Monday 09:00)
                                                                    const newStart = new Date(binStart);
                                                                    newStart.setHours(9, 0, 0);
                                                                    const dur = differenceInMinutes(new Date(evt.meta.end), new Date(evt.meta.start));
                                                                    const newEnd = addDays(newStart, 0);
                                                                    newEnd.setMinutes(newStart.getMinutes() + dur);

                                                                    onUpdateEvent({
                                                                        ...evt,
                                                                        date: newStart,
                                                                        meta: {
                                                                            ...evt.meta,
                                                                            start: newStart,
                                                                            end: newEnd,
                                                                            backlogOrder: 9999
                                                                        }
                                                                    });
                                                                }}
                                                            >
                                                                {/* Bandeau de semaine : seulement quand plusieurs semaines sont affichées
                                                                    (sinon il répète l'en-tête et la charge de la colonne de gauche). */}
                                                                {weeklyBins.length > 1 && <div style={{
                                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                                    padding: '3px 10px', background: 'rgba(255,255,255,0.5)', borderBottom: '1px dashed #FECDD3',
                                                                    fontSize: 11, fontWeight: 700, color: '#9F1239', height: 24
                                                                }}>
                                                                    <span style={{ fontFamily: ROBOTO, fontWeight: 500 }}>Semaine {weekNum}</span>
                                                                    <span style={{ color: isOverloaded ? '#EF4444' : '#9F1239' }}>
                                                                        {binLoadHours}h / {binCapHours}h
                                                                    </span>
                                                                </div>}

                                                                {/* Cards Container : grille à colonnes égales, les cartes s'alignent
                                                                    en colonnes quelle que soit la longueur des titres ; le nombre de
                                                                    colonnes suit la largeur de l'écran. */}
                                                                <div style={{
                                                                    flex: 1,
                                                                    display: 'grid',
                                                                    gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                                                                    alignItems: 'center',
                                                                    alignContent: 'center',
                                                                    padding: '4px',
                                                                    gap: 4
                                                                }}>
                                                                    {binEvents.map(evt => {
                                                                        // Barre = consommé / budget vendu du projet (rouge si dépassement).
                                                                        const binProg = projectHoursById[evt.meta?.projectId];
                                                                        const binConsumed = binProg ? Math.round(binProg.consumed.conf) : 0;
                                                                        const binBudget = binProg ? Math.round(binProg.budget.conf) : 0;
                                                                        const binPct = binBudget > 0 ? (binConsumed / binBudget) * 100 : 0;
                                                                        // Volume posé par l'ordonnancement sur CETTE semaine (la carte elle-même).
                                                                        const binWeekPlanned = Number(evt.meta?.budgetHours) || 0;

                                                                        return (
                                                                            <div
                                                                                key={evt.id}
                                                                                draggable
                                                                                onDragStart={(e) => {
                                                                                    e.stopPropagation();
                                                                                    e.dataTransfer.setData('text/plain', evt.id);
                                                                                    e.dataTransfer.setData('type', 'backlog-sort');
                                                                                    // Renseigne draggedEvent → permet de déposer
                                                                                    // sur une cellule personne pour planifier
                                                                                    // (branche backlog de handleDrop).
                                                                                    onDragStart?.(e, evt);
                                                                                }}
                                                                                onDragOver={(e) => {
                                                                                    e.preventDefault();
                                                                                    e.stopPropagation();
                                                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                                                    const midX = rect.left + rect.width / 2;
                                                                                    const pos = e.clientX < midX ? 'left' : 'right';
                                                                                    if (dragTarget?.id !== evt.id || dragTarget?.pos !== pos) {
                                                                                        setDragTarget({ id: evt.id, pos });
                                                                                    }
                                                                                }}
                                                                                onDragLeave={() => {
                                                                                    // optional debounce
                                                                                }}
                                                                                onDrop={(e) => {
                                                                                    e.preventDefault();
                                                                                    e.stopPropagation();
                                                                                    const currentDragPos = dragTarget?.pos; // Capture before clearing
                                                                                    setDragTarget(null);

                                                                                    const type = e.dataTransfer.getData('type');
                                                                                    if (type !== 'backlog-sort') return;
                                                                                    const sourceId = e.dataTransfer.getData('text/plain');

                                                                                    const newOrder = [...binEvents];
                                                                                    const sIndex = newOrder.findIndex(x => x.id === sourceId);

                                                                                    // If source is in same bin, use basic reorder logic BUT refined by side
                                                                                    // If source is NOT in bin (from another week), handle it too?
                                                                                    // Currently drag from other week is handled by BIN drop.
                                                                                    // But if dropped ON CARD, this handler fires. bind drop handler won't fire due to stopPropagation.
                                                                                    // So we must handle "Move from other week" here too if we want precise insertion.

                                                                                    // Case 1: Same Bin Reorder
                                                                                    if (sIndex >= 0) {
                                                                                        const targetIndex = newOrder.findIndex(x => x.id === evt.id);
                                                                                        const [moved] = newOrder.splice(sIndex, 1);

                                                                                        let freshTargetIndex = newOrder.findIndex(x => x.id === evt.id);
                                                                                        if (currentDragPos === 'right') freshTargetIndex += 1;

                                                                                        newOrder.splice(freshTargetIndex, 0, moved);
                                                                                        newOrder.forEach((item, index) => {
                                                                                            if (item.meta?.backlogOrder !== index) {
                                                                                                onUpdateEvent({ ...item, meta: { ...item.meta, backlogOrder: index } });
                                                                                            }
                                                                                        });
                                                                                    } else {
                                                                                        // Case 2: Move from other week (or bin)
                                                                                        const sourceEvt = findEvent(sourceId);
                                                                                        if (!sourceEvt) return;

                                                                                        // Update Date to start of this week bin
                                                                                        const newStart = new Date(binStart);
                                                                                        newStart.setHours(9, 0, 0);
                                                                                        const dur = differenceInMinutes(new Date(sourceEvt.meta.end), new Date(sourceEvt.meta.start));
                                                                                        const newEnd = addDays(newStart, 0);
                                                                                        newEnd.setMinutes(newStart.getMinutes() + dur);

                                                                                        // determine new Order index
                                                                                        // We want to insert it relative to evt
                                                                                        let insertIndex = binEvents.findIndex(x => x.id === evt.id);
                                                                                        if (dragTarget?.pos === 'right') insertIndex += 1;

                                                                                        // We need to shift everything after insertIndex down.
                                                                                        // But we can't easily set "order" atomically for all without batch update.
                                                                                        // We'll set the new event's order to something decimal? No, int.
                                                                                        // Or we just update the new Move. 
                                                                                        // Actually, we should trigger a full re-sort if possible or just careful updates.
                                                                                        // Simple approach: Set large order, then let user refine?
                                                                                        // Better: Update target event to have specific order. 

                                                                                        // Let's just update the moved event date. 
                                                                                        // And maybe set its order to target event's order?
                                                                                        // If we set same order, sort might be unstable.

                                                                                        // To do it right: 
                                                                                        // 1. Update date of sourceEvt
                                                                                        // 2. Refresh binEvents (not possible sync here easily)
                                                                                        // So we just update date for now, user can re-sort.
                                                                                        // OR: we call onUpdateEvent for sourceEvt with new Date AND new Order.
                                                                                        // What is new Order? 
                                                                                        // We can take (evt.backlogOrder) and maybe shift others?
                                                                                        // Too complex for "Move to other week". 
                                                                                        // Let's stick to "Move to other week" -> Append to end (default logic) OR simple date change.
                                                                                        // User asked for visual feedback. 
                                                                                        // If visual feedback shows insertion, we expect insertion.

                                                                                        // For cross-week drop on card, let's just do date update + try to set order = evt.order 
                                                                                        // But multiple items with same order is undefined.
                                                                                        // Let's Just update Date for now to keep it safe.

                                                                                        onUpdateEvent({
                                                                                            ...sourceEvt,
                                                                                            date: newStart,
                                                                                            meta: {
                                                                                                ...sourceEvt.meta,
                                                                                                start: newStart,
                                                                                                end: newEnd,
                                                                                                backlogOrder: evt.meta?.backlogOrder ?? 9999
                                                                                            }
                                                                                        });
                                                                                    }
                                                                                }}
                                                                                onClick={(e) => { e.stopPropagation(); onEventClick(evt); }}
                                                                                style={{
                                                                                    minWidth: 0,
                                                                                    height: 124,
                                                                                    background: 'white',
                                                                                    border: '1px solid #FECDD3',
                                                                                    borderRadius: 4,
                                                                                    padding: 6,
                                                                                    display: 'flex',
                                                                                    flexDirection: 'column',
                                                                                    justifyContent: 'center',
                                                                                    boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
                                                                                    cursor: 'grab',
                                                                                    position: 'relative',
                                                                                    transition: 'all 0.1s ease'
                                                                                }}
                                                                            >
                                                                                {/* Visual Drop Indicator (Overlay) */}
                                                                                {dragTarget?.id === evt.id && (
                                                                                    <div style={{
                                                                                        position: 'absolute',
                                                                                        top: 0, bottom: 0,
                                                                                        width: 4,
                                                                                        background: '#3B82F6',
                                                                                        borderRadius: 2,
                                                                                        left: dragTarget.pos === 'left' ? -2 : 'auto',
                                                                                        right: dragTarget.pos === 'right' ? -2 : 'auto',
                                                                                        zIndex: 10,
                                                                                        pointerEvents: 'none'
                                                                                    }} />
                                                                                )}
                                                                                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#9F1239', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                                    {evt.title}
                                                                                </div>
                                                                                {evt.meta?.description && (
                                                                                    <div style={{ fontSize: 10.5, fontStyle: 'italic', color: '#9F1239', opacity: 0.75, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                                                                                        {stripMarks(evt.meta.description.split('\n')[0])}
                                                                                    </div>
                                                                                )}
                                                                                <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                                                                                    <div style={{ width: `${Math.min(binPct, 100)}%`, height: '100%', background: binPct > 100 ? '#EF4444' : '#10B981' }} />
                                                                                </div>
                                                                                <div style={{ fontSize: 9, color: binPct > 100 ? '#B91C1C' : '#6B7280', textAlign: 'right', marginTop: 2 }}>
                                                                                    {binConsumed}/{binBudget}h
                                                                                </div>
                                                                                <div style={{ fontSize: 10, fontWeight: 600, color: '#9F1239', marginTop: 3 }}>
                                                                                    Planifié cette semaine : {fmtHours(binWeekPlanned)}h
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}

                                                                    <div
                                                                        onClick={() => onCellClick(member.id, binStart)}
                                                                        style={{
                                                                            minWidth: 30, height: 30, borderRadius: '50%', background: 'white',
                                                                            border: '1px dashed #FECDD3', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                            cursor: 'pointer', color: '#FDA4AF', marginLeft: 4, width: 30, justifySelf: 'start'
                                                                        }}
                                                                    >
                                                                        <PlusIcon size={16} />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    });
                                                })()}


                                            </>
                                        ) : (
                                            gridCols.map((col, colIndex) => (
                                                <div
                                                    key={`${member.id}-${col}`}
                                                    onClick={() => onCellClick(member.id, col)}
                                                    onDragOver={(e) => {
                                                        onDragOver(e);
                                                        const k = `${member.id}|${col}`;
                                                        if (dropCell !== k) setDropCell(k);
                                                    }}
                                                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropCell(null); }}
                                                    onDrop={(e) => { setDropCell(null); onDrop(e, member.id, col); }}
                                                    style={{
                                                        borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #F3F4F6', height: ROW_HEIGHT, position: 'relative',
                                                        transition: 'background-color .12s ease, box-shadow .12s ease',
                                                        ...(dropCell === `${member.id}|${col}`
                                                            ? { background: 'rgba(30,36,71,0.06)', boxShadow: 'inset 0 0 0 2px rgba(30,36,71,0.35)', borderRadius: 6 }
                                                            : { background: closureOfCol(col) ? CLOSED_BG : 'transparent' }),
                                                    }}
                                                >
                                                    {renderEventsForCell(member.id, col)}
                                                    {(() => {
                                                        // Libellé de fermeture sur la ligne du milieu, au cœur des hachures.
                                                        const people = shown.filter(m => m.id !== 'backlog_confection');
                                                        if (people[Math.floor(people.length / 2)]?.id !== member.id) return null;
                                                        const lbl = closureLabelAt(colIndex);
                                                        if (!lbl) return null;
                                                        return (
                                                            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${lbl.span * 100}%`, zIndex: 2, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <span style={{ fontFamily: ROBOTO, fontSize: 13, fontWeight: 500, color: '#6B7280', background: '#F4F4F4', padding: '3px 10px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                                                                    Fermeture · {lbl.closure.title}
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            ))
                                        )}
                                    </React.Fragment>
                                ))}
                            </React.Fragment>
                        )
                    })}

                    {/* --- TOTAL ROW --- */}
                    {showGauges && showTotal && (() => {
                        // Gather ALL visible members
                        const allActiveMembers = Object.values(filteredGroups).flatMap(g => g.members).filter(m => !hiddenResources.includes(m.id));
                        const allMemberIds = allActiveMembers.map(m => m.id);

                        // Global Stats
                        const globalStats = getStats(allMemberIds, gridCols, events);

                        return (
                            <>
                                <StickyLeftCell
                                    bg="#FFF"
                                    style={{ fontFamily: ROBOTO, fontWeight: 500, color: '#111827', borderTop: '2px solid #E5E7EB' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', flex: 1, fontSize: 17 }}>
                                        Total
                                    </div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: globalStats.percent > 100 ? '#EF4444' : '#374151', background: '#F3F4F6', padding: '2px 8px', borderRadius: 4 }}>
                                        {Math.round(globalStats.percent)}%
                                    </div>
                                </StickyLeftCell>

                                {gridCols.map(col => {
                                    const cellStats = getStats(allMemberIds, [col], events);
                                    return (
                                        <div key={`total-${col.toString()}`} style={{ borderTop: '2px solid #E5E7EB' }}>
                                            {renderGaugeCell(cellStats.load, cellStats.cap, cellStats.percent, `total-${col.toString()}`)}
                                        </div>
                                    );
                                })}
                            </>
                        )
                    })()}
                </div>
            </div>
        </div >
    );
};

export default PlanningGrid;
