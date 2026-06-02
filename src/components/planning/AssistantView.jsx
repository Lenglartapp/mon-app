import React, { useState, useMemo, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, ChevronDown, Filter, SlidersHorizontal } from 'lucide-react';

import { PROJECT_STATUS_OPTIONS } from "../../lib/constants/projectStatus";
import { SmartFilterBar } from "../ui/SmartFilterBar";

// Champs de recherche texte (chips)
const SEARCH_FIELDS = [
    { id: 'name', label: 'Nom du dossier' },
    { id: 'manager', label: "Chargé d'affaires" },
    { id: 'status', label: 'Statut' },
];

// Champs des conditions avancées
const FILTER_FIELDS = [
    { id: 'deadline', label: 'Deadline', unit: '', type: 'date' },
    { id: 'pctCotes', label: 'Avancement Cotes', unit: '%', type: 'number' },
    { id: 'pctPrepa', label: 'Avancement Préparation', unit: '%', type: 'number' },
    { id: 'pctConf', label: 'Avancement Confection', unit: '%', type: 'number' },
    { id: 'pctPose', label: 'Avancement Pose', unit: '%', type: 'number' },
    { id: 'totalSold', label: 'Budget', unit: 'h', type: 'number' },
    { id: 'totalConsumed', label: 'Consommé', unit: 'h', type: 'number' },
    { id: 'remainingBudget', label: 'Restant', unit: 'h', type: 'number' },
    { id: 'totalFuture', label: 'Planifié', unit: 'h', type: 'number' },
];

const OPERATORS = [
    { id: 'gt', label: 'supérieur à', dateLabel: 'après le' },
    { id: 'lt', label: 'inférieur à', dateLabel: 'avant le' },
    { id: 'gte', label: 'supérieur ou égal à' },
    { id: 'lte', label: 'inférieur ou égal à' },
    { id: 'eq', label: 'égal à' },
    { id: 'between', label: 'compris entre', dateLabel: 'entre' },
];

let condSeq = 0;
const newCondition = () => ({ id: `c${condSeq++}`, field: 'pctConf', operator: 'gte', value: '', value2: '' });

const pctColor = (pct) => {
    if (pct === null || pct === undefined) return '#9CA3AF';
    if (pct >= 100) return '#10B981';
    if (pct >= 50) return '#3B82F6';
    if (pct > 0) return '#F59E0B';
    return '#9CA3AF';
};

// Valeur d'un champ pour les conditions avancées
const fieldValue = (proj, field) => {
    if (field === 'deadline') return proj.deadline;
    if (field.startsWith('pct')) return proj.advancement?.[field];
    return proj[field];
};

const AssistantView = ({ stats, onUpdateProject }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'remainingBudget', direction: 'asc' });
    const [expanded, setExpanded] = useState(() => new Set());

    // --- FILTRES ---
    const [activeFilters, setActiveFilters] = useState([{ id: 'hide_archived', label: 'Hors archivés', field: 'hide_archived' }]);
    const [statusOpen, setStatusOpen] = useState(false);
    const [advOpen, setAdvOpen] = useState(false);
    const [conditions, setConditions] = useState([newCondition()]);
    const statusRef = useRef(null);
    const advRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (statusRef.current && !statusRef.current.contains(e.target)) setStatusOpen(false);
            if (advRef.current && !advRef.current.contains(e.target)) setAdvOpen(false);
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

    const updateCondition = (id, key, val) =>
        setConditions(prev => prev.map(c => c.id === id ? { ...c, [key]: val, ...(key === 'operator' && val !== 'between' ? { value2: '' } : {}) } : c));
    const removeCondition = (id) =>
        setConditions(prev => prev.length > 1 ? prev.filter(c => c.id !== id) : prev);

    const applyConditions = () => {
        const valid = conditions.filter(c => c.value !== '');
        valid.forEach(cond => {
            const fieldDef = FILTER_FIELDS.find(f => f.id === cond.field);
            const opDef = OPERATORS.find(o => o.id === cond.operator);
            const isDate = fieldDef.type === 'date';
            const opLabel = isDate ? (opDef.dateLabel || opDef.label) : opDef.label;
            const fmtV = (v) => isDate ? v : `${v} ${fieldDef.unit}`;
            const label = cond.operator === 'between'
                ? `${fieldDef.label} ${isDate ? 'entre' : 'entre'} ${fmtV(cond.value)} et ${fmtV(cond.value2 || 0)}`
                : `${fieldDef.label} ${opLabel} ${fmtV(cond.value)}`;
            addFilter({
                id: `adv_${cond.id}_${cond.field}`,
                label, field: 'advanced', matchType: 'advanced',
                filterField: cond.field, fieldType: fieldDef.type,
                operator: cond.operator, value: cond.value, value2: cond.value2 || '',
            });
        });
        setConditions([newCondition()]);
        setAdvOpen(false);
    };

    const statusLabel = (p) => PROJECT_STATUS_OPTIONS[p.projectStatus]?.label || p.projectStatus || '';

    // --- APPLICATION DES FILTRES ---
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

        const adv = activeFilters.filter(f => f.matchType === 'advanced');
        if (adv.length > 0) {
            res = res.filter(p => adv.every(f => {
                const raw = fieldValue(p, f.filterField);
                if (f.fieldType === 'date') {
                    if (!raw) return false;
                    const d = new Date(raw).getTime();
                    const v1 = new Date(f.value).getTime();
                    const v2 = new Date(f.value2 || f.value).getTime();
                    switch (f.operator) {
                        case 'gt': case 'gte': return d >= v1;
                        case 'lt': case 'lte': return d <= v1;
                        case 'between': return d >= Math.min(v1, v2) && d <= Math.max(v1, v2);
                        default: return true;
                    }
                }
                const n = Number(raw) || 0;
                const v1 = Number(f.value);
                const v2 = Number(f.value2 || 0);
                switch (f.operator) {
                    case 'gt': return n > v1;
                    case 'gte': return n >= v1;
                    case 'lt': return n < v1;
                    case 'lte': return n <= v1;
                    case 'eq': return Math.abs(n - v1) < 0.5;
                    case 'between': return n >= Math.min(v1, v2) && n <= Math.max(v1, v2);
                    default: return true;
                }
            }));
        }

        return res;
    }, [stats, activeFilters]);

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

    const th = { padding: '12px 16px', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', userSelect: 'none' };
    const tdNum = { padding: '8px 16px', textAlign: 'right', fontSize: 13 };
    const iconBtn = (active) => ({
        display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 12px', borderRadius: 8, cursor: 'pointer',
        background: active ? '#EEF2FF' : 'white', color: active ? '#4338CA' : '#6B7280',
        border: `1px solid ${active ? '#C7D2FE' : '#E5E7EB'}`, fontSize: 13, fontWeight: 600,
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

    const advCount = activeFilters.filter(f => f.matchType === 'advanced').length;
    const statusCount = activeFilters.filter(f => f.field === 'status_exact').length;
    const inputStyle = { width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 13, outline: 'none', boxSizing: 'border-box' };

    return (
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            {/* BARRE DE FILTRES */}
            <div style={{ maxWidth: 1100, margin: '0 auto 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <SmartFilterBar
                    fields={SEARCH_FIELDS}
                    activeFilters={activeFilters}
                    onAddFilter={addFilter}
                    onRemoveFilter={removeFilter}
                    placeholder="Nom, chargé d'affaires, statut..."
                />

                {/* Filtre Statut */}
                <div ref={statusRef} style={{ position: 'relative' }}>
                    <button onClick={() => setStatusOpen(v => !v)} style={iconBtn(statusOpen || statusCount > 0)}>
                        <Filter size={16} /> Statut{statusCount > 0 ? ` (${statusCount})` : ''}
                    </button>
                    {statusOpen && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'white', borderRadius: 10, width: 220, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)', border: '1px solid #E5E7EB', zIndex: 200, padding: 6 }}>
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

                {/* Filtres avancés */}
                <div ref={advRef} style={{ position: 'relative' }}>
                    <button onClick={() => setAdvOpen(v => !v)} style={iconBtn(advOpen || advCount > 0)}>
                        <SlidersHorizontal size={16} />{advCount > 0 ? ` (${advCount})` : ''}
                    </button>
                    {advOpen && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'white', borderRadius: 10, width: 360, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)', border: '1px solid #E5E7EB', zIndex: 200, padding: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Filtres avancés</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {conditions.map((cond, i) => {
                                    const fieldDef = FILTER_FIELDS.find(f => f.id === cond.field);
                                    const isDate = fieldDef.type === 'date';
                                    const ops = isDate ? OPERATORS.filter(o => o.dateLabel) : OPERATORS;
                                    return (
                                        <div key={cond.id}>
                                            {i > 0 && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 10px' }}>
                                                    <div style={{ flex: 1, height: 1, background: '#F3F4F6' }} />
                                                    <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>ET</span>
                                                    <div style={{ flex: 1, height: 1, background: '#F3F4F6' }} />
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                    <select value={cond.field} onChange={e => updateCondition(cond.id, 'field', e.target.value)} style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}>
                                                        {FILTER_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                                                    </select>
                                                    {conditions.length > 1 && (
                                                        <button onClick={() => removeCondition(cond.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4, fontSize: 16, lineHeight: 1 }}>×</button>
                                                    )}
                                                </div>
                                                <select value={cond.operator} onChange={e => updateCondition(cond.id, 'operator', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                                                    {ops.map(o => <option key={o.id} value={o.id}>{isDate ? (o.dateLabel || o.label) : o.label}</option>)}
                                                </select>
                                                {cond.operator === 'between' ? (
                                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                        <input type={isDate ? 'date' : 'number'} value={cond.value} onChange={e => updateCondition(cond.id, 'value', e.target.value)} style={inputStyle} placeholder="Min" />
                                                        <span style={{ color: '#9CA3AF', fontSize: 12 }}>et</span>
                                                        <input type={isDate ? 'date' : 'number'} value={cond.value2} onChange={e => updateCondition(cond.id, 'value2', e.target.value)} style={inputStyle} placeholder="Max" />
                                                    </div>
                                                ) : (
                                                    <input type={isDate ? 'date' : 'number'} value={cond.value} onChange={e => updateCondition(cond.id, 'value', e.target.value)} style={inputStyle} placeholder="Valeur" />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                                <button onClick={applyConditions} disabled={conditions.every(c => c.value === '')} style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', background: conditions.every(c => c.value === '') ? '#E5E7EB' : '#1E2447', color: conditions.every(c => c.value === '') ? '#9CA3AF' : 'white', cursor: conditions.every(c => c.value === '') ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700 }}>APPLIQUER</button>
                                <button onClick={() => setConditions(prev => [...prev, newCondition()])} style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: '1px solid #1E2447', background: 'white', color: '#1E2447', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>+ Condition</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ maxWidth: 1100, margin: '0 auto', background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
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
                            const statusOpt = PROJECT_STATUS_OPTIONS[proj.projectStatus] || PROJECT_STATUS_OPTIONS.TODO;
                            const isOpen = expanded.has(proj.id);
                            const adv = proj.advancement;
                            const bs = proj.byService || { prepa: {}, conf: {}, pose: {} };
                            return (
                                <React.Fragment key={proj.id}>
                                    <tr style={{ borderBottom: '1px solid #F3F4F6', background: 'white' }}>
                                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>
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
                                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>
                                            {proj.deadline ? format(new Date(proj.deadline), 'dd MMM yyyy', { locale: fr }) : '-'}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                                <select value={proj.projectStatus || "TODO"} onChange={(e) => onUpdateProject && onUpdateProject(proj.id, { status: e.target.value })}
                                                    style={{ appearance: 'none', padding: "4px 12px 4px 24px", borderRadius: 20, border: "1px solid #E5E7EB", background: 'white', color: "#374151", fontWeight: 600, fontSize: 11, cursor: 'pointer', textAlign: 'center', outline: 'none', boxShadow: "0 1px 2px rgba(0,0,0,0.05)", minWidth: 100 }}>
                                                    {Object.entries(PROJECT_STATUS_OPTIONS).map(([key, opt]) => (<option key={key} value={key}>{opt.label}</option>))}
                                                </select>
                                                <div style={{ position: 'absolute', top: '50%', left: 10, transform: 'translateY(-50%)', width: 6, height: 6, borderRadius: '50%', background: statusOpt.color, pointerEvents: 'none' }} />
                                            </div>
                                        </td>
                                        <td />
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>{proj.totalSold}h</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#6B7280' }}>{proj.totalConsumed}h</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: proj.remainingBudget < 0 ? '#EF4444' : '#10B981' }}>{proj.remainingBudget}h</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#111827' }}>{proj.totalFuture}h</td>
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
    );
};

export default AssistantView;
