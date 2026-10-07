import React, { useState, useMemo, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, ChevronDown, Filter } from 'lucide-react';
import ConditionFilterButton from '../ui/ConditionFilterButton';
import { isConditionActive, matchConditions } from '../FilterPanel';

import { PROJECT_STATUS_OPTIONS } from "../../lib/constants/projectStatus";
import { PROJECT_STATUS_TONE } from "../../lib/constants/daStyles";
import { StatusSelectPill } from "../ui/ToolbarControls";
import { useFillViewportHeight } from "../../lib/hooks/useFillViewportHeight";
import { SmartFilterBar } from "../ui/SmartFilterBar";

// Champs de recherche texte (chips)
const SEARCH_FIELDS = [
    { id: 'name', label: 'Nom du dossier' },
    { id: 'manager', label: "Chargé d'affaires" },
    { id: 'status', label: 'Statut' },
];

// Champs du bouton « Filtrer » (même panneau de conditions que les listes Chiffrages / Projets)
const FILTER_SCHEMA = [
    { key: 'deadline', label: 'Deadline', type: 'date' },
    { key: 'pctCotes', label: 'Avancement Cotes (%)', type: 'number' },
    { key: 'pctPrepa', label: 'Avancement Préparation (%)', type: 'number' },
    { key: 'pctConf', label: 'Avancement Confection (%)', type: 'number' },
    { key: 'pctPose', label: 'Avancement Pose (%)', type: 'number' },
    { key: 'totalSold', label: 'Budget (h)', type: 'number' },
    { key: 'totalConsumed', label: 'Consommé (h)', type: 'number' },
    { key: 'remainingBudget', label: 'Restant (h)', type: 'number' },
    { key: 'totalFuture', label: 'Planifié (h)', type: 'number' },
];

const pctColor = (pct) => {
    if (pct === null || pct === undefined) return '#9CA3AF';
    if (pct >= 100) return '#10B981';
    if (pct >= 50) return '#3B82F6';
    if (pct > 0) return '#F59E0B';
    return '#9CA3AF';
};

const AssistantView = ({ stats, onUpdateProject }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'remainingBudget', direction: 'asc' });
    const [expanded, setExpanded] = useState(() => new Set());

    const filterBarRef = useRef(null);
    // Seul le tableau défile : sa hauteur max = place restante jusqu'en bas de l'écran.
    const listScrollRef = useRef(null);
    const listHeight = useFillViewportHeight(listScrollRef);

    // --- FILTRES ---
    const [activeFilters, setActiveFilters] = useState([{ id: 'hide_archived', label: 'Hors archivés', field: 'hide_archived' }]);
    const [statusOpen, setStatusOpen] = useState(false);
    const [filterConditions, setFilterConditions] = useState([]);
    const statusRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (statusRef.current && !statusRef.current.contains(e.target)) setStatusOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const addFilter = (f) => setActiveFilters(prev => prev.find(x => x.id === f.id) ? prev : [...prev, f]);
    const removeFilter = (id) => setActiveFilters(prev => prev.filter(f => f.id !== id));
    const toggleStatusFilter = (key) => {
        const id = `status_${key}`;
        setActiveFilters(prev => prev.find(f => f.id === id)
            ? prev.filter(f => f.id !== id)
            : [...prev, { id, field: 'status_exact', value: key, label: `Statut : ${PROJECT_STATUS_OPTIONS[key]?.label || key}` }]);
    };

    const statusLabel = (p) => PROJECT_STATUS_OPTIONS[p.projectStatus]?.label || p.projectStatus || '';

    const filteredStats = useMemo(() => {
        let res = stats;

        // Statut : si des statuts précis sont sélectionnés, ils priment sur le
        // défaut "hors archivés" (sinon "Archivé" donnerait un résultat vide).
        const statusExact = activeFilters.filter(f => f.field === 'status_exact');
        if (statusExact.length > 0) {
            res = res.filter(p => statusExact.some(f => p.projectStatus === f.value));
        } else if (activeFilters.some(f => f.id === 'hide_archived')) {
            res = res.filter(p => p.projectStatus !== 'ARCHIVED');
        }

        const textFilters = activeFilters.filter(f => f.matchType === 'contains');
        if (textFilters.length > 0) {
            const grouped = textFilters.reduce((acc, f) => { (acc[f.field] = acc[f.field] || []).push(f); return acc; }, {});
            Object.keys(grouped).forEach(field => {
                res = res.filter(p => grouped[field].some(f => {
                    const v = f.value.toLowerCase();
                    if (field === 'all') return [p.name, p.manager, statusLabel(p)].some(x => String(x || '').toLowerCase().includes(v));
                    if (field === 'status') return statusLabel(p).toLowerCase().includes(v);
                    return String(p[field] || '').toLowerCase().includes(v);
                }));
            });
        }

        // Conditions du bouton « Filtrer » (avancements à plat, deadline au format date)
        if (filterConditions.some(isConditionActive)) {
            res = res.filter(p => matchConditions(filterConditions, { ...p, ...(p.advancement || {}) }));
        }

        return res;
    }, [stats, activeFilters, filterConditions]);

    const sortedStats = useMemo(() => {
        const sortable = [...filteredStats];
        if (sortConfig.key) {
            sortable.sort((a, b) => {
                let valA = a[sortConfig.key];
                let valB = b[sortConfig.key];
                if (valA === undefined || valA === null) valA = sortConfig.key === 'deadline' ? '9999-99-99' : 0;
                if (valB === undefined || valB === null) valB = sortConfig.key === 'deadline' ? '9999-99-99' : 0;
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortable;
    }, [filteredStats, sortConfig]);

    const toggleExpand = (id) => {
        setExpanded(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleSort = (key) => {
        setSortConfig(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
    };

    const SortLabel = ({ label, sortKey, align = 'flex-end' }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', justifyContent: align, userSelect: 'none' }} onClick={() => handleSort(sortKey)}>
            {label}
            {sortConfig.key === sortKey ? (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} style={{ opacity: 0.3 }} />}
        </div>
    );

    // sticky top = hauteur de la barre de filtres, pour que l'en-tête se cale pile
    // dessous. Fond opaque obligatoire (sinon les lignes défileraient au travers) et
    // z-index sous les menus déroulants des filtres (z 200).
    // En-têtes : même rendu que les listes Chiffrages / Projets (13 px, demi-gras, quasi noir, sans majuscules)
    const th = { padding: '12px 10px', fontSize: 13, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', userSelect: 'none', position: 'sticky', top: 0, background: '#F4F4F4', zIndex: 20 };
    const tdNum = { padding: '8px 16px', textAlign: 'right', fontSize: 13 };
    const iconBtn = (active) => ({
        display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 12px', borderRadius: 8, cursor: 'pointer',
        background: active ? '#EEF2FF' : 'white', color: active ? '#4338CA' : '#6B7280',
        border: `1px solid ${active ? '#C7D2FE' : '#E0DED9'}`, fontSize: 13, fontWeight: 600,
    });

    const ServiceRow = ({ label, pct, svc }) => (
        <tr style={{ background: '#FBFAF8', borderBottom: '1px solid #F3F4F6' }}>
            <td style={{ padding: '7px 16px 7px 52px', fontSize: 13, color: '#4B5563' }}>{label}</td>
            <td /><td />
            <td style={{ padding: '7px 16px', textAlign: 'center', fontWeight: 700, fontSize: 13, color: pctColor(pct) }}>
                {pct === null || pct === undefined ? '—' : `${pct}%`}
            </td>
            <td style={{ ...tdNum, color: '#374151', fontWeight: 600 }}>{svc.budget}h</td>
            <td style={{ ...tdNum, color: '#6B7280' }}>{svc.consumed}h</td>
            <td style={{ ...tdNum, fontWeight: 700, color: svc.remaining < 0 ? '#EF4444' : '#10B981' }}>{svc.remaining}h</td>
            <td style={{ ...tdNum, color: '#111827' }}>{svc.planned}h</td>
        </tr>
    );

    const statusCount = activeFilters.filter(f => f.field === 'status_exact').length;

    return (
        <div style={{ position: 'relative' }}>
            {/* BARRE DE FILTRES (fixe : seule la liste défile en dessous) */}
            <div ref={filterBarRef} style={{ position: 'relative', zIndex: 30, background: '#FFFFFF', padding: '24px 24px 16px' }}>
            <div style={{ maxWidth: 1440, margin: '0 auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                <SmartFilterBar
                    fields={SEARCH_FIELDS}
                    activeFilters={activeFilters}
                    onAddFilter={addFilter}
                    onRemoveFilter={removeFilter}
                    placeholder="Nom, chargé d'affaires, statut..."
                />

                {/* Statut puis Filtrer, alignés sur le bord droit du tableau */}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div ref={statusRef} style={{ position: 'relative' }}>
                        <button onClick={() => setStatusOpen(v => !v)} style={iconBtn(statusOpen || statusCount > 0)}>
                            <Filter size={16} /> Statut{statusCount > 0 ? ` (${statusCount})` : ''}
                        </button>
                        {statusOpen && (
                            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'white', borderRadius: 10, width: 220, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)', border: '1px solid #E0DED9', zIndex: 200, padding: 6 }}>
                                {Object.entries(PROJECT_STATUS_OPTIONS).map(([key, opt]) => {
                                    const checked = activeFilters.some(f => f.id === `status_${key}`);
                                    return (
                                        <button key={key} onClick={() => toggleStatusFilter(key)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', border: 'none', background: 'white', cursor: 'pointer', borderRadius: 6 }}>
                                            <input type="checkbox" checked={checked} readOnly />
                                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: opt.bg, color: opt.color }}>{opt.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Filtrer : même bouton et même panneau de conditions que les listes Chiffrages / Projets */}
                    <ConditionFilterButton schema={FILTER_SCHEMA} conditions={filterConditions} onChange={setFilterConditions} />
                </div>
            </div>
            </div>

            {/* overflow visible (au lieu de hidden) : sinon la carte deviendrait le
                conteneur de défilement du thead collant et le figerait dans la carte.
                Même gabarit que la barre de filtres (padding 24 + inner maxWidth 1440
                centré) pour que les deux soient parfaitement alignés. */}
            <div style={{ padding: '0 24px 24px' }}>
            {/* Même cadre que les listes Chiffrages / Projets ; seul le tableau défile (en-têtes collés, barre masquée) */}
            <div style={{ maxWidth: 1440, margin: '0 auto', background: 'white', borderRadius: 8, border: '1px solid #E0DED9', overflow: 'hidden' }}>
                <div ref={listScrollRef} className="df-list-scroll" style={{ overflow: 'auto', maxHeight: listHeight ?? undefined }}>
                <table className="df-list-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#F4F4F4' }}>
                        <tr>
                            <th style={{ ...th, textAlign: 'left' }}>Nom du Dossier</th>
                            <th style={{ ...th, textAlign: 'left' }}><SortLabel label="Deadline" sortKey="deadline" align="flex-start" /></th>
                            <th style={{ ...th, textAlign: 'center' }}><SortLabel label="Statut" sortKey="projectStatus" align="center" /></th>
                            <th style={{ ...th, textAlign: 'center' }}>Avancement</th>
                            <th style={{ ...th, textAlign: 'right' }}><SortLabel label="Budget (h)" sortKey="totalSold" /></th>
                            <th style={{ ...th, textAlign: 'right' }}><SortLabel label="Conso. (h)" sortKey="totalConsumed" /></th>
                            <th style={{ ...th, textAlign: 'right' }}><SortLabel label="Restant (h)" sortKey="remainingBudget" /></th>
                            <th style={{ ...th, textAlign: 'right' }}><SortLabel label="Planifié (h)" sortKey="totalFuture" /></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedStats.map(proj => {
                            const isOpen = expanded.has(proj.id);
                            const adv = proj.advancement;
                            const bs = proj.byService || { prepa: {}, conf: {}, pose: {} };
                            return (
                                <React.Fragment key={proj.id}>
                                    <tr style={{ borderBottom: '1px solid #E8E6E2', background: 'white' }}>
                                        <td style={{ padding: '12px 10px', fontWeight: 600, color: '#111827' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <button onClick={() => toggleExpand(proj.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#6B7280', display: 'flex', alignItems: 'center' }} aria-label={isOpen ? 'Replier' : 'Déplier'}>
                                                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                </button>
                                                <div>
                                                    {proj.name}
                                                    <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 400 }}>{proj.manager || "Non assigné"}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 10px', fontSize: 13, color: '#374151' }}>
                                            {proj.deadline ? format(new Date(proj.deadline), 'dd MMM yyyy', { locale: fr }) : '-'}
                                        </td>
                                        <td style={{ padding: '12px 10px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                            {/* Même pastille et même liste déroulante que la liste Projets */}
                                            <StatusSelectPill
                                                value={proj.projectStatus || "TODO"}
                                                options={PROJECT_STATUS_OPTIONS}
                                                tones={PROJECT_STATUS_TONE}
                                                onChange={(v) => onUpdateProject && onUpdateProject(proj.id, { status: v })}
                                            />
                                        </td>
                                        <td />
                                        <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>{proj.totalSold}h</td>
                                        <td style={{ padding: '12px 10px', textAlign: 'right', color: '#6B7280' }}>{proj.totalConsumed}h</td>
                                        <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700, color: proj.remainingBudget < 0 ? '#EF4444' : '#10B981' }}>{proj.remainingBudget}h</td>
                                        <td style={{ padding: '12px 10px', textAlign: 'right', color: '#111827' }}>{proj.totalFuture}h</td>
                                    </tr>

                                    {isOpen && (
                                        <>
                                            <tr style={{ background: '#FBFAF8', borderBottom: '1px solid #F3F4F6' }}>
                                                <td style={{ padding: '7px 16px 7px 52px', fontSize: 13, color: '#4B5563' }}>Prise de cotes</td>
                                                <td /><td />
                                                <td style={{ padding: '7px 16px', textAlign: 'center', fontWeight: 700, fontSize: 13, color: pctColor(adv?.pctCotes) }}>
                                                    {adv && adv.cotesTotal > 0
                                                        ? <>{adv.pctCotes}%<div style={{ fontSize: 10, fontWeight: 400, color: '#9CA3AF' }}>{adv.raw.cotesValidees}/{adv.cotesTotal} validées</div></>
                                                        : '—'}
                                                </td>
                                                <td /><td /><td /><td />
                                            </tr>
                                            <ServiceRow label="Préparation" pct={adv?.pctPrepa} svc={bs.prepa} />
                                            <ServiceRow label="Confection" pct={adv?.pctConf} svc={bs.conf} />
                                            <ServiceRow label="Pose" pct={adv?.pctPose} svc={bs.pose} />
                                        </>
                                    )}
                                </React.Fragment>
                            );
                        })}
                        {sortedStats.length === 0 && (
                            <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>Aucun projet ne correspond aux filtres.</td></tr>
                        )}
                    </tbody>
                </table>
                </div>
            </div>
            </div>
        </div>
    );
};

export default AssistantView;
