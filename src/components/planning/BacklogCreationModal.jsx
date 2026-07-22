import React, { useState, useEffect, useMemo } from 'react';
import { differenceInMinutes, parseISO, isSameWeek } from 'date-fns';
import { X, Briefcase, Calculator } from 'lucide-react';
import { INTERNAL_PROJECT_NAME, isInternalProject, findInternalProject, getActiveChapters, normalizeChapter } from '../../lib/planning/internalProject';

const S = {
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    },
    modal: {
        backgroundColor: 'white', borderRadius: 12, padding: 24, width: 500, maxWidth: '90%',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
    },
    header: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20
    },
    title: { fontSize: 18, fontWeight: 700, color: '#111827' },
    closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' },
    section: { marginBottom: 16 },
    label: { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 },
    input: {
        width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 14,
        outline: 'none', transition: 'border-color 0.2s'
    },
    statsBox: {
        backgroundColor: '#F3F4F6', borderRadius: 8, padding: 12, marginTop: 8, fontSize: 13, color: '#4B5563',
        border: '1px solid #E5E7EB'
    },
    statRow: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 },
    statValue: { fontWeight: 600, color: '#111827' },
    footer: { display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
    btnParams: {
        padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500
    },
    btnCancel: { backgroundColor: '#F3F4F6', color: '#374151' },
    btnSubmit: { backgroundColor: '#BE123C', color: 'white' } // Pink/Red for Backlog
};

const BacklogCreationModal = ({ isOpen, onClose, onSave, onDelete, projects, events, currentWeekStart, eventToEdit }) => {
    // FORM STATE
    const [search, setSearch] = useState('');
    const [selectedProject, setSelectedProject] = useState(null);
    const [hours, setHours] = useState('');
    const [customLabel, setCustomLabel] = useState('');
    const [comment, setComment] = useState('');

    // UI STATE
    const [showSuggestions, setShowSuggestions] = useState(false);

    // RESET ON OPEN
    // RESET OR POPULATE ON OPEN
    useEffect(() => {
        if (isOpen) {
            if (eventToEdit) {
                // EDIT MODE
                const proj = projects.find(p => p.id === eventToEdit.meta?.projectId);
                setSelectedProject(proj || { name: eventToEdit.title, id: eventToEdit.meta?.projectId });
                setSearch(proj ? proj.name : eventToEdit.title);
                setHours(eventToEdit.meta?.budgetHours || '');
                setCustomLabel(eventToEdit.title);
                setComment(eventToEdit.meta?.description || '');
            } else {
                // CREATE MODE
                setSearch('');
                setSelectedProject(null);
                setHours('');
                setCustomLabel('');
                setComment('');
            }
            setShowSuggestions(false);
        }
    }, [isOpen, eventToEdit, projects]);

    // FILTER PROJECTS
    const filteredProjects = useMemo(() => {
        if (!search) return [];
        return projects.filter(p =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            (p.code && p.code.toLowerCase().includes(search.toLowerCase()))
        ).slice(0, 5); // Limit to 5
    }, [projects, search]);

    // CALCULATE STATS
    const projectStats = useMemo(() => {
        if (!selectedProject) return null;

        const budgetSold = selectedProject.budget?.conf || 0;

        // CONFECTION UNIQUEMENT : on ignore pose, prépa, absences et les buckets backlog.
        // (Ce programme semaine concerne l'atelier confection.)
        const confEvents = events.filter(e =>
            e.meta?.projectId === selectedProject.id &&
            e.type === 'conf' &&
            e.resourceId !== 'backlog_confection'
        );

        // Heures réelles d'un créneau : durationHours exclut déjà la pause déjeuner ;
        // en repli, on déduit l'heure de pause de la durée brute.
        const eventHours = (e) => {
            if (e.meta?.durationHours != null) return e.meta.durationHours;
            const start = new Date(e.meta?.start || e.date);
            const end = new Date(e.meta?.end || e.date);
            let mins = differenceInMinutes(end, start);
            const lunchStart = new Date(start); lunchStart.setHours(12, 0, 0, 0);
            const lunchEnd = new Date(start); lunchEnd.setHours(13, 0, 0, 0);
            if (start < lunchStart && end > lunchEnd) mins -= 60;
            return Math.max(0, mins) / 60;
        };

        // Planifié = à faire (pending) ; Consommé = réalisé (validé), figé.
        let plannedHours = 0;
        let consumedHours = 0;
        confEvents.forEach(e => {
            const h = eventHours(e);
            if (e.meta?.status === 'validated') consumedHours += h;
            else plannedHours += h;
        });

        return {
            sold: budgetSold,
            planned: plannedHours,
            consumed: consumedHours,
            remaining: budgetSold - plannedHours - consumedHours
        };
    }, [selectedProject, events]);

    // Affiche les heures avec au plus 1 décimale (7,8 reste 7,8 ; 78 reste 78)
    const fmtH = (n) => {
        const r = Math.round(n * 10) / 10;
        return `${r}`.replace('.', ',');
    };

    // Dossier interne : le libellé devient le CHAPITRE, et il est obligatoire — c'est lui
    // qui porte le suivi des heures hors dossier (cf. lib/planning/internalProject).
    const internalProject = findInternalProject(projects);
    const showInternalOption = !filteredProjects.some(isInternalProject);
    const isInternalSelected = isInternalProject(selectedProject);
    const chapterSuggestions = getActiveChapters(internalProject)
        .filter(c => !customLabel || c.name.toLowerCase().includes(customLabel.toLowerCase()))
        .slice(0, 8);

    const selectInternal = () => {
        // Créé à l'enregistrement s'il n'existe pas encore.
        setSelectedProject(internalProject || { id: null, name: INTERNAL_PROJECT_NAME, config: { isInternal: true } });
        setSearch(INTERNAL_PROJECT_NAME);
        setShowSuggestions(false);
        setCustomLabel('');
    };

    const canSubmit = !!selectedProject && !!hours && (!isInternalSelected || !!normalizeChapter(customLabel));

    const handleSubmit = () => {
        if (!canSubmit) return;

        onSave({
            id: eventToEdit?.id, // Pass ID if editing
            projectId: selectedProject.id,
            title: isInternalSelected ? normalizeChapter(customLabel) : (customLabel || selectedProject.name),
            internalChapter: isInternalSelected ? normalizeChapter(customLabel) : null,
            isInternal: isInternalSelected,
            hours: parseFloat(hours),
            comment: comment
        });
        onClose();
    };

    const handleDelete = () => {
        if (onDelete && eventToEdit) {
            if (window.confirm("Supprimer ce créneau Backlog ?")) {
                onDelete(eventToEdit.id);
                onClose();
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div style={S.overlay} onClick={onClose}>
            <div style={S.modal} onClick={e => e.stopPropagation()}>
                <div style={S.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Briefcase size={20} color="#BE123C" />
                        <span style={S.title}>{eventToEdit ? 'Modifier le programme' : 'Ajouter au programme semaine'}</span>
                    </div>
                    <button style={S.closeBtn} onClick={onClose}><X size={20} /></button>
                </div>

                {/* 1. PROJECT SELECTION */}
                <div style={S.section}>
                    <label style={S.label}>Dossier / Projet</label>
                    <div style={{ position: 'relative' }}>
                        <input
                            style={S.input}
                            placeholder="Rechercher un dossier..."
                            value={selectedProject ? selectedProject.name : search}
                            onChange={e => {
                                setSearch(e.target.value);
                                setSelectedProject(null); // Clear selection on edit
                                setShowSuggestions(true);
                            }}
                            onFocus={() => setShowSuggestions(true)}
                        />
                        {/* Le repli « interne » doit rester atteignable même quand la recherche ne donne rien */}
                        {showSuggestions && (filteredProjects.length > 0 || showInternalOption) && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0,
                                backgroundColor: 'white', border: '1px solid #E5E7EB',
                                borderRadius: 6, zIndex: 50, maxHeight: 200, overflowY: 'auto',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                            }}>
                                {filteredProjects.map(p => (
                                    <div
                                        key={p.id}
                                        onClick={() => {
                                            setSelectedProject(p);
                                            setSearch(p.name);
                                            setShowSuggestions(false);
                                            setCustomLabel(p.name); // Default label
                                        }}
                                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #F3F4F6' }}
                                        onMouseEnter={e => e.target.style.backgroundColor = '#F9FAFB'}
                                        onMouseLeave={e => e.target.style.backgroundColor = 'white'}
                                    >
                                        <div style={{ fontWeight: 500, fontSize: 14 }}>{p.name}</div>
                                        <div style={{ fontSize: 12, color: '#6B7280' }}>{p.code}</div>
                                    </div>
                                ))}
                                {showInternalOption && (
                                    <div
                                        onClick={selectInternal}
                                        style={{ padding: '8px 12px', cursor: 'pointer', borderTop: '1px solid #E5E7EB', background: '#FEFCE8' }}
                                    >
                                        <div style={{ fontWeight: 600, color: '#111827' }}>{INTERNAL_PROJECT_NAME}</div>
                                        <div style={{ fontSize: 12, color: '#6B7280' }}>Prototype, étude… — temps hors dossier</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* STATS BUDGET */}
                    {selectedProject && projectStats && (
                        <div style={S.statsBox}>
                            <div style={S.statRow}>
                                <span>Budget Vendu (Confection) :</span>
                                <span style={S.statValue}>{fmtH(projectStats.sold)}h</span>
                            </div>
                            <div style={S.statRow}>
                                <span>Déjà Planifié (à faire) :</span>
                                <span style={{ ...S.statValue, color: '#EA580C' }}>{fmtH(projectStats.planned)}h</span>
                            </div>
                            <div style={S.statRow}>
                                <span>Déjà Consommé (réalisé) :</span>
                                <span style={{ ...S.statValue, color: '#6B7280' }}>{fmtH(projectStats.consumed)}h</span>
                            </div>
                            <div style={{ ...S.statRow, marginTop: 8, paddingTop: 8, borderTop: '1px dashed #D1D5DB' }}>
                                <span>Reste à Planifier :</span>
                                <span style={{ ...S.statValue, color: projectStats.remaining < 0 ? '#EF4444' : '#10B981' }}>
                                    {fmtH(projectStats.remaining)}h
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. HOURS */}
                <div style={S.section}>
                    <label style={S.label}>Volume d'Heures pour cette semaine</label>
                    <input
                        type="number"
                        style={S.input}
                        placeholder="Ex: 40"
                        value={hours}
                        onChange={e => setHours(e.target.value)}
                        autoFocus
                    />
                </div>

                {/* 3. OPTIONAL FIELDS */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={S.section}>
                        <label style={S.label}>{isInternalSelected ? 'Chapitre' : 'Libellé (Optionnel)'}</label>
                        <input
                            style={S.input}
                            placeholder={isInternalSelected ? 'Ex: prototype bambou, Fab Lab' : 'Ex: RDC, Finitions...'}
                            value={customLabel}
                            onChange={e => setCustomLabel(e.target.value)}
                            list={isInternalSelected ? 'chapitres-internes' : undefined}
                        />
                        {isInternalSelected && (
                            <datalist id="chapitres-internes">
                                {chapterSuggestions.map(c => <option key={c.name} value={c.name} />)}
                            </datalist>
                        )}
                    </div>
                </div>

                <div style={S.section}>
                    <label style={S.label}>Commentaire pour l'équipe (Optionnel)</label>
                    <textarea
                        style={{ ...S.input, minHeight: 60, resize: 'vertical' }}
                        placeholder="Instructions particulières..."
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                    />
                </div>

                {/* FOOTER */}
                <div style={{ ...S.footer, justifyContent: 'space-between' }}>
                    <div>
                        {eventToEdit && (
                            <button
                                style={{ ...S.btnParams, backgroundColor: '#FEF2F2', color: '#EF4444', border: '1px solid #FECACA' }}
                                onClick={handleDelete}
                            >
                                Supprimer
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button style={{ ...S.btnParams, ...S.btnCancel }} onClick={onClose}>Annuler</button>
                        <button
                            style={{ ...S.btnParams, ...S.btnSubmit, opacity: canSubmit ? 1 : 0.5 }}
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            title={!canSubmit && isInternalSelected ? 'Renseignez le chapitre' : undefined}
                        >
                            {eventToEdit ? 'Mettre à jour' : 'Ajouter au programme'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BacklogCreationModal;
