import React, { useMemo } from 'react';
import { ChevronDown, ChevronRight as ChevronRightIcon, CheckCircle, X } from 'lucide-react';
import { format, isSameDay, startOfMonth, startOfDay, endOfMonth, eachDayOfInterval, isWeekend, differenceInMinutes, addDays, parseISO, getHours, getMinutes } from 'date-fns';
import { PLANNING_COLORS, ROW_HEIGHT, HEADER_HEIGHT_1, HEADER_HEIGHT_2, TOTAL_WORK_MINUTES } from './constants';
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
    getCellContent
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
            const opacity = evt.meta?.status === 'validated' ? 0.6 : 1;
            const isValidated = evt.meta?.status === 'validated';
            const borderStyle = evt.meta?.status === 'validated' ? 'dashed' : 'solid';

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
                <div key={evt.id} draggable
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
                    <div style={{ fontSize: 11, fontWeight: 700, color: style.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {displayTitle}
                    </div>

                    {isValidated && (
                        <CheckCircle size={10} color={style.text} style={{ position: 'absolute', bottom: 2, right: 2 }} />
                    )}

                    {hoveredEventId === evt.id && !isValidated && (
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

                    {!isValidated && (
                        <div
                            className="resize-handle"
                            style={{
                                position: 'absolute', top: 0, bottom: 0, right: 0, width: 12,
                                cursor: 'col-resize', zIndex: 50,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const rect = e.target.parentElement.getBoundingClientRect();
                                const currentSpan = widthMultiplier || 1;
                                const singleCellWidth = rect.width / currentSpan;

                                const seriesEvents = evt.meta?.seriesId
                                    ? events.filter(ev => ev.meta?.seriesId === evt.meta.seriesId)
                                    : [evt];
                                seriesEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

                                onResizeStart({
                                    startX: e.clientX,
                                    initialSeries: seriesEvents,
                                    cellWidth: singleCellWidth,
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

    return (
        <div style={{ flex: 1, overflow: 'hidden', padding: '0 24px 24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 'fit-content', maxHeight: '100%', overflow: 'auto', background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, position: 'relative' }}>
                <div style={{ display: 'grid', gridTemplateColumns: `260px repeat(${columns.length}, minmax(${MIN_WIDTH}px, 1fr))`, gridAutoRows: 'max-content', width: 'max-content', minWidth: '100%' }}>
                    <StickyCorner style={{ height: HEADER_HEIGHT_1, borderBottom: 'none' }} />
                    {superHeaders.map((header, i) => (<div key={i} style={{ gridColumn: `span ${header.span}`, position: 'sticky', top: 0, zIndex: 40, background: 'white', borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 }}>{header.label}</div>))}
                    <StickyCorner style={{ top: HEADER_HEIGHT_1, height: HEADER_HEIGHT_2 }}>Ressources</StickyCorner>
                    {columns.map(col => (<StickyTopCell key={col.toString()} style={{ top: HEADER_HEIGHT_1, height: HEADER_HEIGHT_2, background: isSameDay(col, new Date()) && view !== 'year' ? '#EFF6FF' : 'white', color: isSameDay(col, new Date()) && view !== 'year' ? '#2563EB' : '#4B5563' }}>{getCellContent(col)}</StickyTopCell>))}

                    {Object.entries(filteredGroups).map(([key, group]) => (
                        <React.Fragment key={key}>
                            <StickyLeftCell onClick={() => onToggleGroup(key)} bg={group.bg} style={{ fontWeight: 800, color: '#111827' }}>{expandedGroups[key] ? <ChevronDown size={14} style={{ marginRight: 8 }} /> : <ChevronRightIcon size={14} style={{ marginRight: 8 }} />}{group.label}</StickyLeftCell>
                            {/* LIGNE DE CAPACITÉ (Jauges) */}
                            {columns.map(col => {
                                const isMonthColumn = view === 'year';
                                const colStart = isMonthColumn ? startOfMonth(col) : startOfDay(col);
                                const colEnd = isMonthColumn ? endOfMonth(col) : new Date(col.getFullYear(), col.getMonth(), col.getDate(), 23, 59, 59);

                                const activeMembers = group.members.filter(m => !hiddenResources.includes(m.id));
                                let workDaysCount = 0;
                                if (isMonthColumn) {
                                    const daysInMonth = eachDayOfInterval({ start: colStart, end: colEnd });
                                    workDaysCount = daysInMonth.filter(d => !isWeekend(d)).length;
                                } else {
                                    workDaysCount = isWeekend(colStart) ? 0 : 1;
                                }
                                const theoreticalCapacity = activeMembers.length * 7 * workDaysCount; // en heures

                                let totalAbsenceHours = 0;
                                let totalLoadHours = 0;
                                const activeMemberIds = activeMembers.map(m => m.id);

                                events.forEach(evt => {
                                    if (!activeMemberIds.includes(evt.resourceId)) return;

                                    const eStart = new Date(evt.meta?.start || evt.date);
                                    const eEnd = new Date(evt.meta?.end || evt.date);

                                    if (eEnd <= colStart || eStart >= colEnd) return;

                                    const interStart = eStart < colStart ? colStart : eStart;
                                    const interEnd = eEnd > colEnd ? colEnd : eEnd;
                                    const durationMinutes = differenceInMinutes(interEnd, interStart);
                                    const hours = durationMinutes / 60;

                                    const isAbsence = ['Congés', 'RTT', 'Maladie', 'Autre', 'absence'].includes(evt.type) || ['Congés', 'RTT', 'Maladie', 'Autre'].includes(evt.title);

                                    if (isAbsence) {
                                        totalAbsenceHours += hours;
                                    } else {
                                        totalLoadHours += hours;
                                    }
                                });

                                const realCapacity = Math.max(0, theoreticalCapacity - totalAbsenceHours);
                                const loadPercent = realCapacity > 0 ? (totalLoadHours / realCapacity) * 100 : 0;

                                let barColor = '#10B981'; // Vert
                                if (loadPercent >= 80) barColor = '#F59E0B'; // Orange
                                if (loadPercent > 100) barColor = '#EF4444'; // Rouge

                                return (
                                    <div key={col.toString()} style={{
                                        borderRight: '1px solid #E5E7EB',
                                        borderBottom: '1px solid #E5E7EB',
                                        background: group.bg,
                                        height: ROW_HEIGHT,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                        padding: '0 8px'
                                    }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                                            <span>{Math.round(totalLoadHours)}h <span style={{ color: '#9CA3AF', fontWeight: 400 }}>/ {Math.round(realCapacity)}h</span></span>
                                        </div>
                                        <div style={{ width: '100%', height: 6, background: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                                            <div style={{ width: `${Math.min(loadPercent, 100)}%`, height: '100%', background: barColor, transition: 'width 0.3s ease' }} />
                                        </div>
                                    </div>
                                );
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
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PlanningGrid;
