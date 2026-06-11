import React, { useState, useMemo, useEffect } from 'react';
import { X, Briefcase, Check, Calendar as CalendarIcon, Clock, ArrowRight, User, ChevronDown, Trash2, CheckCircle } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { ATELIER_HOURS_PER_DAY } from './constants';

const EventModal = ({ isOpen, onClose, onSave, onValidate, onDelete, projects = [], events = [], eventToEdit, initialData, currentUser, groupsConfig, readOnly = false }) => {
    // États Formulaire
    const [projectSearch, setProjectSearch] = useState('');
    const [selectedProject, setSelectedProject] = useState(null);
    const [showProjectList, setShowProjectList] = useState(false);

    // Multi-Ressources
    const [selectedResources, setSelectedResources] = useState([]);
    const [showResourceList, setShowResourceList] = useState(false);
    const [description, setDescription] = useState('');

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
                setProjectSearch(eventToEdit.title || '');
                setSelectedProject(projects.find(p => p.id === eventToEdit.meta?.projectId) || { name: eventToEdit.title });
                setSelectedResources([eventToEdit.resourceId]);
                const startDateObj = new Date(eventToEdit.meta?.start || eventToEdit.date);
                const endDateObj = new Date(eventToEdit.meta?.end || eventToEdit.date);
                setStartDate(format(startDateObj, 'yyyy-MM-dd'));
                setStartTime(format(startDateObj, 'HH:mm'));
                setEndDate(format(endDateObj, 'yyyy-MM-dd'));
                setEndTime(format(endDateObj, 'HH:mm'));
                setDescription(eventToEdit.meta?.description || '');
                setDurationHours(eventToEdit.meta?.durationHours ?? ATELIER_HOURS_PER_DAY);
            } else if (initialData) {
                // Mode Création (Clic Cellule)
                setProjectSearch('');
                setSelectedProject(null);
                setSelectedResources([initialData.resourceId]);
                setStartDate(initialData.date);
                setEndDate(initialData.date);
                setStartTime('08:00');
                setEndTime('17:00');
                setDescription('');
                setDurationHours(ATELIER_HOURS_PER_DAY);
            } else {
                // Mode Création (Bouton Nouveau)
                setProjectSearch('');
                setSelectedProject(null);
                setSelectedResources([]);
                setStartDate(format(new Date(), 'yyyy-MM-dd'));
                setEndDate(format(new Date(), 'yyyy-MM-dd'));
                setStartTime('08:00');
                setEndTime('17:00');
                setDescription('');
                setDurationHours(ATELIER_HOURS_PER_DAY);
            }
        }
    }, [isOpen, eventToEdit, initialData]);

    const filteredProjects = (projects || []).filter(p =>
        (p.name && p.name.toLowerCase().includes(projectSearch.toLowerCase())) ||
        (p.id && p.id.toString().includes(projectSearch))
    );

    const toggleResource = (resId) => {
        if (selectedResources.includes(resId)) {
            setSelectedResources(selectedResources.filter(id => id !== resId));
        } else {
            setSelectedResources([...selectedResources, resId]);
        }
    };

    const handleSubmit = () => {
        const titleToSave = selectedProject ? selectedProject.name : projectSearch;

        if (titleToSave && selectedResources.length > 0) {
            onSave({
                id: eventToEdit?.id, // Passe l'ID si édition
                seriesId: eventToEdit?.meta?.seriesId, // Permet de remplacer toute la série, pas juste le 1er jour
                title: titleToSave,
                projectId: selectedProject?.id || null,
                resourceIds: selectedResources,
                startDate,
                startTime,
                endDate: endDate,
                endTime,
                durationHours: isHourMode ? parseFloat(durationHours) || ATELIER_HOURS_PER_DAY : null,
                description,
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
        color: '#111827',
        outline: 'none',
        fontFamily: 'inherit', // Hériter la police de l'app (pas de monospace)
        cursor: 'pointer',
        fontWeight: 500
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />

            <div style={{ position: 'relative', width: 720, background: 'white', borderRadius: 12, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', padding: 0, overflow: 'hidden', animation: 'fadeIn 0.2s ease-out' }}>

                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#111827' }}>Planifier une activité</h3>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6B7280' }}><X size={20} /></button>
                </div>

                <fieldset disabled={readOnly} style={{ border: 'none', padding: 0, margin: 0, minInlineSize: 'auto', display: 'contents' }}>
                    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>

                        {/* 1. PROJET */}
                        <div>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#374151' }}>Projet / Client</label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', background: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                <Briefcase size={18} color="#9CA3AF" style={{ marginRight: 10 }} />
                                <input
                                    autoFocus
                                    value={projectSearch}
                                    onChange={e => { setProjectSearch(e.target.value); setShowProjectList(true); setSelectedProject(null); }}
                                    onFocus={() => setShowProjectList(true)}
                                    placeholder="Rechercher un dossier..."
                                    style={{ border: 'none', outline: 'none', width: '100%', fontSize: 14, color: '#111827', fontFamily: 'inherit' }}
                                />
                                {selectedProject && <Check size={18} color="#10B981" />}
                            </div>
                            {showProjectList && projectSearch.length > 0 && !selectedProject && (
                                <div style={{ position: 'absolute', width: '100%', maxHeight: 200, overflowY: 'auto', background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, marginTop: 4, zIndex: 20, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                                    {filteredProjects.length > 0 ? filteredProjects.map(p => (
                                        <div
                                            key={p.id}
                                            onClick={() => { setSelectedProject(p); setProjectSearch(p.name); setShowProjectList(false); }}
                                            style={{ padding: '10px 12px', fontSize: 14, cursor: 'pointer', borderBottom: '1px solid #F9FAFB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                        >
                                            <span style={{ fontWeight: 500, color: '#111827' }}>{p.name}</span>
                                            <span style={{ fontSize: 12, color: '#9CA3AF', background: '#F3F4F6', padding: '2px 6px', borderRadius: 4 }}>#{p.id.toString().slice(-4)}</span>
                                        </div>
                                    )) : (
                                        <div style={{ padding: 12, fontSize: 13, color: '#9CA3AF' }}>Aucun projet trouvé.</div>
                                    )}
                                </div>
                            )}

                            {/* SYNTHÈSE BUDGET POSE */}
                            {poseStats && (
                                <div style={{ backgroundColor: '#F3F4F6', borderRadius: 8, padding: 12, marginTop: 12, fontSize: 13, color: '#4B5563', border: '1px solid #E5E7EB' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span>Budget Vendu (Pose) :</span>
                                        <span style={{ fontWeight: 600, color: '#111827' }}>{fmtH(poseStats.sold)}h</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span>Déjà Planifié (à faire) :</span>
                                        <span style={{ fontWeight: 600, color: '#EA580C' }}>{fmtH(poseStats.planned)}h</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Déjà Consommé (réalisé) :</span>
                                        <span style={{ fontWeight: 600, color: '#6B7280' }}>{fmtH(poseStats.consumed)}h</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px dashed #D1D5DB' }}>
                                        <span>Reste à Planifier :</span>
                                        <span style={{ fontWeight: 600, color: poseStats.remaining < 0 ? '#EF4444' : '#10B981' }}>{fmtH(poseStats.remaining)}h</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 2. DATES & HEURES / DURÉE */}
                        <div>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#374151' }}>
                                {isHourMode ? 'Période et durée journalière' : 'Période d\'intervention'}
                            </label>

                            {isHourMode ? (
                                /* MODE DURÉE — conf & prepa */
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    {/* Date début */}
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', background: '#F9FAFB' }}>
                                        <CalendarIcon size={16} color="#6B7280" style={{ marginRight: 8, flexShrink: 0 }} />
                                        <input
                                            type="date" value={startDate} onChange={e => {
                                                setStartDate(e.target.value);
                                                if (e.target.value > endDate) setEndDate(e.target.value);
                                            }}
                                            style={{ ...dateTimeInputStyle, flex: 1, minWidth: 0 }}
                                        />
                                    </div>

                                    <ArrowRight size={18} color="#9CA3AF" />

                                    {/* Date fin */}
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', background: '#F9FAFB' }}>
                                        <CalendarIcon size={16} color="#6B7280" style={{ marginRight: 8, flexShrink: 0 }} />
                                        <input
                                            type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)}
                                            style={{ ...dateTimeInputStyle, flex: 1, minWidth: 0 }}
                                        />
                                    </div>

                                    {/* Durée par jour */}
                                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', background: '#F9FAFB', gap: 8 }}>
                                        <Clock size={16} color="#6B7280" style={{ flexShrink: 0 }} />
                                        <input
                                            type="number"
                                            min="0.5" max="8" step="0.1"
                                            value={durationHours}
                                            onChange={e => setDurationHours(e.target.value)}
                                            style={{ ...dateTimeInputStyle, width: 48, textAlign: 'center' }}
                                        />
                                        <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>h/j</span>
                                    </div>
                                </div>
                            ) : (
                                /* MODE CRÉNEAU — pose */
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    {/* Début */}
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', background: '#F9FAFB', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}>
                                        <CalendarIcon size={16} color="#6B7280" style={{ marginRight: 8, flexShrink: 0 }} />
                                        <input
                                            type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                            style={{ ...dateTimeInputStyle, flex: 1, minWidth: 0 }}
                                        />
                                        <div style={{ width: 1, height: 18, background: '#D1D5DB', margin: '0 10px' }} />
                                        <Clock size={16} color="#6B7280" style={{ marginRight: 8, flexShrink: 0 }} />
                                        <input
                                            type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                                            style={{ ...dateTimeInputStyle, width: 80 }}
                                        />
                                    </div>

                                    <ArrowRight size={18} color="#9CA3AF" />

                                    {/* Fin */}
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', background: '#F9FAFB', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}>
                                        <CalendarIcon size={16} color="#6B7280" style={{ marginRight: 8, flexShrink: 0 }} />
                                        <input
                                            type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                                            style={{ ...dateTimeInputStyle, flex: 1, minWidth: 0 }}
                                        />
                                        <div style={{ width: 1, height: 18, background: '#D1D5DB', margin: '0 10px' }} />
                                        <Clock size={16} color="#6B7280" style={{ marginRight: 8, flexShrink: 0 }} />
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
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#374151' }}>Ressources affectées</label>
                            <div
                                onClick={() => setShowResourceList(!showResourceList)}
                                style={{ display: 'flex', alignItems: 'center', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 14px', cursor: 'pointer', justifyContent: 'space-between', background: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                                    <User size={18} color="#9CA3AF" style={{ marginRight: 10, flexShrink: 0 }} />
                                    <span style={{ fontSize: 14, color: selectedResources.length ? '#111827' : '#9CA3AF', fontWeight: selectedResources.length ? 500 : 400 }}>
                                        {selectedResources.length === 0 ? "Qui doit intervenir ?" :
                                            `${selectedResources.length} ressource(s) sélectionnée(s)`}
                                    </span>
                                </div>
                                <ChevronDown size={16} color="#6B7280" />
                            </div>

                            {showResourceList && (
                                <div style={{ maxHeight: 200, overflowY: 'auto', background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, marginTop: 8, padding: 4, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                    {['prepa', 'conf', 'pose'].map(grpKey => (
                                        <div key={grpKey}>
                                            <div style={{ padding: '8px 12px', background: '#F3F4F6', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6B7280', borderRadius: 4, margin: 4 }}>
                                                {groupsConfig[grpKey].label}
                                            </div>
                                            {groupsConfig[grpKey].members.filter(m => m.id !== 'backlog_confection').map(member => (
                                                <div
                                                    key={member.id}
                                                    onClick={() => toggleResource(member.id)}
                                                    style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', cursor: 'pointer', margin: '0 4px', borderRadius: 6, background: selectedResources.includes(member.id) ? '#EFF6FF' : 'transparent' }}
                                                >
                                                    <div style={{ width: 18, height: 18, border: selectedResources.includes(member.id) ? '1px solid #2563EB' : '1px solid #D1D5DB', borderRadius: 4, marginRight: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: selectedResources.includes(member.id) ? '#2563EB' : 'white', transition: 'all 0.2s' }}>
                                                        {selectedResources.includes(member.id) && <Check size={12} color="white" />}
                                                    </div>
                                                    <span style={{ fontSize: 13, fontWeight: selectedResources.includes(member.id) ? 600 : 400, color: '#374151' }}>{member.first_name} {member.last_name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* 4. INSTRUCTIONS */}
                        <div>

                            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#374151' }}>Instructions / Notes</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Détails de l'intervention..."
                                style={{ width: '100%', minHeight: 80, border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
                            />
                        </div>


                    </div>
                </fieldset>

                {/* Footer */}
                <div style={{ padding: '20px 24px', background: '#F9FAFB', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    {eventToEdit && onDelete && (eventToEdit.meta?.status !== 'validated' || currentUser?.role === 'admin') && !readOnly && (
                        <button
                            onClick={() => { if (window.confirm('Supprimer ce créneau ?')) { onDelete(eventToEdit); onClose(); } }}
                            style={{ marginRight: 'auto', padding: '10px 16px', borderRadius: 8, border: '1px solid #fee2e2', background: '#fef2f2', color: '#ef4444', fontWeight: 600, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
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

                    <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #D1D5DB', background: 'white', fontWeight: 600, color: '#374151', cursor: 'pointer', fontSize: 14 }}>{readOnly ? 'Fermer' : 'Annuler'}</button>
                    {!readOnly && (
                        <button onClick={handleSubmit} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#111827', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                            {eventToEdit ? 'Enregistrer' : 'Planifier'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EventModal;
