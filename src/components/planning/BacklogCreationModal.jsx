import React, { useState, useEffect, useMemo } from 'react';
import { startOfWeek, addWeeks, addDays, getISOWeek, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { X, Briefcase } from 'lucide-react';
import { INTERNAL_PROJECT_NAME, isInternalProject, findInternalProject, getActiveChapters, normalizeChapter } from '../../lib/planning/internalProject';
import { computeProjectHours } from '../../lib/projectMetrics';
import RichTextArea from '../ui/RichTextArea';

// Semaines proposées dans le sélecteur : de 4 semaines avant à 1 an après la semaine de
// référence, pour pouvoir déporter loin. Chaque option affiche le n° ISO ET les dates
// (lun → ven) car on ne connaît pas toujours les dates d'un numéro de semaine par cœur.
const WEEKS_BACK = 4;
const WEEKS_FORWARD = 52;
const WEEK_OPTIONS = (refMonday) => {
    const base = startOfWeek(refMonday, { weekStartsOn: 1 });
    return Array.from({ length: WEEKS_BACK + 1 + WEEKS_FORWARD }, (_, i) => {
        const monday = addWeeks(base, i - WEEKS_BACK);
        const friday = addDays(monday, 4);
        const key = format(monday, 'yyyy-MM-dd');
        // Année ajoutée quand on sort de l'année en cours, pour lever l'ambiguïté sur un an.
        const sameYear = monday.getFullYear() === base.getFullYear();
        const dateFmt = sameYear ? 'd MMM' : 'd MMM yyyy';
        const label = `S${getISOWeek(monday)} · ${format(monday, dateFmt, { locale: fr })} → ${format(friday, dateFmt, { locale: fr })}`;
        return { key, label };
    });
};

const S = {
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    },
    modal: {
        backgroundColor: 'white', borderRadius: 12, padding: 24, width: 620, maxWidth: '92%',
        maxHeight: '90vh', overflowY: 'auto',
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
    // Semaine du bloc (lundi, format yyyy-MM-dd) — modifiable pour décaler le programme.
    const [weekStart, setWeekStart] = useState('');

    // UI STATE
    const [showSuggestions, setShowSuggestions] = useState(false);

    // RESET ON OPEN
    // RESET OR POPULATE ON OPEN
    useEffect(() => {
        if (isOpen) {
            const refDate = eventToEdit?.meta?.start ? new Date(eventToEdit.meta.start) : (currentWeekStart || new Date());
            setWeekStart(format(startOfWeek(refDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'));

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
    }, [isOpen, eventToEdit, projects, currentWeekStart]);

    // Fenêtre de semaines centrée sur la semaine du bloc édité (sinon sur la semaine
    // affichée). On garantit que la semaine actuellement choisie figure toujours dans la
    // liste, même si on édite un bloc très éloigné.
    const weekOptions = useMemo(() => {
        const ref = eventToEdit?.meta?.start ? new Date(eventToEdit.meta.start) : (currentWeekStart || new Date());
        const opts = WEEK_OPTIONS(ref);
        if (weekStart && !opts.some(o => o.key === weekStart)) {
            const monday = new Date(weekStart);
            const friday = addDays(monday, 4);
            opts.unshift({ key: weekStart, label: `S${getISOWeek(monday)} · ${format(monday, 'd MMM', { locale: fr })} → ${format(friday, 'd MMM', { locale: fr })}` });
        }
        return opts;
    }, [eventToEdit, currentWeekStart, weekStart]);

    // FILTER PROJECTS
    const filteredProjects = useMemo(() => {
        if (!search) return [];
        return projects.filter(p =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            (p.code && p.code.toLowerCase().includes(search.toLowerCase()))
        ).slice(0, 5); // Limit to 5
    }, [projects, search]);

    // CALCULATE STATS — source unique (computeProjectHours), confection uniquement.
    //  • Planifié  = ce qui est posé au Programme semaine, cumulé (planned.conf).
    //  • Consommé  = créneaux confection validés (consumed.conf) — inchangé.
    //  • Reste à planifier = budget vendu − planifié (peut passer en négatif → rouge).
    const projectStats = useMemo(() => {
        if (!selectedProject) return null;

        const hours = computeProjectHours(selectedProject, events);
        const sold = hours.budget.conf;
        const planned = hours.planned.conf;
        const consumed = hours.consumed.conf;

        return {
            sold,
            planned,
            consumed,
            remaining: sold - planned,
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
            comment: comment,
            weekStart, // lundi de la semaine choisie (yyyy-MM-dd) → décale le bloc
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
                                <span style={{ ...S.statValue, color: projectStats.consumed > projectStats.sold ? '#EF4444' : '#6B7280' }}>{fmtH(projectStats.consumed)}h</span>
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

                {/* 2. SEMAINE + VOLUME */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={S.section}>
                        <label style={S.label}>Semaine</label>
                        <select
                            style={{ ...S.input, cursor: 'pointer' }}
                            value={weekStart}
                            onChange={e => setWeekStart(e.target.value)}
                        >
                            {weekOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                        </select>
                    </div>
                    <div style={S.section}>
                        <label style={S.label}>Volume d'heures (semaine)</label>
                        <input
                            type="number"
                            style={S.input}
                            placeholder="Ex: 40"
                            value={hours}
                            onChange={e => setHours(e.target.value)}
                        />
                    </div>
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
                    <RichTextArea
                        value={comment}
                        onChange={setComment}
                        placeholder="Instructions particulières… (gras, italique, souligné, barré)"
                        minHeight={120}
                        textareaStyle={{ ...S.input, fontFamily: 'inherit' }}
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
