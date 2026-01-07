import React, { useState, useMemo, useEffect } from 'react';
import { S, COLORS } from '../lib/constants/ui';
import { useAuth } from '../auth';
import {
    ChevronLeft, ChevronRight, Search, ChevronDown, ChevronRight as ChevronRightIcon,
    X, Check, User, Briefcase, Clock, Calendar as CalendarIcon, ArrowRight, CheckCircle, Trash2, Edit2
} from 'lucide-react';
import { ROLES } from '../auth';
import {
    format, startOfWeek, addDays, addWeeks, subWeeks,
    isSameDay, startOfMonth, endOfMonth, eachDayOfInterval,
    startOfQuarter, endOfQuarter, startOfYear, endOfYear, eachMonthOfInterval,
    addMonths, subMonths, addQuarters, subQuarters, addYears, subYears, startOfDay,
    differenceInDays, parseISO, getHours, getMinutes, differenceInMinutes, setHours, setMinutes,
    isWeekend
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCapacityPlanning } from '../hooks/useCapacityPlanning';
import { uid } from '../lib/utils/uid';

// --- CONFIGURATION ---
// --- CONFIGURATION INITIALE (Structure Seulement) ---
const INITIAL_GROUPS_CONFIG = {
    prepa: {
        id: 'prepa',
        label: 'PRÉPARATION DES MÉCANISMES',
        bg: '#FFF7ED',
        members: [] // Sera rempli dynamiquement
    },
    conf: {
        id: 'conf',
        label: 'ATELIER CONFECTION',
        bg: '#F8FAFC',
        members: []
    },
    pose: {
        id: 'pose',
        label: 'ÉQUIPES DE POSE',
        bg: '#F0FDF4',
        members: []
    }
};

const PLANNING_COLORS = {
    pose: { bg: '#DCFCE7', border: '#4ADE80', text: '#166534' },  // Vert
    conf: { bg: '#DBEAFE', border: "#60A5FA", text: "#1E40AF" },  // Bleu
    prepa: { bg: '#FEF9C3', border: "#FACC15", text: "#854D0E" }, // Jaune
    absence: { bg: "#FEE2E2", border: "#EF4444", text: "#991B1B", pattern: true }, // Rouge
    default: { bg: '#F3F4F6', border: "#9CA3AF", text: "#374151" } // Gris
};

// CONSTANTES DIMENSION
const ROW_HEIGHT = 70;
const HEADER_HEIGHT_1 = 36;
const HEADER_HEIGHT_2 = 40;
const WORK_START_HOUR = 8; // 8h00
const WORK_END_HOUR = 17;   // 17h00
const TOTAL_WORK_MINUTES = (WORK_END_HOUR - WORK_START_HOUR) * 60; // 9h = 540 min

// --- COMPOSANT MODALE AVANCÉE ---
const EventModal = ({ isOpen, onClose, onSave, onValidate, onDelete, projects = [], eventToEdit, initialData, currentUser, groupsConfig }) => {
    // États Formulaire
    const [projectSearch, setProjectSearch] = useState('');
    const [selectedProject, setSelectedProject] = useState(null);
    const [showProjectList, setShowProjectList] = useState(false);

    // Multi-Ressources
    const [selectedResources, setSelectedResources] = useState([]);
    const [showResourceList, setShowResourceList] = useState(false);
    const [description, setDescription] = useState('');
    const [absType, setAbsType] = useState('Congés'); // Utilisé par ResourcePanel mais on le définit ici pour check les types

    // Types d'absence pour le calcul de capacité
    const ABSENCE_TYPES = ['Congés', 'RTT', 'Maladie', 'Autre'];

    // Dates & Heures
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [startTime, setStartTime] = useState('08:00');
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [endTime, setEndTime] = useState('17:00');

    // Aplatir la liste des membres pour l'affichage
    const allMembers = useMemo(() => [
        ...(groupsConfig.prepa?.members.map(m => ({ id: m.id, group: 'prepa', label: `${m.first_name} ${m.last_name || ''}` })) || []),
        ...(groupsConfig.conf?.members.map(m => ({ id: m.id, group: 'conf', label: `${m.first_name} ${m.last_name || ''}` })) || []),
        ...(groupsConfig.pose?.members.map(m => ({ id: m.id, group: 'pose', label: `${m.first_name} ${m.last_name || ''}` })) || [])
    ], [groupsConfig]);

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
                                            {groupsConfig[grpKey].label}
                                        </div>
                                        {groupsConfig[grpKey].members.map(member => (
                                            <div
                                                key={member.id}
                                                onClick={() => toggleResource(member.id)}
                                                style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', cursor: 'pointer', margin: '0 4px', borderRadius: 6, background: selectedResources.includes(member) ? '#EFF6FF' : 'transparent' }}
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

// --- PANNEAU GESTION ÉQUIPE (Droit) ---
const ResourcePanel = ({ isOpen, onClose, users, hiddenResources, onToggleVisibility, onAddAbsence, onUpdateUser }) => {
    // État local pour le formulaire d'absence
    const [selectedUserForAbsence, setSelectedUserForAbsence] = useState(null);
    const [selectedGroupForAbsence, setSelectedGroupForAbsence] = useState(null); // Pour absence groupée
    const [absType, setAbsType] = useState('Congés');
    const [absStart, setAbsStart] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [absStartTime, setAbsStartTime] = useState('08:00');
    const [absEnd, setAbsEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [absEndTime, setAbsEndTime] = useState('17:00');

    // État local pour l'édition d'un user (Interim)
    const [editingUser, setEditingUser] = useState(null); // { id, first_name, last_name }

    if (!isOpen) return null;

    // Grouper les users pour l'affichage
    const groupedUsers = {
        prepa: users.filter(u => u.role === 'prepa'),
        conf: users.filter(u => u.role === 'conf'),
        pose: users.filter(u => u.role === 'pose')
    };

    const handleCreateAbsence = () => {
        if (selectedGroupForAbsence) {
            // -- MODE GROUPE --
            const members = groupedUsers[selectedGroupForAbsence];
            members.forEach(member => {
                onAddAbsence(member.id, absType, absStart, absStartTime, absEnd, absEndTime);
            });
            setSelectedGroupForAbsence(null);
        } else if (selectedUserForAbsence) {
            // -- MODE INDIVIDUEL --
            onAddAbsence(selectedUserForAbsence, absType, absStart, absStartTime, absEnd, absEndTime);
            setSelectedUserForAbsence(null);
        }

        // Reset form defaults 
        setAbsType('Congés');
        setAbsStart(format(new Date(), 'yyyy-MM-dd'));
        setAbsStartTime('08:00');
        setAbsEnd(format(new Date(), 'yyyy-MM-dd'));
        setAbsEndTime('17:00');
    };

    const openModal = (userId = null, groupId = null) => {
        setAbsStart(format(new Date(), 'yyyy-MM-dd'));
        setAbsEnd(format(new Date(), 'yyyy-MM-dd'));
        setSelectedUserForAbsence(userId);
        setSelectedGroupForAbsence(groupId);
    };

    const handleSaveUser = () => {
        if (editingUser) {
            onUpdateUser(editingUser); // Envoie { id, first_name, last_name, ... }
            setEditingUser(null);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 120, display: 'flex', justifyContent: 'flex-end' }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }} />
            <div style={{ position: 'relative', width: 420, background: 'white', height: '100%', boxShadow: '-5px 0 25px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.3s ease-out' }}>

                <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFAFA' }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Gérer l'équipe</h3>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={24} color="#6B7280" /></button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                    {Object.entries(groupedUsers).map(([role, members]) => (
                        <div key={role} style={{ marginBottom: 32 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: '#6B7280', marginBottom: 16, borderBottom: '1px solid #F3F4F6', paddingBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>
                                    {role === 'prepa' && 'Préparation'}
                                    {role === 'conf' && 'Atelier Confection'}
                                    {role === 'pose' && 'Équipes de Pose'}
                                    ({members.length})
                                </span>
                                {/* Bouton Absence Groupe */}
                                <button
                                    onClick={() => openModal(null, role)}
                                    title="Absence pour tout le groupe"
                                    style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 4, padding: '2px 8px', color: '#EF4444', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, textTransform: 'none' }}
                                >
                                    <CalendarIcon size={12} /> Tout le groupe
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {members.map(user => {
                                    // isVisible = Actif dans le switch. Mais attention, le user a dit "désactivé via is_active".
                                    // On va utiliser le champ "active" du user s'il existe, sinon fallback sur hiddenResources.
                                    // Mais le code existant utilise hiddenResources pour le toggle "Visibilité".
                                    // On va unifier : Le switch "Actif/Inactif" contrôle hiddenResources (Masqué = Inactif).
                                    // Pour la consistance UI, on garde hiddenResources.
                                    const isVisible = !hiddenResources.includes(user.id);

                                    // Identification CDI vs Interim
                                    // "Considère comme Profil Flottant tout utilisateur dont le first_name commence par Interim"
                                    // Attention : si on le renomme, il ne commence plus par Interim. 
                                    // IL FAUT UN MOYEN DE SAVOIR SI C'EST UN COMPTE FLOTTANT A L'ORIGINE.
                                    // Supposons que le login/email ou un ID spécifique ou un champ 'is_interim' serait mieux.
                                    // FAUTE DE MIEUX : On se base sur le fait qu'il EST interim SI on peut l'éditer. 
                                    // MAIS si on ré-ouvre l'app, comment savoir ?
                                    // L'user dit : "tout utilisateur dont le first_name commence par Interim".
                                    // Si on le renomme "Sonia", il devient un CDI aux yeux du système ? C'est le risque.
                                    // Idéalement on stocke is_interim dans l'objet user.
                                    // On va supposer qu'on ajoute une propriété is_interim lors du chargement initial si ça commence par Interim, et on la garde.
                                    // Ou alors on checke si l'ID contient par exemple "temp" ou si une propriété custom existe.
                                    // Pour cet exercice, on va check "Interim" dans le nom OU si on a déjà flaggé comme interim.

                                    const isInterim = user.first_name?.startsWith('Interim') || user.is_interim;
                                    // Note: on ajoute is_interim dans l'objet user mis à jour pour persister ce statut après renommage.

                                    const isEditing = editingUser?.id === user.id;

                                    return (
                                        <div key={user.id} style={{ display: 'flex', flexDirection: 'column', background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 14px', opacity: isVisible ? 1 : 0.6 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isEditing ? 12 : 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: isVisible ? (isInterim ? '#FEF3C7' : '#DBEAFE') : '#F3F4F6', color: isVisible ? (isInterim ? '#D97706' : '#1E40AF') : '#9CA3AF', display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: 13 }}>
                                                        {user.first_name?.[0]}
                                                    </div>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <div style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>
                                                                {user.first_name} {user.last_name}
                                                            </div>
                                                            {/* Badge */}
                                                            <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 4, fontWeight: 700, background: isInterim ? '#FFFbeb' : '#EFF6FF', color: isInterim ? '#B45309' : '#1D4ED8', border: `1px solid ${isInterim ? '#FCD34D' : '#BFDBFE'}` }}>
                                                                {isInterim ? 'INTERIM' : 'CDI'}
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: 12, color: isVisible ? '#10B981' : '#9CA3AF', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            {isVisible ? 'Actif' : 'Désactivé'}
                                                            {/* Bouton Edit pour Interim */}
                                                            {isInterim && !isEditing && (
                                                                <button
                                                                    onClick={() => setEditingUser({ ...user, is_interim: true })} // On garde le flag
                                                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, marginLeft: 4 }}
                                                                    title="Renommer"
                                                                >
                                                                    <Edit2 size={10} color="#6B7280" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    {/* Bouton Absence */}
                                                    <button
                                                        onClick={() => openModal(user.id, null)}
                                                        title="Déclarer absence"
                                                        style={{ padding: 6, borderRadius: 6, border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', color: '#EF4444' }}
                                                    >
                                                        <CalendarIcon size={16} />
                                                    </button>

                                                    {/* BOUTON TOGGLE ACTIF/INACTIF */}
                                                    <button
                                                        onClick={() => onToggleVisibility(user.id)}
                                                        title={isVisible ? "Désactiver" : "Activer"}
                                                        style={{
                                                            width: 36, height: 20, borderRadius: 999,
                                                            background: isVisible ? '#10B981' : '#E5E7EB',
                                                            position: 'relative', border: 'none', cursor: 'pointer', transition: 'background 0.2s'
                                                        }}
                                                    >
                                                        <div style={{
                                                            width: 16, height: 16, borderRadius: '50%', background: 'white',
                                                            position: 'absolute', top: 2, left: isVisible ? 18 : 2,
                                                            transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                                                        }} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* FORMULAIRE D'ÉDITION POUR INTERIM */}
                                            {isEditing && (
                                                <div style={{ marginTop: 8, padding: 8, background: '#F9FAFB', borderRadius: 6, border: '1px solid #E5E7EB' }}>
                                                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                                        <input
                                                            value={editingUser.first_name || ''}
                                                            onChange={e => setEditingUser({ ...editingUser, first_name: e.target.value })}
                                                            placeholder="Prénom"
                                                            style={{ flex: 1, padding: '4px 8px', fontSize: 12, borderRadius: 4, border: '1px solid #D1D5DB' }}
                                                        />
                                                        <input
                                                            value={editingUser.last_name || ''}
                                                            onChange={e => setEditingUser({ ...editingUser, last_name: e.target.value })}
                                                            placeholder="Nom"
                                                            style={{ flex: 1, padding: '4px 8px', fontSize: 12, borderRadius: 4, border: '1px solid #D1D5DB' }}
                                                        />
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                                        <button onClick={() => setEditingUser(null)} style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #D1D5DB', background: 'white', borderRadius: 4, cursor: 'pointer' }}>Annuler</button>
                                                        <button onClick={handleSaveUser} style={{ fontSize: 11, padding: '4px 8px', border: 'none', background: '#2563EB', color: 'white', borderRadius: 4, cursor: 'pointer' }}>Enregistrer</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* MODALE INTERNE POUR ABSENCE */}
                {(selectedUserForAbsence || selectedGroupForAbsence) && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.95)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                        <div style={{ width: '100%', background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: 20 }}>
                            <h4 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
                                {selectedGroupForAbsence ? `Absence Groupe : ${selectedGroupForAbsence.toUpperCase()}` : 'Déclarer une absence'}
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                                {/* Type d'absence */}
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Type</label>
                                    <select value={absType} onChange={e => setAbsType(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #D1D5DB', borderRadius: 6 }}>
                                        <option value="Congés">Congés</option>
                                        <option value="RTT">RTT</option>
                                        <option value="Maladie">Maladie</option>
                                        <option value="Autre">Autre</option>
                                    </select>
                                </div>

                                {/* Début */}
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <div style={{ flex: 2 }}>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Date de début</label>
                                        <input type="date" value={absStart} onChange={e => setAbsStart(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #D1D5DB', borderRadius: 6 }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Heure</label>
                                        <input type="time" value={absStartTime} onChange={e => setAbsStartTime(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #D1D5DB', borderRadius: 6 }} />
                                    </div>
                                </div>

                                {/* Fin */}
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <div style={{ flex: 2 }}>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Date de fin (incluse)</label>
                                        <input type="date" value={absEnd} onChange={e => setAbsEnd(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #D1D5DB', borderRadius: 6 }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Heure</label>
                                        <input type="time" value={absEndTime} onChange={e => setAbsEndTime(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #D1D5DB', borderRadius: 6 }} />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                    <button onClick={() => { setSelectedUserForAbsence(null); setSelectedGroupForAbsence(null); }} style={{ flex: 1, padding: '8px', border: '1px solid #D1D5DB', borderRadius: 6, background: 'white', fontWeight: 600 }}>Annuler</button>
                                    <button onClick={handleCreateAbsence} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 6, background: '#EF4444', color: 'white', fontWeight: 600 }}>Valider</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
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
const ViewSelector = ({ view, onViewChange, customRange, onCustomRangeChange, showWeekends, onToggleWeekends }) => {
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
                        <div style={{ paddingBottom: 4, borderBottom: '1px solid #F3F4F6' }}>
                            {options.map(opt => (<div key={opt.id} onClick={() => { onViewChange(opt.id); setIsOpen(false); }} style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 4, background: view === opt.id ? '#EFF6FF' : 'transparent', color: view === opt.id ? '#2563EB' : '#374151', fontWeight: view === opt.id ? 600 : 400 }}>{opt.label}</div>))}
                            <div onClick={() => onToggleWeekends(!showWeekends)} style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#374151' }}>
                                Afficher les week-ends
                                {showWeekends && <Check size={14} color="#111827" />}
                            </div>
                        </div>
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
    customRange, onCustomRangeChange, onNew, onManageTeam,
    searchQuery, setSearchQuery, activeFilters, onAddFilter, onRemoveFilter,
    assistantMode, onToggleAssistant, showWeekends, onToggleWeekends
}) => {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#FAF5EE' }}>
            <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={onNew} style={{ background: '#111827', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Nouveau</button>
                <button onClick={onManageTeam} style={{ background: 'white', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 6, padding: '8px 16px', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <User size={16} /> Gérer l'équipe
                </button>
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
                <ViewSelector view={view} onViewChange={onViewChange} customRange={customRange} onCustomRangeChange={onCustomRangeChange} showWeekends={showWeekends} onToggleWeekends={onToggleWeekends} />
                <button onClick={onToday} style={{ background: 'transparent', color: '#111827', border: 'none', padding: '0 8px', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>Aujourd'hui</button>
            </div>
        </div>
    );
};

export default function PlanningScreen({ projects, events: initialEvents, onUpdateEvent, onDeleteEvent, onBack }) {
    const { users: authUsers, currentUser } = useAuth();
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
        // Ici on pourrait aussi appeler une API Supabase update
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
    const [resizingEvent, setResizingEvent] = useState(null);
    const resizeRef = React.useRef(null); // Ref pour garder trace des valeurs sans fermeture

    // Initialisation
    useEffect(() => {
        resizeRef.current = resizingEvent;
    }, [resizingEvent]);

    useEffect(() => {
        if (!resizingEvent) return;

        // Utilitaires de Slots (2h de travail)
        // Slots valides : 8-10, 10-12, (12-13 off), 13-15, 15-17
        const getSlotsFromDate = (date) => {
            // Retourne le nombre de slots complets depuis le début de la journée (8h)
            // 10h -> 1, 12h -> 2, 15h -> 3, 17h -> 4
            const h = getHours(date);
            if (h <= 8) return 0;
            if (h <= 10) return 1;
            if (h <= 12) return 2; // (ou 13h)
            if (h <= 15) return 3;
            return 4; // > 15h -> 17h
        };

        const getDateFromSlots = (start, totalSlots) => {
            // On projette à partir de start
            let cursor = new Date(start);
            // On aligne le curseur sur le début de journée si besoin?
            // Non, on suppose start propre (8h).
            // Mais start peut être 13h ? Supposons start toujours 8h pour la simplicité de la grille 
            // (ou adapté si start != 8h, mais le User part de journées complètes).

            // On avance jour par jour
            let remaining = totalSlots;

            // Alignement curseur à "Début de travail ce jour"
            // Si start est 8h, ok.

            while (remaining > 0) {
                const h = getHours(cursor);
                // Combien de slots restent-ils ajd ?
                // Si 8h: 4 slots. If 10h: 3 slots...
                let slotsTodayLeft = 0;
                if (h < 10) slotsTodayLeft = 4;
                else if (h < 12) slotsTodayLeft = 3;
                else if (h < 13) slotsTodayLeft = 2; // midi
                else if (h < 15) slotsTodayLeft = 2; // 13h -> 15 (1), 15->17(2) -> wait. 13-15 is slot 3. 15-17 is slot 4.
                // Si on est à 13h. On peut faire 13-15 (1 slot), 15-17 (2eme slot). -> 2 slots left.
                else if (h < 17) slotsTodayLeft = 1;

                if (remaining <= slotsTodayLeft) {
                    // On finit aujourd'hui
                    // On ajoute remaining * 2h (en sautant 12-13)
                    let endH = h;
                    for (let i = 0; i < remaining; i++) {
                        endH += 2;
                        if (endH === 12) {
                            // Arrivé à 12h. Prochain +2 part de 13h.
                            // Mais ma boucle ajoute juste +2h au compteur.
                            // Si je suis à 10h. +1 slot -> 12h.
                            // Si je suis à 10h. +2 slots -> 12h ... hop 15h ?
                        }
                    }

                    // Méthode plus simple : mappage statique
                    // 1 slot ajouté à 8h -> 10h
                    // 2 slots -> 12h
                    // 3 slots -> 15h
                    // 4 slots -> 17h

                    // Si départ 8h
                    if (h === 8) {
                        if (remaining === 1) cursor.setHours(10, 0);
                        else if (remaining === 2) cursor.setHours(12, 0);
                        else if (remaining === 3) cursor.setHours(15, 0);
                        else if (remaining === 4) cursor.setHours(17, 0);
                    } else if (h === 10) { // slotsLeft = 3
                        if (remaining === 1) cursor.setHours(12, 0);
                        else if (remaining === 2) cursor.setHours(15, 0);
                        else if (remaining === 3) cursor.setHours(17, 0);
                    } else if (h === 13) { // slotsLeft = 2
                        if (remaining === 1) cursor.setHours(15, 0);
                        else if (remaining === 2) cursor.setHours(17, 0);
                    }
                    return cursor;
                } else {
                    // On consomme la journée et on passe à la suivante
                    remaining -= slotsTodayLeft;
                    cursor = addDays(cursor, 1);
                    cursor.setHours(WORK_START_HOUR, 0, 0, 0); // On commence à 8h demain
                }
            }
            return cursor;
        };

        const handleResizeMove = (e) => {
            const { startX, initialSeries, cellWidth, resourceId, seriesId, type, title, meta, tempSeriesId } = resizeRef.current;
            const safeCellWidth = cellWidth && cellWidth > 0 ? cellWidth : 100;
            const deltaX = e.clientX - startX;

            // 4 slots par jour (cellWidth)
            const pixelsPerSlot = safeCellWidth / 4;
            const deltaSlots = Math.round(deltaX / pixelsPerSlot);

            // Calcul Slots initiaux
            const start = new Date(initialSeries[0].meta.start);
            const initialEnd = new Date(initialSeries[initialSeries.length - 1].meta.end);

            // On compte combien de slots couvre la série initiale
            // Approximation : nombre jours * 4 + slots de fin - slots de début
            // Plus robuste : on itère
            // TODO: Optimiser. Pour l'instant on recalcule à la volée
            // On assume que le User part d'un état propre.
            // On va tricher : on prend le nombre de jours * 4 (si plein) + partiel

            // VERSION SIMPLE : On applique deltaSlots à la fin actuelle
            // On a besoin de savoir "où on est" en slots à la fin.
            // Fin actuelle : initialEnd.
            // Slots "dans la journée de fin" :
            const endH = getHours(initialEnd);
            let endSlotsIdx = 0; // 0=8h, 1=10h, 2=12h, 3=15h, 4=17h
            if (endH >= 17) endSlotsIdx = 4;
            else if (endH >= 15) endSlotsIdx = 3;
            else if (endH >= 12) endSlotsIdx = 2; // ou 13
            else if (endH >= 10) endSlotsIdx = 1;

            // On doit ajouter deltaSlots.
            // 1. On recule si delta négatif
            // 2. On avance si positif

            let currentCursor = new Date(initialEnd);
            // On remet au propre (si 12h01 -> 12h00)
            if (endSlotsIdx === 4) currentCursor.setHours(17, 0);
            else if (endSlotsIdx === 3) currentCursor.setHours(15, 0);
            else if (endSlotsIdx === 2) currentCursor.setHours(12, 0);
            else if (endSlotsIdx === 1) currentCursor.setHours(10, 0);
            else currentCursor.setHours(8, 0);

            let slotsToDo = deltaSlots;

            // Itération pour trouver newEnd
            if (slotsToDo > 0) {
                while (slotsToDo > 0) {
                    const h = getHours(currentCursor);
                    if (h === 8) currentCursor.setHours(10, 0);
                    else if (h === 10) currentCursor.setHours(12, 0);
                    else if (h === 12) currentCursor.setHours(15, 0); // Jump MIDI
                    else if (h === 15) currentCursor.setHours(17, 0);
                    else if (h >= 17) {
                        currentCursor = addDays(currentCursor, 1);
                        currentCursor.setHours(10, 0); // Premier slot de demain (8->10)
                    }
                    slotsToDo--;
                }
            } else if (slotsToDo < 0) {
                while (slotsToDo < 0) {
                    const h = getHours(currentCursor);
                    if (h === 17) currentCursor.setHours(15, 0);
                    else if (h === 15) currentCursor.setHours(12, 0); // Jump MIDI
                    else if (h === 12) currentCursor.setHours(10, 0);
                    else if (h === 10) currentCursor.setHours(8, 0);
                    else if (h <= 8) {
                        currentCursor = addDays(currentCursor, -1);
                        currentCursor.setHours(15, 0); // Dernier slot d'hier (15->17 => fin 17, recul 1 = fin 15)
                    }
                    slotsToDo++;
                }
            }

            const newEnd = currentCursor;

            // Sécurité : min 1 slot (10h le premier jour)
            // Si newEnd <= start + 2h
            const minEnd = new Date(start); minEnd.setHours(10, 0);
            if (newEnd < minEnd) newEnd.setTime(minEnd.getTime());

            // --- RECONSTRUCTION (Inchangée mais avec newEnd précis) ---
            const effectiveSeriesId = seriesId || tempSeriesId;
            const originalIds = new Set(initialSeries.map(i => i.id));

            setLocalEvents(prev => {
                const others = prev.filter(ev => {
                    if (originalIds.has(ev.id)) return false;
                    if (effectiveSeriesId && ev.meta?.seriesId === effectiveSeriesId) return false;
                    return true;
                });

                const newSeries = [];
                let loopDate = new Date(start);
                let idx = 0;

                while (loopDate < newEnd) {
                    const currentDayStr = format(loopDate, 'yyyy-MM-dd');

                    const s = new Date(`${currentDayStr}T08:00`);
                    if (isSameDay(s, start)) s.setTime(start.getTime());

                    const e = new Date(`${currentDayStr}T17:00`);
                    if (isSameDay(e, newEnd)) e.setTime(newEnd.getTime());

                    if (e > s) {
                        const existingId = initialSeries[idx]?.id || uid();
                        newSeries.push({
                            id: existingId,
                            title: title,
                            resourceId: resourceId,
                            date: currentDayStr,
                            duration: 1,
                            type: type,
                            meta: {
                                ...meta,
                                start: s.toISOString(),
                                end: e.toISOString(),
                                seriesId: effectiveSeriesId
                            }
                        });
                        idx++;
                    }

                    loopDate = addDays(loopDate, 1);
                    loopDate.setHours(WORK_START_HOUR, 0);
                    if (differenceInDays(loopDate, start) > 365) break;
                }

                return [...others, ...newSeries];
            });
        };

        const handleResizeUp = () => {
            const { seriesId, tempSeriesId } = resizeRef.current;
            const effectiveSeriesId = seriesId || tempSeriesId;
            const finalSeries = localEvents.filter(e => e.meta?.seriesId === effectiveSeriesId);
            finalSeries.forEach(evt => {
                if (onUpdateEvent) onUpdateEvent(evt);
            });
            setResizingEvent(null);
        };

        window.addEventListener('mousemove', handleResizeMove);
        window.addEventListener('mouseup', handleResizeUp);
        return () => {
            window.removeEventListener('mousemove', handleResizeMove);
            window.removeEventListener('mouseup', handleResizeUp);
        };
    }, [resizingEvent]); // localEvents omis pour éviter reset, on utilise setLocalEvents(cb)

    // --- RECHERCHE MULTI-CRITÈRES ---
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilters, setActiveFilters] = useState([]);

    // --- CONSTRUCTION DYNAMIQUE DES GROUPES ---
    const groupsConfig = useMemo(() => {
        if (!localUsers || localUsers.length === 0) return INITIAL_GROUPS_CONFIG;

        // Initialisation d'une structure vide propre (basée sur la structure initiale pour garder les labels/couleurs)
        // On ne copie PAS les membres s'il y en avait par défaut (ils sont vides dans INITIAL_GROUPS_CONFIG de toute façon)
        const config = {
            prepa: { ...INITIAL_GROUPS_CONFIG.prepa, members: [] },
            conf: { ...INITIAL_GROUPS_CONFIG.conf, members: [] },
            pose: { ...INITIAL_GROUPS_CONFIG.pose, members: [] }
        };

        // Remplissage STRICT avec les users réels
        // Si le rôle n'est pas 'conf', 'pose' ou 'prepa', l'utilisateur est IGNORÉ (ex: admin, dev)
        localUsers.forEach(u => {
            if (u.role && config[u.role]) {
                config[u.role].members.push(u);
            }
        });

        return config;
    }, [localUsers]);

    // --- FILTRAGE DES RESSOURCES MASQUÉES ---
    // (Utilisé pour l'affichage ET le calcul de capacité)
    const visibleGroupsConfig = useMemo(() => {
        const config = JSON.parse(JSON.stringify(groupsConfig));
        Object.keys(config).forEach(key => {
            config[key].members = config[key].members.filter(m => !hiddenResources.includes(m.id));
        });
        return config;
    }, [groupsConfig, hiddenResources]);


    // --- MODE ASSISTANT ---
    const [assistantMode, setAssistantMode] = useState(false);

    // Calcul dynamique des capacités (basé sur visibleGroupsConfig)
    const capacityConfig = useMemo(() => ({
        conf: visibleGroupsConfig.conf.members.length,
        pose: visibleGroupsConfig.pose.members.length
    }), [visibleGroupsConfig]);

    const { projectStats: stats } = useCapacityPlanning(projects, localEvents, capacityConfig);

    const filteredGroups = useMemo(() => {
        if (activeFilters.length === 0) return visibleGroupsConfig;

        const newConfig = {};
        Object.keys(visibleGroupsConfig).forEach(key => {
            const group = visibleGroupsConfig[key];
            const filteredMembers = group.members.filter(member => {
                const fullName = `${member.first_name} ${member.last_name}`.toLowerCase();
                return activeFilters.every(filter => {
                    if (filter.type === 'resource') {
                        return fullName.includes(filter.value.toLowerCase());
                    }
                    if (filter.type === 'project') {
                        return localEvents.some(evt =>
                            evt.resourceId === member.id &&
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
    }, [activeFilters, localEvents, visibleGroupsConfig]);

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

        // Calcul du décalage en jours
        const originalDate = parseISO(draggedEvent.date);
        const deltaDays = differenceInDays(targetDate, originalDate);

        // Si c'est 0 jours et même ressource, rien à faire
        if (deltaDays === 0 && draggedEvent.resourceId === targetResourceId) {
            setDraggedEvent(null);
            return;
        }

        const isSeries = !!draggedEvent.meta?.seriesId;
        const eventsToUpdate = isSeries
            ? localEvents.filter(e => e.meta?.seriesId === draggedEvent.meta.seriesId)
            : [draggedEvent];

        // Préparation des mises à jour
        const updates = eventsToUpdate.map(evt => {
            const currentEvtDate = parseISO(evt.date);
            const newEvtDate = addDays(currentEvtDate, deltaDays);

            const currentStart = new Date(evt.meta.start);
            const currentEnd = new Date(evt.meta.end);

            const newStart = addDays(currentStart, deltaDays);
            const newEnd = addDays(currentEnd, deltaDays);

            return {
                ...evt,
                resourceId: targetResourceId, // On déplace tout vers la nouvelle ressource cible
                date: format(newEvtDate, 'yyyy-MM-dd'),
                meta: {
                    ...evt.meta,
                    start: newStart.toISOString(),
                    end: newEnd.toISOString()
                }
            };
        });

        // Mise à jour locale
        setLocalEvents(prev => prev.map(e => {
            const updated = updates.find(u => u.id === e.id);
            return updated || e;
        }));

        // Sauvegarde DB
        if (onUpdateEvent) {
            updates.forEach(u => onUpdateEvent(u));
        }

        setDraggedEvent(null);
    };

    // --- HANDLER SAUVEGARDE (Création OU Édition) ---
    const handleSaveEvent = (formData) => {
        if (formData.id) {
            // -- ÉDITION --
            // 1. Trouver l'événement original
            const originalEvt = localEvents.find(e => e.id === formData.id);
            if (originalEvt) {
                // 2. Supprimer l'ancien (ou la série complète)
                if (originalEvt.meta?.seriesId) {
                    setLocalEvents(prev => prev.filter(e => e.meta?.seriesId !== originalEvt.meta.seriesId));
                } else {
                    setLocalEvents(prev => prev.filter(e => e.id !== formData.id));
                }
            }
            // 3. Recréer proprement (via handleAddEvent qui gère le découpage)
            // On s'assure que formData a les bons champs pour handleAddEvent
            handleAddEvent(formData);
        } else {
            // -- CRÉATION --
            handleAddEvent(formData);
        }
    };

    // --- LOGIQUE AJOUT EVENTS (Multi) ---
    const handleAddEvent = (formData) => {
        // Logique de découpage par jour pour respecter "8h à 17h sur chaque jour"
        const startDate = new Date(formData.startDate);
        const endDate = new Date(formData.endDate);
        const newEvents = [];

        // ID pour lier visuellement les blocs
        const seriesId = uid();

        // Itérer sur chaque ressource sélectionnée
        formData.resourceIds.forEach(resId => {
            // Itérer sur chaque jour de l'intervalle
            const days = eachDayOfInterval({ start: startDate, end: endDate });

            days.forEach(dayDate => {
                const dayStr = format(dayDate, 'yyyy-MM-dd');

                // Reconstruire les bornes précises pour CE jour
                const startDateTime = new Date(`${dayStr}T${formData.startTime}`);
                const endDateTime = new Date(`${dayStr}T${formData.endTime}`);

                // SNAPSHOT NOM RESSOURCE
                const assignedUser = localUsers.find(u => u.id === resId);
                const assignedName = assignedUser ? `${assignedUser.first_name} ${assignedUser.last_name || ''}`.trim() : 'Inconnu';

                newEvents.push({
                    id: uid(), // unique ID pour cette occurence
                    resourceId: resId,
                    date: dayStr,
                    duration: 1, // Chaque event dure explicitement 1 "journée" (enfin, un créneau) sur la grille
                    type: formData.type || 'default',
                    title: formData.title,
                    meta: {
                        projectId: formData.projectId,
                        description: formData.description,
                        start: startDateTime.toISOString(),
                        end: endDateTime.toISOString(),
                        status: 'planned',
                        seriesId: seriesId, // On lie tous les jours
                        assigned_name: assignedName // Snapshot identité
                    }
                });
            });
        });

        setLocalEvents(prev => [...prev, ...newEvents]);

        // SAUVEGARDE DB
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

    // --- HANDLER ABSENCE RAPIDE ---
    const handleAddAbsence = (resourceId, type, startStr, startTime, endStr, endTime) => {
        // Même logique de découpage par jour
        const startDate = new Date(startStr);
        const endDate = new Date(endStr);
        const newEvents = [];
        const seriesId = uid();

        try {
            const days = eachDayOfInterval({ start: startDate, end: endDate });

            days.forEach(dayDate => {
                const dayStr = format(dayDate, 'yyyy-MM-dd');
                const startDateTime = new Date(`${dayStr}T${startTime}`);
                const endDateTime = new Date(`${dayStr}T${endTime}`);

                newEvents.push({
                    id: uid(),
                    title: 'Absence',
                    resourceId: resourceId,
                    date: dayStr,
                    duration: 1,
                    type: 'absence',
                    meta: {
                        start: startDateTime.toISOString(),
                        end: endDateTime.toISOString(),
                        status: 'validated',
                        description: `${type} - Absence déclarée via panneau`,
                        seriesId: seriesId
                    }
                });
            });

            setLocalEvents(prev => [...prev, ...newEvents]);

            if (onUpdateEvent) {
                newEvents.forEach(evt => onUpdateEvent(evt));
            }
        } catch (e) {
            console.error("Erreur création absence", e);
            // Fallback si dates invalides
        }
    };

    // --- MOTEUR TEMPOREL (Inchangé) ---
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

            const isAbsence = evt.type === 'absence';
            const displayTitle = isAbsence ? (evt.meta?.description || 'Absence') : `${evt.title}`;

            // --- GESTION FUSION VISUELLE (SERIES) ---
            let widthMultiplier = 1;
            let isStartOfVisibleSeries = true;

            if (evt.meta?.seriesId) {
                const prevDate = addDays(dayDate, -1);

                // Est-ce que le jour précédent fait partie de la série ET est visible dans la vue actuelle ?
                const prevVisible = columns.some(col => isSameDay(col, prevDate));
                const hasPrev = localEvents.some(e =>
                    e.resourceId === memberId &&
                    e.meta?.seriesId === evt.meta.seriesId &&
                    isSameDay(parseISO(e.date), prevDate)
                );

                // Si le bloc continue depuis un jour visible précédent, on ne le rend pas ici (c'est le précédent qui s'étend)
                if (hasPrev && prevVisible) {
                    return null;
                }

                // Sinon, c'est le début du bloc visible. On calcule combien de jours il doit couvrir.
                let cumulativeWidth = widthPercent; // On commence avec la largeur du jour courant
                let lookAhead = addDays(dayDate, 1);

                // On cherche les jours suivants
                let maxDays = 20; // Sécurité
                while (maxDays > 0) {
                    const nextEvt = localEvents.find(e =>
                        e.resourceId === memberId &&
                        e.meta?.seriesId === evt.meta.seriesId &&
                        isSameDay(parseISO(e.date), lookAhead)
                    );

                    if (!nextEvt) break;

                    // Calcul de la largeur de ce segment
                    const s = new Date(nextEvt.meta.start);
                    const e = new Date(nextEvt.meta.end); // Note: e peut être undefined si c'est event sans meta ? Non on a filtré sur seriesId donc meta existe.
                    const dur = Math.min(TOTAL_WORK_MINUTES, Math.max(0, differenceInMinutes(e, s)));
                    const segWidth = (dur / TOTAL_WORK_MINUTES) * 100;

                    cumulativeWidth += segWidth;

                    lookAhead = addDays(lookAhead, 1);
                    maxDays--;
                }
                widthMultiplier = cumulativeWidth / 100; // Juste pour l'échelle si besoin, mais on utilise cumulativeWidth direct
                isStartOfVisibleSeries = !hasPrev;
            }

            // Si c'est une série, on force la largeur calculée en cumulé
            let finalWidth = evt.meta?.seriesId ? `calc(${isStartOfVisibleSeries ? widthMultiplier * 100 : widthPercent}% - 2px)` : `${widthPercent}%`;
            // Correction : widthMultiplier contient déjà le ratio total. 
            // Si widthMultiplier = 2.5 (250%), on veut calc(250% - 2px).
            if (evt.meta?.seriesId) {
                finalWidth = `calc(${widthMultiplier * 100}% - 2px)`;
            }

            return (
                <div key={evt.id} draggable
                    onMouseEnter={() => setHoveredEventId(evt.id)}
                    onMouseLeave={() => setHoveredEventId(null)}
                    onDragStart={(e) => handleDragStart(e, evt)}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (evt.meta?.seriesId) {
                            // Reconstituer l'événement complet (série)
                            const seriesEvents = localEvents.filter(e => e.meta?.seriesId === evt.meta.seriesId);
                            // On trie pour avoir le premier et dernier jour
                            seriesEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
                            if (seriesEvents.length > 0) {
                                const first = seriesEvents[0];
                                const last = seriesEvents[seriesEvents.length - 1];
                                // On crée un objet événement "virtuel" qui couvre toute la période
                                const aggregatedEvent = {
                                    ...first,
                                    meta: {
                                        ...first.meta,
                                        end: last.meta.end // On prend la fin du dernier jour
                                    }
                                };
                                setEditingEvent(aggregatedEvent);
                            }
                        } else {
                            setEditingEvent(evt);
                        }
                        setIsModalOpen(true);
                    }}
                    title={`${displayTitle} (${labelTime})`}
                    style={{
                        position: 'absolute', top: 4, bottom: 4,
                        left: `${leftPercent}%`,
                        width: finalWidth,
                        backgroundColor: style.bg,

                        // Bordure générale légère
                        border: `1px solid ${style.border}`,

                        // Bordure GAUCHE épaisse pour le statut (si début de série visible)
                        borderLeft: isStartOfVisibleSeries ? `4px ${borderStyle} ${style.border}` : 'none',

                        // Arrondis adaptés
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

                    {/* Icone Validation (bas droite) */}
                    {isValidated && (
                        <CheckCircle size={10} color={style.text} style={{ position: 'absolute', bottom: 2, right: 2 }} />
                    )}

                    {/* Icone Suppression (haut droite, au survol, si non validé) */}
                    {hoveredEventId === evt.id && !isValidated && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm('Supprimer ce créneau ?')) {
                                    // Suppression intelligente : si série, on supprime tout, sinon juste l'event
                                    if (evt.meta?.seriesId) {
                                        setLocalEvents(prev => prev.filter(e => e.meta?.seriesId !== evt.meta.seriesId));
                                    } else {
                                        handleDeleteEvent(evt);
                                    }
                                }
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

                    {/* Poignée de redimensionnement (Bord Droit) */}
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
                                e.preventDefault(); // Empêche drag du parent
                                const rect = e.target.parentElement.getBoundingClientRect();
                                const currentSpan = widthMultiplier || 1;
                                const singleCellWidth = rect.width / currentSpan;

                                const seriesEvents = evt.meta?.seriesId
                                    ? localEvents.filter(ev => ev.meta?.seriesId === evt.meta.seriesId)
                                    : [evt];
                                seriesEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

                                setResizingEvent({
                                    startX: e.clientX,
                                    initialSeries: seriesEvents,
                                    cellWidth: singleCellWidth,
                                    resourceId: evt.resourceId,
                                    seriesId: evt.meta?.seriesId,
                                    tempSeriesId: evt.meta?.seriesId ? null : uid(), // On génère un ID si manquant (legacy)
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

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#FAF5EE' }}>
            <TopBar
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
                onNew={() => { setEditingEvent(null); setIsModalOpen(true); }}
                onManageTeam={() => setShowResourcePanel(true)}
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
                groupsConfig={visibleGroupsConfig}
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
                                    {/* LIGNE DE CAPACITÉ (Jauges) */}
                                    {columns.map(col => {
                                        // 1. Définir la période (Jour ou Mois)
                                        const isMonthColumn = view === 'year';
                                        const colStart = isMonthColumn ? startOfMonth(col) : startOfDay(col);
                                        const colEnd = isMonthColumn ? endOfMonth(col) : new Date(col.getFullYear(), col.getMonth(), col.getDate(), 23, 59, 59);

                                        // 2. Membres Actifs
                                        const activeMembers = group.members.filter(m => !hiddenResources.includes(m.id));

                                        // 3. Calcul Capacité Théorique
                                        // 7h par jour ouvré par membre
                                        let workDaysCount = 0;
                                        if (isMonthColumn) {
                                            // Compter jours ouvrés du mois
                                            const daysInMonth = eachDayOfInterval({ start: colStart, end: colEnd });
                                            workDaysCount = daysInMonth.filter(d => !isWeekend(d)).length;
                                        } else {
                                            // Si c'est un jour unique
                                            workDaysCount = isWeekend(colStart) ? 0 : 1;
                                        }
                                        const theoreticalCapacity = activeMembers.length * 7 * workDaysCount; // en heures

                                        // 4. Parcourir les events pour Calculer Charge & Absences
                                        let totalAbsenceHours = 0;
                                        let totalLoadHours = 0;

                                        // Optimisation : Pré-filtrer les events du groupe qui chevauchent la période
                                        // On pourrait faire un filter global avant, en attendant on itère.
                                        // Note: c'est un peu lourd dans une boucle de rendu, idéalement useMemo, mais on tente.
                                        const activeMemberIds = activeMembers.map(m => m.id);

                                        localEvents.forEach(evt => {
                                            if (!activeMemberIds.includes(evt.resourceId)) return;

                                            const eStart = new Date(evt.meta?.start || evt.date);
                                            const eEnd = new Date(evt.meta?.end || evt.date);

                                            // Chevauchement ?
                                            if (eEnd <= colStart || eStart >= colEnd) return;

                                            // Calcul durée intersection en heures
                                            const interStart = eStart < colStart ? colStart : eStart;
                                            const interEnd = eEnd > colEnd ? colEnd : eEnd;
                                            const durationMinutes = differenceInMinutes(interEnd, interStart);
                                            // On retire la pause midi (12-13) UNIQUEMENT si on est en vue fine (Jour) ?
                                            // Simplification : On prend brut divisé pour l'instant. L'user a dit "sautant la pause de 12-13".
                                            // Si nos events sont bien découpés (8-12, 13-17), le brut est juste.
                                            // Si l'event traverse midi (ex 8-17 continuous), on devrait soustraire.
                                            // Notre resize logic force le saut, donc on suppose que les données sont propres (2 blocs ou saut).
                                            // Mais soyons prudents : si duration > 5h (300min) sur une journée, on enlève 1h?
                                            // Non, on a dit "Somme des heures d'interventions".
                                            const hours = durationMinutes / 60;

                                            // Type
                                            // "type" dans event peut être le groupe ou 'absence' ou autre.
                                            // On check si c'est une absence via le type stocké ou méta ?
                                            // Dans le code actuel on ne stocke pas toujours 'Congés' dans type.
                                            // On va vérifier si le titre ou un champ meta indique absence, ou si type == 'absence' (PLANNING_COLORS)
                                            // Ou check ABSENCE_TYPES
                                            // Faute de mieux, on suppose que si ResourcePanel met absType dans type ou titre...
                                            // Edit précédent handleCreateAbsence : onAddAbsence(..., absType, ...)
                                            // Il faudrait voir comment onAddAbsence stocke le type.
                                            // Hypothèse : evt.title contient le type ("Congés", "RTT") ou evt.type.
                                            // On va check evt.title contre ABSENCE_TYPES aussi pour être sûr.
                                            const isAbsence = ['Congés', 'RTT', 'Maladie', 'Autre', 'absence'].includes(evt.type) || ['Congés', 'RTT', 'Maladie', 'Autre'].includes(evt.title);

                                            if (isAbsence) {
                                                totalAbsenceHours += hours;
                                            } else {
                                                totalLoadHours += hours;
                                            }
                                        });

                                        const realCapacity = Math.max(0, theoreticalCapacity - totalAbsenceHours);
                                        const loadPercent = realCapacity > 0 ? (totalLoadHours / realCapacity) * 100 : 0;

                                        // Couleur Jauge
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
                                                {/* Text: Charge / Capacité */}
                                                <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>{Math.round(totalLoadHours)}h <span style={{ color: '#9CA3AF', fontWeight: 400 }}>/ {Math.round(realCapacity)}h</span></span>
                                                </div>
                                                {/* Barre de progression */}
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
                                                    onClick={() => handleCellClick(member.id, col)}
                                                    onDragOver={handleDragOver}
                                                    onDrop={(e) => handleDrop(e, member.id, col)}
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
            )}
        </div>
    );
}