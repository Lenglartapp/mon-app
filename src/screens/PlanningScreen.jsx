import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../auth';
import {
    format, startOfWeek, addDays, getHours, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval,
    startOfQuarter, endOfQuarter, startOfYear, endOfYear, eachMonthOfInterval,
    addMonths, subMonths, addQuarters, subQuarters, addYears, subYears,
    differenceInDays, setHours, setMinutes,
    isWeekend, parseISO, differenceInMinutes, getMinutes
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCapacityPlanning } from '../hooks/useCapacityPlanning';
import { can } from '../lib/authz';
import { uid } from '../lib/utils/uid';
import { INITIAL_GROUPS_CONFIG, WORK_START_HOUR, WORK_END_HOUR } from '../components/planning/constants';
import EventModal from '../components/planning/EventModal';
import ResourcePanel from '../components/planning/ResourcePanel';
import PlanningTopBar from '../components/planning/PlanningTopBar';
import PlanningGrid from '../components/planning/PlanningGrid';
import AssistantView from '../components/planning/AssistantView';

export default function PlanningScreen({ projects, events: initialEvents, onUpdateEvent, onDeleteEvent: onDeleteEventProp, onBack }) {
    const { users: authUsers, currentUser } = useAuth();
    const canEdit = can(currentUser, 'planning.edit');
    const showGauges = can(currentUser, 'planning.view_gauges');

    // STATE LOCAL USERS (pour permettre renommage en pseudo temps réel)
    const [localUsers, setLocalUsers] = useState(authUsers || []);

    // Sync if authUsers changes but keep local improvements if unmatched
    useEffect(() => {
        if (authUsers && authUsers.length > 0 && localUsers.length === 0) {
            setLocalUsers(authUsers);
        }
    }, [authUsers]);

    // Handler pour update user (Renommage Interim)
    const handleUpdateUser = (updatedUser) => {
        setLocalUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    };

    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState('week');
    const [showWeekends, setShowWeekends] = useState(false);
    const [customRange, setCustomRange] = useState(null);
    const [expandedGroups, setExpandedGroups] = useState({ pose: true, conf: true, prepa: true });

    // MODALE & EVENTS
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [localEvents, setLocalEvents] = useState(initialEvents || []);

    // --- STATE ÉDITION & DRAG ---
    const [editingEvent, setEditingEvent] = useState(null);
    const [draggedEvent, setDraggedEvent] = useState(null);
    const [initialModalData, setInitialModalData] = useState(null);
    const [hoveredEventId, setHoveredEventId] = useState(null);
    const [hiddenResources, setHiddenResources] = useState([]); // Nouveau state pour masquer
    const [showResourcePanel, setShowResourcePanel] = useState(false); // Panel gestion équipe

    // --- RESIZING STATE & LOGIC ---
    // Note: La logique de resize complexe est gérée globalement via listener window
    // Mais l'initialisation du resize se fait depuis la grille
    const [resizingEvent, setResizingEvent] = useState(null);
    const resizeRef = React.useRef(null);

    useEffect(() => {
        resizeRef.current = resizingEvent;
    }, [resizingEvent]);

    useEffect(() => {
        if (!resizingEvent) return;

        const handleResizeMove = (e) => {
            if (!resizeRef.current) return;
            const state = resizeRef.current;
            const diffX = e.clientX - state.startX;
            const slotsDiff = Math.round(diffX / state.cellWidth);

            if (slotsDiff === 0) return;
            // Note: Implémentation simplifiée pour le refactoring. 
            // Idéalement on recalcule la date de fin en fonction des slots.
        };

        const handleResizeUp = (e) => {
            setResizingEvent(null);
        };

        window.addEventListener('mousemove', handleResizeMove);
        window.addEventListener('mouseup', handleResizeUp);
        return () => {
            window.removeEventListener('mousemove', handleResizeMove);
            window.removeEventListener('mouseup', handleResizeUp);
        };
    }, [resizingEvent]);

    // --- NAVIGATION TIME ---
    const navPrev = () => { if (view === 'month') setCurrentDate(d => subMonths(d, 1)); else if (view === 'quarter') setCurrentDate(d => subQuarters(d, 1)); else if (view === 'year') setCurrentDate(d => subYears(d, 1)); else setCurrentDate(d => addDays(d, view === 'day' ? -1 : -7)); };
    const navNext = () => { if (view === 'month') setCurrentDate(d => addMonths(d, 1)); else if (view === 'quarter') setCurrentDate(d => addQuarters(d, 1)); else if (view === 'year') setCurrentDate(d => addYears(d, 1)); else setCurrentDate(d => addDays(d, view === 'day' ? 1 : 7)); };

    // --- RECHERCHE MULTI-CRITÈRES ---
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilters, setActiveFilters] = useState([]);

    // --- CONSTRUCTION DYNAMIQUE DES GROUPES ---
    const groupsConfig = useMemo(() => {
        if (!localUsers || localUsers.length === 0) return INITIAL_GROUPS_CONFIG;

        const config = {
            prepa: { ...INITIAL_GROUPS_CONFIG.prepa, members: [] },
            conf: { ...INITIAL_GROUPS_CONFIG.conf, members: [] },
            pose: { ...INITIAL_GROUPS_CONFIG.pose, members: [] }
        };

        localUsers.forEach(u => {
            if (u.role && config[u.role]) {
                config[u.role].members.push(u);
            }
        });

        return config;
    }, [localUsers]);

    // --- FILTRAGE DES RESSOURCES MASQUÉES ---
    const visibleGroupsConfig = useMemo(() => {
        const config = JSON.parse(JSON.stringify(groupsConfig));
        Object.keys(config).forEach(key => {
            config[key].members = config[key].members.filter(m => !hiddenResources.includes(m.id));
        });
        return config;
    }, [groupsConfig, hiddenResources]);


    // --- MODE ASSISTANT ---
    const [assistantMode, setAssistantMode] = useState(false);

    // Calcul dynamique des capacités
    const capacityConfig = useMemo(() => ({
        conf: visibleGroupsConfig.conf.members.length,
        pose: visibleGroupsConfig.pose.members.length
    }), [visibleGroupsConfig]);

    const { projectStats: stats } = useCapacityPlanning(projects, localEvents, capacityConfig);

    const filteredGroups = useMemo(() => {
        if (activeFilters.length === 0 && !searchQuery) return visibleGroupsConfig;

        // TODO: Implémenter logique de filtrage avancée si nécessaire
        return visibleGroupsConfig;
    }, [visibleGroupsConfig, activeFilters, searchQuery]);


    // --- HANDLERS ÉVÉNEMENTS ---

    const handleSaveEvent = (eventData) => {
        let newEvents = localEvents;
        if (eventData.id) {
            newEvents = newEvents.filter(e => e.id !== eventData.id && e.meta?.seriesId !== eventData.meta?.seriesId);
        }

        const days = eachDayOfInterval({ start: new Date(eventData.startDate), end: new Date(eventData.endDate) });
        const seriesId = uid();
        const createdEvents = [];

        days.forEach(d => {
            if (!showWeekends && isWeekend(d)) return;

            eventData.resourceIds.forEach(resId => {
                const assignedUser = localUsers.find(u => u.id === resId);
                const assignedName = assignedUser ? `${assignedUser.first_name} ${assignedUser.last_name || ''}`.trim() : 'Inconnu';

                createdEvents.push({
                    id: uid(),
                    resourceId: resId,
                    date: format(d, 'yyyy-MM-dd'),
                    title: eventData.title,
                    type: eventData.type,
                    meta: {
                        startDate: eventData.startDate, // Legacy naming ? check usage in modal
                        start: format(d, 'yyyy-MM-dd') + 'T' + eventData.startTime,
                        end: format(d, 'yyyy-MM-dd') + 'T' + eventData.endTime,
                        description: eventData.description,
                        projectId: eventData.projectId,
                        seriesId: seriesId,
                        assigned_name: assignedName,
                        status: 'validated'
                    }
                });
            });
        });

        setLocalEvents([...newEvents, ...createdEvents]);
    };

    const handleDeleteEvent = (evt) => {
        setLocalEvents(prev => prev.filter(e => e.id !== evt.id));
        if (onDeleteEventProp) onDeleteEventProp(evt);
    };

    const handleInlineDeleteEvent = (evt) => {
        if (window.confirm('Supprimer ce créneau ?')) {
            if (evt.meta?.seriesId) {
                setLocalEvents(prev => prev.filter(e => e.meta?.seriesId !== evt.meta.seriesId));
            } else {
                handleDeleteEvent(evt);
            }
        }
    };

    const handleEventClick = (evt) => {
        if (evt.meta?.seriesId) {
            const seriesEvents = localEvents.filter(e => e.meta?.seriesId === evt.meta.seriesId);
            seriesEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
            if (seriesEvents.length > 0) {
                const first = seriesEvents[0];
                const last = seriesEvents[seriesEvents.length - 1];
                const agg = {
                    ...first,
                    meta: { ...first.meta, end: last.meta.end || last.date }
                };
                setEditingEvent(agg);
            }
        } else {
            setEditingEvent(evt);
        }
        setIsModalOpen(true);
    };

    const handleValidateEvent = (evt) => {
        const newStatus = 'validated';
        const updater = e => ({ ...e, meta: { ...e.meta, status: newStatus } });
        if (evt.meta?.seriesId) {
            setLocalEvents(prev => prev.map(e => e.meta?.seriesId === evt.meta.seriesId ? updater(e) : e));
        } else {
            setLocalEvents(prev => prev.map(e => e.id === evt.id ? updater(e) : e));
        }
    };

    const handleAddAbsence = (resourceId, type, startStr, startTime, endStr, endTime) => {
        const startDate = new Date(startStr);
        const endDate = new Date(endStr);
        const newEvents = [];
        const seriesId = uid();

        try {
            const days = eachDayOfInterval({ start: startDate, end: endDate });
            days.forEach(dayDate => {
                if (!showWeekends && isWeekend(dayDate)) return;
                const dayStr = format(dayDate, 'yyyy-MM-dd');
                const startDateTime = new Date(`${dayStr}T${startTime}`);
                const endDateTime = new Date(`${dayStr}T${endTime}`);

                newEvents.push({
                    id: uid(),
                    title: type, // 'Congés', etc.
                    resourceId: resourceId,
                    date: dayStr,
                    duration: 1,
                    type: 'absence',
                    meta: {
                        start: startDateTime.toISOString(),
                        end: endDateTime.toISOString(),
                        status: 'validated',
                        description: `${type} - Absence déclarée via panneau`,
                        seriesId: seriesId,
                        type: type // Sous-type important pour PlanningGrid
                    }
                });
            });
            setLocalEvents(prev => [...prev, ...newEvents]);
        } catch (e) {
            console.error("Erreur création absence", e);
        }
    };

    // --- DRAG AND DROP HANDLERS ---
    const handleDragStart = (e, evt) => {
        setDraggedEvent(evt);
    };
    const handleDragOver = (e) => e.preventDefault();
    const handleDrop = (e, resourceId, date) => {
        e.preventDefault();
        if (!draggedEvent) return;

        // Calcul décalage jour
        const oldDate = parseISO(draggedEvent.date);
        const diffDays = differenceInDays(date, oldDate);

        // Si série
        if (draggedEvent.meta?.seriesId) {
            setLocalEvents(prev => prev.map(evt => {
                if (evt.meta?.seriesId === draggedEvent.meta.seriesId) {
                    const newDate = addDays(parseISO(evt.date), diffDays);
                    const newDateStr = format(newDate, 'yyyy-MM-dd');
                    // Update meta start/end too
                    // Simplifié: on garde l'heure
                    return {
                        ...evt,
                        date: newDateStr,
                        resourceId: resourceId // Move to new resource
                    };
                }
                return evt;
            }));
        } else {
            // Single event
            const newDateStr = format(date, 'yyyy-MM-dd');
            setLocalEvents(prev => prev.map(evt => {
                if (evt.id === draggedEvent.id) {
                    return { ...evt, date: newDateStr, resourceId: resourceId };
                }
                return evt;
            }));
        }
        setDraggedEvent(null);
    };

    const handleCellClick = (resourceId, col) => {
        if (!canEdit) return;
        setInitialModalData({ resourceId, date: format(col, 'yyyy-MM-dd') });
        setIsModalOpen(true);
    };

    // --- COLUMNS GENERATION ---
    const columns = useMemo(() => {
        let cols = [];
        if (view === 'day') cols = [currentDate];
        else if (view === 'week') cols = Array.from({ length: 7 }).map((_, i) => addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i));
        else if (view === 'month') cols = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
        else if (view === 'quarter') cols = eachDayOfInterval({ start: startOfQuarter(currentDate), end: endOfQuarter(currentDate) });
        else if (view === 'year') cols = eachMonthOfInterval({ start: startOfYear(currentDate), end: endOfYear(currentDate) });
        else if (view === 'custom' && customRange) cols = eachDayOfInterval(customRange);
        else cols = [currentDate];

        if (!showWeekends && view !== 'year') {
            return cols.filter(d => !isWeekend(d));
        }
        return cols;
    }, [view, currentDate, customRange, showWeekends]);

    const superHeaders = useMemo(() => {
        const headers = [];
        let currentLabel = '';
        let spanCount = 0;
        columns.forEach((col, index) => {
            let label = '';
            if (view === 'week') label = `Semaine ${format(col, 'w')}`;
            else if (view === 'year') label = format(col, 'yyyy');
            else label = format(col, 'MMMM yyyy', { locale: fr });
            if (label === currentLabel) { spanCount++; }
            else { if (currentLabel) headers.push({ label: currentLabel, span: spanCount }); currentLabel = label; spanCount = 1; }
            if (index === columns.length - 1) headers.push({ label: currentLabel, span: spanCount });
        });
        return headers;
    }, [columns, view]);

    const getCellContent = (col) => {
        if (view === 'year') return format(col, 'MMM', { locale: fr });
        if (view === 'quarter' || view === 'month') return format(col, 'd');
        return format(col, 'EE d', { locale: fr });
    };

    const handleResizeStart = (startState) => {
        setResizingEvent(startState);
    };


    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#FAF5EE' }}>
            <PlanningTopBar
                view={view}
                onViewChange={(v) => { setView(v); if (v === 'custom') setCustomRange(null); }}
                showWeekends={showWeekends}
                onToggleWeekends={setShowWeekends}
                currentDate={currentDate}
                onPrev={navPrev}
                onNext={navNext}
                onToday={() => setCurrentDate(new Date())}
                customRange={customRange}
                onCustomRangeChange={(r) => { setCustomRange(r); setView('custom'); }}
                onNew={() => { if (canEdit) { setEditingEvent(null); setIsModalOpen(true); } }}
                onManageTeam={() => setShowResourcePanel(true)}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                activeFilters={activeFilters}
                onAddFilter={(f) => setActiveFilters([...activeFilters, f])}
                onRemoveFilter={(f) => setActiveFilters(activeFilters.filter(x => x !== f))}
                assistantMode={assistantMode}
                onToggleAssistant={() => setAssistantMode(!assistantMode)}
            />

            <EventModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingEvent(null); setInitialModalData(null); }}
                onSave={handleSaveEvent}
                onValidate={handleValidateEvent}
                onDelete={handleDeleteEvent}
                projects={projects}
                eventToEdit={editingEvent}
                initialData={initialModalData}
                currentUser={currentUser}
                groupsConfig={visibleGroupsConfig}
                readOnly={!canEdit}
            />

            <ResourcePanel
                isOpen={showResourcePanel}
                onClose={() => setShowResourcePanel(false)}
                users={localUsers}
                hiddenResources={hiddenResources}
                onToggleVisibility={(id) => {
                    if (hiddenResources.includes(id)) setHiddenResources(hiddenResources.filter(x => x !== id));
                    else setHiddenResources([...hiddenResources, id]);
                }}
                onAddAbsence={handleAddAbsence}
                onUpdateUser={handleUpdateUser}
            />

            {assistantMode ? (
                <AssistantView stats={stats} />
            ) : (
                <PlanningGrid
                    days={columns}
                    columns={columns}
                    superHeaders={superHeaders}
                    view={view}
                    filteredGroups={filteredGroups}
                    expandedGroups={expandedGroups}
                    onToggleGroup={(key) => setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }))}
                    events={localEvents}
                    hiddenResources={hiddenResources}
                    onCellClick={handleCellClick}
                    onEventClick={handleEventClick}
                    onDeleteEvent={handleInlineDeleteEvent}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    hoveredEventId={hoveredEventId}
                    onHoverEvent={setHoveredEventId}
                    onResizeStart={handleResizeStart}
                    getCellContent={getCellContent}
                    readOnly={!canEdit}
                    showGauges={showGauges}
                />
            )}
        </div>
    );
}