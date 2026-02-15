import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight as ChevronRightIcon, CheckCircle, X, Plus as PlusIcon } from 'lucide-react';
import { format, isSameDay, startOfMonth, startOfDay, endOfMonth, eachDayOfInterval, isWeekend, differenceInMinutes, addDays, parseISO, getHours, getMinutes, getISOWeek, addWeeks, startOfWeek, endOfWeek } from 'date-fns';
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
    days, columns: gridCols, superHeaders, view,
    filteredGroups, expandedGroups, onToggleGroup,
    events, hiddenResources,
    onCellClick, onEventClick, onDeleteEvent, onUpdateEvent,
    onDragStart, onDragOver, onDrop,
    hoveredEventId, onHoverEvent,
    onResizeStart,
    getCellContent,
    showGauges = true,
    readOnly = false,
    isVertical = false
}) => {

    const MIN_WIDTH = view === 'year' ? 80 : (view === 'quarter' || view === 'month' ? 40 : 120);

    const [dragTarget, setDragTarget] = useState(null); // { id: string, pos: 'left' | 'right' }

    const renderEventsForCell = (memberId, dayDate) => {
        // Filtrer les événements pour ce jour et cette ressource
        const dayEvents = events.filter(e =>
            e.resourceId === memberId &&
            isSameDay(parseISO(e.date), dayDate)
        );

        if (dayEvents.length === 0) return null;

        return dayEvents.map(evt => {
            const isBacklog = memberId === 'backlog_confection';
            const style = PLANNING_COLORS[evt.type] || PLANNING_COLORS.default;
            const isValidated = evt.meta?.status === 'validated';
            const borderStyle = isValidated ? 'solid' : 'dashed';
            const fontWeight = isBacklog ? 800 : (isValidated ? 700 : 500);
            const opacity = isValidated || isBacklog ? 1 : 0.9;

            // --- BACKLOG SPECIFIC LOGIC ---
            let progressPercent = 0;
            let plannedHours = 0;
            let totalHours = 0;
            let childEvents = []; // Fix: Declare outside if block

            if (isBacklog) {
                // Calculate dispatched hours from children
                // MATCHING LOGIC: Project ID or Title AND Date Range Intersection

                // Pre-calc view range safely inside loop (safest scope)
                let viewStart = new Date();
                let viewEnd = new Date();

                if (typeof gridCols !== 'undefined' && gridCols && gridCols.length > 0) {
                    viewStart = startOfDay(gridCols[0]);
                    const lastCol = gridCols[gridCols.length - 1];
                    viewEnd = view === 'year'
                        ? endOfMonth(lastCol)
                        : new Date(lastCol.getFullYear(), lastCol.getMonth(), lastCol.getDate(), 23, 59, 59);
                }

                // Filter Loop
                childEvents = events.filter(e => {
                    if (e.resourceId === 'backlog_confection') return false;

                    // 1. Project/Title Match
                    let isMatch = false;
                    if (evt.meta?.projectId && e.meta?.projectId) {
                        isMatch = e.meta.projectId === evt.meta.projectId;
                    } else {
                        const normalize = s => s ? s.toLowerCase().trim() : '';
                        isMatch = normalize(e.title) === normalize(evt.title);
                    }
                    if (!isMatch) return false;

                    // 2. Date Range Intersection Match
                    const eventStart = new Date(e.meta?.start || e.date);
                    const eventEnd = new Date(e.meta?.end || e.date);
                    return (eventStart < viewEnd && eventEnd > viewStart);
                });

                // Sum duration of ALL child events
                const minutes = childEvents.reduce((acc, child) => {
                    const s = new Date(child.meta.start);
                    const e = new Date(child.meta.end);

                    let duration = differenceInMinutes(e, s);

                    // Deduct Lunch Break (12:00-13:00) if event spans across it
                    const lunchStart = new Date(s); lunchStart.setHours(12, 0, 0, 0);
                    const lunchEnd = new Date(s); lunchEnd.setHours(13, 0, 0, 0);

                    if (s < lunchStart && e > lunchEnd) {
                        duration -= 60;
                    } else if (s < lunchEnd && e > lunchStart) {
                        // Partial overlap (rare but possible)
                        // For simplicity, we stick to the standard rule: 
                        // If you work through lunch, you usually split the event.
                        // But let's be robust: subtract overlap.
                        const overlapStart = s < lunchStart ? lunchStart : s;
                        const overlapEnd = e > lunchEnd ? lunchEnd : e;
                        if (overlapStart < overlapEnd) {
                            duration -= differenceInMinutes(overlapEnd, overlapStart);
                        }
                    }

                    return acc + Math.max(0, duration);
                }, 0);

                plannedHours = Math.round(minutes / 60);

                // Total from Master Event
                // If explicit budget is set (via Backlog Modal), use it.
                if (evt.meta?.budgetHours) {
                    totalHours = evt.meta.budgetHours;
                } else {
                    const masterS = new Date(evt.meta.start);
                    const masterE = new Date(evt.meta.end);
                    totalHours = Math.round(differenceInMinutes(masterE, masterS) / 60);
                }

                progressPercent = totalHours > 0 ? (plannedHours / totalHours) * 100 : 0;
            }
            // ------------------------------

            const startStr = evt.meta?.start ? format(new Date(evt.meta.start || evt.date), 'HH:mm') : '08:00';
            const endStr = evt.meta?.end ? format(new Date(evt.meta.end || evt.date), 'HH:mm') : '17:00';
            const labelTime = `${startStr}-${endStr}`;

            // Calcul Position Horizontale
            let leftPercent = 0;
            let widthPercent = 100;

            if (evt.meta?.start && evt.meta?.end) {
                // ... (standard logic) ...
                const s = new Date(evt.meta.start);
                const e = new Date(evt.meta.end);

                // For Backlog, we force full width if it's the start of the week? 
                // User said "Displays on the whole week".
                // We'll keep standard rendering for now, but maybe force color/style.

                const sMinutes = getHours(s) * 60 + getMinutes(s);
                const startWorkMinutes = 8 * 60;
                const relativeStart = Math.max(0, sMinutes - startWorkMinutes);
                leftPercent = (relativeStart / TOTAL_WORK_MINUTES) * 100;

                const duration = Math.min(TOTAL_WORK_MINUTES, Math.max(0, differenceInMinutes(e, s)));
                widthPercent = (duration / TOTAL_WORK_MINUTES) * 100;
            }

            // ... (Fusion Logic reused) ...
            const prevDay = addDays(dayDate, -1);
            const prevEvt = localEventsRef(events).find(e =>
                e.resourceId === memberId &&
                e.meta?.seriesId === evt.meta.seriesId &&
                isSameDay(parseISO(e.date), prevDay)
            );
            const columns = gridCols; // Ensure columns is available for legacy logic if needed
            const prevVisible = true;

            // RE-INSERTING FUSION LOGIC CAREFULLY
            const hasPrev = !!prevEvt;
            let isStartOfVisibleSeries = !hasPrev;
            let widthMultiplier = 1;

            // Simplified width for Backlog to be always visible/distinct
            if (isBacklog) {
                // Backlog styling override
            }

            // ... (rest of fusion logic) ...

            // Custom Backlog Content
            const renderBacklogContent = () => (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <span style={{ fontWeight: 800, fontSize: 11 }}>{evt.title}</span>
                        <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.8)', padding: '1px 4px', borderRadius: 4 }}>
                            {plannedHours}h / {totalHours}h
                        </span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'rgba(0,0,0,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(progressPercent, 100)}%`, background: progressPercent > 100 ? '#EF4444' : '#10B981', height: '100%' }} />
                    </div>
                </div>
            );

            return (
                <div key={evt.id} draggable={!readOnly && !isBacklog} // DISABLE DRAG FOR BACKLOG
                    onMouseEnter={() => onHoverEvent && onHoverEvent(evt.id)}
                    onMouseLeave={() => onHoverEvent && onHoverEvent(null)}
                    onDragStart={(e) => onDragStart(e, evt)}
                    onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(evt);
                    }}
                    title={isBacklog ? `ID:${evt.id} | Enfants:${childEvents.length} | Backlog: ${plannedHours}h / ${totalHours}h planifié` : `${evt.title} (${labelTime})`}
                    style={{
                        position: 'absolute', top: 4, bottom: 4,
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`, // Simplified for now, real fusion logic needs full block
                        backgroundColor: isBacklog ? '#FFF1F2' : style.bg, // Pinkish for Backlog
                        border: `1px solid ${isBacklog ? '#BE123C' : style.border}`,
                        borderLeft: `4px solid ${isBacklog ? '#BE123C' : style.border}`,
                        borderRadius: 8,
                        zIndex: evt.meta?.seriesId ? 20 : 10,
                        padding: '2px 4px',
                        overflow: 'hidden',
                        cursor: 'grab',
                        opacity: opacity,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        // Hatched pattern for Backlog
                        backgroundImage: isBacklog
                            ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(190, 18, 60, 0.05) 10px, rgba(190, 18, 60, 0.05) 20px)'
                            : (style.pattern ? 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.05) 5px, rgba(0,0,0,0.05) 10px)' : 'none')
                    }}
                >
                    {isBacklog ? renderBacklogContent() : (
                        <div style={{ fontSize: 11, fontWeight: fontWeight, color: isBacklog ? '#881337' : style.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {evt.title}
                        </div>
                    )}

                    {/* ... Icons (Check, Delete, Resize) ... */}
                    {!isBacklog && isValidated && (
                        <CheckCircle size={10} color={style.text} style={{ position: 'absolute', bottom: 2, right: 2 }} />
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
                    {gridCols.map(col => (
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
                    {gridCols.map(col => (
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
            // EXCLUDE BACKLOG FROM CAPACITY
            const realMembersCount = memberIds.filter(id => id !== 'backlog_confection').length;
            theoreticalCapacity += realMembersCount * 8 * workDaysCount;
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
                <div style={{ display: 'grid', gridTemplateColumns: `260px repeat(${gridCols.length}, minmax(${MIN_WIDTH}px, 1fr))`, gridAutoRows: 'max-content', width: 'max-content', minWidth: '100%' }}>
                    <StickyCorner style={{ height: HEADER_HEIGHT_1, borderBottom: 'none' }} />
                    {superHeaders.map((header, i) => (<div key={i} style={{ gridColumn: `span ${header.span}`, position: 'sticky', top: 0, zIndex: 40, background: 'white', borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 }}>{header.label}</div>))}
                    <StickyCorner style={{ top: HEADER_HEIGHT_1, height: HEADER_HEIGHT_2 }}>Ressources</StickyCorner>
                    {gridCols.map(col => (<StickyTopCell key={col.toString()} style={{ top: HEADER_HEIGHT_1, height: HEADER_HEIGHT_2, background: isSameDay(col, new Date()) && view !== 'year' ? '#EFF6FF' : 'white', color: isSameDay(col, new Date()) && view !== 'year' ? '#2563EB' : '#4B5563' }}>{getCellContent(col)}</StickyTopCell>))}

                    {Object.entries(filteredGroups).map(([key, group]) => {
                        const activeMembers = group.members.filter(m => !hiddenResources.includes(m.id));
                        // Calc Global Stats for Header
                        const groupStats = getStats(activeMembers.map(m => m.id), gridCols, events);

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

                                {expandedGroups[key] && group.members.map(member => (
                                    <React.Fragment key={member.id}>
                                        <StickyLeftCell style={{ paddingLeft: 42, color: member.id === 'backlog_confection' ? '#BE123C' : '#4B5563', fontWeight: member.id === 'backlog_confection' ? 700 : 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>{member.first_name} {member.last_name?.charAt(0)}.</span>

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
                                                    <span style={{ fontSize: 11, background: '#FFE4E6', color: '#BE123C', padding: '1px 6px', borderRadius: 4, marginLeft: 8 }}>
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
                                                                    height: ROW_HEIGHT,
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    background: binIndex % 2 === 0 ? '#FFF1F2' : '#FDF2F8',
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
                                                                    e.currentTarget.style.background = binIndex % 2 === 0 ? '#FFF1F2' : '#FDF2F8';
                                                                }}
                                                                onDrop={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    e.currentTarget.style.background = binIndex % 2 === 0 ? '#FFF1F2' : '#FDF2F8';

                                                                    const type = e.dataTransfer.getData('type');
                                                                    if (type !== 'backlog-sort') return;
                                                                    const sourceId = e.dataTransfer.getData('text/plain');

                                                                    const evt = events.find(ev => ev.id === sourceId);
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
                                                                {/* Bin Header */}
                                                                <div style={{
                                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                                    padding: '2px 8px', background: 'rgba(255,255,255,0.5)', borderBottom: '1px dashed #FECDD3',
                                                                    fontSize: 10, fontWeight: 700, color: '#9F1239', height: 20
                                                                }}>
                                                                    <span>SEM {weekNum}</span>
                                                                    <span style={{ color: isOverloaded ? '#EF4444' : '#9F1239' }}>
                                                                        {binLoadHours}h / {binCapHours}h
                                                                    </span>
                                                                </div>

                                                                {/* Cards Container */}
                                                                <div style={{
                                                                    flex: 1,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    overflowX: 'auto',
                                                                    padding: '0 4px',
                                                                    gap: 4
                                                                }}>
                                                                    {binEvents.map(evt => {
                                                                        // Reuse progress Logic
                                                                        let plannedHours = 0;
                                                                        let totalHours = 0;
                                                                        if (evt.meta?.budgetHours) totalHours = parseFloat(evt.meta.budgetHours);
                                                                        else totalHours = Math.round(differenceInMinutes(new Date(evt.meta.end), new Date(evt.meta.start)) / 60);

                                                                        const childEvents = events.filter(e => {
                                                                            if (e.resourceId === 'backlog_confection') return false;

                                                                            // 1. Date Range Match (Must be within this bin)
                                                                            const s = new Date(e.meta?.start || e.date);
                                                                            const end = new Date(e.meta?.end || e.date);
                                                                            if (s >= binEnd || end <= binStart) return false;

                                                                            // 2. Project/Title Match
                                                                            let isMatch = false;
                                                                            if (evt.meta?.projectId && e.meta?.projectId) isMatch = e.meta.projectId === evt.meta.projectId;
                                                                            else {
                                                                                const normalize = s => s ? s.toLowerCase().trim() : '';
                                                                                isMatch = normalize(e.title) === normalize(evt.title);
                                                                            }
                                                                            return isMatch;
                                                                        });
                                                                        const minutes = childEvents.reduce((acc, child) => {
                                                                            const s = new Date(child.meta.start);
                                                                            const e = new Date(child.meta.end);
                                                                            let d = differenceInMinutes(e, s);
                                                                            const lStart = new Date(s); lStart.setHours(12, 0, 0, 0);
                                                                            if (s < lStart && e > lStart) d -= 60;
                                                                            return acc + Math.max(0, d);
                                                                        }, 0);
                                                                        plannedHours = Math.round(minutes / 60);
                                                                        const progressPercent = totalHours > 0 ? (plannedHours / totalHours) * 100 : 0;

                                                                        return (
                                                                            <div
                                                                                key={evt.id}
                                                                                draggable
                                                                                onDragStart={(e) => {
                                                                                    e.stopPropagation();
                                                                                    e.dataTransfer.setData('text/plain', evt.id);
                                                                                    e.dataTransfer.setData('type', 'backlog-sort');
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
                                                                                    console.log('DROP DEBUG', { id: evt.id, pos: currentDragPos, dragTarget });
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
                                                                                        const sourceEvt = events.find(ev => ev.id === sourceId);
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
                                                                                    minWidth: 140,
                                                                                    maxWidth: 160,
                                                                                    height: 'calc(100% - 4px)',
                                                                                    background: 'white',
                                                                                    border: '1px solid #FECDD3',
                                                                                    borderRadius: 4,
                                                                                    padding: 4,
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
                                                                                <div style={{ fontSize: 11, fontWeight: 600, color: '#9F1239', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                                    {evt.title}
                                                                                </div>
                                                                                <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                                                                                    <div style={{ width: `${Math.min(progressPercent, 100)}%`, height: '100%', background: '#10B981' }} />
                                                                                </div>
                                                                                <div style={{ fontSize: 9, color: '#6B7280', textAlign: 'right', marginTop: 2 }}>
                                                                                    {plannedHours}/{totalHours}h
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}

                                                                    <div
                                                                        onClick={() => onCellClick(member.id, binStart)}
                                                                        style={{
                                                                            minWidth: 30, height: 30, borderRadius: '50%', background: 'white',
                                                                            border: '1px dashed #FECDD3', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                            cursor: 'pointer', color: '#FDA4AF', marginLeft: 4
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
                                            gridCols.map(col => (
                                                <div
                                                    key={`${member.id}-${col}`}
                                                    onClick={() => onCellClick(member.id, col)}
                                                    onDragOver={onDragOver}
                                                    onDrop={(e) => onDrop(e, member.id, col)}
                                                    style={{ borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #F3F4F6', background: (view !== 'year' && isSameDay(col, new Date())) ? '#F9FAFB' : 'transparent', height: ROW_HEIGHT, position: 'relative' }}
                                                >
                                                    {renderEventsForCell(member.id, col)}
                                                </div>
                                            ))
                                        )}
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
                        const globalStats = getStats(allMemberIds, gridCols, events);

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
