import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import { can, productionGroup } from '../lib/authz';
import { uid } from '../lib/utils/uid';
import { supabase } from '../lib/supabaseClient';
import { INITIAL_GROUPS_CONFIG, WORK_START_HOUR, WORK_END_HOUR, TOTAL_WORK_MINUTES, ATELIER_HOURS_PER_DAY, memberContractOverlaps } from '../components/planning/constants';
import EventModal from '../components/planning/EventModal';
import ResourcePanel from '../components/planning/ResourcePanel';
import PlanningTopBar from '../components/planning/PlanningTopBar';
import PlanningGrid from '../components/planning/PlanningGrid';
import AssistantView from '../components/planning/AssistantView';
import CapaciteView from '../components/planning/CapaciteView';
import BacklogCreationModal from '../components/planning/BacklogCreationModal';
import { findInternalProject, buildInternalProject, configWithChapter } from '../lib/planning/internalProject';
import { generatePlanningTemplate, processPlanningImport } from '../lib/utils/planningExcelUtils';

// --- Helpers atelier : durée <-> créneau (pause déjeuner 12h-13h) ---

// Heure de fin à partir d'une durée en heures, en sautant la pause déjeuner.
const computeEndFromDuration = (dayDate, dh) => {
    let remaining = dh * 60; // minutes
    let currentMin = 8 * 60; // 8h00

    // Bloc matin : 8h00 – 12h00 = 240 min
    const morningMins = Math.min(remaining, 240);
    currentMin += morningMins;
    remaining -= morningMins;

    if (remaining > 0) {
        // Sauter la pause déjeuner → 13h00
        currentMin = 13 * 60 + remaining;
    }

    const h = Math.floor(currentMin / 60);
    const m = Math.round(currentMin % 60);
    const endD = new Date(dayDate);
    endD.setHours(h, m, 0, 0);
    return endD;
};

// Durée d'un créneau en heures : durationHours si présent, sinon dérivée de start/end (moins déjeuner).
const eventDurationHours = (evt) => {
    if (evt?.meta?.durationHours != null) return Number(evt.meta.durationHours) || 0;
    const s = new Date(evt?.meta?.start || evt?.date);
    const e = new Date(evt?.meta?.end || evt?.date);
    let mins = differenceInMinutes(e, s);
    const lStart = new Date(s); lStart.setHours(12, 0, 0, 0);
    const lEnd = new Date(s); lEnd.setHours(13, 0, 0, 0);
    if (s < lStart && e > lEnd) mins -= 60;
    return Math.max(0, mins / 60);
};

// Rééquilibre les créneaux atelier NON validés d'une case (personne × jour × type) :
// chacun reçoit (7,8h − somme des heures validées) / (nb de non validés).
// Les validés sont figés. Renvoie uniquement les events modifiés (à persister).
const rebalanceAtelierDay = (resourceId, dateStr, type, pool) => {
    const bucket = pool.filter(e =>
        e.resourceId === resourceId && e.date === dateStr && e.type === type
    );
    const pending = bucket.filter(e => e.meta?.status !== 'validated');
    if (pending.length === 0) return [];

    const validatedHours = bucket
        .filter(e => e.meta?.status === 'validated')
        .reduce((acc, e) => acc + eventDurationHours(e), 0);

    const remaining = Math.max(0, ATELIER_HOURS_PER_DAY - validatedHours);
    const per = remaining / pending.length;

    const dayDate = parseISO(dateStr);
    const startD = new Date(dayDate); startD.setHours(8, 0, 0, 0);
    const endD = computeEndFromDuration(dayDate, per);

    return pending.map(e => ({
        ...e,
        meta: {
            ...e.meta,
            durationHours: per,
            start: startD.toISOString(),
            end: endD.toISOString(),
        },
    }));
};

export default function PlanningScreen({ projects, events: initialEvents, onUpdateEvent, onDeleteEvent: onDeleteEventProp, onUpdateProject, onCreateProject, onBack }) {
    const { users: authUsers, currentUser } = useAuth();
    const canEdit = can(currentUser, 'planning.edit');
    const showGauges = can(currentUser, 'planning.view_gauges');
    const canManageTeam = can(currentUser, 'planning.manage_team');
    const canViewAssistant = can(currentUser, 'planning.view_assistant');

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

    // Handler pour ajouter un nouveau membre d'équipe
    const handleAddMember = async (role, firstName, lastName, contract = {}) => {
        const newMember = {
            id: uid(),
            first_name: firstName,
            last_name: lastName || null,
            role,
            contract_type: contract.type || 'CDI',
            contract_start_date: contract.start || null,
            contract_end_date: contract.end || null,
        };
        const { data, error } = await supabase.from('profiles').insert([newMember]).select().single();
        if (error) {
            console.error('Erreur ajout membre:', error);
            alert(`Erreur lors de l'ajout : ${error.message}`);
            return;
        }
        const mapped = {
            ...data,
            name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
            initials: `${(data.first_name || '').charAt(0)}${(data.last_name || '').charAt(0)}`.toUpperCase(),
        };
        setLocalUsers(prev => [...prev, mapped]);
    };

    // Réactiver un membre archivé (intérimaire qui revient) : on garde son profil
    // et son historique, on lève l'archivage et on applique le nouveau contrat.
    const handleReactivateMember = async (userId, contract = {}) => {
        const patch = {
            archived_at: null,
            contract_type: contract.type || 'Intérim',
            contract_start_date: contract.start || null,
            contract_end_date: contract.end || null,
        };
        const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
        if (error) {
            console.error('Erreur réactivation membre:', error);
            alert(`Erreur lors de la réactivation : ${error.message}`);
            return;
        }
        setLocalUsers(prev => prev.map(u => u.id === userId ? { ...u, ...patch } : u));
    };

    // Mise à jour du contrat d'un membre (type + dates) — renouvellement, prolongation…
    const handleUpdateContract = async (userId, contract = {}) => {
        const patch = {
            contract_type: contract.type,
            contract_start_date: contract.start || null,
            contract_end_date: contract.end || null,
        };
        const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
        if (error) {
            console.error('Erreur maj contrat:', error);
            alert(`Erreur : ${error.message}`);
            return;
        }
        setLocalUsers(prev => prev.map(u => u.id === userId ? { ...u, ...patch } : u));
    };

    // Handler pour supprimer / archiver un membre d'équipe.
    // - Si le membre a des créneaux VALIDÉS (réalisés) → archivage (données passées conservées).
    // - Sinon → suppression nette (le profil + ses créneaux planifiés non réalisés).
    const handleDeleteMember = async (user) => {
        const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'ce membre';
        const memberEvents = localEvents.filter(e => e.resourceId === user.id);
        const hasValidated = memberEvents.some(e => e.meta?.status === 'validated');

        if (hasValidated) {
            if (!window.confirm(`${name} a des créneaux déjà réalisés.\n\nIl sera ARCHIVÉ : son historique reste visible sur les semaines passées, mais il n'apparaîtra plus sur les semaines à venir.\n\nContinuer ?`)) return;
            const archived_at = new Date().toISOString();
            const { error } = await supabase.from('profiles').update({ archived_at }).eq('id', user.id);
            if (error) {
                console.error('Erreur archivage membre:', error);
                alert(`Erreur lors de l'archivage : ${error.message}`);
                return;
            }
            setLocalUsers(prev => prev.map(u => u.id === user.id ? { ...u, archived_at } : u));
        } else {
            if (!window.confirm(`Supprimer ${name} ?\n\nSes éventuels créneaux planifiés (non réalisés) seront aussi retirés. Cette action est définitive.`)) return;
            // Retirer ses créneaux planifiés
            memberEvents.forEach(e => { if (onDeleteEventProp) onDeleteEventProp(e.id); });
            setLocalEvents(prev => prev.filter(e => e.resourceId !== user.id));
            const { error } = await supabase.from('profiles').delete().eq('id', user.id);
            if (error) {
                console.error('Erreur suppression membre:', error);
                alert(`Erreur lors de la suppression : ${error.message}`);
                return;
            }
            setLocalUsers(prev => prev.filter(u => u.id !== user.id));
        }
    };

    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState('week');
    const [showWeekends, setShowWeekends] = useState(false);
    const [customRange, setCustomRange] = useState(null);
    // 0 = replié, 1 = programme seulement (conf uniquement), 2 = déplié complet
    const [expandedGroups, setExpandedGroups] = useState({ pose: 2, conf: 2, prepa: 2 });

    // MODALE & EVENTS
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [localEvents, setLocalEvents] = useState(initialEvents || []);

    // Sync quand initialEvents arrive en async (ex: chargement depuis IndexedDB hors ligne)
    useEffect(() => {
        if (initialEvents?.length > 0 && localEvents.length === 0) {
            setLocalEvents(initialEvents);
        }
    }, [initialEvents]);

    // --- STATE ÉDITION & DRAG ---
    const [editingEvent, setEditingEvent] = useState(null);
    const [draggedEvent, setDraggedEvent] = useState(null);
    const [initialModalData, setInitialModalData] = useState(null);
    const [hoveredEventId, setHoveredEventId] = useState(null);
    const [hiddenResources, setHiddenResources] = useState([]); // Nouveau state pour masquer
    const [showResourcePanel, setShowResourcePanel] = useState(false); // Panel gestion équipe
    const [myViewMode, setMyViewMode] = useState(false); // Mode "Ma Vue" (Agenda Perso)

    const [backlogModalOpen, setBacklogModalOpen] = useState(false);
    const [backlogDate, setBacklogDate] = useState(null);
    const [editingBacklogEvent, setEditingBacklogEvent] = useState(null);

    // --- IMPORT EXCEL ---
    const [importResult, setImportResult] = useState(null);
    const [importResultOpen, setImportResultOpen] = useState(false);

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
                originalIds.forEach(id => onDeleteEventProp(id));

                // Find new ones (by seriesId)
                const newEvents = localEvents.filter(e => e.meta?.seriesId === currentSeriesId);
                newEvents.forEach(evt => onUpdateEvent(evt));

            } else {
                // Single event resized into series?
                if (onDeleteEventProp) onDeleteEventProp(resizeRef.current.initialSeries[0].id);
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
    const navPrev = () => { if (view === 'month') setCurrentDate(d => subMonths(d, 1)); else if (view === 'quarter') setCurrentDate(d => subQuarters(d, 1)); else if (view === 'year') setCurrentDate(d => subYears(d, 1)); else if (view === 'twoweeks') setCurrentDate(d => addDays(d, -14)); else setCurrentDate(d => addDays(d, view === 'day' ? -1 : -7)); };
    const navNext = () => { if (view === 'month') setCurrentDate(d => addMonths(d, 1)); else if (view === 'quarter') setCurrentDate(d => addQuarters(d, 1)); else if (view === 'year') setCurrentDate(d => addYears(d, 1)); else if (view === 'twoweeks') setCurrentDate(d => addDays(d, 14)); else setCurrentDate(d => addDays(d, view === 'day' ? 1 : 7)); };

    // --- RECHERCHE MULTI-CRITÈRES ---
    const [activeFilters, setActiveFilters] = useState([]);

    // --- FERMETURES ANNUELLES ---
    const closures = useMemo(() => localEvents.filter(e => e.type === 'closure'), [localEvents]);
    const planningEvents = useMemo(() => localEvents.filter(e => e.type !== 'mission' && e.type !== 'closure'), [localEvents]);

    // --- CONSTRUCTION DYNAMIQUE DES GROUPES ---
    const groupsConfig = useMemo(() => {
        if (!localUsers || localUsers.length === 0) return INITIAL_GROUPS_CONFIG;

        const config = {
            prepa: { ...INITIAL_GROUPS_CONFIG.prepa, members: [...INITIAL_GROUPS_CONFIG.prepa.members] },
            conf: { ...INITIAL_GROUPS_CONFIG.conf, members: [...INITIAL_GROUPS_CONFIG.conf.members] },
            pose: { ...INITIAL_GROUPS_CONFIG.pose, members: [...INITIAL_GROUPS_CONFIG.pose.members] }
        };

        localUsers.forEach(u => {
            // Le service planning dépend du groupe de production (pas du rôle brut) :
            // ex. ordo_conf → confection, tout en gardant ses permissions d'ordo.
            const groupKey = productionGroup(u.role);
            if (groupKey && config[groupKey]) {
                config[groupKey].members.push(u);
            }
        });

        // Ordre d'affichage personnalisé par groupe (par prénom).
        // Les membres nommés sont placés en tête dans cet ordre ; les autres suivent
        // dans leur ordre naturel. Le backlog "Programme semaine" reste toujours en tête.
        const RESOURCE_ORDER = {
            conf: ['Delphine'],                              // Delphine avant Catherine, etc.
            pose: ['Guillaume', 'Alain', 'Samuel', 'Hamed'],
        };
        const orderIndex = (member, key) => {
            if (member.id === 'backlog_confection') return -1;
            const order = RESOURCE_ORDER[key] || [];
            const idx = order.findIndex(n => n.toLowerCase() === (member.first_name || '').toLowerCase());
            return idx === -1 ? order.length : idx;
        };
        Object.keys(config).forEach(key => {
            if (!RESOURCE_ORDER[key]) return;
            config[key].members.sort((a, b) => orderIndex(a, key) - orderIndex(b, key));
        });

        return config;
    }, [localUsers]);

    // Période actuellement affichée (en chaînes 'yyyy-MM-dd'), pour décider
    // de la visibilité des membres archivés (visibles seulement sur leurs semaines passées).
    const visibleRange = useMemo(() => {
        let start = currentDate, end = currentDate;
        if (view === 'week') { start = startOfWeek(currentDate, { weekStartsOn: 1 }); end = addDays(start, 6); }
        else if (view === 'twoweeks') { start = startOfWeek(currentDate, { weekStartsOn: 1 }); end = addDays(start, 13); }
        else if (view === 'month') { start = startOfMonth(currentDate); end = endOfMonth(currentDate); }
        else if (view === 'quarter') { start = startOfQuarter(currentDate); end = endOfQuarter(currentDate); }
        else if (view === 'year') { start = startOfYear(currentDate); end = endOfYear(currentDate); }
        else if (view === 'custom' && customRange) { start = customRange.start; end = customRange.end; }
        return { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') };
    }, [view, currentDate, customRange]);

    // --- FILTRAGE DES RESSOURCES MASQUÉES ET FINS DE CONTRAT ---
    const visibleGroupsConfig = useMemo(() => {
        const config = JSON.parse(JSON.stringify(groupsConfig));
        Object.keys(config).forEach(key => {
            config[key].members = config[key].members.filter(m => {
                if (m.id === 'backlog_confection') return true; // ressource virtuelle, toujours visible
                if (hiddenResources.includes(m.id)) return false;
                // Présent si sa fenêtre de contrat chevauche la période affichée…
                if (memberContractOverlaps(m, visibleRange.start, visibleRange.end)) return true;
                // …ou (archivé / contrat terminé) s'il a un créneau dans la période → historique conservé
                return localEvents.some(e => {
                    if (e.resourceId !== m.id) return false;
                    const d = e.date || (e.meta?.start ? e.meta.start.slice(0, 10) : null);
                    return d && d >= visibleRange.start && d <= visibleRange.end;
                });
            });
        });
        return config;
    }, [groupsConfig, hiddenResources, localEvents, visibleRange]);


    // --- MODE ASSISTANT ---
    // null | 'programmation' | 'capacite'
    const [assistantMode, setAssistantMode] = useState(null);

    // Calcul dynamique des capacités
    const capacityConfig = useMemo(() => ({
        // Exclude 'backlog_confection' virtual resource from capacity count
        conf: visibleGroupsConfig.conf.members.filter(m => m.id !== 'backlog_confection').length,
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

        if (activeFilters.length === 0) return visibleGroupsConfig;

        let config = JSON.parse(JSON.stringify(visibleGroupsConfig));

        activeFilters.forEach(filter => {
            const q = (filter.value || '').toLowerCase();

            if (filter.field === 'service') {
                // Garder seulement les groupes dont le label ou la clé contient le terme
                Object.keys(config).forEach(key => {
                    const group = config[key];
                    const matches = group.label.toLowerCase().includes(q) || key.toLowerCase().includes(q);
                    if (!matches) config[key].members = [];
                });
            }

            if (filter.field === 'person') {
                // Garder seulement les membres dont le nom contient le terme
                Object.keys(config).forEach(key => {
                    config[key].members = config[key].members.filter(m => {
                        const fullName = `${m.first_name || ''} ${m.last_name || ''}`.toLowerCase();
                        return fullName.includes(q);
                    });
                });
            }

            if (filter.field === 'project') {
                // Trouver les events matchant le dossier, ne garder que leurs ressources
                const matchingResourceIds = new Set(
                    localEvents
                        .filter(e => {
                            const titleMatch = (e.title || '').toLowerCase().includes(q);
                            const projectMatch = (projects || []).some(p =>
                                (p.name || '').toLowerCase().includes(q) && p.id === e.meta?.projectId
                            );
                            return titleMatch || projectMatch;
                        })
                        .map(e => e.resourceId)
                );
                Object.keys(config).forEach(key => {
                    config[key].members = config[key].members.filter(m => matchingResourceIds.has(m.id));
                });
            }
        });

        // Supprimer les groupes sans membres après filtrage
        Object.keys(config).forEach(key => {
            if (config[key].members.length === 0) delete config[key];
        });

        return config;
    }, [visibleGroupsConfig, activeFilters, myViewMode, currentUser, localEvents, projects]);

    const filteredEvents = useMemo(() => {
        const projectFilters = activeFilters.filter(f => f.field === 'project');
        if (projectFilters.length === 0) return planningEvents;
        return planningEvents.filter(e =>
            projectFilters.every(filter => {
                const q = (filter.value || '').toLowerCase();
                const titleMatch = (e.title || '').toLowerCase().includes(q);
                const projectMatch = (projects || []).some(p =>
                    (p.name || '').toLowerCase().includes(q) && p.id === e.meta?.projectId
                );
                return titleMatch || projectMatch;
            })
        );
    }, [localEvents, activeFilters, projects]);

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

    // Dossier interne : créé à la toute première utilisation (personne n'a à le créer à la
    // main), puis on y enregistre le chapitre s'il est nouveau — c'est ce qui alimentera
    // les suggestions et, plus tard, le suivi par chapitre.
    // Renvoie l'id du dossier à rattacher au créneau, ou null si la création a échoué :
    // dans ce cas on préfère ne rien enregistrer plutôt que de recréer un créneau orphelin.
    const ensureInternalProject = async (chapterName) => {
        let internal = findInternalProject(projects);

        if (!internal) {
            if (!onCreateProject) {
                console.error('[planning] création du dossier interne impossible (droits insuffisants ?)');
                return null;
            }
            const payload = buildInternalProject();
            const { data, error } = (await onCreateProject(payload)) || {};
            if (error) {
                console.error('[planning] création du dossier interne échouée :', error.message);
                alert(`Impossible de créer le dossier interne : ${error.message}`);
                return null;
            }
            internal = data?.[0] || payload;
        }

        const nextConfig = configWithChapter(internal, chapterName);
        if (nextConfig && onUpdateProject) onUpdateProject(internal.id, { config: nextConfig });

        return internal.id;
    };

    const handleSaveEvent = async (eventData) => {
        let newEvents = localEvents;

        // Créneau interne : on résout (ou crée) le dossier avant de poser quoi que ce soit.
        let projectId = eventData.projectId;
        if (eventData.isInternal) {
            projectId = await ensureInternalProject(eventData.internalChapter);
            if (!projectId) return;
        }

        // PERSISTENCE: Suppression ancienne version (si édition)
        if (eventData.id || eventData.seriesId) {
            const eventsToDelete = localEvents.filter(e =>
                e.id === eventData.id ||
                (eventData.seriesId && e.meta?.seriesId === eventData.seriesId)
            );
            eventsToDelete.forEach(e => {
                if (onDeleteEventProp) onDeleteEventProp(e.id);
            });

            // Filtre local
            const deletedIds = new Set(eventsToDelete.map(e => e.id));
            newEvents = newEvents.filter(e => !deletedIds.has(e.id));
        }

        const days = eachDayOfInterval({ start: parseISO(eventData.startDate), end: parseISO(eventData.endDate) });
        const createdEvents = [];

        const isHourMode = eventData.durationHours != null && ['conf', 'prepa'].includes(eventData.type);

        // Un seriesId par ressource : les jours d'une même personne sont groupés,
        // mais deux personnes planifiées ensemble restent indépendantes.
        eventData.resourceIds.forEach(resId => {
            const seriesId = uid();

            days.forEach(d => {
            if (!showWeekends && isWeekend(d)) return;
                const assignedUser = localUsers.find(u => u.id === resId);
                const assignedName = assignedUser ? `${assignedUser.first_name} ${assignedUser.last_name || ''}`.trim() : 'Inconnu';

                let startD, endD;

                if (isHourMode) {
                    // MODE DURÉE : start fixé à 8h, end calculé depuis durationHours
                    startD = new Date(d);
                    startD.setHours(8, 0, 0, 0);
                    endD = computeEndFromDuration(d, eventData.durationHours);
                } else {
                    // MODE CRÉNEAU : heure début / heure fin
                    const sTime = eventData.startTime.split(':');
                    const eTime = eventData.endTime.split(':');
                    startD = new Date(d);
                    startD.setHours(parseInt(sTime[0]), parseInt(sTime[1]), 0, 0);
                    endD = new Date(d);
                    endD.setHours(parseInt(eTime[0]), parseInt(eTime[1]), 0, 0);
                }

                const evt = {
                    id: uid(),
                    resourceId: resId,
                    date: format(d, 'yyyy-MM-dd'),
                    title: eventData.title,
                    type: eventData.type,
                    meta: {
                        start: startD.toISOString(),
                        end: endD.toISOString(),
                        description: eventData.description,
                        projectId: projectId,
                        internalChapter: eventData.internalChapter || null,
                        seriesId: seriesId,
                        assigned_name: assignedName,
                        status: eventData.status || 'pending',
                        ...(isHourMode && { durationHours: eventData.durationHours, createdAt: new Date().toISOString() })
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
        const nextPool = localEvents.filter(e => e.id !== evt.id);
        if (onDeleteEventProp) onDeleteEventProp(evt.id);

        // Si c'était un créneau atelier confection : rééquilibrer les non-validés
        // restants de la case (personne × jour) sur le temps restant.
        if (evt.type === 'conf' && evt.resourceId && evt.resourceId !== 'backlog_confection' && evt.date) {
            const rebalanced = rebalanceAtelierDay(evt.resourceId, evt.date, 'conf', nextPool);
            const byId = new Map(rebalanced.map(e => [e.id, e]));
            setLocalEvents(nextPool.map(e => byId.get(e.id) || e));
            rebalanced.forEach(e => { if (onUpdateEvent) onUpdateEvent(e); });
        } else {
            setLocalEvents(nextPool);
        }
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
        // BACKLOG CLICK
        if (evt.resourceId === 'backlog_confection' || evt.meta?.isBacklogMaster) {
            setBacklogDate(parseISO(evt.date));
            setEditingBacklogEvent(evt); // Set editing event
            setBacklogModalOpen(true);
            return;
        }

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

    // --- FERMETURES ANNUELLES ---
    const handleAddClosure = (label, startDate, endDate) => {
        const evt = {
            id: uid(),
            resourceId: 'ALL',
            date: startDate,
            title: label,
            type: 'closure',
            meta: {
                start: new Date(startDate).toISOString(),
                end: new Date(endDate).toISOString(),
                seriesId: uid(),
            },
        };
        setLocalEvents(prev => [...prev, evt]);
        if (onUpdateEvent) onUpdateEvent(evt);
    };

    const handleDeleteClosure = (closureId) => {
        setLocalEvents(prev => prev.filter(e => e.id !== closureId));
        if (onDeleteEventProp) onDeleteEventProp(closureId);
    };

    // --- DRAG AND DROP HANDLERS ---
    const handleDragStart = (e, evt) => {
        setDraggedEvent(evt);
    };
    const handleDragOver = (e) => e.preventDefault();
    const handleDrop = (e, resourceId, date) => {
        e.preventDefault();
        if (!draggedEvent) return;

        // --- BACKLOG LOGIC : COPIE (Master -> Child) ---
        if (draggedEvent.resourceId === 'backlog_confection') {
            // On ne déplace pas le backlog : on crée une copie (enfant) qui cale
            // directement une journée sur la personne cible, puis on rééquilibre les
            // créneaux non validés de la case (personne × jour) à parts égales du
            // temps restant (7,8h − heures déjà validées).
            const dateStr = format(date, 'yyyy-MM-dd');
            const startD = new Date(date); startD.setHours(8, 0, 0, 0);
            const endD = computeEndFromDuration(date, ATELIER_HOURS_PER_DAY);

            const newEvent = {
                ...draggedEvent,
                id: uid(), // New ID
                resourceId: resourceId, // Target resource
                date: dateStr,
                // Créneau de confection planifié sur une personne → type 'conf' :
                // déclenche le rendu "côte à côte" (MODE DURÉE) et compte dans la
                // charge atelier. (Le master backlog est lui de type 'default'.)
                type: 'conf',
                title: draggedEvent.title,
                meta: {
                    ...draggedEvent.meta,
                    start: startD.toISOString(),
                    end: endD.toISOString(),
                    durationHours: ATELIER_HOURS_PER_DAY, // sera ajusté par le rééquilibrage
                    status: 'pending', // Reset status
                    parent_backlog_id: String(draggedEvent.id), // LINK TO MASTER (Force String)
                    seriesId: null, // Break series from master if any
                    isBacklogMaster: false, // l'enfant n'est PAS un master (clic → modale event)
                    budgetHours: undefined, // volume propre au master uniquement
                    createdAt: new Date().toISOString(),
                }
            };

            // Ajout + rééquilibrage des non-validés de la case (personne × jour × type)
            const pool = [...localEvents, newEvent];
            const rebalanced = rebalanceAtelierDay(resourceId, dateStr, 'conf', pool);
            const byId = new Map(rebalanced.map(e => [e.id, e]));

            setLocalEvents(pool.map(e => byId.get(e.id) || e));

            // Persist : le nouvel event + tous les créneaux non validés recalculés
            rebalanced.forEach(e => { if (onUpdateEvent) onUpdateEvent(e); });

            setDraggedEvent(null);
            return;
        }

        // --- STANDARD LOGIC : MOVE ---

        // Calcul décalage jour
        const oldDate = parseISO(draggedEvent.date);
        const diffDays = differenceInDays(date, oldDate);

        // La source de vérité en base est meta.start / meta.end (colonnes start_time /
        // end_time). On décale donc AUSSI ces datetimes du même nombre de jours (heure
        // préservée), sinon le déplacement n'est ni persisté ni reflété dans la modale.
        const shiftISO = (iso) => iso ? addDays(new Date(iso), diffDays).toISOString() : iso;

        // Si série
        if (draggedEvent.meta?.seriesId) {
            const buildUpdated = (evt) => {
                const newDate = addDays(parseISO(evt.date), diffDays);
                return {
                    ...evt,
                    date: format(newDate, 'yyyy-MM-dd'),
                    resourceId: resourceId,
                    meta: {
                        ...evt.meta,
                        start: shiftISO(evt.meta?.start),
                        end: shiftISO(evt.meta?.end),
                    },
                };
            };

            // Local Update
            setLocalEvents(prev => prev.map(evt =>
                evt.meta?.seriesId === draggedEvent.meta.seriesId ? buildUpdated(evt) : evt
            ));

            // PERSIST LOOP
            const seriesEvents = localEvents.filter(e => e.meta?.seriesId === draggedEvent.meta.seriesId);
            seriesEvents.forEach(evt => {
                if (onUpdateEvent) onUpdateEvent(buildUpdated(evt));
            });

        } else {
            // Single event
            const newDateStr = format(date, 'yyyy-MM-dd');
            const updated = {
                ...draggedEvent,
                date: newDateStr,
                resourceId: resourceId,
                meta: {
                    ...draggedEvent.meta,
                    start: shiftISO(draggedEvent.meta?.start),
                    end: shiftISO(draggedEvent.meta?.end),
                },
            };

            // Local
            setLocalEvents(prev => prev.map(evt => evt.id === draggedEvent.id ? updated : evt));

            // PERSIST
            if (onUpdateEvent) onUpdateEvent(updated);
        }
        setDraggedEvent(null);
    };

    const handleCellClick = (resourceId, col) => {
        if (!canEdit) return;

        // --- BACKLOG CLICK ---
        if (resourceId === 'backlog_confection') {
            setBacklogDate(col);
            setEditingBacklogEvent(null); // Clear editing event (Create Mode)
            setBacklogModalOpen(true);
            return;
        }

        setInitialModalData({ resourceId, date: format(col, 'yyyy-MM-dd') });
        setIsModalOpen(true);
    };

    const handleSaveBacklog = async (data) => {
        // data: { id?, projectId, title, hours, comment, isInternal?, internalChapter? }

        // Interne : résout (ou crée) le dossier et enregistre le chapitre avant de poser la carte.
        let projectId = data.projectId;
        if (data.isInternal) {
            projectId = await ensureInternalProject(data.internalChapter);
            if (!projectId) return;
        }

        if (data.id) {
            // UPDATE EXISTING
            const updater = e => ({
                ...e,
                title: data.title,
                meta: {
                    ...e.meta,
                    projectId: projectId,
                    internalChapter: data.internalChapter || null,
                    budgetHours: data.hours,
                    description: data.comment
                }
            });

            // Local
            setLocalEvents(prev => prev.map(e => e.id === data.id ? updater(e) : e));

            // Persist
            const evt = localEvents.find(e => e.id === data.id);
            if (evt && onUpdateEvent) onUpdateEvent(updater(evt));

        } else {
            // CREATE NEW
            if (!backlogDate) return;

            const startW = startOfWeek(backlogDate, { weekStartsOn: 1 });
            const startD = new Date(startW);
            startD.setHours(8, 0, 0, 0); // Lundi 8h

            const endD = addDays(startD, 4); // Vendredi
            endD.setHours(17, 0, 0, 0); // 17h

            const newEvent = {
                id: uid(),
                resourceId: 'backlog_confection',
                title: data.title,
                type: 'default',
                date: format(backlogDate, 'yyyy-MM-dd'),
                meta: {
                    projectId: projectId,
                    internalChapter: data.internalChapter || null,
                    start: startD.toISOString(),
                    end: endD.toISOString(),
                    budgetHours: data.hours,
                    description: data.comment,
                    status: 'pending',
                    isBacklogMaster: true
                }
            };

            const newEvents = [...localEvents, newEvent];
            setLocalEvents(newEvents);
            if (onUpdateEvent) onUpdateEvent(newEvent);
        }

        setBacklogModalOpen(false);
        setEditingBacklogEvent(null);
    };

    const handleDeleteBacklog = (id) => {
        if (onDeleteEventProp) onDeleteEventProp(id);
        setLocalEvents(prev => prev.filter(e => e.id !== id));
    };

    const handleDownloadTemplate = async () => {
        const allMembers = [
            ...groupsConfig.conf.members.filter(m => m.id !== 'backlog_confection'),
            ...groupsConfig.pose.members,
            ...groupsConfig.prepa.members,
        ];
        await generatePlanningTemplate(columns, allMembers, projects);
    };

    const handleImport = async (file) => {
        if (!file) return;
        try {
            const allMembers = [
                ...groupsConfig.conf.members.filter(m => m.id !== 'backlog_confection'),
                ...groupsConfig.pose.members,
                ...groupsConfig.prepa.members,
            ];
            const result = await processPlanningImport(file, allMembers, projects, localEvents);
            setImportResult(result);
            setImportResultOpen(true);
        } catch (err) {
            alert(`Erreur lors de l'import : ${err.message}`);
        }
    };

    const handleConfirmImport = () => {
        const allToProcess = [...(importResult.toCreate || []), ...(importResult.toOverwrite || [])];
        allToProcess.forEach(evt => {
            setLocalEvents(prev => {
                const exists = prev.find(e => e.id === evt.id);
                return exists ? prev.map(e => e.id === evt.id ? evt : e) : [...prev, evt];
            });
            if (onUpdateEvent) onUpdateEvent(evt);
        });
        setImportResultOpen(false);
        setImportResult(null);
    };



    // --- COLUMNS GENERATION ---
    const columns = useMemo(() => {
        let cols = [];
        if (view === 'day') cols = [currentDate];
        else if (view === 'week') cols = Array.from({ length: 7 }).map((_, i) => addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i));
        else if (view === 'twoweeks') cols = Array.from({ length: 14 }).map((_, i) => addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i));
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
            if (view === 'week' || view === 'twoweeks') label = `Semaine ${format(col, 'w')}`;
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
        if (view === 'twoweeks') return format(col, 'EE d MMM', { locale: fr });
        return format(col, 'EE d MMM', { locale: fr });
    };

    const handleResizeStart = (startState) => {
        setResizingEvent(startState);
    };

    // Mesure du bloc sticky (pastilles + barre d'outils) pour dimensionner la zone
    // du tableau à 100vh moins ce bloc : une fois le bandeau de titre scrollé,
    // le tableau occupe tout l'écran restant.
    const stickyHeaderRef = useRef(null);
    const [stickyHeaderHeight, setStickyHeaderHeight] = useState(0);
    useEffect(() => {
        const el = stickyHeaderRef.current;
        if (!el) return;
        const measure = () => setStickyHeaderHeight(el.getBoundingClientRect().height);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    return (
        <div style={{ height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', background: '#FAF5EE' }}>
            {/* Bandeau de titre : défile normalement et disparaît au scroll */}
            <div style={{ padding: '24px 24px 0', flexShrink: 0 }}>
                <div style={{ marginBottom: 16 }}>
                    {onBack && (
                        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontWeight: 600, fontSize: 13, marginBottom: 12, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                            ← Retour
                        </button>
                    )}
                    <h1 style={{ fontSize: 32, fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.5px' }}>Planning</h1>
                    <p style={{ fontSize: 14, color: '#6B7280', margin: '4px 0 0' }}>Planification des équipes et de la charge de production</p>
                </div>
            </div>

            {/* Bloc sticky : pastilles de navigation + barre d'outils, toujours visibles au scroll */}
            <div ref={stickyHeaderRef} style={{ position: 'sticky', top: 0, zIndex: 70, background: '#FAF5EE', flexShrink: 0 }}>
                {canViewAssistant && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 24px 12px' }}>
                        <div style={{
                            background: 'white', borderRadius: 9999, padding: 4, display: 'flex', gap: 4,
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
                            border: '1px solid rgba(0,0,0,0.05)',
                        }}>
                            {[
                                { key: null, label: 'Planning' },
                                { key: 'programmation', label: 'Programmation' },
                                { key: 'capacite', label: 'Capacité' },
                            ].map(seg => {
                                const active = (assistantMode || null) === seg.key;
                                return (
                                    <button
                                        key={seg.label}
                                        onClick={() => setAssistantMode(seg.key)}
                                        style={{
                                            padding: '8px 24px', borderRadius: 9999, fontSize: 14, fontWeight: 500,
                                            border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                                            background: active ? '#1E2447' : 'transparent',
                                            color: active ? 'white' : '#4B5563',
                                        }}
                                    >
                                        {seg.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

            {/* Barre d'outils calendrier : uniquement sur la vue Planning */}
            {assistantMode === null && (
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
                activeFilters={activeFilters}
                onAddFilter={(f) => setActiveFilters(prev => prev.find(x => x.id === f.id) ? prev : [...prev, f])}
                onRemoveFilter={(id) => setActiveFilters(prev => prev.filter(x => x.id !== id))}
                myViewMode={myViewMode}
                onToggleMyView={handleToggleMyView}
                onDownloadTemplate={canEdit ? handleDownloadTemplate : undefined}
                onImport={canEdit ? handleImport : undefined}
                canManageTeam={canManageTeam}
            />
            )}
            </div>

            <EventModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingEvent(null); setInitialModalData(null); }}
                onSave={handleSaveEvent}
                onValidate={handleValidateEvent}
                onDelete={handleDeleteEvent}
                projects={projects}
                events={localEvents}
                eventToEdit={editingEvent}
                initialData={initialModalData}
                currentUser={currentUser}
                groupsConfig={visibleGroupsConfig}
                readOnly={!canEdit}
            />

            {backlogModalOpen && (
                <BacklogCreationModal
                    isOpen={backlogModalOpen}
                    onClose={() => setBacklogModalOpen(false)}
                    onSave={handleSaveBacklog}
                    onDelete={handleDeleteBacklog}
                    projects={projects}
                    events={initialEvents}
                    currentWeekStart={startOfWeek(currentDate, { weekStartsOn: 1 })}
                    eventToEdit={editingBacklogEvent}
                />
            )}

            {importResultOpen && importResult && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'white', borderRadius: 12, padding: 28, width: 520, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Résultat de l'import</h2>

                        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                            <span style={{ background: '#DCFCE7', color: '#166534', borderRadius: 6, padding: '6px 12px', fontSize: 13, fontWeight: 600 }}>
                                {importResult.toCreate.length} à créer
                            </span>
                            <span style={{ background: '#DBEAFE', color: '#1E40AF', borderRadius: 6, padding: '6px 12px', fontSize: 13, fontWeight: 600 }}>
                                {importResult.toOverwrite.length} à écraser
                            </span>
                            {importResult.skipped?.length > 0 && (
                                <span style={{ background: '#F3F4F6', color: '#374151', borderRadius: 6, padding: '6px 12px', fontSize: 13, fontWeight: 600 }}>
                                    {importResult.skipped.length} ignorée(s) — projet non indiqué
                                </span>
                            )}
                            {importResult.blocked.length > 0 && (
                                <span style={{ background: '#FEE2E2', color: '#991B1B', borderRadius: 6, padding: '6px 12px', fontSize: 13, fontWeight: 600 }}>
                                    {importResult.blocked.length} bloqué(s) — déjà validés
                                </span>
                            )}
                            {importResult.errors.length > 0 && (
                                <span style={{ background: '#FEF9C3', color: '#854D0E', borderRadius: 6, padding: '6px 12px', fontSize: 13, fontWeight: 600 }}>
                                    {importResult.errors.length} erreur(s)
                                </span>
                            )}
                        </div>

                        {importResult.blocked.length > 0 && (
                            <details style={{ marginBottom: 12 }}>
                                <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#991B1B', marginBottom: 6 }}>Créneaux bloqués (déjà validés)</summary>
                                {importResult.blocked.map((b, i) => (
                                    <div key={i} style={{ fontSize: 12, color: '#374151', padding: '4px 0', borderBottom: '1px solid #F3F4F6' }}>
                                        Ligne {b.row} — {b.personne} · {b.date} {b.duree ? `(${b.duree})` : `${b.debut}–${b.fin}`}
                                    </div>
                                ))}
                            </details>
                        )}

                        {importResult.errors.length > 0 && (
                            <details style={{ marginBottom: 16 }}>
                                <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#854D0E', marginBottom: 6 }}>Erreurs de saisie</summary>
                                {importResult.errors.map((e, i) => (
                                    <div key={i} style={{ fontSize: 12, color: '#374151', padding: '4px 0', borderBottom: '1px solid #F3F4F6' }}>
                                        Ligne {e.row} — {e.message}
                                    </div>
                                ))}
                            </details>
                        )}

                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                            <button onClick={() => { setImportResultOpen(false); setImportResult(null); }} style={{ background: 'white', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 6, padding: '8px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                                Annuler
                            </button>
                            <button
                                onClick={handleConfirmImport}
                                disabled={importResult.toCreate.length + importResult.toOverwrite.length === 0}
                                style={{ background: importResult.toCreate.length + importResult.toOverwrite.length > 0 ? '#111827' : '#9CA3AF', color: 'white', border: 'none', borderRadius: 6, padding: '8px 20px', fontWeight: 600, fontSize: 14, cursor: importResult.toCreate.length + importResult.toOverwrite.length > 0 ? 'pointer' : 'not-allowed' }}
                            >
                                Confirmer l'import ({importResult.toCreate.length + importResult.toOverwrite.length} séances)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ResourcePanel
                isOpen={showResourcePanel}
                onClose={() => setShowResourcePanel(false)}
                users={localUsers}
                onAddAbsence={handleAddAbsence}
                closures={closures}
                archivedUsers={localUsers.filter(u => u.archived_at)}
                onAddClosure={handleAddClosure}
                onDeleteClosure={handleDeleteClosure}
                onAddMember={handleAddMember}
                onReactivateMember={handleReactivateMember}
                onUpdateContract={handleUpdateContract}
                onDeleteMember={handleDeleteMember}
            />

            {/* Zone de contenu : 100vh moins le bloc sticky, pour que le tableau
                profite de tout l'écran une fois le bandeau de titre scrollé */}
            <div style={{ height: `calc(100vh - ${stickyHeaderHeight}px)`, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {assistantMode === 'programmation' ? (
                <AssistantView stats={stats} onUpdateProject={onUpdateProject} />
            ) : assistantMode === 'capacite' ? (
                <CapaciteView localUsers={localUsers} localEvents={localEvents} />
            ) : (
                <PlanningGrid
                    days={columns}
                    columns={columns}
                    superHeaders={superHeaders}
                    view={view}
                    filteredGroups={filteredGroups}
                    expandedGroups={expandedGroups}
                    onToggleGroup={(key) => setExpandedGroups(prev => {
                        if (key === 'conf') {
                            // Entête : replié ↔ Programme semaine (0 ↔ 1).
                            // Le "par personne" (niveau 2) se pilote via le chevron de la
                            // ligne Programme semaine (onToggleMembers).
                            return { ...prev, [key]: prev[key] > 0 ? 0 : 1 };
                        }
                        return { ...prev, [key]: prev[key] === 0 ? 2 : 0 };
                    })}
                    onToggleMembers={(key) => setExpandedGroups(prev => (
                        // Ligne Programme semaine : Programme seul ↔ par personne (1 ↔ 2)
                        { ...prev, [key]: prev[key] >= 2 ? 1 : 2 }
                    ))}
                    events={filteredEvents}
                    hiddenResources={hiddenResources}
                    onCellClick={handleCellClick}
                    onEventClick={handleEventClick}
                    onDeleteEvent={handleInlineDeleteEvent}
                    onUpdateEvent={(updatedEvent) => {
                        setLocalEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
                        if (onUpdateEvent) onUpdateEvent(updatedEvent);
                    }}
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
        </div>
    );
}