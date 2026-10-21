import React, { useState, useMemo, useEffect } from 'react';
import { X, Briefcase, Check, Calendar as CalendarIcon, Clock, ArrowRight, User, ChevronDown, Trash2, CheckCircle, BedDouble, Moon } from 'lucide-react';
import { format, differenceInMinutes, addDays } from 'date-fns';
import { ATELIER_HOURS_PER_DAY } from './constants';
import {
    INTERNAL_PROJECT_NAME, isInternalProject, findInternalProject,
    getActiveChapters, normalizeChapter,
} from '../../lib/planning/internalProject';

const EventModal = ({ isOpen, onClose, onSave, onValidate, onDelete, projects = [], events = [], eventToEdit, initialData, currentUser, groupsConfig, readOnly = false, canDelete = false }) => {
    // États Formulaire
    const [projectSearch, setProjectSearch] = useState('');
    const [selectedProject, setSelectedProject] = useState(null);
    const [showProjectList, setShowProjectList] = useState(false);
    // Chapitre : uniquement quand le dossier interne est sélectionné
    const [chapter, setChapter] = useState('');
    const [showChapterList, setShowChapterList] = useState(false);

    // Multi-Ressources
    const [selectedResources, setSelectedResources] = useState([]);
    const [showResourceList, setShowResourceList] = useState(false);
    const [description, setDescription] = useState('');
    const [decouche, setDecouche] = useState(false); // Pose : l'équipe dort sur place (nuit sur place)
    const [night, setNight] = useState(false); // Pose : intervention de nuit (fin le lendemain matin)

    // Dates & Heures
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [startTime, setStartTime] = useState('08:00');
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [endTime, setEndTime] = useState('17:00');

    // Mode durée (conf/prepa)
    const [durationHours, setDurationHours] = useState(ATELIER_HOURS_PER_DAY);

    // Aplatir la liste des membres pour l'affichage
    const allMembers = useMemo(() => [
        ...(groupsConfig.prepa?.members.map(m => ({ id: m.id, group: 'prepa', label: `${m.first_name} ${m.last_name || ''}` })) || []),
        ...(groupsConfig.conf?.members.filter(m => m.id !== 'backlog_confection').map(m => ({ id: m.id, group: 'conf', label: `${m.first_name} ${m.last_name || ''}` })) || []),
        ...(groupsConfig.pose?.members.map(m => ({ id: m.id, group: 'pose', label: `${m.first_name} ${m.last_name || ''}` })) || [])
    ], [groupsConfig]);

    // Mode durée : actif quand toutes les ressources sélectionnées sont conf ou prepa
    const isHourMode = useMemo(() => {
        if (selectedResources.length === 0) {
            // Si pas encore de ressource sélectionnée, se baser sur l'event en édition ou initialData
            if (eventToEdit) return eventToEdit.type === 'conf' || eventToEdit.type === 'prepa';
            if (initialData?.resourceId) {
                const m = allMembers.find(x => x.id === initialData.resourceId);
                return m?.group === 'conf' || m?.group === 'prepa';
            }
            return false;
        }
        return selectedResources.every(id => {
            const m = allMembers.find(x => x.id === id);
            return m?.group === 'conf' || m?.group === 'prepa';
        });
    }, [selectedResources, allMembers, eventToEdit, initialData]);

    // Service de la ressource sélectionnée (pour cibler le bon budget)
    const selectedGroup = useMemo(() => {
        const resId = selectedResources[0] || eventToEdit?.resourceId || initialData?.resourceId;
        if (!resId) return null;
        return allMembers.find(x => x.id === resId)?.group || null;
    }, [selectedResources, allMembers, eventToEdit, initialData]);

    // Synthèse budget POSE pour le projet sélectionné (vendu / planifié / consommé / reste)
    const poseStats = useMemo(() => {
        if (selectedGroup !== 'pose' || !selectedProject?.id) return null;
        const budgetSold = selectedProject.budget?.pose || 0;

        // POSE UNIQUEMENT (pas conf/prépa/absence)
        const poseEvents = events.filter(e =>
            e.meta?.projectId === selectedProject.id && e.type === 'pose'
        );

        // Heures réelles hors pause déjeuner
        const eventHours = (e) => {
            const start = new Date(e.meta?.start || e.date);
            const end = new Date(e.meta?.end || e.date);
            let mins = differenceInMinutes(end, start);
            const lunchStart = new Date(start); lunchStart.setHours(12, 0, 0, 0);
            const lunchEnd = new Date(start); lunchEnd.setHours(13, 0, 0, 0);
            if (start < lunchStart && end > lunchEnd) mins -= 60;
            return Math.max(0, mins) / 60;
        };

        // Planifié = à faire (pending) ; Consommé = réalisé (validé)
        let planned = 0, consumed = 0;
        poseEvents.forEach(e => {
            const h = eventHours(e);
            if (e.meta?.status === 'validated') consumed += h;
            else planned += h;
        });

        return { sold: budgetSold, planned, consumed, remaining: budgetSold - planned - consumed };
    }, [selectedGroup, selectedProject, events]);

    const fmtH = (n) => `${Math.round(n * 10) / 10}`.replace('.', ',');

    useEffect(() => {
        if (isOpen) {
            if (eventToEdit) {
                // Mode Édition
                const editedProject = projects.find(p => p.id === eventToEdit.meta?.projectId) || null;
                // Créneaux d'avant la refonte : pas de dossier, juste un titre libre. On
                // affiche le titre pour ne rien perdre, mais l'enregistrement redemandera
                // un dossier — c'est l'occasion de les régulariser un par un.
                setProjectSearch(editedProject ? editedProject.name : (eventToEdit.title || ''));
                setSelectedProject(editedProject);
                setChapter(eventToEdit.meta?.internalChapter || '');
                setSelectedResources([eventToEdit.resourceId]);
                const startDateObj = new Date(eventToEdit.meta?.start || eventToEdit.date);
                const endDateObj = new Date(eventToEdit.meta?.end || eventToEdit.date);
                setStartDate(format(startDateObj, 'yyyy-MM-dd'));
                setStartTime(format(startDateObj, 'HH:mm'));
                // Nuit : la fin tombe le lendemain, mais la période saisie reste celle des soirs de départ.
                const isNight = !!eventToEdit.meta?.night;
                setNight(isNight);
                setEndDate(format(isNight ? addDays(endDateObj, -1) : endDateObj, 'yyyy-MM-dd'));
                setEndTime(format(endDateObj, 'HH:mm'));
                setDescription(eventToEdit.meta?.description || '');
                setDecouche(!!eventToEdit.meta?.decouche);
                setDurationHours(eventToEdit.meta?.durationHours ?? ATELIER_HOURS_PER_DAY);
            } else if (initialData) {
                // Mode Création (Clic Cellule)
                setProjectSearch('');
                setSelectedProject(null);
                setChapter('');
                setSelectedResources([initialData.resourceId]);
                setStartDate(initialData.date);
                setEndDate(initialData.date);
                setStartTime('08:00');
                setEndTime('17:00');
                setDescription('');
                setDecouche(false);
                setNight(false);
                setDurationHours(ATELIER_HOURS_PER_DAY);
            } else {
                // Mode Création (Bouton Nouveau)
                setProjectSearch('');
                setSelectedProject(null);
                setChapter('');
                setSelectedResources([]);
                setStartDate(format(new Date(), 'yyyy-MM-dd'));
                setEndDate(format(new Date(), 'yyyy-MM-dd'));
                setStartTime('08:00');
                setEndTime('17:00');
                setDescription('');
                setDecouche(false);
                setNight(false);
                setDurationHours(ATELIER_HOURS_PER_DAY);
            }
        }
    }, [isOpen, eventToEdit, initialData]);

    const filteredProjects = (projects || []).filter(p =>
        (p.name && p.name.toLowerCase().includes(projectSearch.toLowerCase())) ||
        (p.id && p.id.toString().includes(projectSearch))
    );

    // Absence (Congés / RTT / Maladie) en cours d'édition : ce n'est PAS un travail
    // rattachable à un dossier. On ne lui propose donc pas le dossier interne, on ne lui
    // impose pas de dossier, et on préserve son type à l'enregistrement (sinon il
    // deviendrait un créneau du service de la personne).
    const isAbsence = eventToEdit?.type === 'absence';

    // Le dossier interne est TOUJOURS proposé quand la recherche ne donne rien (sauf pour
    // une absence) : c'est la porte de sortie qui remplace l'ancienne saisie libre.
    const internalProject = findInternalProject(projects);
    const showInternalOption = !isAbsence && !filteredProjects.some(isInternalProject);
    const isInternalSelected = isInternalProject(selectedProject);
    const chapterSuggestions = useMemo(() => {
        const q = normalizeChapter(chapter).toLowerCase();
        return getActiveChapters(internalProject)
            .filter(c => !q || c.name.toLowerCase().includes(q))
            .slice(0, 8);
    }, [internalProject, chapter]);

    const selectInternal = () => {
        // Si le dossier n'existe pas encore, il sera créé à l'enregistrement.
        setSelectedProject(internalProject || { id: null, name: INTERNAL_PROJECT_NAME, config: { isInternal: true } });
        setProjectSearch(INTERNAL_PROJECT_NAME);
        setShowProjectList(false);
    };

    const toggleResource = (resId) => {
        if (selectedResources.includes(resId)) {
            setSelectedResources(selectedResources.filter(id => id !== resId));
        } else {
            setSelectedResources([...selectedResources, resId]);
        }
    };

    // Un créneau doit être rattaché à un dossier — réel ou interne. Plus de titre libre :
    // c'est ce qui a produit les créneaux orphelins (« Autre », noms tapés à la main),
    // impossibles à rattacher a posteriori à quoi que ce soit.
    // Une absence n'a pas de dossier : seules les ressources et les dates comptent.
    const canSubmit = selectedResources.length > 0
        && (isAbsence || (!!selectedProject && (!isInternalSelected || !!normalizeChapter(chapter))));

    const handleSubmit = () => {
        if (canSubmit) {
            if (isAbsence) {
                // On préserve tout ce qui fait l'absence : son type, son libellé et son
                // sous-type (Congés/RTT/Maladie, porté par meta.type et lu par la grille).
                onSave({
                    id: eventToEdit?.id,
                    seriesId: eventToEdit?.meta?.seriesId,
                    title: eventToEdit.title,
                    type: 'absence',
                    absenceSubtype: eventToEdit.meta?.type || eventToEdit.title,
                    projectId: null,
                    internalChapter: null,
                    isInternal: false,
                    resourceIds: selectedResources,
                    startDate, startTime, endDate, endTime,
                    durationHours: null,
                    description,
                    status: eventToEdit?.meta?.status || 'validated',
                });
                onClose();
                return;
            }
            // Sur l'interne, le créneau porte le nom du chapitre : c'est ce que l'atelier
            // doit lire sur le planning (« prototype bambou », pas « Interne Lenglart »).
            const titleToSave = isInternalSelected ? normalizeChapter(chapter) : selectedProject.name;
            onSave({
                id: eventToEdit?.id, // Passe l'ID si édition
                seriesId: eventToEdit?.meta?.seriesId, // Permet de remplacer toute la série, pas juste le 1er jour
                title: titleToSave,
                internalChapter: isInternalSelected ? normalizeChapter(chapter) : null,
                isInternal: isInternalSelected,
                projectId: selectedProject?.id || null,
                resourceIds: selectedResources,
                startDate,
                startTime,
                endDate: endDate,
                endTime,
                durationHours: isHourMode ? parseFloat(durationHours) || ATELIER_HOURS_PER_DAY : null,
                description,
                decouche: selectedGroup === 'pose' ? decouche : false, // découché : pertinent pour la pose
                night: selectedGroup === 'pose' ? night : false,
                status: eventToEdit?.meta?.status || 'pending', // Preserves status or defaults to pending
                type: allMembers.find(m => m.id === selectedResources[0])?.group || 'default'
            });
            onClose();
        }
    };

    const canValidate = useMemo(() => {
        // TEMP: Allow all authenticated users to validate
        if (!currentUser || !eventToEdit) return false;
        return true;
    }, [currentUser, eventToEdit]);

    if (!isOpen) return null;

    // Style commun pour les inputs Date/Heure (Fix police & taille)
    const dateTimeInputStyle = {
        border: 'none',
        background: 'transparent',
        fontSize: 13,
        color: 'var(--df-text)',
        outline: 'none',
        fontFamily: 'inherit', // Hériter la police de l'app (pas de monospace)
        cursor: 'pointer',
        fontWeight: 500
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />

            <div style={{ position: 'relative', width: 720, background: 'var(--df-bg)', borderRadius: 12, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', padding: 0, overflow: 'hidden', animation: 'fadeIn 0.2s ease-out' }}>

                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--df-surface-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--df-surface-5)' }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--df-text)' }}>Planifier une activité</h3>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--df-muted)' }}><X size={20} /></button>
                </div>

                <fieldset disabled={readOnly} style={{ border: 'none', padding: 0, margin: 0, minInlineSize: 'auto', display: 'contents' }}>
                    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>

                        {/* 1. PROJET (ou type d'absence si on édite un congé/RTT/maladie) */}
                        <div>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--df-text-2)' }}>
                                {isAbsence ? "Type d'absence" : 'Projet / Client'}
                            </label>
                            {isAbsence ? (
                                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--df-border)', borderRadius: 8, padding: '10px 12px', background: 'var(--df-surface)', color: 'var(--df-text-2)', fontSize: 14 }}>
                                    <Briefcase size={18} color="var(--df-faint)" style={{ marginRight: 10 }} />
                                    {eventToEdit?.title || eventToEdit?.meta?.type || 'Absence'}
                                </div>
                            ) : (
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', border: '1px solid var(--df-border)', borderRadius: 8, padding: '10px 12px', background: 'var(--df-bg)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                <Briefcase size={18} color="var(--df-faint)" style={{ marginRight: 10 }} />
                                <input
                                    autoFocus
                                    value={projectSearch}
                                    onChange={e => { setProjectSearch(e.target.value); setShowProjectList(true); setSelectedProject(null); }}
                                    onFocus={() => setShowProjectList(true)}
                                    placeholder="Rechercher un dossier..."
                                    style={{ border: 'none', outline: 'none', width: '100%', fontSize: 14, color: 'var(--df-text)', fontFamily: 'inherit', background: 'transparent' }}
                                />
                                {selectedProject && <Check size={18} color="#10B981" />}
                            </div>
                            )}
                            {showProjectList && projectSearch.length > 0 && !selectedProject && (
                                <div style={{ position: 'absolute', width: '100%', maxHeight: 200, overflowY: 'auto', background: 'var(--df-bg)', border: '1px solid var(--df-border)', borderRadius: 8, marginTop: 4, zIndex: 20, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                                    {filteredProjects.length > 0 ? filteredProjects.map(p => (
                                        <div
                                            key={p.id}
                                            onClick={() => { setSelectedProject(p); setProjectSearch(p.name); setShowProjectList(false); }}
                                            style={{ padding: '10px 12px', fontSize: 14, cursor: 'pointer', borderBottom: '1px solid var(--df-surface-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                        >
                                            <span style={{ fontWeight: 500, color: 'var(--df-text)' }}>{p.name}</span>
                                            <span style={{ fontSize: 12, color: 'var(--df-faint)', background: 'var(--df-surface-2)', padding: '2px 6px', borderRadius: 4 }}>#{p.id.toString().slice(-4)}</span>
                                        </div>
                                    )) : (
                                        <div style={{ padding: 12, fontSize: 13, color: 'var(--df-faint)' }}>Aucun dossier à ce nom.</div>
                                    )}
                                    {/* Repli : temps qui n'appartient à aucun dossier client */}
                                    {showInternalOption && (
                                        <div
                                            onClick={selectInternal}
                                            style={{ padding: '10px 12px', fontSize: 14, cursor: 'pointer', borderTop: '1px solid var(--df-border-2)', background: 'var(--df-warn-bg)' }}
                                        >
                                            <div style={{ fontWeight: 600, color: 'var(--df-text)' }}>{INTERNAL_PROJECT_NAME}</div>
                                            <div style={{ fontSize: 12, color: 'var(--df-muted)', marginTop: 2 }}>
                                                Prototype, étude, cotes anticipées… — temps hors dossier
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* CHAPITRE — obligatoire sur le dossier interne, c'est lui qui porte le suivi */}
                            {isInternalSelected && (
                                <div style={{ marginTop: 12, position: 'relative' }}>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--df-text-2)' }}>
                                        Chapitre <span style={{ color: 'var(--df-faint)', fontWeight: 400 }}>— ex. prototype bambou, Fab Lab</span>
                                    </label>
                                    <input
                                        value={chapter}
                                        onChange={e => { setChapter(e.target.value); setShowChapterList(true); }}
                                        onFocus={() => setShowChapterList(true)}
                                        onBlur={() => setTimeout(() => setShowChapterList(false), 150)}
                                        placeholder="Nom du chapitre"
                                        style={{ width: '100%', border: '1px solid var(--df-border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--df-text)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                                    />
                                    {showChapterList && chapterSuggestions.length > 0 && (
                                        <div style={{ position: 'absolute', width: '100%', maxHeight: 180, overflowY: 'auto', background: 'var(--df-bg)', border: '1px solid var(--df-border)', borderRadius: 8, marginTop: 4, zIndex: 20, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                                            {chapterSuggestions.map(c => (
                                                <div
                                                    key={c.name}
                                                    onMouseDown={() => { setChapter(c.name); setShowChapterList(false); }}
                                                    style={{ padding: '9px 12px', fontSize: 14, cursor: 'pointer', borderBottom: '1px solid var(--df-surface-4)', color: 'var(--df-text)' }}
                                                >
                                                    {c.name}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* SYNTHÈSE BUDGET POSE */}
                            {poseStats && (
                                <div style={{ backgroundColor: 'var(--df-surface-2)', borderRadius: 8, padding: 12, marginTop: 12, fontSize: 13, color: 'var(--df-text-3)', border: '1px solid var(--df-border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span>Budget Vendu (Pose) :</span>
                                        <span style={{ fontWeight: 600, color: 'var(--df-text)' }}>{fmtH(poseStats.sold)}h</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span>Déjà Planifié (à faire) :</span>
                                        <span style={{ fontWeight: 600, color: '#EA580C' }}>{fmtH(poseStats.planned)}h</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Déjà Consommé (réalisé) :</span>
                                        <span style={{ fontWeight: 600, color: 'var(--df-muted)' }}>{fmtH(poseStats.consumed)}h</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--df-border-strong)' }}>
                                        <span>Reste à Planifier :</span>
                                        <span style={{ fontWeight: 600, color: poseStats.remaining < 0 ? 'var(--df-danger)' : '#10B981' }}>{fmtH(poseStats.remaining)}h</span>
                                    </div>
                                </div>
                            )}

                            {/* DÉCOUCHÉ (pose uniquement) : l'équipe dort sur place */}
                            {selectedGroup === 'pose' && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '10px 12px', borderRadius: 8, border: `1px solid ${decouche ? '#6366F1' : 'var(--df-border)'}`, background: decouche ? 'var(--df-indigo-bg)' : 'var(--df-bg)', cursor: readOnly ? 'default' : 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={decouche}
                                        disabled={readOnly}
                                        onChange={(e) => setDecouche(e.target.checked)}
                                        style={{ width: 16, height: 16, cursor: readOnly ? 'default' : 'pointer', accentColor: '#6366F1' }}
                                    />
                                    <BedDouble size={18} color={decouche ? 'var(--df-x-4338CA)' : 'var(--df-muted)'} />
                                    <span style={{ fontSize: 13, fontWeight: 600, color: decouche ? 'var(--df-chip-name)' : 'var(--df-text-2)' }}>Découché — nuit sur place</span>
                                </label>
                            )}

                            {/* INTERVENTION DE NUIT (pose uniquement) : 18h → 8h par défaut, fin le lendemain */}
                            {selectedGroup === 'pose' && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, padding: '10px 12px', borderRadius: 8, border: `1px solid ${night ? 'var(--df-primary)' : 'var(--df-border)'}`, background: night ? 'var(--df-indigo-bg-2)' : 'var(--df-bg)', cursor: readOnly ? 'default' : 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={night}
                                        disabled={readOnly}
                                        onChange={(e) => {
                                            const on = e.target.checked;
                                            setNight(on);
                                            if (on && startTime === '08:00' && endTime === '17:00') { setStartTime('18:00'); setEndTime('08:00'); }
                                            if (!on && startTime === '18:00' && endTime === '08:00') { setStartTime('08:00'); setEndTime('17:00'); }
                                        }}
                                        style={{ width: 16, height: 16, cursor: readOnly ? 'default' : 'pointer', accentColor: 'var(--df-primary)' }}
                                    />
                                    <Moon size={18} color={night ? 'var(--df-primary)' : 'var(--df-muted)'} />
                                    <span style={{ fontSize: 13, fontWeight: 600, color: night ? 'var(--df-primary)' : 'var(--df-text-2)' }}>Intervention de nuit — fin le lendemain matin</span>
                                </label>
                            )}
                        </div>

                        {/* 2. DATES & HEURES / DURÉE */}
                        <div>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--df-text-2)' }}>
                                {isHourMode ? 'Période et durée journalière' : 'Période d\'intervention'}
                            </label>

                            {isHourMode ? (
                                /* MODE DURÉE — conf & prepa */
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    {/* Date début */}
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', border: '1px solid var(--df-border)', borderRadius: 8, padding: '10px 12px', background: 'var(--df-surface)' }}>
                                        <CalendarIcon size={16} color="var(--df-muted)" style={{ marginRight: 8, flexShrink: 0 }} />
                                        <input
                                            type="date" value={startDate} onChange={e => {
                                                setStartDate(e.target.value);
                                                if (e.target.value > endDate) setEndDate(e.target.value);
                                            }}
                                            style={{ ...dateTimeInputStyle, flex: 1, minWidth: 0 }}
                                        />
                                    </div>

                                    <ArrowRight size={18} color="var(--df-faint)" />

                                    {/* Date fin */}
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', border: '1px solid var(--df-border)', borderRadius: 8, padding: '10px 12px', background: 'var(--df-surface)' }}>
                                        <CalendarIcon size={16} color="var(--df-muted)" style={{ marginRight: 8, flexShrink: 0 }} />
                                        <input
                                            type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)}
                                            style={{ ...dateTimeInputStyle, flex: 1, minWidth: 0 }}
                                        />
                                    </div>

                                    {/* Durée par jour */}
                                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--df-border)', borderRadius: 8, padding: '10px 12px', background: 'var(--df-surface)', gap: 8 }}>
                                        <Clock size={16} color="var(--df-muted)" style={{ flexShrink: 0 }} />
                                        <input
                                            type="number"
                                            min="0.5" max="8" step="0.1"
                                            value={durationHours}
                                            onChange={e => setDurationHours(e.target.value)}
                                            style={{ ...dateTimeInputStyle, width: 48, textAlign: 'center' }}
                                        />
                                        <span style={{ fontSize: 13, color: 'var(--df-muted)', fontWeight: 500 }}>h/j</span>
                                    </div>
                                </div>
                            ) : (
                                /* MODE CRÉNEAU — pose */
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    {/* Début */}
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', border: '1px solid var(--df-border)', borderRadius: 8, padding: '10px 12px', background: 'var(--df-surface)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}>
                                        <CalendarIcon size={16} color="var(--df-muted)" style={{ marginRight: 8, flexShrink: 0 }} />
                                        <input
                                            type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                            style={{ ...dateTimeInputStyle, flex: 1, minWidth: 0 }}
                                        />
                                        <div style={{ width: 1, height: 18, background: 'var(--df-border-strong)', margin: '0 10px' }} />
                                        <Clock size={16} color="var(--df-muted)" style={{ marginRight: 8, flexShrink: 0 }} />
                                        <input
                                            type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                                            style={{ ...dateTimeInputStyle, width: 80 }}
                                        />
                                    </div>

                                    <ArrowRight size={18} color="var(--df-faint)" />

                                    {/* Fin */}
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', border: '1px solid var(--df-border)', borderRadius: 8, padding: '10px 12px', background: 'var(--df-surface)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}>
                                        <CalendarIcon size={16} color="var(--df-muted)" style={{ marginRight: 8, flexShrink: 0 }} />
                                        <input
                                            type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                                            style={{ ...dateTimeInputStyle, flex: 1, minWidth: 0 }}
                                        />
                                        <div style={{ width: 1, height: 18, background: 'var(--df-border-strong)', margin: '0 10px' }} />
                                        <Clock size={16} color="var(--df-muted)" style={{ marginRight: 8, flexShrink: 0 }} />
                                        <input
                                            type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                                            style={{ ...dateTimeInputStyle, width: 80 }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 3. RESSOURCES */}
                        <div>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--df-text-2)' }}>Ressources affectées</label>
                            <div
                                onClick={() => setShowResourceList(!showResourceList)}
                                style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--df-border)', borderRadius: 8, padding: '12px 14px', cursor: 'pointer', justifyContent: 'space-between', background: 'var(--df-bg)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                                    <User size={18} color="var(--df-faint)" style={{ marginRight: 10, flexShrink: 0 }} />
                                    <span style={{ fontSize: 14, color: selectedResources.length ? 'var(--df-text)' : 'var(--df-faint)', fontWeight: selectedResources.length ? 500 : 400 }}>
                                        {selectedResources.length === 0 ? "Qui doit intervenir ?" :
                                            `${selectedResources.length} ressource(s) sélectionnée(s)`}
                                    </span>
                                </div>
                                <ChevronDown size={16} color="var(--df-muted)" />
                            </div>

                            {showResourceList && (
                                <div style={{ maxHeight: 200, overflowY: 'auto', background: 'var(--df-bg)', border: '1px solid var(--df-border)', borderRadius: 8, marginTop: 8, padding: 4, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                    {['prepa', 'conf', 'pose'].map(grpKey => (
                                        <div key={grpKey}>
                                            <div style={{ padding: '8px 12px', background: 'var(--df-surface-2)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--df-muted)', borderRadius: 4, margin: 4 }}>
                                                {groupsConfig[grpKey].label}
                                            </div>
                                            {groupsConfig[grpKey].members.filter(m => m.id !== 'backlog_confection').map(member => (
                                                <div
                                                    key={member.id}
                                                    onClick={() => toggleResource(member.id)}
                                                    style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', cursor: 'pointer', margin: '0 4px', borderRadius: 6, background: selectedResources.includes(member.id) ? 'var(--df-blue-bg)' : 'transparent' }}
                                                >
                                                    <div style={{ width: 18, height: 18, border: selectedResources.includes(member.id) ? '1px solid var(--df-blue)' : '1px solid var(--df-border-strong)', borderRadius: 4, marginRight: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: selectedResources.includes(member.id) ? 'var(--df-blue)' : 'var(--df-bg)', transition: 'all 0.2s' }}>
                                                        {selectedResources.includes(member.id) && <Check size={12} color="white" />}
                                                    </div>
                                                    <span style={{ fontSize: 13, fontWeight: selectedResources.includes(member.id) ? 600 : 400, color: 'var(--df-text-2)' }}>{member.first_name} {member.last_name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* 4. INSTRUCTIONS */}
                        <div>

                            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--df-text-2)' }}>Instructions / Notes</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Détails de l'intervention..."
                                style={{ width: '100%', minHeight: 80, border: '1px solid var(--df-border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
                            />
                        </div>


                    </div>
                </fieldset>

                {/* Footer */}
                <div style={{ padding: '20px 24px', background: 'var(--df-surface)', borderTop: '1px solid var(--df-surface-2)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    {/* Une absence est toujours « validée » par nature : le garde-fou
                        « seul l'admin supprime un créneau validé » (pensé pour le travail
                        confirmé) ne doit pas empêcher l'ordo de retirer un congé/RTT/maladie. */}
                    {/* Validé : réservé à l'admin, SAUF si le créneau est encore À VENIR
                        (début après maintenant) → misclic de validation sur un futur, l'ordo peut le retirer. */}
                    {eventToEdit && onDelete && canDelete && (isAbsence || eventToEdit.meta?.status !== 'validated' || currentUser?.role === 'admin' || (new Date(eventToEdit.meta?.start || eventToEdit.date) > new Date())) && !readOnly && (
                        <button
                            onClick={() => { onClose(); onDelete(eventToEdit); }}
                            style={{ marginRight: 'auto', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--df-danger-border)', background: 'var(--df-danger-bg)', color: 'var(--df-danger)', fontWeight: 600, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                            <Trash2 size={16} /> Supprimer
                        </button>
                    )}

                    {eventToEdit && canValidate && eventToEdit.meta?.status !== 'validated' && !readOnly && (
                        <button
                            onClick={() => { onValidate(eventToEdit); onClose(); }}
                            style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#059669', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                            <CheckCircle size={16} /> Valider (Réalisé)
                        </button>
                    )}

                    <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--df-border-strong)', background: 'var(--df-bg)', fontWeight: 600, color: 'var(--df-text-2)', cursor: 'pointer', fontSize: 14 }}>{readOnly ? 'Fermer' : 'Annuler'}</button>
                    {!readOnly && (
                        <button
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            title={!canSubmit ? (isInternalSelected ? 'Renseignez le chapitre' : 'Choisissez un dossier et une ressource') : undefined}
                            style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--df-ink)', color: 'white', fontWeight: 600, cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.45, fontSize: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
                        >
                            {eventToEdit ? 'Enregistrer' : 'Planifier'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EventModal;
