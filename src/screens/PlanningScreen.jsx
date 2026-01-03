import React, { useState, useMemo } from 'react';
import { S, COLORS } from '../lib/constants/ui';
import { useAuth } from '../auth';
import {
    ChevronLeft, ChevronRight, Search, ChevronDown, ChevronRight as ChevronRightIcon
} from 'lucide-react';
import {
    format, startOfWeek, addDays, addWeeks, subWeeks,
    isSameDay, startOfMonth, endOfMonth, eachDayOfInterval,
    startOfQuarter, endOfQuarter, startOfYear, endOfYear, eachMonthOfInterval,
    addMonths, subMonths, addQuarters, subQuarters, addYears, subYears, startOfDay
} from 'date-fns';
import { fr } from 'date-fns/locale';

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
const ROW_HEIGHT = 60;
const HEADER_HEIGHT_1 = 36;
const HEADER_HEIGHT_2 = 40;

// --- COMPOSANTS UI HELPERS ---

const StickyLeftCell = ({ children, bg = 'white', borderBottom = true, onClick, style }) => (
    <div
        onClick={onClick}
        style={{
            position: 'sticky', left: 0, zIndex: 50,
            background: bg,
            borderRight: '2px solid #E5E7EB',
            borderBottom: borderBottom ? '1px solid #E5E7EB' : 'none',
            display: 'flex', alignItems: 'center', padding: '0 16px',
            fontSize: 13, fontWeight: 600, color: '#374151',
            cursor: onClick ? 'pointer' : 'default',
            height: ROW_HEIGHT,
            minWidth: 260, maxWidth: 260, // Largeur fixe vitale pour le sticky
            ...style
        }}
    >
        {children}
    </div>
);

const StickyTopCell = ({ children, bg = 'white', style }) => (
    <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: bg,
        borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 600, color: '#4B5563',
        ...style
    }}>
        {children}
    </div>
);

const StickyCorner = ({ children, style }) => (
    <div style={{
        position: 'sticky', left: 0, top: 0, zIndex: 60,
        background: 'white',
        borderRight: '2px solid #E5E7EB', borderBottom: '1px solid #E5E7EB',
        display: 'flex', alignItems: 'center', paddingLeft: 16,
        fontWeight: 700, fontSize: 13, color: '#111827',
        minWidth: 260, maxWidth: 260,
        ...style
    }}>
        {children}
    </div>
);

// --- COMPOSANTS NAV ---
const ViewSelector = ({ view, onViewChange, customRange, onCustomRangeChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [tempStart, setTempStart] = useState('');
    const [tempEnd, setTempEnd] = useState('');

    const handleApply = () => {
        if (tempStart && tempEnd) {
            onCustomRangeChange({ start: new Date(tempStart), end: new Date(tempEnd) });
            setIsOpen(false);
        }
    };
    const options = [
        { id: 'day', label: 'Jour' }, { id: 'week', label: 'Semaine' },
        { id: 'month', label: 'Mois' }, { id: 'quarter', label: 'Trimestre' },
        { id: 'year', label: 'Année' },
    ];

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
                            {options.map(opt => (
                                <div key={opt.id} onClick={() => { onViewChange(opt.id); setIsOpen(false); }} style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 4, background: view === opt.id ? '#EFF6FF' : 'transparent', color: view === opt.id ? '#2563EB' : '#374151', fontWeight: view === opt.id ? 600 : 400 }}>{opt.label}</div>
                            ))}
                        </div>
                        <div style={{ padding: 12 }}>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                <input type="date" style={{ ...S.input, padding: 4, fontSize: 12 }} onChange={e => setTempStart(e.target.value)} />
                                <input type="date" style={{ ...S.input, padding: 4, fontSize: 12 }} onChange={e => setTempEnd(e.target.value)} />
                            </div>
                            <button onClick={handleApply} style={{ width: '100%', background: '#1F2937', color: 'white', border: 'none', padding: '6px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>Appliquer</button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

const TopBar = ({ view, onViewChange, currentDate, onPrev, onNext, onToday, customRange, onCustomRangeChange, onNew }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#FAF5EE' }}>
        <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={onNew} style={{ background: '#111827', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Nouveau</button>
            <button style={{ background: '#111827', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Publier</button>
        </div>
        <div style={{ flex: 1, maxWidth: 400, margin: '0 24px' }}>
            <div style={{ background: '#1F2937', borderRadius: 6, display: 'flex', alignItems: 'center', padding: '8px 12px', border: '1px solid #374151' }}>
                <Search size={16} color="#9CA3AF" />
                <input placeholder="Rechercher..." style={{ background: 'transparent', border: 'none', color: 'white', marginLeft: 10, flex: 1, outline: 'none', fontSize: 14 }} />
            </div>
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

export default function PlanningScreen({ projects, events, onUpdateEvent, onBack }) {
    const { users } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState('week');
    const [customRange, setCustomRange] = useState(null);
    const [expandedGroups, setExpandedGroups] = useState({ pose: true, conf: true, prepa: true });

    // 1. Calcul des Colonnes
    const columns = useMemo(() => {
        if (view === 'day') return [currentDate];
        if (view === 'week') return Array.from({ length: 7 }).map((_, i) => addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i));
        if (view === 'month') return eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
        if (view === 'quarter') return eachDayOfInterval({ start: startOfQuarter(currentDate), end: endOfQuarter(currentDate) });
        if (view === 'year') return eachMonthOfInterval({ start: startOfYear(currentDate), end: endOfYear(currentDate) });
        if (view === 'custom' && customRange) return eachDayOfInterval(customRange);
        return [currentDate];
    }, [view, currentDate, customRange]);

    // 2. Calcul des Super Headers
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
            else {
                if (currentLabel) headers.push({ label: currentLabel, span: spanCount });
                currentLabel = label;
                spanCount = 1;
            }
            if (index === columns.length - 1) headers.push({ label: currentLabel, span: spanCount });
        });
        return headers;
    }, [columns, view]);

    // 3. Navigation
    const navPrev = () => {
        if (view === 'month') setCurrentDate(d => subMonths(d, 1));
        else if (view === 'quarter') setCurrentDate(d => subQuarters(d, 1));
        else if (view === 'year') setCurrentDate(d => subYears(d, 1));
        else setCurrentDate(d => addDays(d, -7));
    };
    const navNext = () => {
        if (view === 'month') setCurrentDate(d => addMonths(d, 1));
        else if (view === 'quarter') setCurrentDate(d => addQuarters(d, 1));
        else if (view === 'year') setCurrentDate(d => addYears(d, 1));
        else setCurrentDate(d => addDays(d, 7));
    };

    const getCellContent = (col) => {
        if (view === 'year') return format(col, 'MMM', { locale: fr });
        if (view === 'quarter' || view === 'month') return format(col, 'd');
        return format(col, 'EE d', { locale: fr });
    };

    const MIN_WIDTH = view === 'year' ? 80 : (view === 'quarter' || view === 'month' ? 40 : 120);

    const renderEventsForCell = (memberId, dayDate) => {
        if (!events) return null;
        const dayEvents = events.filter(e => e.resourceId === memberId && isSameDay(new Date(e.date), dayDate));
        return dayEvents.map(evt => {
            const style = PLANNING_COLORS[evt.type] || PLANNING_COLORS.default;
            return (
                <div key={evt.id} draggable
                    style={{
                        position: 'absolute', top: 4, left: 4, height: 'calc(100% - 8px)',
                        width: `calc(${evt.duration || 1}00% - 8px)`,
                        backgroundColor: style.bg, borderLeft: `3px solid ${style.border}`,
                        color: style.text, borderRadius: 4, padding: '2px 4px',
                        fontSize: 11, fontWeight: 700, zIndex: 10,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)', cursor: 'grab',
                        display: 'flex', alignItems: 'center'
                    }}
                >
                    {evt.title || "Projet"}
                </div>
            );
        });
    };

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#FAF5EE' }}>

            <TopBar view={view} onViewChange={(v) => { setView(v); if (v === 'custom') setCustomRange(null); }} currentDate={currentDate} onPrev={navPrev} onNext={navNext} onToday={() => setCurrentDate(new Date())} customRange={customRange} onCustomRangeChange={(r) => { setCustomRange(r); setView('custom'); }} onNew={() => alert("Nouveau")} />

            <div style={{ flex: 1, overflow: 'hidden', padding: '0 24px 24px', display: 'flex', flexDirection: 'column' }}>

                {/* FIX FINAL : 
                   - height: 'fit-content' -> Le conteneur s'arrête à la fin du tableau (donc fond beige dessous)
                   - maxHeight: '100%' -> Si le tableau est trop grand, on scrolle dans ce cadre (et pas la page)
                   - overflow: 'auto' -> Active les barres de défilement (H et V) sur CE cadre
                */}
                <div style={{
                    height: 'fit-content',
                    maxHeight: '100%',
                    overflow: 'auto',
                    background: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: 12,
                    position: 'relative'
                }}>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: `260px repeat(${columns.length}, minmax(${MIN_WIDTH}px, 1fr))`,
                        gridAutoRows: 'max-content',
                        width: 'max-content', // IMPORTANT : Force le contenu à pousser pour le scroll horizontal
                        minWidth: '100%' // Assure que ça prend au moins la largeur écran
                    }}>

                        {/* --- HEADER NIVEAU 1 --- */}
                        <StickyCorner style={{ height: HEADER_HEIGHT_1, borderBottom: 'none' }} />

                        {superHeaders.map((header, i) => (
                            <div key={i} style={{
                                gridColumn: `span ${header.span}`,
                                position: 'sticky', top: 0, zIndex: 40,
                                background: 'white', borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1
                            }}>
                                {header.label}
                            </div>
                        ))}

                        {/* --- HEADER NIVEAU 2 --- */}
                        <StickyCorner style={{ top: HEADER_HEIGHT_1, height: HEADER_HEIGHT_2 }}>
                            Ressources
                        </StickyCorner>

                        {columns.map(col => (
                            <StickyTopCell key={col.toString()} style={{ top: HEADER_HEIGHT_1, height: HEADER_HEIGHT_2, background: isSameDay(col, new Date()) && view !== 'year' ? '#EFF6FF' : 'white', color: isSameDay(col, new Date()) && view !== 'year' ? '#2563EB' : '#4B5563' }}>
                                {getCellContent(col)}
                            </StickyTopCell>
                        ))}

                        {/* --- CORPS --- */}
                        {Object.entries(GROUPS_CONFIG).map(([key, group]) => (
                            <React.Fragment key={key}>
                                {/* TITRE GROUPE */}
                                <StickyLeftCell
                                    onClick={() => setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }))}
                                    bg={group.bg}
                                    style={{ fontWeight: 800, color: '#111827' }}
                                >
                                    {expandedGroups[key] ? <ChevronDown size={14} style={{ marginRight: 8 }} /> : <ChevronRightIcon size={14} style={{ marginRight: 8 }} />}
                                    {group.label}
                                </StickyLeftCell>
                                <div style={{ gridColumn: `span ${columns.length}`, background: group.bg, borderBottom: '1px solid #E5E7EB', height: ROW_HEIGHT }} />

                                {/* MEMBRES */}
                                {expandedGroups[key] && group.members.map(member => (
                                    <React.Fragment key={member}>
                                        <StickyLeftCell style={{ paddingLeft: 42, color: '#4B5563', fontWeight: 500 }}>
                                            {member}
                                        </StickyLeftCell>

                                        {columns.map(col => (
                                            <div key={`${member}-${col}`} style={{
                                                borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #F3F4F6',
                                                background: (view !== 'year' && isSameDay(col, new Date())) ? '#F9FAFB' : 'transparent',
                                                height: ROW_HEIGHT, position: 'relative'
                                            }}>
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
        </div>
    );
}