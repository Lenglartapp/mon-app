import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Search, ChevronDown, Check, User, Briefcase, Calendar as CalendarIcon, X } from 'lucide-react';
import { S } from '../../lib/constants/ui';

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

const PlanningTopBar = ({
    view, onViewChange, currentDate, onPrev, onNext, onToday,
    customRange, onCustomRangeChange, onNew, onManageTeam,
    searchQuery, setSearchQuery, activeFilters, onAddFilter, onRemoveFilter,
    assistantMode, onToggleAssistant, showWeekends, onToggleWeekends,
    myViewMode, onToggleMyView
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
