import React, { useState, useRef, useLayoutEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Check, User, Download, Upload, FileSpreadsheet, History, CheckCircle2 } from 'lucide-react';
import { DA_INPUT_STYLE } from '../../lib/constants/daStyles';
import { SmartFilterBar } from '../ui/SmartFilterBar';

const PLANNING_SEARCH_FIELDS = [
    { id: 'project', label: 'Dossier' },
    { id: 'person',  label: 'Personne' },
    { id: 'service', label: 'Service' },
];

// Boutons de la barre : même gabarit que ceux du Chiffrage (Importer Excel, Recalibrer…).
const BTN = {
    display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 14px', borderRadius: 8,
    background: 'white', border: '1px solid #E0DED9', color: '#374151', fontSize: 13, fontWeight: 600,
    fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', boxSizing: 'border-box',
};
const NAVY = '#1E2447';
const btn = (on = false) => (on ? { ...BTN, background: NAVY, borderColor: NAVY, color: 'white' } : BTN);

const ViewSelector = ({ view, onViewChange, customRange, onCustomRangeChange, showWeekends, onToggleWeekends }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [tempStart, setTempStart] = useState('');
    const [tempEnd, setTempEnd] = useState('');
    const handleApply = () => { if (tempStart && tempEnd) { onCustomRangeChange({ start: new Date(tempStart), end: new Date(tempEnd) }); setIsOpen(false); } };
    const options = [{ id: 'day', label: 'Jour' }, { id: 'week', label: 'Semaine' }, { id: 'twoweeks', label: '2 Semaines' }, { id: 'month', label: 'Mois' }, { id: 'quarter', label: 'Trimestre' }, { id: 'year', label: 'Année' }];
    return (
        <div style={{ position: 'relative' }}>
            <button onClick={() => setIsOpen(!isOpen)} style={BTN}>
                {view === 'custom' ? 'Période' : options.find(o => o.id === view)?.label || 'Vue'} <ChevronDown size={14} color="#6B7280" />
            </button>
            {isOpen && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 80 }} onClick={() => setIsOpen(false)} />
                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, width: 280, background: 'white', borderRadius: 8, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #E0DED9', zIndex: 90, padding: 4 }}>
                        <div style={{ paddingBottom: 4, borderBottom: '1px solid #F3F4F6' }}>
                            {options.map(opt => (<div key={opt.id} onClick={() => { onViewChange(opt.id); setIsOpen(false); }} style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: view === opt.id ? '#EEF4FD' : 'transparent', color: '#111827', fontWeight: view === opt.id ? 600 : 400 }}>{opt.label}{view === opt.id && <Check size={14} color={NAVY} />}</div>))}
                            <div onClick={() => onToggleWeekends(!showWeekends)} style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#111827' }}>
                                Afficher les week-ends
                                {showWeekends && <Check size={14} color={NAVY} />}
                            </div>
                        </div>
                        {/* Période libre : mêmes champs que le reste de l'appli (Roboto, 34 px, coins 8 px) */}
                        <div style={{ padding: '10px 8px 8px' }}>
                            <div style={{ fontSize: 13, color: '#6B7280', margin: '0 4px 8px' }}>Période personnalisée</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                                <label style={{ display: 'block', fontSize: 12, color: '#9B9A97', margin: '0 4px' }}>Du
                                    <input type="date" style={{ ...DA_INPUT_STYLE, height: 34, padding: '0 8px', fontSize: 13, marginTop: 4 }} onChange={e => setTempStart(e.target.value)} />
                                </label>
                                <label style={{ display: 'block', fontSize: 12, color: '#9B9A97', margin: '0 4px' }}>Au
                                    <input type="date" style={{ ...DA_INPUT_STYLE, height: 34, padding: '0 8px', fontSize: 13, marginTop: 4 }} onChange={e => setTempEnd(e.target.value)} />
                                </label>
                            </div>
                            <button onClick={handleApply} style={{ ...btn(true), width: '100%', justifyContent: 'center', height: 34 }}>Appliquer</button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// Largeur minimale de la recherche avant qu'elle passe sous les boutons.
const SEARCH_MIN = 300;
const BAR_GAP = 16;

/** Largeur du contenu d'un groupe de boutons (somme des enfants + écarts), indépendante de
    la place que le flex lui donne. */
const contentWidth = (el) => {
    if (!el) return 0;
    const kids = [...el.children];
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    return kids.reduce((w, c) => w + c.getBoundingClientRect().width, 0) + gap * Math.max(0, kids.length - 1);
};

const PlanningTopBar = ({
    view, onViewChange, currentDate, onPrev, onNext, onToday,
    customRange, onCustomRangeChange, onNew, onManageTeam,
    activeFilters, onAddFilter, onRemoveFilter,
    showWeekends, onToggleWeekends,
    myViewMode, onToggleMyView,
    onDownloadTemplate, onImport,
    canManageTeam,
    onToggleHistory, historyOpen,
    onBulkValidate,
}) => {
    const fileInputRef = useRef(null);
    const [showImportMenu, setShowImportMenu] = useState(false);

    // Recherche au centre tant qu'elle tient entre les boutons ; sinon elle passe sur sa
    // propre ligne (jamais par-dessus Validation / Import).
    const barRef = useRef(null);
    const leftRef = useRef(null);
    const rightRef = useRef(null);
    const histRef = useRef(null);
    const [stacked, setStacked] = useState(false);
    useLayoutEffect(() => {
        const bar = barRef.current;
        if (!bar) return;
        const measure = () => {
            const cs = getComputedStyle(bar);
            const inner = bar.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
            const hist = histRef.current ? histRef.current.getBoundingClientRect().width + 10 : 0;
            const need = contentWidth(leftRef.current) + contentWidth(rightRef.current) + hist + SEARCH_MIN + BAR_GAP * 2;
            setStacked(need > inner);
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(bar);
        if (leftRef.current) ro.observe(leftRef.current);
        if (rightRef.current) ro.observe(rightRef.current);
        return () => ro.disconnect();
    }, []);
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file && onImport) onImport(file);
        e.target.value = '';
    };
    const hasExcel = !!onImport || !!onDownloadTemplate;
    const menuItemStyle = {
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '11px 14px',
        textAlign: 'left', border: 'none', background: 'white', fontSize: 13, fontWeight: 500,
        color: '#374151', cursor: 'pointer',
    };
    return (
        <div ref={barRef} style={{ display: 'flex', alignItems: 'center', flexWrap: stacked ? 'wrap' : 'nowrap', rowGap: 10, padding: '16px 24px', background: '#FFFFFF' }}>
            {/* GAUCHE (flex:1 pour centrer la recherche) */}
            <div ref={leftRef} style={{ flex: '1 1 auto', display: 'flex', gap: 12, alignItems: 'center', minWidth: 'max-content', order: 1 }}>
                <button onClick={onNew} style={btn(true)}>Nouveau</button>
                {canManageTeam && (
                    <button onClick={onManageTeam} style={BTN}>
                        <User size={16} /> Gérer l'équipe
                    </button>
                )}
                {hasExcel && (
                    <div style={{ position: 'relative' }}>
                        <input ref={fileInputRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleFileChange} />
                        <button
                            onClick={() => setShowImportMenu(v => !v)}
                            style={BTN}
                        >
                            <FileSpreadsheet size={16} /> Import <ChevronDown size={14} color="#6B7280" />
                        </button>
                        {showImportMenu && (
                            <>
                                <div onClick={() => setShowImportMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                                <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 100, background: 'white', border: '1px solid #E0DED9', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 220, overflow: 'hidden' }}>
                                    {onImport && (
                                        <button
                                            onClick={() => { setShowImportMenu(false); fileInputRef.current?.click(); }}
                                            style={menuItemStyle}
                                            onMouseEnter={e => e.currentTarget.style.background = '#F4F4F4'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                        >
                                            <Upload size={15} /> Importer des données
                                        </button>
                                    )}
                                    {onDownloadTemplate && (
                                        <button
                                            onClick={() => { setShowImportMenu(false); onDownloadTemplate(); }}
                                            style={menuItemStyle}
                                            onMouseEnter={e => e.currentTarget.style.background = '#F4F4F4'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                        >
                                            <Download size={15} /> Télécharger le modèle Excel
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
                {onBulkValidate && (
                    <button
                        onClick={onBulkValidate}
                        title="Valider en masse les créneaux d'un service sur une période"
                        style={BTN}
                    >
                        <CheckCircle2 size={16} /> Validation
                    </button>
                )}
            </div>

            {/* CENTRE : recherche centrée */}
            <div style={stacked
                ? { order: 3, flex: '1 1 calc(100% - 60px)', minWidth: 0 }
                : { order: 2, flex: '0 1 520px', minWidth: SEARCH_MIN, margin: `0 ${BAR_GAP}px` }}>
                <SmartFilterBar
                    fields={PLANNING_SEARCH_FIELDS}
                    activeFilters={activeFilters}
                    onAddFilter={onAddFilter}
                    onRemoveFilter={onRemoveFilter}
                    placeholder="Projets, ressources, services..."
                />
            </div>

            {/* Bouton Historique — à côté de la recherche */}
            {onToggleHistory && (
                <button
                    ref={histRef}
                    onClick={onToggleHistory}
                    title="Historique des créneaux par dossier"
                    style={{
                        flexShrink: 0, marginLeft: stacked ? 10 : -6, marginRight: stacked ? 0 : BAR_GAP, order: stacked ? 4 : 2,
                        ...btn(historyOpen), padding: '0 10px',
                    }}
                >
                    <History size={16} />
                </button>
            )}

            {/* DROITE (flex:1) */}
            <div ref={rightRef} style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, minWidth: 'max-content', order: stacked ? 2 : 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', height: 36, boxSizing: 'border-box', background: '#fff', borderRadius: 8, border: '1px solid #E0DED9', padding: '0 2px' }}>
                    <button onClick={onPrev} title="Précédent" style={{ border: 'none', background: 'transparent', padding: '6px 8px', cursor: 'pointer', display: 'flex', color: '#374151' }}><ChevronLeft size={16} /></button>
                    <button onClick={onNext} title="Suivant" style={{ border: 'none', background: 'transparent', padding: '6px 8px', cursor: 'pointer', display: 'flex', color: '#374151' }}><ChevronRight size={16} /></button>
                </div>

                <button
                    onClick={onToggleMyView}
                    title="Ma Vue (Agenda Personnel)"
                    style={btn(myViewMode)}
                >
                    <User size={16} /> Ma Vue
                </button>

                <ViewSelector view={view} onViewChange={onViewChange} customRange={customRange} onCustomRangeChange={onCustomRangeChange} showWeekends={showWeekends} onToggleWeekends={onToggleWeekends} />
                <button onClick={onToday} style={BTN}>Aujourd'hui</button>
            </div>
        </div>
    );
};

export default PlanningTopBar;
