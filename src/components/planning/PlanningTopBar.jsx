import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Check, User, Briefcase, Calendar as CalendarIcon, Download, Upload } from 'lucide-react';
import { S } from '../../lib/constants/ui';
import { SmartFilterBar } from '../ui/SmartFilterBar';

const PLANNING_SEARCH_FIELDS = [
    { id: 'project', label: 'Dossier' },
    { id: 'person',  label: 'Personne' },
    { id: 'service', label: 'Service' },
];

const ViewSelector = ({ view, onViewChange, customRange, onCustomRangeChange, showWeekends, onToggleWeekends }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [tempStart, setTempStart] = useState('');
    const [tempEnd, setTempEnd] = useState('');
    const handleApply = () => { if (tempStart && tempEnd) { onCustomRangeChange({ start: new Date(tempStart), end: new Date(tempEnd) }); setIsOpen(false); } };
    const options = [{ id: 'day', label: 'Jour' }, { id: 'week', label: 'Semaine' }, { id: 'twoweeks', label: '2 Semaines' }, { id: 'month', label: 'Mois' }, { id: 'quarter', label: 'Trimestre' }, { id: 'year', label: 'Année' }];
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

const PlanningTopBar = ({
    view, onViewChange, currentDate, onPrev, onNext, onToday,
    customRange, onCustomRangeChange, onNew, onManageTeam,
    activeFilters, onAddFilter, onRemoveFilter,
    assistantMode, onSetAssistantMode, showWeekends, onToggleWeekends,
    myViewMode, onToggleMyView,
    onDownloadTemplate, onImport
}) => {
    const fileInputRef = useRef(null);
    const [showAssistantMenu, setShowAssistantMenu] = useState(false);
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file && onImport) onImport(file);
        e.target.value = '';
    };
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#FAF5EE' }}>
            <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={onNew} style={{ background: '#111827', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Nouveau</button>
                <button onClick={onManageTeam} style={{ background: 'white', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 6, padding: '8px 16px', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <User size={16} /> Gérer l'équipe
                </button>
                {onDownloadTemplate && (
                    <button onClick={onDownloadTemplate} title="Télécharger le template Excel pour la période affichée" style={{ background: 'white', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 6, padding: '8px 16px', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Download size={16} /> Modèle Excel
                    </button>
                )}
                {onImport && (
                    <>
                        <input ref={fileInputRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleFileChange} />
                        <button onClick={() => fileInputRef.current?.click()} title="Importer un fichier de déclaration de temps" style={{ background: 'white', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 6, padding: '8px 16px', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Upload size={16} /> Importer
                        </button>
                    </>
                )}
                {/* Vue Assistant dropdown */}
                <div style={{ position: 'relative' }}>
                    {assistantMode ? (
                        /* En mode assistant : tabs + bouton retour */
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button onClick={() => onSetAssistantMode('programmation')} style={{
                                padding: '8px 14px', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                                background: assistantMode === 'programmation' ? '#111827' : '#F3F4F6',
                                color:      assistantMode === 'programmation' ? 'white'   : '#6B7280',
                            }}>Programmation</button>
                            <button onClick={() => onSetAssistantMode('capacite')} style={{
                                padding: '8px 14px', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                                background: assistantMode === 'capacite' ? '#111827' : '#F3F4F6',
                                color:      assistantMode === 'capacite' ? 'white'   : '#6B7280',
                            }}>Capacité</button>
                            <button onClick={() => onSetAssistantMode(null)} style={{
                                padding: '8px 12px', borderRadius: 6, border: '1px solid #E5E7EB', background: 'white', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                                <CalendarIcon size={14} /> Calendrier
                            </button>
                        </div>
                    ) : (
                        /* Bouton Vue Assistant avec dropdown */
                        <>
                            <button
                                onClick={() => setShowAssistantMenu(v => !v)}
                                style={{ background: 'white', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 6, padding: '8px 14px', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                            >
                                <Briefcase size={16} /> Vue Assistant <ChevronDown size={13} />
                            </button>
                            {showAssistantMenu && (
                                <>
                                    <div onClick={() => setShowAssistantMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                                    <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 100, background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 170, overflow: 'hidden' }}>
                                        {[['programmation', 'Programmation'], ['capacite', 'Capacité']].map(([mode, label]) => (
                                            <button key={mode} onClick={() => { onSetAssistantMode(mode); setShowAssistantMenu(false); }} style={{
                                                display: 'block', width: '100%', padding: '11px 16px', textAlign: 'left', border: 'none', background: 'white', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div style={{ flex: 1, maxWidth: 600, margin: '0 24px' }}>
                <SmartFilterBar
                    fields={PLANNING_SEARCH_FIELDS}
                    activeFilters={activeFilters}
                    onAddFilter={onAddFilter}
                    onRemoveFilter={onRemoveFilter}
                    placeholder="Projets, ressources, services..."
                />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', background: '#fff', borderRadius: 6, border: '1px solid #E5E7EB', padding: 2 }}>
                    <button onClick={onPrev} style={{ border: 'none', background: 'transparent', padding: '6px 8px', cursor: 'pointer' }}><ChevronLeft size={16} /></button>
                    <button onClick={onNext} style={{ border: 'none', background: 'transparent', padding: '6px 8px', cursor: 'pointer' }}><ChevronRight size={16} /></button>
                </div>

                <button
                    onClick={onToggleMyView}
                    title="Ma Vue (Agenda Personnel)"
                    style={{
                        background: myViewMode ? '#2563EB' : 'white',
                        color: myViewMode ? 'white' : '#374151',
                        border: '1px solid #E5E7EB',
                        borderRadius: 6,
                        padding: '8px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontWeight: 600,
                        fontSize: 13
                    }}
                >
                    <User size={16} /> Ma Vue
                </button>

                <ViewSelector view={view} onViewChange={onViewChange} customRange={customRange} onCustomRangeChange={onCustomRangeChange} showWeekends={showWeekends} onToggleWeekends={onToggleWeekends} />
                <button onClick={onToday} style={{ background: 'transparent', color: '#111827', border: 'none', padding: '0 8px', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>Aujourd'hui</button>
            </div>
        </div>
    );
};

export default PlanningTopBar;
