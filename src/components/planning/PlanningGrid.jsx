import React, { useMemo } from 'react';
import { ChevronDown, ChevronRight as ChevronRightIcon, CheckCircle, X } from 'lucide-react';
import { format, isSameDay, startOfMonth, startOfDay, endOfMonth, eachDayOfInterval, isWeekend, differenceInMinutes, addDays, parseISO, getHours, getMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PLANNING_COLORS, ROW_HEIGHT, HEADER_HEIGHT_1, HEADER_HEIGHT_2, TOTAL_WORK_MINUTES, WORK_START_HOUR, WORK_END_HOUR } from './constants';
import { uid } from '../../lib/utils/uid';

// --- STICKY CELLS ---
const StickyLeftCell = ({ children, bg = 'white', borderBottom = true, onClick, style }) => (
    <div onClick={onClick} style={{ position: 'sticky', left: 0, zIndex: 50, background: bg, borderRight: '2px solid #E5E7EB', borderBottom: borderBottom ? '1px solid #E5E7EB' : 'none', display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: 13, fontWeight: 600, color: '#374151', cursor: onClick ? 'pointer' : 'default', height: ROW_HEIGHT, minWidth: 260, maxWidth: 260, ...style }}>
        {children}
    </div>
);
const StickyTopCell = ({ children, bg = 'white', style }) => (
    <div style={{ position: 'sticky', top: 0, zIndex: 40, background: bg, borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#4B5563', ...style }}>
        {children}
    </div>
);
const StickyCorner = ({ children, style }) => (
    <div style={{ position: 'sticky', left: 0, top: 0, zIndex: 60, background: 'white', borderRight: '2px solid #E5E7EB', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', paddingLeft: 16, fontWeight: 700, fontSize: 13, color: '#111827', minWidth: 260, maxWidth: 260, ...style }}>
        {children}
    </div>
);

const PlanningGrid = ({
    days, columns, superHeaders, view,
    filteredGroups, expandedGroups, onToggleGroup,
    events, hiddenResources,
    onCellClick, onEventClick, onDeleteEvent,
    onDragStart, onDragOver, onDrop,
    hoveredEventId, onHoverEvent,
    onResizeStart,
    getCellContent,
    showGauges = true,
    readOnly = false,
    isVertical = false
}) => {

    const MIN_WIDTH = view === 'year' ? 80 : (view === 'quarter' || view === 'month' ? 40 : 120);

    const renderEventsForCell = (memberId, dayDate) => {
        // Filtrer les événements pour ce jour et cette ressource
        const dayEvents = events.filter(e =>
            e.resourceId === memberId &&
            isSameDay(parseISO(e.date), dayDate)
        );

        if (dayEvents.length === 0) return null;

        return dayEvents.map(evt => {
            const style = PLANNING_COLORS[evt.type] || PLANNING_COLORS.default;
            const isValidated = evt.meta?.status === 'validated';
            const borderStyle = isValidated ? 'solid' : 'dashed';
            const fontWeight = isValidated ? 700 : 500; // Bold if validated
            const opacity = isValidated ? 1 : 0.9; // Slight transparency for pending

            // Heure de début et fin pour l'affichage (positionnement vertical ?)
            // Dans ce planning "Journée", on ne positionne pas verticalement (pas de grille horaire fine),
            // mais on affiche peut-être l'heure dans le titre.
            const startStr = evt.meta?.start ? format(new Date(evt.meta.start || evt.date), 'HH:mm') : '08:00';
            const endStr = evt.meta?.end ? format(new Date(evt.meta.end || evt.date), 'HH:mm') : '17:00';
            const labelTime = `${startStr}-${endStr}`;

            // Calcul Position Horizontale (Si multi-jours)
            // L'événement est découpé par jour (split).
            // Donc chaque evt couvre au max la journée (ou moins).
            let leftPercent = 0;
            let widthPercent = 100;

            if (evt.meta?.start && evt.meta?.end) {
                const s = new Date(evt.meta.start);
                const e = new Date(evt.meta.end);
                // Si l'event commence après 8h
                const startOfDayDate = new Date(s);
                startOfDayDate.setHours(8, 0, 0, 0);

                // Calcul début relatif à la journée (8h-17h = 9h = 540min)
                // On ramène tout sur la journée courante pour l'affichage dans la cellule
                // Attention: s et e peuvent être sur d'autres jours si c'est raw.
                // MAIS ici on a splitté. evt.date est le jour courant.
                // Donc s est forcément >= 8h le jour J ou avant (si continue).
                // On va simplifier : on prend l'heure de s et e.
                const sMinutes = getHours(s) * 60 + getMinutes(s);
                const startWorkMinutes = 8 * 60; // 480
                const relativeStart = Math.max(0, sMinutes - startWorkMinutes);
                leftPercent = (relativeStart / TOTAL_WORK_MINUTES) * 100;

                const eMinutes = getHours(e) * 60 + getMinutes(e);
                // Si e est sur un autre jour, on prend 17h.
                // Mais avec le split, e est sur le jour J (ou 17h si split).
                // Calcul durée
                const duration = Math.min(TOTAL_WORK_MINUTES, Math.max(0, differenceInMinutes(e, s)));
                widthPercent = (duration / TOTAL_WORK_MINUTES) * 100;
            }

            // Gestion des séries (Fusion visuelle)
            // Si l'événement fait partie d'une série, on veut peut-être l'afficher en continu.
            // Actuellement, chaque jour est une case.
            // Si on veut que ça dépasse sur la case suivante, il faudrait overflow: visible et z-index.
            // ALGORITHME DE FUSION :
            // Si un événement a un seriesId, on regarde s'il continue le LENDEMAIN.
            // Si oui, on augmente sa largeur pour couvrir les jours suivants,
            // ET on masque l'événement du lendemain (pour ne pas l'avoir en double).
            // C'est tricky.

            // On vérifie le "masquage" : est-ce que cet évent est couvert par un précédent ?
            // On regarde le jour précédent (-1 jour).
            const prevDay = addDays(dayDate, -1);
            // Est-ce qu'il y a un evt de la même série hier ?
            const prevEvt = localEventsRef(events).find(e =>
                e.resourceId === memberId &&
                e.meta?.seriesId === evt.meta.seriesId &&
                isSameDay(parseISO(e.date), prevDay)
            );

            // On regarde si l'event d'hier "touche" la fin de journée (17h) et celui d'ajd commence à 8h.
            // Simplification : Si même série, on considère que c'est fusionné si adjacent.
            // Si on a un prevEvt, on doit savoir si ON doit être dessiné (début de bloc visible) ou non (caché sous le précédent).
            // Le rendu style "Saucisse" (Gantt-like) sur grille tabulaire requiert que la cellule de gauche déborde.

            // RÈGLE : On ne dessine l'élément QUE SI c'est le premier jour de la série visible à l'écran,
            // OU si le jour précédent n'avait pas cet event (trous dans la série).

            // On va checker si le jour d'avant est affiché dans la grille (columns).
            // Si prevDay n'est PAS dans columns (ex: scroll ou view), alors on DOIT dessiner ici (c'est le début visuel).
            const prevVisible = columns.some(c => isSameDay(c, prevDay));
            const hasPrev = !!prevEvt;

            let isStartOfVisibleSeries = false;
            let widthMultiplier = 1;

            if (evt.meta?.seriesId) {
                if (hasPrev && prevVisible) {
                    return null;
                }

                // Sinon, c'est le début du bloc visible. On calcule combien de jours il doit couvrir.
                let cumulativeWidth = widthPercent; // On commence avec la largeur du jour courant
                let lookAhead = addDays(dayDate, 1);

                // On cherche les jours suivants
                let maxDays = 20; // Sécurité
                while (maxDays > 0) {
                    const nextEvt = events.find(e =>
                        e.resourceId === memberId &&
                        e.meta?.seriesId === evt.meta.seriesId &&
                        isSameDay(parseISO(e.date), lookAhead)
                    );

                    if (!nextEvt) break;

                    // Calcul de la largeur de ce segment
                    const s = new Date(nextEvt.meta.start);
                    const e = new Date(nextEvt.meta.end);
                    const dur = Math.min(TOTAL_WORK_MINUTES, Math.max(0, differenceInMinutes(e, s)));
                    const segWidth = (dur / TOTAL_WORK_MINUTES) * 100;

                    cumulativeWidth += segWidth;

                    lookAhead = addDays(lookAhead, 1);
                    maxDays--;
                }
                widthMultiplier = cumulativeWidth / 100;
                isStartOfVisibleSeries = !hasPrev;
            }

            let finalWidth = evt.meta?.seriesId ? `calc(${isStartOfVisibleSeries ? widthMultiplier * 100 : widthPercent}% - 2px)` : `${widthPercent}%`;
            if (evt.meta?.seriesId) {
                finalWidth = `calc(${widthMultiplier * 100}% - 2px)`;
            }

            // Snapshot Identity
            const displayTitle = evt.meta?.assigned_name
                ? `${evt.title} (${evt.meta.assigned_name})`
                : evt.title;

            return (
                <div key={evt.id} draggable={!readOnly}
                    onMouseEnter={() => onHoverEvent && onHoverEvent(evt.id)}
                    onMouseLeave={() => onHoverEvent && onHoverEvent(null)}
                    onDragStart={(e) => onDragStart(e, evt)}
                    onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(evt);
                    }}
                    title={`${displayTitle} (${labelTime})`}
                    style={{
                        position: 'absolute', top: 4, bottom: 4,
                        left: `${leftPercent}%`,
                        width: finalWidth,
                        backgroundColor: style.bg,
                        border: `1px solid ${style.border}`,
                        borderLeft: isStartOfVisibleSeries ? `4px ${borderStyle} ${style.border}` : 'none',
                        borderTopLeftRadius: isStartOfVisibleSeries ? 8 : 0,
                        borderBottomLeftRadius: isStartOfVisibleSeries ? 8 : 0,
                        borderTopRightRadius: 8,
                        borderBottomRightRadius: 8,
                        zIndex: evt.meta?.seriesId ? 20 : 10,
                        padding: '2px 4px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        opacity: opacity,
                        boxShadow: evt.meta?.seriesId ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                        backgroundImage: style.pattern ? 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.05) 5px, rgba(0,0,0,0.05) 10px)' : 'none'
                    }}
                >
                    <div style={{ fontSize: 11, fontWeight: fontWeight, color: style.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {displayTitle}
                    </div>

                    {isValidated && (
                        <CheckCircle size={10} color={style.text} style={{ position: 'absolute', bottom: 2, right: 2 }} />
                    )}

                    {hoveredEventId === evt.id && !isValidated && !readOnly && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteEvent(evt);
                            }}
                            style={{
                                position: 'absolute', top: 2, right: 2,
                                background: 'rgba(255,255,255,0.6)', borderRadius: '50%',
                                width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', zIndex: 60
                            }}
                            title="Supprimer"
                        >
                            <X size={10} color="#EF4444" />
                        </div>
                    )}

                    {!isValidated && !readOnly && (
                        <div
                            className="resize-handle"
                            style={{
                                position: 'absolute', top: 0, bottom: 0, right: 0, width: 12,
                                cursor: 'col-resize', zIndex: 50,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const cellNode = e.target.parentElement.parentElement;
                                const cellRect = cellNode.getBoundingClientRect();
                                const columnPixelWidth = cellRect.width;

                                const seriesEvents = evt.meta?.seriesId
                                    ? events.filter(ev => ev.meta?.seriesId === evt.meta.seriesId)
                                    : [evt];
                                seriesEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

                                onResizeStart({
                                    startX: e.clientX,
                                    initialSeries: seriesEvents,
                                    columnPixelWidth, // Time conversion ref
                                    resourceId: evt.resourceId,
                                    seriesId: evt.meta?.seriesId,
                                    tempSeriesId: evt.meta?.seriesId ? null : uid(),
                                    type: evt.type,
                                    title: evt.title,
                                    meta: evt.meta
                                });
                            }}
                        />
                    )}
                </div>
            );
        });
    };

    // Helpler to access latest events in loop if needed, but here we pass events prop
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
                    {columns.map(col => (
                        <div key={col.toString()} style={{ flex: 1, textAlign: 'center', padding: '12px', fontWeight: 700, textTransform: 'uppercase', fontSize: 13, color: '#374151' }}>
                            {format(col, 'EEEE d', { locale: fr })}
                        </div>
                    ))}
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', position: 'relative' }}>
                    {/* Time Sidebar */}
                    <div style={{ width: 60, flexShrink: 0, borderRight: '1px solid #E5E7EB', background: '#F9FAFB' }}>
                        {Array.from({ length: V_END - V_START + 1 }).map((_, i) => (
                            <div key={i} style={{ height: hourHeight, borderBottom: '1px solid #E5E7EB', position: 'relative', overflow: 'visible' }}>
                                <span style={{ position: 'absolute', top: -10, right: 8, fontSize: 11, color: '#9CA3AF', background: '#F9FAFB', padding: '0 4px', zIndex: 10 }}>
                                    {V_START + i}:00
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Day Columns */}
                    {columns.map(col => (
                        <div key={col.toString()} style={{ flex: 1, borderRight: '1px solid #E5E7EB', position: 'relative', height: totalHeight, minHeight: totalHeight }}>
                            {/* Grid Lines */}
                            {Array.from({ length: V_END - V_START }).map((_, i) => (
                                <div key={i} style={{ position: 'absolute', top: (i + 1) * hourHeight, left: 0, right: 0, borderTop: '1px solid #F3F4F6', pointerEvents: 'none' }} />
                            ))}

                            {/* Events */}
                            {Object.values(filteredGroups).flatMap(g => g.members).map(member => {
                                const dayEvents = events.filter(e => e.resourceId === member.id && isSameDay(parseISO(e.date), col));

                                return dayEvents.map(evt => {
                                    const style = PLANNING_COLORS[evt.type] || PLANNING_COLORS.default;
                                    const start = new Date(evt.meta?.start || evt.date);
                                    const end = new Date(evt.meta?.end || evt.date);

                                    const sMinutes = getHours(start) * 60 + getMinutes(start);
                                    const eMinutes = getHours(end) * 60 + getMinutes(end);
                                    const startWorkMinutes = V_START * 60;

                                    const top = Math.max(0, sMinutes - startWorkMinutes);
                                    const duration = Math.max(15, eMinutes - sMinutes);

                                    return (
                                        <div key={evt.id}
                                            onClick={(e) => { e.stopPropagation(); onEventClick(evt); }}
                                            style={{
                                                position: 'absolute',
                                                top: top,
                                                height: duration,
                                                left: 4, right: 4,
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
                            })}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // --- UTILS CALCULATION ---
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

            let workDaysCount = 0;
            if (isMonthColumn) {
                const daysInMonth = eachDayOfInterval({ start: colStart, end: colEnd });
                workDaysCount = daysInMonth.filter(d => !isWeekend(d)).length;
            } else {
                workDaysCount = isWeekend(colStart) ? 0 : 1;
            }
            // For this column (Day or Month), capacity is:
            theoreticalCapacity += memberIds.length * 8 * workDaysCount;
        });

        activeMemberCount = memberIds.length;

        // Loop events once? Or per member?
        // Using existing logic structure: per event check is safest given data structure
        allEvents.forEach(evt => {
            if (!memberIds.includes(evt.resourceId)) return;

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

                if (isAbsence) totalAbsenceHours += hours;
                else totalLoadHours += hours;
            });
        });

        const realCapacity = Math.max(0, theoreticalCapacity - totalAbsenceHours);
        const percent = realCapacity > 0 ? (totalLoadHours / realCapacity) * 100 : 0;

        return { load: totalLoadHours, cap: realCapacity, percent };
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
                    <span>{Math.round(load)}h <span style={{ color: '#9CA3AF', fontWeight: 400 }}>/ {Math.round(cap)}h</span></span>
                </div>
                <div style={{ width: '100%', height: 6, background: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(percent, 100)}%`, height: '100%', background: barColor, transition: 'width 0.3s ease' }} />
                </div>
            </div>
        );
    };


    return (
        <div style={{ flex: 1, overflow: 'hidden', padding: '0 24px 24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 'fit-content', maxHeight: '100%', overflow: 'auto', background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, position: 'relative' }}>
                <div style={{ display: 'grid', gridTemplateColumns: `260px repeat(${columns.length}, minmax(${MIN_WIDTH}px, 1fr))`, gridAutoRows: 'max-content', width: 'max-content', minWidth: '100%' }}>
                    <StickyCorner style={{ height: HEADER_HEIGHT_1, borderBottom: 'none' }} />
                    {superHeaders.map((header, i) => (<div key={i} style={{ gridColumn: `span ${header.span}`, position: 'sticky', top: 0, zIndex: 40, background: 'white', borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 }}>{header.label}</div>))}
                    <StickyCorner style={{ top: HEADER_HEIGHT_1, height: HEADER_HEIGHT_2 }}>Ressources</StickyCorner>
                    {columns.map(col => (<StickyTopCell key={col.toString()} style={{ top: HEADER_HEIGHT_1, height: HEADER_HEIGHT_2, background: isSameDay(col, new Date()) && view !== 'year' ? '#EFF6FF' : 'white', color: isSameDay(col, new Date()) && view !== 'year' ? '#2563EB' : '#4B5563' }}>{getCellContent(col)}</StickyTopCell>))}

                    {Object.entries(filteredGroups).map(([key, group]) => {
                        const activeMembers = group.members.filter(m => !hiddenResources.includes(m.id));
                        // Calc Global Stats for Header
                        const groupStats = getStats(activeMembers.map(m => m.id), columns, events);

                        return (
                            <React.Fragment key={key}>
                                <StickyLeftCell onClick={() => onToggleGroup(key)} bg={group.bg} style={{ fontWeight: 800, color: '#111827' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                        {expandedGroups[key] ? <ChevronDown size={14} style={{ marginRight: 8 }} /> : <ChevronRightIcon size={14} style={{ marginRight: 8 }} />}
                                        {group.label}
                                    </div>
                                    {showGauges && (
                                        <div style={{ fontSize: 11, fontWeight: 600, color: groupStats.percent > 100 ? '#EF4444' : '#6B7280', background: 'rgba(255,255,255,0.5)', padding: '2px 6px', borderRadius: 4 }}>
                                            {Math.round(groupStats.percent)}%
                                        </div>
                                    )}
                                </StickyLeftCell>

                                {/* LIGNE DE CAPACITÉ (Jauges) */}
                                {columns.map(col => {
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

                                {expandedGroups[key] && group.members.map(member => (
                                    <React.Fragment key={member.id}>
                                        <StickyLeftCell style={{ paddingLeft: 42, color: '#4B5563', fontWeight: 500 }}>
                                            {member.first_name} {member.last_name?.charAt(0)}.
                                        </StickyLeftCell>
                                        {columns.map(col => (
                                            <div
                                                key={`${member.id}-${col}`}
                                                onClick={() => onCellClick(member.id, col)}
                                                onDragOver={onDragOver}
                                                onDrop={(e) => onDrop(e, member.id, col)}
                                                style={{ borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #F3F4F6', background: (view !== 'year' && isSameDay(col, new Date())) ? '#F9FAFB' : 'transparent', height: ROW_HEIGHT, position: 'relative' }}
                                            >
                                                {renderEventsForCell(member.id, col)}
                                            </div>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </React.Fragment>
                        )
                    })}

                    {/* --- TOTAL ROW --- */}
                    {showGauges && (() => {
                        // Gather ALL visible members
                        const allActiveMembers = Object.values(filteredGroups).flatMap(g => g.members).filter(m => !hiddenResources.includes(m.id));
                        const allMemberIds = allActiveMembers.map(m => m.id);

                        // Global Stats
                        const globalStats = getStats(allMemberIds, columns, events);

                        return (
                            <>
                                <StickyLeftCell
                                    bg="#FFF"
                                    style={{ fontWeight: 800, color: '#111827', borderTop: '2px solid #E5E7EB' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', flex: 1, fontSize: 14 }}>
                                        TOTAL
                                    </div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: globalStats.percent > 100 ? '#EF4444' : '#374151', background: '#F3F4F6', padding: '2px 8px', borderRadius: 4 }}>
                                        {Math.round(globalStats.percent)}%
                                    </div>
                                </StickyLeftCell>

                                {columns.map(col => {
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
        </div>
    );
};

export default PlanningGrid;
