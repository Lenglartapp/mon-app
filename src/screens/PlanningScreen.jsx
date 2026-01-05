import React, { useState, useMemo, useEffect } from 'react';
import { S, COLORS } from '../lib/constants/ui';
import { useAuth } from '../auth';
import {
    ChevronLeft, ChevronRight, Search, ChevronDown, ChevronRight as ChevronRightIcon,
    X, Check, User, Briefcase, Clock, Calendar as CalendarIcon, ArrowRight, CheckCircle, Trash2
} from 'lucide-react';
import { ROLES } from '../auth';
import {
    format, startOfWeek, addDays, addWeeks, subWeeks,
    isSameDay, startOfMonth, endOfMonth, eachDayOfInterval,
    startOfQuarter, endOfQuarter, startOfYear, endOfYear, eachMonthOfInterval,
    addMonths, subMonths, addQuarters, subQuarters, addYears, subYears, startOfDay,
    differenceInDays, parseISO, getHours, getMinutes, differenceInMinutes, setHours, setMinutes
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCapacityPlanning } from '../hooks/useCapacityPlanning';
import { uid } from '../lib/utils/uid';

// --- CONFIGURATION ---
const GROUPS_CONFIG = {
    prepa: {
        id: 'prepa',
        label: 'PRÉPARATION & BUREAU',
        bg: '#FFF7ED',
        members: ['Bureau d\'Études']
    },
    conf: {
        id: 'conf',
        label: 'ATELIER CONFECTION',
        bg: '#F8FAFC',
        members: ['Atelier Global']
    },
    pose: {
        id: 'pose',
        label: 'ÉQUIPES DE POSE',
        bg: '#F0FDF4',
        members: ['Alain', 'Guillaume', 'Nicolas']
    }
};

const PLANNING_COLORS = {
    pose: { bg: '#1F2937', text: '#FFF', border: '#000' },
    conf: { bg: '#E5E7EB', text: '#1F2937', border: '#9CA3AF' },
    prepa: { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' },
    default: { bg: '#3B82F6', text: '#FFF', border: '#2563EB' }
};

// CONSTANTES DIMENSION
const ROW_HEIGHT = 70;
const HEADER_HEIGHT_1 = 36;
const HEADER_HEIGHT_2 = 40;
const WORK_START_HOUR = 8; // 8h00
const WORK_END_HOUR = 17;   // 17h00
const TOTAL_WORK_MINUTES = (WORK_END_HOUR - WORK_START_HOUR) * 60; // 9h = 540 min

// --- COMPOSANT MODALE AVANCÉE ---
const EventModal = ({ isOpen, onClose, onSave, onValidate, onDelete, projects = [], eventToEdit, initialData, currentUser }) => {
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

    // Aplatir la liste des membres pour l'affichage
    const allMembers = [
        ...GROUPS_CONFIG.prepa.members.map(m => ({ id: m, group: 'prepa', label: m })),
        ...GROUPS_CONFIG.conf.members.map(m => ({ id: m, group: 'conf', label: m })),
        ...GROUPS_CONFIG.pose.members.map(m => ({ id: m, group: 'pose', label: m }))
    ];

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
                title: titleToSave,
                projectId: selectedProject?.id || null,
                resourceIds: selectedResources,
                startDate,
                startTime,
                endDate,
                endTime,
                description,
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
                    </div>

                    {/* 2. DATES & HEURES (Clean Layout) */}
                    <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#374151' }}>Période d'intervention</label>
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
                                            {GROUPS_CONFIG[grpKey].label}
                                        </div>
                                        {GROUPS_CONFIG[grpKey].members.map(member => (
                                            <div
                                                key={member}
                                                onClick={() => toggleResource(member)}
                                                style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', cursor: 'pointer', margin: '0 4px', borderRadius: 6, background: selectedResources.includes(member) ? '#EFF6FF' : 'transparent' }}
                                            >
                                                <div style={{ width: 18, height: 18, border: selectedResources.includes(member) ? '1px solid #2563EB' : '1px solid #D1D5DB', borderRadius: 4, marginRight: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: selectedResources.includes(member) ? '#2563EB' : 'white', transition: 'all 0.2s' }}>
                                                    {selectedResources.includes(member) && <Check size={12} color="white" />}
                                                </div>
                                                <span style={{ fontSize: 13, fontWeight: selectedResources.includes(member) ? 600 : 400, color: '#374151' }}>{member}</span>
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

                {/* Footer */}
                <div style={{ padding: '20px 24px', background: '#F9FAFB', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    {eventToEdit && onDelete && eventToEdit.meta?.status !== 'validated' && (
                        <button
                            onClick={() => { if (window.confirm('Supprimer ce créneau ?')) { onDelete(eventToEdit); onClose(); } }}
                            style={{ marginRight: 'auto', padding: '10px 16px', borderRadius: 8, border: '1px solid #fee2e2', background: '#fef2f2', color: '#ef4444', fontWeight: 600, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                            <Trash2 size={16} /> Supprimer
                        </button>
                    )}

                    {eventToEdit && canValidate && eventToEdit.meta?.status !== 'validated' && (
                        <button
                            onClick={() => { onValidate(eventToEdit); onClose(); }}
                            style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#059669', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                            <CheckCircle size={16} /> Valider (Réalisé)
                        </button>
                    )}

                    <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #D1D5DB', background: 'white', fontWeight: 600, color: '#374151', cursor: 'pointer', fontSize: 14 }}>Annuler</button>
                    <button onClick={handleSubmit} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#111827', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                        {eventToEdit ? 'Enregistrer' : 'Planifier'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- LE RESTE DU FICHIER RESTE INCHANGÉ MAIS DOIT ÊTRE PRÉSENT ---
// (StickyLeftCell, StickyTopCell, StickyCorner, ViewSelector, TopBar, PlanningScreen...)

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
const ViewSelector = ({ view, onViewChange, customRange, onCustomRangeChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [tempStart, setTempStart] = useState('');
    const [tempEnd, setTempEnd] = useState('');
    const handleApply = () => { if (tempStart && tempEnd) { onCustomRangeChange({ start: new Date(tempStart), end: new Date(tempEnd) }); setIsOpen(false); } };
    const options = [{ id: 'day', label: 'Jour' }, { id: 'week', label: 'Semaine' }, { id: 'month', label: 'Mois' }, { id: 'quarter', label: 'Trimestre' }, { id: 'year', label: 'Année' }];
    return (
        <div style={{ position: 'relative' }}>
            <button onClick={() => setIsOpen(!isOpen)} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 6, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                {view === 'custom' ? 'Période' : options.find(o => o.id === view)?.label || 'Vue'} <ChevronDown size={14} />
            </button>
            {isOpen && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 80 }} onClick={() => setIsOpen(false)} />
                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, width: 280, background: 'white', borderRadius: 8, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #E5E7EB', zIndex: 90, padding: 4 }}>
                        <div style={{ paddingBottom: 4, borderBottom: '1px solid #F3F4F6' }}>{options.map(opt => (<div key={opt.id} onClick={() => { onViewChange(opt.id); setIsOpen(false); }} style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 4, background: view === opt.id ? '#EFF6FF' : 'transparent', color: view === opt.id ? '#2563EB' : '#374151', fontWeight: view === opt.id ? 600 : 400 }}>{opt.label}</div>))}</div>
                        <div style={{ padding: 12 }}>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}> <input type="date" style={{ ...S.input, padding: 4, fontSize: 12 }} onChange={e => setTempStart(e.target.value)} /> <input type="date" style={{ ...S.input, padding: 4, fontSize: 12 }} onChange={e => setTempEnd(e.target.value)} /> </div>
                            <button onClick={handleApply} style={{ width: '100%', background: '#1F2937', color: 'white', border: 'none', padding: '6px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>Appliquer</button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
const TopBar = ({
    view, onViewChange, currentDate, onPrev, onNext, onToday,
    customRange, onCustomRangeChange, onNew,
    searchQuery, setSearchQuery, activeFilters, onAddFilter, onRemoveFilter,
    assistantMode, onToggleAssistant
}) => {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#FAF5EE' }}>
            <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={onNew} style={{ background: '#111827', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Nouveau</button>
                <button
                    onClick={onToggleAssistant}
                    style={{
                        background: assistantMode ? '#2563EB' : 'white',
                        color: assistantMode ? 'white' : '#374151',
                        border: '1px solid #E5E7EB',
                        borderRadius: 6,
                        padding: '8px 16px',
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'all 0.2s'
                    }}
                >
                    {assistantMode ? <CalendarIcon size={16} /> : <Briefcase size={16} />}
                    {assistantMode ? "Vue Calendrier" : "Vue Assistant"}
                </button>
            </div>

            <div style={{ flex: 1, maxWidth: 600, margin: '0 24px', position: 'relative' }}>
                <div style={{
                    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
                    background: 'white', border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 10px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}>
                    <Search size={16} color="#9CA3AF" />

                    {activeFilters.map((filter, idx) => (
                        <div key={idx} style={{
                            background: '#1F2937', color: 'white', borderRadius: 4,
                            padding: '2px 8px', fontSize: 12, fontWeight: 500,
                            display: 'flex', alignItems: 'center', gap: 6, animation: 'fadeIn 0.2s'
                        }}>
                            <span>{filter.label}</span>
                            <div onClick={() => onRemoveFilter(filter)} style={{ cursor: 'pointer', display: 'flex' }}><X size={12} /></div>
                        </div>
                    ))}

                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={activeFilters.length === 0 ? "Rechercher..." : ""}
                        style={{ border: 'none', outline: 'none', flex: 1, minWidth: 80, fontSize: 14, background: 'transparent', color: '#111827' }}
                    />
                </div>

                {searchQuery.length > 0 && (
                    <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                        background: 'white', borderRadius: 6, border: '1px solid #E5E7EB',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 100, overflow: 'hidden'
                    }}>
                        <div
                            onClick={() => { onAddFilter({ type: 'project', value: searchQuery, label: `Projet : ${searchQuery}` }); setSearchQuery(''); }}
                            style={{ padding: '10px 14px', fontSize: 13, color: '#374151', cursor: 'pointer', borderBottom: '1px solid #F3F4F6' }}
                            onMouseEnter={(e) => e.target.style.background = '#F9FAFB'}
                            onMouseLeave={(e) => e.target.style.background = 'white'}
                        >
                            Rechercher <strong>{searchQuery}</strong> dans <strong>Projets</strong>
                        </div>
                        <div
                            onClick={() => { onAddFilter({ type: 'resource', value: searchQuery, label: `Ressource : ${searchQuery}` }); setSearchQuery(''); }}
                            style={{ padding: '10px 14px', fontSize: 13, color: '#374151', cursor: 'pointer' }}
                            onMouseEnter={(e) => e.target.style.background = '#F9FAFB'}
                            onMouseLeave={(e) => e.target.style.background = 'white'}
                        >
                            Rechercher <strong>{searchQuery}</strong> dans <strong>Ressources</strong>
                        </div>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', background: '#fff', borderRadius: 6, border: '1px solid #E5E7EB', padding: 2 }}>
                    <button onClick={onPrev} style={{ border: 'none', background: 'transparent', padding: '6px 8px', cursor: 'pointer' }}><ChevronLeft size={16} /></button>
                    <button onClick={onNext} style={{ border: 'none', background: 'transparent', padding: '6px 8px', cursor: 'pointer' }}><ChevronRight size={16} /></button>
                </div>
                <ViewSelector view={view} onViewChange={onViewChange} customRange={customRange} onCustomRangeChange={onCustomRangeChange} />
                <button onClick={onToday} style={{ background: 'transparent', color: '#111827', border: 'none', padding: '0 8px', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>Aujourd'hui</button>
            </div>
        </div>
    );
};

export default function PlanningScreen({ projects, events: initialEvents, onUpdateEvent, onDeleteEvent, onBack }) {
    const { users, currentUser } = useAuth();

    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState('week');
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

    // --- RECHERCHE MULTI-CRITÈRES ---
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilters, setActiveFilters] = useState([]);

    // --- MODE ASSISTANT ---
    const [assistantMode, setAssistantMode] = useState(false);
    const stats = useCapacityPlanning(projects, localEvents, { conf: 11, pose: 3 });

    const filteredGroups = useMemo(() => {
        if (activeFilters.length === 0) return GROUPS_CONFIG;

        const newConfig = {};
        Object.keys(GROUPS_CONFIG).forEach(key => {
            const group = GROUPS_CONFIG[key];
            const filteredMembers = group.members.filter(member => {
                return activeFilters.every(filter => {
                    if (filter.type === 'resource') {
                        return member.toLowerCase().includes(filter.value.toLowerCase());
                    }
                    if (filter.type === 'project') {
                        // On cherche si un événement de ce membre correspond au projet
                        return localEvents.some(evt =>
                            evt.resourceId === member &&
                            evt.title && evt.title.toLowerCase().includes(filter.value.toLowerCase())
                        );
                    }
                    return true;
                });
            });

            if (filteredMembers.length > 0) {
                newConfig[key] = { ...group, members: filteredMembers };
            }
        });
        return newConfig;
    }, [activeFilters, localEvents]);

    // --- HANDLERS DRAG & DROP ---
    const handleCellClick = (resourceId, date) => {
        setEditingEvent(null);
        setInitialModalData({
            resourceId: resourceId,
            date: format(date, 'yyyy-MM-dd')
        });
        setIsModalOpen(true);
    };

    const handleDragStart = (e, event) => {
        setDraggedEvent(event);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // Autorise le drop
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e, targetResourceId, targetDate) => {
        e.preventDefault();
        if (!draggedEvent) return;

        // On garde les heures d'origine, on change juste la date et la ressource
        const originalStart = new Date(draggedEvent.meta.start);
        const originalEnd = new Date(draggedEvent.meta.end);

        const newStart = new Date(targetDate);
        newStart.setHours(getHours(originalStart), getMinutes(originalStart));

        const durationMinutes = differenceInMinutes(originalEnd, originalStart);
        const newEnd = new Date(newStart);
        newEnd.setMinutes(newStart.getMinutes() + durationMinutes);

        // Mise à jour locale
        setLocalEvents(prev => prev.map(evt => {
            if (evt.id === draggedEvent.id) {
                return {
                    ...evt,
                    resourceId: targetResourceId,
                    date: format(targetDate, 'yyyy-MM-dd'),
                    meta: { ...evt.meta, start: newStart.toISOString(), end: newEnd.toISOString() }
                };
            }
            return evt;
        }));
        setDraggedEvent(null);

        // SAUVEGARDE DB
        const updatedEvent = {
            ...draggedEvent,
            resourceId: targetResourceId,
            date: format(targetDate, 'yyyy-MM-dd'),
            meta: { ...draggedEvent.meta, start: newStart.toISOString(), end: newEnd.toISOString() }
        };
        if (onUpdateEvent) onUpdateEvent(updatedEvent);
    };

    // --- HANDLER SAUVEGARDE (Création OU Édition) ---
    const handleSaveEvent = (formData) => {
        const start = new Date(`${formData.startDate}T${formData.startTime}`);
        const end = new Date(`${formData.endDate}T${formData.endTime}`);
        const durationDays = Math.max(1, differenceInDays(end, start) + 1);

        if (formData.id) {
            // Modification
            setLocalEvents(prev => prev.map(evt => evt.id === formData.id ? {
                ...evt, title: formData.title, resourceId: formData.resourceIds[0], date: formData.startDate, duration: durationDays, type: formData.type,
                meta: { ...evt.meta, start: start.toISOString(), end: end.toISOString(), projectId: formData.projectId }
            } : evt));

            // SAUVEGARDE DB (Modification)
            if (onUpdateEvent) {
                const updatedEvt = {
                    id: formData.id,
                    title: formData.title,
                    resourceId: formData.resourceIds[0],
                    date: formData.startDate,
                    duration: durationDays,
                    type: formData.type,
                    meta: {
                        ...localEvents.find(e => e.id === formData.id)?.meta,
                        start: start.toISOString(),
                        end: end.toISOString(),
                        projectId: formData.projectId
                    }
                };
                onUpdateEvent(updatedEvt);
            }
        } else {
            // Création (Code existant...)
            handleAddEvent(formData);
        }
    };

    // --- LOGIQUE AJOUT EVENTS (Multi) ---
    const handleAddEvent = (formData) => {
        const start = new Date(formData.startDate);
        const end = new Date(formData.endDate);
        // Calcul durée inclusive (min 1 jour)
        const durationDays = Math.max(1, differenceInDays(end, start) + 1);

        const newEvents = formData.resourceIds.map(resId => ({
            id: uid(),
            title: formData.title,
            resourceId: resId,
            date: formData.startDate, // IMPORTANT: On garde la String 'YYYY-MM-DD'
            duration: durationDays,
            type: formData.type,
            meta: {
                start: `${formData.startDate}T${formData.startTime}`,
                end: `${formData.endDate}T${formData.endTime}`,
                projectId: formData.projectId,
                status: 'planned' // Défaut
            }
        }));

        setLocalEvents(prev => [...prev, ...newEvents]);

        // SAUVEGARDE DB (Création Multiple)
        if (onUpdateEvent) {
            newEvents.forEach(evt => onUpdateEvent(evt));
        }
    };

    const handleValidateEvent = (event) => {
        const updatedEvent = {
            ...event,
            meta: {
                ...event.meta,
                status: 'validated',
                validatedBy: currentUser?.name || 'Inconnu',
                validatedAt: new Date().toISOString()
            }
        };

        setLocalEvents(prev => prev.map(e => e.id === event.id ? updatedEvent : e));
        if (onUpdateEvent) onUpdateEvent(updatedEvent);
    };

    const handleDeleteEvent = (event) => {
        setLocalEvents(prev => prev.filter(e => e.id !== event.id));
        if (onDeleteEvent) onDeleteEvent(event.id);
    };

    // --- MOTEUR TEMPOREL (Inchangé) ---
    const columns = useMemo(() => {
        if (view === 'day') return [currentDate];
        if (view === 'week') return Array.from({ length: 7 }).map((_, i) => addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i));
        if (view === 'month') return eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
        if (view === 'quarter') return eachDayOfInterval({ start: startOfQuarter(currentDate), end: endOfQuarter(currentDate) });
        if (view === 'year') return eachMonthOfInterval({ start: startOfYear(currentDate), end: endOfYear(currentDate) });
        if (view === 'custom' && customRange) return eachDayOfInterval(customRange);
        return [currentDate];
    }, [view, currentDate, customRange]);

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

    const navPrev = () => { if (view === 'month') setCurrentDate(d => subMonths(d, 1)); else if (view === 'quarter') setCurrentDate(d => subQuarters(d, 1)); else if (view === 'year') setCurrentDate(d => subYears(d, 1)); else setCurrentDate(d => addDays(d, -7)); };
    const navNext = () => { if (view === 'month') setCurrentDate(d => addMonths(d, 1)); else if (view === 'quarter') setCurrentDate(d => addQuarters(d, 1)); else if (view === 'year') setCurrentDate(d => addYears(d, 1)); else setCurrentDate(d => addDays(d, 7)); };
    const getCellContent = (col) => { if (view === 'year') return format(col, 'MMM', { locale: fr }); if (view === 'quarter' || view === 'month') return format(col, 'd'); return format(col, 'EE d', { locale: fr }); };
    const MIN_WIDTH = view === 'year' ? 80 : (view === 'quarter' || view === 'month' ? 40 : 120);

    const renderEventsForCell = (memberId, dayDate) => {
        if (!localEvents) return null;
        // On parse la date de l'event (String) pour la comparer proprement à la colonne (Date)
        const dayEvents = localEvents.filter(e =>
            e.resourceId === memberId &&
            isSameDay(parseISO(e.date), dayDate)
        );

        return dayEvents.map(evt => {
            const style = PLANNING_COLORS[evt.type] || PLANNING_COLORS.default;
            const eventStart = new Date(evt.meta?.start || evt.date);
            const eventEnd = new Date(evt.meta?.end || evt.date);

            // Calcul Position & Largeur (Uniquement pour vues détaillées)
            let leftPercent = 0;
            let widthPercent = 100;
            let labelTime = "";

            if (view === 'week' || view === 'day') {
                const startMinutes = getHours(eventStart) * 60 + getMinutes(eventStart);
                const offsetMinutes = Math.max(0, startMinutes - (WORK_START_HOUR * 60));
                const duration = Math.min(TOTAL_WORK_MINUTES, differenceInMinutes(eventEnd, eventStart));

                leftPercent = (offsetMinutes / TOTAL_WORK_MINUTES) * 100;
                widthPercent = (duration / TOTAL_WORK_MINUTES) * 100;

                // Sécurité bornes
                if (leftPercent < 0) leftPercent = 0;
                if ((leftPercent + widthPercent) > 100) widthPercent = 100 - leftPercent;

                labelTime = `${format(eventStart, 'HH:mm')} - ${format(eventEnd, 'HH:mm')}`;
            }

            const isValidated = evt.meta?.status === 'validated';
            const opacity = isValidated ? 1 : 0.75;
            const borderStyle = isValidated ? 'solid' : 'dashed';

            return (
                <div key={evt.id} draggable
                    onMouseEnter={() => setHoveredEventId(evt.id)}
                    onMouseLeave={() => setHoveredEventId(null)}
                    onDragStart={(e) => handleDragStart(e, evt)}
                    onClick={(e) => { e.stopPropagation(); setEditingEvent(evt); setIsModalOpen(true); }}
                    title={`${evt.title} (${labelTime})`}
                    style={{
                        position: 'absolute', top: 4, bottom: 4,
                        left: `${leftPercent}%`, width: `${widthPercent}%`,
                        backgroundColor: style.bg,
                        borderLeft: `4px ${borderStyle} ${style.border}`,
                        borderTop: isValidated ? `1px solid ${style.border}` : 'none', // Cadre complet si validé
                        borderRight: isValidated ? `1px solid ${style.border}` : 'none',
                        borderBottom: isValidated ? `1px solid ${style.border}` : 'none',
                        color: style.text, borderRadius: 6, padding: '2px 4px',
                        fontSize: 10, fontWeight: 600, zIndex: 10, opacity,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        cursor: 'grab', display: 'flex', flexDirection: 'column', justifyContent: 'center',
                        minWidth: 25, transition: 'all 0.2s'
                    }}
                >
                    <div style={{ fontSize: 9, opacity: 0.9, display: 'flex', justifyContent: 'space-between' }}>
                        {labelTime}
                        {isValidated && <CheckCircle size={10} color={style.text} />}
                    </div>
                    <div>{evt.title}</div>

                    {/* HOVER DELETE ICON */}
                    {!isValidated && onDeleteEvent && hoveredEventId === evt.id && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm('Supprimer ce créneau ?')) handleDeleteEvent(evt);
                            }}
                            style={{
                                position: 'absolute', top: 2, right: 2,
                                background: 'rgba(255,255,255,0.9)', borderRadius: 4,
                                width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: '#ef4444', boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }}
                            title="Supprimer"
                        >
                            <X size={12} strokeWidth={3} />
                        </div>
                    )}
                </div>
            );
        });
    };

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#FAF5EE' }}>
            <TopBar
                view={view}
                onViewChange={(v) => { setView(v); if (v === 'custom') setCustomRange(null); }}
                currentDate={currentDate}
                onPrev={navPrev}
                onNext={navNext}
                onToday={() => setCurrentDate(new Date())}
                customRange={customRange}
                onCustomRangeChange={(r) => { setCustomRange(r); setView('custom'); }}
                onNew={() => { setEditingEvent(null); setIsModalOpen(true); }}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                activeFilters={activeFilters}
                onAddFilter={(f) => setActiveFilters([...activeFilters, f])}
                onRemoveFilter={(f) => setActiveFilters(activeFilters.filter(x => x !== f))}
                assistantMode={assistantMode}
                onToggleAssistant={() => setAssistantMode(!assistantMode)}
            />

            {/* MODALE AVANCÉE */}
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
            />

            {assistantMode ? (
                <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
                    <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                                <tr>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Projet</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Deadline</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Budget (h)</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Planifié (h)</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Progression</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>État</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.map(proj => (
                                    <tr key={proj.id} style={{ borderBottom: '1px solid #F3F4F6', background: proj.status === 'late' ? '#FEF2F2' : 'white' }}>
                                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>
                                            {proj.name}
                                            <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 400 }}>{proj.manager || "Non assigné"}</div>
                                        </td>
                                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>
                                            {proj.deadline ? format(new Date(proj.deadline), 'dd MMM yyyy', { locale: fr }) : '-'}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{proj.totalSold}h</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', color: proj.totalPlanned > proj.totalSold ? '#EF4444' : '#111827' }}>
                                            {proj.totalPlanned}h
                                        </td>
                                        <td style={{ padding: '12px 16px', width: 120 }}>
                                            <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                                                <div style={{ width: `${Math.min(proj.progress, 100)}%`, height: '100%', background: proj.progress > 100 ? '#EF4444' : '#10B981', transition: 'width 0.3s' }} />
                                            </div>
                                            <div style={{ textAlign: 'center', fontSize: 11, color: '#6B7280', marginTop: 4 }}>{Math.round(proj.progress)}%</div>
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                            {proj.status === 'late' && <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>EN RETARD</span>}
                                            {proj.status === 'warning' && <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>SURCHARGE</span>}
                                            {proj.status === 'ok' && <span style={{ background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>OK</span>}
                                        </td>
                                    </tr>
                                ))}
                                {stats.length === 0 && (
                                    <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>Aucun projet actif.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div style={{ flex: 1, overflow: 'hidden', padding: '0 24px 24px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ height: 'fit-content', maxHeight: '100%', overflow: 'auto', background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, position: 'relative' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: `260px repeat(${columns.length}, minmax(${MIN_WIDTH}px, 1fr))`, gridAutoRows: 'max-content', width: 'max-content', minWidth: '100%' }}>
                            <StickyCorner style={{ height: HEADER_HEIGHT_1, borderBottom: 'none' }} />
                            {superHeaders.map((header, i) => (<div key={i} style={{ gridColumn: `span ${header.span}`, position: 'sticky', top: 0, zIndex: 40, background: 'white', borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 }}>{header.label}</div>))}
                            <StickyCorner style={{ top: HEADER_HEIGHT_1, height: HEADER_HEIGHT_2 }}>Ressources</StickyCorner>
                            {columns.map(col => (<StickyTopCell key={col.toString()} style={{ top: HEADER_HEIGHT_1, height: HEADER_HEIGHT_2, background: isSameDay(col, new Date()) && view !== 'year' ? '#EFF6FF' : 'white', color: isSameDay(col, new Date()) && view !== 'year' ? '#2563EB' : '#4B5563' }}>{getCellContent(col)}</StickyTopCell>))}

                            {Object.entries(filteredGroups).map(([key, group]) => (
                                <React.Fragment key={key}>
                                    <StickyLeftCell onClick={() => setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }))} bg={group.bg} style={{ fontWeight: 800, color: '#111827' }}>{expandedGroups[key] ? <ChevronDown size={14} style={{ marginRight: 8 }} /> : <ChevronRightIcon size={14} style={{ marginRight: 8 }} />}{group.label}</StickyLeftCell>
                                    <div style={{ gridColumn: `span ${columns.length}`, background: group.bg, borderBottom: '1px solid #E5E7EB', height: ROW_HEIGHT }} />
                                    {expandedGroups[key] && group.members.map(member => (
                                        <React.Fragment key={member}>
                                            <StickyLeftCell style={{ paddingLeft: 42, color: '#4B5563', fontWeight: 500 }}>{member}</StickyLeftCell>
                                            {columns.map(col => (
                                                <div
                                                    key={`${member}-${col}`}
                                                    onClick={() => handleCellClick(member, col)}
                                                    onDragOver={handleDragOver}
                                                    onDrop={(e) => handleDrop(e, member, col)}
                                                    style={{ borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #F3F4F6', background: (view !== 'year' && isSameDay(col, new Date())) ? '#F9FAFB' : 'transparent', height: ROW_HEIGHT, position: 'relative' }}
                                                >
                                                    {renderEventsForCell(member, col)}
                                                </div>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}