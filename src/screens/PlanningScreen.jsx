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
import { INITIAL_GROUPS_CONFIG, WORK_START_HOUR, WORK_END_HOUR, TOTAL_WORK_MINUTES } from '../components/planning/constants';
import EventModal from '../components/planning/EventModal';
import ResourcePanel from '../components/planning/ResourcePanel';
import PlanningTopBar from '../components/planning/PlanningTopBar';
import PlanningGrid from '../components/planning/PlanningGrid';
import AssistantView from '../components/planning/AssistantView';

export default function PlanningScreen({ projects, events: initialEvents, onUpdateEvent, onDeleteEvent: onDeleteEventProp, onUpdateProject, onBack }) {
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
    const [myViewMode, setMyViewMode] = useState(false); // Mode "Ma Vue" (Agenda Perso)

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

            // 1. Calculate Delta Visual Minutes (08h-17h timeline)
            // columnPixelWidth = 9h = 540min
            const minutesPerPixel = TOTAL_WORK_MINUTES / state.columnPixelWidth;
            let deltaVisualMinutes = diffX * minutesPerPixel;

            // 2. Determine Candidate End Date (Visual Projection)
            // We project the initial end date by deltaVisualMinutes, skipping nights (17h->08h)
            // but INCLUDING lunch (visually linear).
            const initialStart = new Date(state.initialSeries[0].meta.start || state.initialSeries[0].date);
            // Robust initialEnd finding (sort is safe due to init)
            const lastEvt = state.initialSeries[state.initialSeries.length - 1];
            const initialEnd = new Date(lastEvt.meta.end || lastEvt.date);

            // Helper: Add Visual Minutes (08-17)
            const addVisualMinutes = (date, minutes) => {
                let d = new Date(date);
                let minsToAdd = Math.round(minutes);
                // Safety loop
                let safety = 0;
                while (minsToAdd !== 0 && safety < 1000) {
                    safety++;
                    const currentHour = getHours(d);
                    const currentMin = getMinutes(d);
                    const minOfDay = currentHour * 60 + currentMin; // e.g. 17*60=1020
                    const workEndMin = WORK_END_HOUR * 60; // 17*60
                    const workStartMin = WORK_START_HOUR * 60; // 8*60

                    if (minsToAdd > 0) {
                        // Forward
                        const remainingToday = workEndMin - minOfDay;
                        if (minsToAdd <= remainingToday) {
                            d = new Date(d.getTime() + minsToAdd * 60000);
                            minsToAdd = 0;
                        } else {
                            // Consume today
                            d = new Date(d.getTime() + remainingToday * 60000);
                            minsToAdd -= remainingToday;
                            // Jump to next morning
                            d = addDays(d, 1);
                            d.setHours(WORK_START_HOUR, 0, 0, 0);
                            // Skip weekends? (User didn't specify, but safer)
                            while (!showWeekends && isWeekend(d)) {
                                d = addDays(d, 1);
                            }
                        }
                    } else {
                        // Backward
                        const passedToday = minOfDay - workStartMin;
                        if (Math.abs(minsToAdd) <= passedToday) {
                            d = new Date(d.getTime() + minsToAdd * 60000); // minsToAdd is negative
                            minsToAdd = 0;
                        } else {
                            // Consume today
                            d = new Date(d.getTime() - passedToday * 60000);
                            minsToAdd += passedToday;
                            // Jump to prev evening
                            d = addDays(d, -1);
                            d.setHours(WORK_END_HOUR, 0, 0, 0);
                            while (!showWeekends && isWeekend(d)) {
                                d = addDays(d, -1);
                            }
                        }
                    }
                }
                return d;
            };

            const candidateEnd = addVisualMinutes(initialEnd, deltaVisualMinutes);

            // 3. Calculate Work Duration (08-12, 13-17)
            // Between initialStart and candidateEnd.
            const getWorkMinutes = (s, e) => {
                if (s >= e) return 0;
                let total = 0;
                let current = new Date(s);
                // Align start time rules
                // If s is in 12-13, effective start for work is 13.
                // If s < 8, effective is 8.
                // If s > 17, effective is next day 8.
                // We assume start is valid (snapped).

                // Iterate days
                const end = new Date(e);
                while (current < end) {
                    const cYear = current.getFullYear();
                    const cMonth = current.getMonth();
                    const cDate = current.getDate();

                    // Define blocks for current day
                    const block1Start = new Date(cYear, cMonth, cDate, 8, 0, 0);
                    const block1End = new Date(cYear, cMonth, cDate, 12, 0, 0);
                    const block2Start = new Date(cYear, cMonth, cDate, 13, 0, 0);
                    const block2End = new Date(cYear, cMonth, cDate, 17, 0, 0);

                    // Calc overlap
                    const overlap1 = Math.max(0, differenceInMinutes(Math.min(end, block1End), Math.max(current, block1Start)));
                    const overlap2 = Math.max(0, differenceInMinutes(Math.min(end, block2End), Math.max(current, block2Start)));

                    total += overlap1 + overlap2;

                    // Move to next day
                    current = addDays(current, 1);
                    current.setHours(8, 0, 0, 0);
                    while (!showWeekends && isWeekend(current)) {
                        current = addDays(current, 1);
                    }
                }
                return total;
            };

            const rawWorkDuration = getWorkMinutes(initialStart, candidateEnd);

            // 4. Snap to 2h (120min)
            // Minimum 2h
            const snappedDuration = Math.max(120, Math.round(rawWorkDuration / 120) * 120);

            // 5. Project Final End Date (Work Time Projection)
            // Add snappedDuration to initialStart, skipping 12-13 and nights.
            const addWorkMinutes = (date, minutes) => {
                let remaining = minutes;
                let current = new Date(date);

                while (remaining > 0) {
                    const cYear = current.getFullYear();
                    const cMonth = current.getMonth();
                    const cDate = current.getDate();

                    // Check current position and remaining blocks today
                    // Blocks: 08-12, 13-17.
                    const b1S = new Date(cYear, cMonth, cDate, 8, 0, 0);
                    const b1E = new Date(cYear, cMonth, cDate, 12, 0, 0);
                    const b2S = new Date(cYear, cMonth, cDate, 13, 0, 0);
                    const b2E = new Date(cYear, cMonth, cDate, 17, 0, 0);

                    // If current < b1S, jump to b1S
                    if (current < b1S) current = b1S;

                    if (current < b1E) {
                        const available = differenceInMinutes(b1E, current);
                        const take = Math.min(remaining, available);
                        current = new Date(current.getTime() + take * 60000);
                        remaining -= take;
                        if (remaining <= 0) break;
                    }

                    // If we are at b1E (12:00) or between b1E and b2S, jump to b2S
                    if (current >= b1E && current < b2S) current = b2S;

                    if (current < b2E) {
                        const available = differenceInMinutes(b2E, current);
                        const take = Math.min(remaining, available);
                        current = new Date(current.getTime() + take * 60000);
                        remaining -= take;
                        if (remaining <= 0) break;
                    }

                    // If reached b2E (17:00), next day
                    if (current >= b2E) {
                        current = addDays(current, 1);
                        current.setHours(8, 0, 0, 0);
                        while (!showWeekends && isWeekend(current)) {
                            current = addDays(current, 1);
                        }
                    }
                }
                return current;
            };

            const finalEnd = addWorkMinutes(initialStart, snappedDuration);

            // 6. Redistribute into Segments (Standard Rendering Splitting)
            // We have New End Date. We now just split this interval [initialStart, finalEnd] 
            // into display segments (standard logic: one segment per day, respecting 8-17 visual bounds).
            // NOTE: But display must also respect lunch? 
            // No, the grid is continuous 08-17 visual. 
            // If I have an event 08-15 (skipping lunch), visually it is 08-12 + 12-?? 
            // The grid doesn't have a gap for lunch.
            // If I work 08-15 (with lunch break), it means 08-12 work, 12-13 break, 13-15 work.
            // So I finish at 15:00.
            // Visually on valid grid 08-17: 08:00 to 15:00.
            // Does the user want the event to visually BREAK at 12?
            // User: "globalement, ça fait 2h, 8h, 10h, 2h, 10h, midi, 2h, 13h, 15h et 2h, 15h, 17h"
            // Implies alignment.
            // If I end at 15:00, the event is 08:00-15:00.
            // My logic above calculates finalEnd correctly (15:00).
            // Now I just need to generate the segments for localEvents.

            let segCurrent = new Date(initialStart);
            let finalSegments = [];

            while (segCurrent < finalEnd) {
                const segDayStr = format(segCurrent, 'yyyy-MM-dd');
                const dayEnd = new Date(segCurrent);
                dayEnd.setHours(17, 0, 0, 0);

                const effectiveEnd = (finalEnd < dayEnd) ? finalEnd : dayEnd;

                finalSegments.push({
                    date: segDayStr,
                    start: segCurrent,
                    end: effectiveEnd
                });

                // Next day
                if (effectiveEnd >= finalEnd) break;
                segCurrent = addDays(segCurrent, 1);
                segCurrent.setHours(8, 0, 0, 0);
                while (!showWeekends && isWeekend(segCurrent)) {
                    segCurrent = addDays(segCurrent, 1);
                }
            }

            // --- APPLY TO LOCAL EVENTS ---
            const currentSeriesId = state.seriesId || state.tempSeriesId;
            const otherEvents = localEvents.filter(e => {
                if (state.seriesId) return e.meta?.seriesId !== state.seriesId;
                return e.id !== state.initialSeries[0].id;
            });

            const newTemps = finalSegments.map(seg => ({
                id: uid(),
                resourceId: state.resourceId,
                title: state.title,
                type: state.type,
                date: seg.date,
                meta: {
                    ...state.meta,
                    start: seg.start.toISOString(),
                    end: seg.end.toISOString(),
                    seriesId: currentSeriesId,
                    status: state.meta.status
                }
            }));

            setLocalEvents([...otherEvents, ...newTemps]);
        };

        const handleResizeUp = (e) => {
            // PERSIST CHANGES
            // The localEvents are already updated visually.
            // We just need to trigger onUpdateEvent / onDeleteEvent for the server.

            // We need to know the Final Series derived in handleResizeMove.
            // But handleResizeMove doesn't persist.
            // Simplest: Just call onUpdateEvent for all events in the current series found in localEvents.

            const currentSeriesId = resizeRef.current.seriesId || resizeRef.current.tempSeriesId;

            // 1. Delete Old Series on Server? 
            // Best practice: The persistence in 'handleSaveEvent' deletes old if ID matches.
            // Here 'onUpdateEvent' usually updates/creates.
            // For resizing, we might have added/removed days.
            // Strategy: Delete original series, then Create new events.

            if (onDeleteEventProp && resizeRef.current.seriesId) {
                // Delete all events of original series using meta logic
                // But wait, we don't have batch delete.
                // We can just rely on updating 'localEvents' and assume parent handles sync?
                // No, PlanningScreen is responsible for calling onUpdateEvent.

                // A bit complex to sync differential changes.
                // BRUTE FORCE:
                // 1. Find the new events in localEvents (they have IDs generated in Move).
                // 2. Identify which matched old events (none, IDs regenerated).
                // 3. Delete *Original* IDs.
                // 4. Create *New* Events.

                const originalIds = resizeRef.current.initialSeries.map(e => e.id);
                originalIds.forEach(id => onDeleteEventProp({ id }));

                // Find new ones (by seriesId)
                const newEvents = localEvents.filter(e => e.meta?.seriesId === currentSeriesId);
                newEvents.forEach(evt => onUpdateEvent(evt));

            } else {
                // Single event resized into series?
                if (onDeleteEventProp) onDeleteEventProp({ id: resizeRef.current.initialSeries[0].id });
                const newEvents = localEvents.filter(e => e.meta?.seriesId === currentSeriesId);
                newEvents.forEach(evt => onUpdateEvent(evt));
            }

            setResizingEvent(null);
        };

        window.addEventListener('mousemove', handleResizeMove);
        window.addEventListener('mouseup', handleResizeUp);
        return () => {
            window.removeEventListener('mousemove', handleResizeMove);
            window.removeEventListener('mouseup', handleResizeUp);
        };
    }, [resizingEvent, localEvents, showWeekends]);

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
        if (myViewMode && currentUser) {
            const config = JSON.parse(JSON.stringify(visibleGroupsConfig));
            Object.keys(config).forEach(key => {
                config[key].members = config[key].members.filter(m => m.id === currentUser.id || m.email === currentUser.email);
            });
            return config;
        }

        if (activeFilters.length === 0 && !searchQuery) return visibleGroupsConfig;

        // TODO: Implémenter logique de filtrage avancée si nécessaire
        return visibleGroupsConfig;
    }, [visibleGroupsConfig, activeFilters, searchQuery, myViewMode, currentUser]);

    const handleToggleMyView = () => {
        if (!myViewMode) {
            setMyViewMode(true);
            setView('day');
            setCurrentDate(new Date());
        } else {
            setMyViewMode(false);
            setView('week');
        }
    };


    // --- HANDLERS ÉVÉNEMENTS ---

    const handleSaveEvent = (eventData) => {
        let newEvents = localEvents;

        // PERSISTENCE: Suppression ancienne version (si édition)
        if (eventData.id) {
            const eventsToDelete = localEvents.filter(e =>
                e.id === eventData.id ||
                (eventData.meta?.seriesId && e.meta?.seriesId === eventData.meta?.seriesId)
            );
            eventsToDelete.forEach(e => {
                if (onDeleteEventProp) onDeleteEventProp(e.id);
            });

            // Filtre local
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

                const evt = {
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
                        status: eventData.status || 'pending'
                    }
                };

                createdEvents.push(evt);
                // PERSIST: CREATE
                if (onUpdateEvent) onUpdateEvent(evt);
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
            // Update local
            setLocalEvents(prev => prev.map(e => e.meta?.seriesId === evt.meta.seriesId ? updater(e) : e));
            // Persist
            localEvents.filter(e => e.meta?.seriesId === evt.meta.seriesId).forEach(e => {
                if (onUpdateEvent) onUpdateEvent(updater(e));
            });
        } else {
            // Update local
            setLocalEvents(prev => prev.map(e => e.id === evt.id ? updater(e) : e));
            // Persist
            if (onUpdateEvent) onUpdateEvent(updater(evt));
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

                const evt = {
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
                };
                newEvents.push(evt);
                // PERSIST
                if (onUpdateEvent) onUpdateEvent(evt);
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
            // Local Update
            setLocalEvents(prev => prev.map(evt => {
                if (evt.meta?.seriesId === draggedEvent.meta.seriesId) {
                    const newDate = addDays(parseISO(evt.date), diffDays);
                    const newDateStr = format(newDate, 'yyyy-MM-dd');
                    const updated = {
                        ...evt,
                        date: newDateStr,
                        resourceId: resourceId
                    };
                    // PERSIST (side effect inside map... dirty but works for this block)
                    // Better to loop separately or rely on setLocalEvents triggering something? No.
                    // We must call onUpdateEvent.
                    return updated;
                }
                return evt;
            }));

            // PERSIST LOOP
            const seriesEvents = localEvents.filter(e => e.meta?.seriesId === draggedEvent.meta.seriesId);
            seriesEvents.forEach(evt => {
                const newDate = addDays(parseISO(evt.date), diffDays);
                const updated = {
                    ...evt,
                    date: format(newDate, 'yyyy-MM-dd'),
                    resourceId: resourceId
                };
                if (onUpdateEvent) onUpdateEvent(updated);
            });

        } else {
            // Single event
            const newDateStr = format(date, 'yyyy-MM-dd');
            const updated = { ...draggedEvent, date: newDateStr, resourceId: resourceId };

            // Local
            setLocalEvents(prev => prev.map(evt => {
                if (evt.id === draggedEvent.id) {
                    return updated;
                }
                return evt;
            }));

            // PERSIST
            if (onUpdateEvent) onUpdateEvent(updated);
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
                myViewMode={myViewMode}
                onToggleMyView={handleToggleMyView}
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
                <AssistantView stats={stats} onUpdateProject={onUpdateProject} />
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
                    isVertical={myViewMode}
                />
            )}
        </div>
    );
}