import React, { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, eachWeekOfInterval, eachDayOfInterval, isWeekend, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { X, ChevronRight, ChevronDown } from 'lucide-react';
import {
    ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { useAuth } from '../../auth';
import { productionGroup } from '../../lib/authz';
import { isMemberActiveOnDay, dailyHoursForGroup } from './constants';
import { findInternalProject } from '../../lib/planning/internalProject';
import { computeProjectHours } from '../../lib/projectMetrics';

// Couleurs des trois séries — franchement distinctes.
const COLOR_CAPA     = '#10B981'; // Capacité → vert
const COLOR_PLANIFIE = '#2563EB'; // Planifié → bleu
const COLOR_CHARGE   = '#111827'; // Charge   → noir

const WORKSHOP_CONFIG = {
    conf:  { label: 'Confection',   color: '#3B82F6' },
    pose:  { label: 'Pose',         color: '#10B981' },
    prepa: { label: 'Préparation',  color: '#F59E0B' },
};
const ALL_WS = ['conf', 'pose', 'prepa'];

// Typologies de période (comme le module Performance) : on démarre toujours à S-1
// et on projette N mois en avant.
const PERIODE_PRESETS = [
    { key: 'month',        label: 'Mois en cours',     dir: 'future', months: 1  },
    { key: 'quarter',      label: 'Trimestre à venir', dir: 'future', months: 3  },
    { key: '6m',           label: '6 mois à venir',    dir: 'future', months: 6  },
    { key: 'year',         label: 'Année à venir',     dir: 'future', months: 12 },
    { key: 'last_month',   label: 'Mois dernier',      dir: 'past',   months: 1  },
    { key: 'last_quarter', label: 'Trimestre dernier', dir: 'past',   months: 3  },
    { key: 'last_6m',      label: '6 derniers mois',   dir: 'past',   months: 6  },
    { key: 'last_year',    label: 'Dernière année',    dir: 'past',   months: 12 },
];

// Tuile de synthèse du dashboard.
const Tile = ({ label, value, sub, color = '#111827', onClick }) => (
    <div
        onClick={onClick}
        title={onClick ? 'Voir les projets concernés' : undefined}
        style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px', cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow .15s, border-color .15s' }}
        onMouseEnter={onClick ? (e) => { e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = '#C7D2FE'; } : undefined}
        onMouseLeave={onClick ? (e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#E5E7EB'; } : undefined}
    >
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.3, display: 'flex', alignItems: 'center', gap: 4 }}>
            {label}{onClick && <span style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1 }}>›</span>}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color, marginTop: 6, lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{sub}</div>}
    </div>
);

// Pop-up : liste des projets qui dépassent (surplanification ou suroccupation), avec les chiffres.
const OverModal = ({ type, rows, onClose }) => {
    const r1 = (n) => Math.round((n || 0) * 10) / 10;
    const isPlan = type === 'surplanif';
    const [expanded, setExpanded] = useState(() => new Set());
    const toggle = (id) => setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const title = isPlan ? 'Surplanification — projets concernés' : 'Surconsommation — projets concernés';
    const suffix = isPlan ? 'au-delà du budget restant' : 'au-delà du budget vendu';
    const totalOver = rows.reduce((s, r) => s + r.over, 0);
    const dth = { textAlign: 'right', padding: '4px 8px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' };
    const dtd = { textAlign: 'right', padding: '4px 8px', color: '#4B5563' };
    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: 'min(720px, 100%)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 18px', borderBottom: '1px solid #E5E7EB' }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: '#111827' }}>{title}</div>
                        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{rows.length} projet{rows.length > 1 ? 's' : ''} · total +{r1(totalOver)}h {suffix} · <span style={{ color: '#9CA3AF' }}>clique un projet pour le détail par service</span></div>
                    </div>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6B7280', padding: 4 }}><X size={20} /></button>
                </div>
                <div style={{ overflowY: 'auto', padding: '4px 8px 10px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ color: '#9CA3AF', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                                <th style={{ textAlign: 'left', padding: '8px 10px' }}>Projet</th>
                                <th style={{ textAlign: 'right', padding: '8px 10px' }}>{isPlan ? 'Planifié futur' : 'Consommé'}</th>
                                <th style={{ textAlign: 'right', padding: '8px 10px' }}>{isPlan ? 'Budget restant' : 'Budget vendu'}</th>
                                <th style={{ textAlign: 'right', padding: '8px 10px' }}>{isPlan ? 'Surplanif' : 'Surconso'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => {
                                const open = expanded.has(r.id);
                                return (
                                    <React.Fragment key={r.id}>
                                        <tr onClick={() => toggle(r.id)} style={{ borderTop: '1px solid #F3F4F6', cursor: 'pointer', background: open ? '#F9FAFB' : 'transparent' }}>
                                            <td style={{ padding: '8px 10px', fontWeight: 600, color: '#111827' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                    {open ? <ChevronDown size={14} color="#9CA3AF" /> : <ChevronRight size={14} color="#9CA3AF" />}
                                                    {r.name}
                                                </span>
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#374151' }}>{r1(r.a)}h</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#374151' }}>{r1(r.b)}h</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#B91C1C' }}>+{r1(r.over)}h</td>
                                        </tr>
                                        {open && (
                                            <tr style={{ background: '#F9FAFB' }}>
                                                <td colSpan={4} style={{ padding: '2px 10px 12px 28px' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                                        <thead>
                                                            <tr>
                                                                <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' }}>Service</th>
                                                                <th style={dth}>{isPlan ? 'Planifié futur' : 'Consommé'}</th>
                                                                <th style={dth}>{isPlan ? 'Budget restant' : 'Budget vendu'}</th>
                                                                <th style={dth}>{isPlan ? 'Surplanif' : 'Surconso'}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {r.services.map((s) => {
                                                                const aWs = isPlan ? s.planned : s.consumed;
                                                                const bWs = isPlan ? s.remaining : s.budget;
                                                                const overWs = Math.max(0, aWs - bWs);
                                                                return (
                                                                    <tr key={s.key} style={{ borderTop: '1px solid #EEF0F3' }}>
                                                                        <td style={{ textAlign: 'left', padding: '4px 8px', color: '#374151', fontWeight: 600 }}>{s.label}</td>
                                                                        <td style={dtd}>{r1(aWs)}h</td>
                                                                        <td style={dtd}>{r1(bWs)}h</td>
                                                                        <td style={{ ...dtd, fontWeight: 700, color: overWs > 0 ? '#B91C1C' : '#9CA3AF' }}>{overWs > 0 ? `+${r1(overWs)}h` : '—'}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                            {rows.length === 0 && <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: '#9CA3AF' }}>Aucun projet concerné.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// Détail par projet (panneau latéral) : titre + liste avec barres proportionnelles.
// overFn(item) → heures de surplanification du projet (0 si aucune) ; marqueur rouge si > 0.
const ProjectBreakdown = ({ title, items, total, barColor, emptyText, overFn, overLabel = 'dépassement', overSuffix = 'au-delà du budget' }) => (
    <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>{title} ({items.length})</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: barColor }}>{Math.round(total * 10) / 10}h</span>
        </div>
        {items.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: 12, textAlign: 'center', margin: '8px 0 14px' }}>{emptyText}</div>
        ) : items.map((p, i) => {
            const pct = total > 0 ? Math.round(p.hours / total * 100) : 0;
            const over = overFn ? overFn(p) : 0;
            return (
                <div key={i} style={{ padding: '9px 0', borderBottom: '1px solid #F3F4F6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: over > 0 ? '#B91C1C' : '#111827' }}>{p.name}</span>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#374151' }}>{Math.round(p.hours * 10) / 10}h</span>
                    </div>
                    <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2 }}>
                        <div style={{ height: 4, width: `${Math.min(pct, 100)}%`, background: over > 0 ? '#EF4444' : barColor, borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 10, marginTop: 2 }}>
                        <span style={{ color: '#9CA3AF' }}>{pct}%</span>
                        {over > 0 && <span style={{ color: '#EF4444', fontWeight: 700, marginLeft: 6 }}>· {overLabel} +{over}h {overSuffix}</span>}
                    </div>
                </div>
            );
        })}
    </div>
);

const CapaciteView = ({ localUsers, localEvents, projects = [] }) => {
    const today = new Date();
    const { currentUser } = useAuth();
    const isPoseTech = currentUser?.role === 'pose';

    const [selectedWorkshops, setSelectedWorkshops] = useState(isPoseTech ? ['pose'] : ['conf', 'pose', 'prepa']);
    // Vue de base : on démarre à la semaine précédente (S-1), horizon = trimestre.
    const [periode,    setPeriode]    = useState('quarter');   // défaut : Trimestre à venir
    const [direction,  setDirection]  = useState('future');    // 'future' (planification) | 'past' (consommation)
    const [rangeStart, setRangeStart] = useState(format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    const [rangeEnd,   setRangeEnd]   = useState(format(addMonths(today, 3), 'yyyy-MM-dd'));
    const [selectedWeekData, setSelectedWeekData] = useState(null);
    // Charge masquée par défaut : la vue de base compare Capacité et Planifié.
    const [showCharge, setShowCharge] = useState(false);

    // Applique une typologie. Futur : de la semaine en cours à +N mois (planification).
    // Passé : de −N mois à la semaine en cours (consommation). La direction pilote les tuiles.
    const applyPreset = (key) => {
        const preset = PERIODE_PRESETS.find(p => p.key === key);
        if (!preset) return;
        setPeriode(key);
        setDirection(preset.dir);
        const weekStart = startOfWeek(today, { weekStartsOn: 1 });
        if (preset.dir === 'past') {
            setRangeStart(format(startOfWeek(subMonths(today, preset.months), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
            setRangeEnd(format(weekStart, 'yyyy-MM-dd'));
        } else {
            setRangeStart(format(weekStart, 'yyyy-MM-dd'));
            setRangeEnd(format(addMonths(today, preset.months), 'yyyy-MM-dd'));
        }
    };

    const closures      = useMemo(() => localEvents.filter(e => e.type === 'closure'),  [localEvents]);
    const absences      = useMemo(() => localEvents.filter(e => e.type === 'absence'),  [localEvents]);
    const planningEvts  = useMemo(() => localEvents.filter(e =>
        e.type !== 'mission' && e.type !== 'closure' && e.type !== 'absence' &&
        e.resourceId !== 'backlog_confection'
    ), [localEvents]);
    // Cartes du Programme semaine (confection) — source du « planifié » confection.
    const backlogCards  = useMemo(() => localEvents.filter(e => e.resourceId === 'backlog_confection'), [localEvents]);

    // Projet interne « Lenglart » : exclu de la CHARGE (on mesure l'occupation des
    // ateliers par les projets vendus, pas par le travail interne).
    const internalProjectId = useMemo(() => findInternalProject(projects)?.id ?? null, [projects]);
    const isInternalEvt = (e) =>
        (internalProjectId != null && e.meta?.projectId === internalProjectId) || !!e.meta?.internalChapter;

    // Budget / planifié par projet (source unique) → sert à repérer la SURPLANIFICATION :
    // heures planifiées au-delà du budget vendu (planifié > budget), sur les ateliers affichés.
    const projectHoursById = useMemo(() => {
        // Surplanification = FUTUR uniquement : on ne compte le planifié qu'à partir du lundi de la
        // semaine en cours. Le passé planifié-non-réalisé ne doit pas gonfler le total (ex. 100h
        // programmées S-1, 60h faites → les 40h non faites ne comptent plus). Le consommé, lui,
        // reste compté quelle que soit la date (c'est du réalisé).
        const plannedFrom = startOfWeek(today, { weekStartsOn: 1 });
        const map = {};
        (projects || []).forEach(p => { map[p.id] = computeProjectHours(p, localEvents, { plannedFrom }); });
        return map;
    }, [projects, localEvents]);
    const overPlanForProject = (projId) => {
        const h = projectHoursById[projId];
        if (!h) return 0;
        // Planifié FUTUR total (ateliers sélectionnés) au-delà du budget RESTANT total
        // (budget vendu − déjà consommé). Agrégé, cohérent avec les chiffres affichés.
        let planned = 0, remaining = 0;
        selectedWorkshops.forEach(ws => {
            planned   += h.planned[ws] || 0;
            remaining += Math.max(0, (h.budget[ws] || 0) - (h.consumed[ws] || 0));
        });
        return Math.max(0, planned - remaining);
    };
    // Suroccupation : heures CONSOMMÉES au-delà du budget vendu (débordement réel).
    const overOccForProject = (projId) => {
        const h = projectHoursById[projId];
        if (!h) return 0;
        let consumed = 0, budget = 0;
        selectedWorkshops.forEach(ws => { consumed += h.consumed[ws] || 0; budget += h.budget[ws] || 0; });
        return Math.max(0, consumed - budget);
    };

    // Détails par projet (pour les pop-ups) — mêmes calculs que les tuiles.
    const overPlanDetail = (projId) => {
        const h = projectHoursById[projId];
        if (!h) return { planned: 0, remaining: 0, over: 0 };
        let planned = 0, remaining = 0;
        selectedWorkshops.forEach(ws => {
            planned   += h.planned[ws] || 0;
            remaining += Math.max(0, (h.budget[ws] || 0) - (h.consumed[ws] || 0));
        });
        return { planned, remaining, over: Math.max(0, planned - remaining) };
    };
    const overOccDetail = (projId) => {
        const h = projectHoursById[projId];
        if (!h) return { consumed: 0, budget: 0, over: 0 };
        let consumed = 0, budget = 0;
        selectedWorkshops.forEach(ws => { consumed += h.consumed[ws] || 0; budget += h.budget[ws] || 0; });
        return { consumed, budget, over: Math.max(0, consumed - budget) };
    };
    const [overModal, setOverModal] = useState(null); // 'surplanif' | 'surocc' | null

    const filteredUsers = useMemo(() =>
        // Groupe de production (ex. ordo_conf compté en confection)
        localUsers.filter(u => selectedWorkshops.includes(productionGroup(u.role))),
        [localUsers, selectedWorkshops]
    );

    const weeks = useMemo(() => {
        const s = startOfWeek(new Date(rangeStart), { weekStartsOn: 1 });
        const e = startOfWeek(new Date(rangeEnd),   { weekStartsOn: 1 });
        if (s > e) return [];
        return eachWeekOfInterval({ start: s, end: e }, { weekStartsOn: 1 });
    }, [rangeStart, rangeEnd]);


    const isClosureOnDay = (dayStr) =>
        closures.some(c =>
            format(new Date(c.meta.start), 'yyyy-MM-dd') <= dayStr &&
            format(new Date(c.meta.end),   'yyyy-MM-dd') >= dayStr
        );

    // Heures NETTES d'un intervalle : durée brute moins la pause déjeuner 12h–13h si couverte.
    const netHours = (start, end) => {
        let h = Math.max(0, (end - start) / 3_600_000);
        const lunchStart = new Date(start); lunchStart.setHours(12, 0, 0, 0);
        const lunchEnd   = new Date(start); lunchEnd.setHours(13, 0, 0, 0);
        const os = Math.max(start, lunchStart), oe = Math.min(end, lunchEnd);
        if (os < oe) h -= (oe - os) / 3_600_000;
        return Math.max(0, h);
    };

    const absenceHoursOnDay = (userId, dayStr) => {
        return absences
            .filter(e => e.resourceId === userId && e.date === dayStr)
            .reduce((total, abs) => {
                if (!abs.meta?.start || !abs.meta?.end) return total + 24; // journée entière → capacité 0
                return total + netHours(new Date(abs.meta.start), new Date(abs.meta.end));
            }, 0);
    };

    const eventHours = (evt) => {
        if (evt.meta?.durationHours != null) return evt.meta.durationHours; // conf : durée nette déjà stockée
        if (!evt.meta?.start || !evt.meta?.end) return 0;
        return netHours(new Date(evt.meta.start), new Date(evt.meta.end));
    };

    const chartData = useMemo(() => {
        const weekUserIds = new Set(filteredUsers.map(u => u.id));
        return weeks.map(weekStart => {
            const weekEnd  = endOfWeek(weekStart, { weekStartsOn: 1 });
            const workDays = eachDayOfInterval({ start: weekStart, end: weekEnd }).filter(d => !isWeekend(d));

            // ── Capacité ── (heures contractuelles réelles : 7,8h conf/prépa, 8h pose)
            let capaHours = 0;
            filteredUsers.forEach(user => {
                const dh = dailyHoursForGroup(productionGroup(user.role));
                workDays.forEach(day => {
                    const dayStr = format(day, 'yyyy-MM-dd');
                    if (isClosureOnDay(dayStr)) return;
                    if (!isMemberActiveOnDay(user, dayStr)) return; // hors contrat / archivé
                    const absH = absenceHoursOnDay(user.id, dayStr);
                    capaHours += Math.max(0, dh - absH);
                });
            });

            // ── Charge ── (tous les créneaux posés par personne, heures nettes)
            const weekStr    = format(weekStart, 'yyyy-MM-dd');
            const weekEndStr = format(weekEnd,   'yyyy-MM-dd');
            const weekEvts   = planningEvts.filter(e =>
                weekUserIds.has(e.resourceId) &&
                e.date >= weekStr && e.date <= weekEndStr
            );
            // Charge = ce qui a été CONSOMMÉ (créneaux validés) sur des projets vendus
            // → on exclut l'interne Lenglart et on ne garde que les créneaux validés.
            const chargeEvts  = weekEvts.filter(e => !isInternalEvt(e) && e.meta?.status === 'validated');
            const chargeHours = chargeEvts.reduce((s, e) => s + eventHours(e), 0);

            // ── Planifié ──
            //  Confection  : volume posé au Programme semaine (budgetHours) de la semaine.
            //  Pose / prépa : créneaux du planning NON validés (le reste à faire).
            let planifieHours = 0;
            if (selectedWorkshops.includes('conf')) {
                planifieHours += backlogCards
                    .filter(c => c.date >= weekStr && c.date <= weekEndStr && !isInternalEvt(c))
                    .reduce((s, c) => s + (Number(c.meta?.budgetHours) || 0), 0);
            }
            planifieHours += weekEvts
                .filter(e => (e.type === 'pose' || e.type === 'prepa') && e.meta?.status !== 'validated' && !isInternalEvt(e))
                .reduce((s, e) => s + eventHours(e), 0);

            // ── Détail CONSOMMÉ par projet (= charge) ──
            const projectMap = {};
            chargeEvts.forEach(e => {
                const id = e.meta?.projectId || null;
                const key = id || e.title || '—';
                if (!projectMap[key]) projectMap[key] = { id, name: e.title || '—', hours: 0 };
                projectMap[key].hours += eventHours(e);
            });

            // ── Détail PLANIFIÉ par projet (programme conf + créneaux pose/prépa non validés) ──
            const plannedMap = {};
            const addPlanned = (id, name, hours) => {
                const key = id || name || '—';
                if (!plannedMap[key]) plannedMap[key] = { id: id || null, name: name || '—', hours: 0 };
                plannedMap[key].hours += hours;
            };
            if (selectedWorkshops.includes('conf')) {
                backlogCards
                    .filter(c => c.date >= weekStr && c.date <= weekEndStr && !isInternalEvt(c))
                    .forEach(c => addPlanned(c.meta?.projectId, c.title, Number(c.meta?.budgetHours) || 0));
            }
            weekEvts
                .filter(e => (e.type === 'pose' || e.type === 'prepa') && e.meta?.status !== 'validated' && !isInternalEvt(e))
                .forEach(e => addPlanned(e.meta?.projectId, e.title, eventHours(e)));

            const weekNum  = format(weekStart, 'w');
            const prevWeek = weeks[weeks.indexOf(weekStart) - 1];
            const monthLabel = !prevWeek || format(prevWeek, 'M') !== format(weekStart, 'M')
                ? format(weekStart, 'MMMM', { locale: fr })
                : null;
            return {
                weekStart,
                weekLabel:     `S${weekNum}`,
                weekFullLabel: format(weekStart, "'Sem' w · dd MMM", { locale: fr }),
                monthLabel,
                capa:     Math.round(capaHours     * 10) / 10,
                charge:   Math.round(chargeHours   * 10) / 10,
                planifie: Math.round(planifieHours * 10) / 10,
                projects:        Object.values(projectMap).sort((a, b) => b.hours - a.hours),
                plannedProjects: Object.values(plannedMap).sort((a, b) => b.hours - a.hours),
            };
        });
    }, [weeks, filteredUsers, planningEvts, backlogCards, closures, absences, selectedWorkshops, internalProjectId]);

    // « Tous » = les 3 ateliers actifs, mais les puces individuelles apparaissent inactives.
    const isAllMode = selectedWorkshops.length === ALL_WS.length;
    const toggleWorkshop = (ws) => {
        if (isPoseTech) return; // technicien pose : verrouillé sur son atelier
        setSelectedWorkshops(prev => {
            if (prev.length === ALL_WS.length) return [ws];        // depuis « Tous » → uniquement cet atelier
            if (prev.includes(ws)) {
                const next = prev.filter(w => w !== ws);
                return next.length ? next : [...ALL_WS];           // plus rien de sélectionné → retour à « Tous »
            }
            return [...prev, ws];                                  // ajoute l'atelier
        });
    };

    const todayWeekLabel = `S${format(today, 'w')}`;

    // Style d'en-tête de tableau (aligné, compact).
    const th = (align = 'right', extra = {}) => ({ padding: '8px 14px', textAlign: align, fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', whiteSpace: 'nowrap', ...extra });
    const rateColor = (r) => r > 100 ? '#EF4444' : r > 80 ? '#F59E0B' : '#10B981';

    // Synthèse (tuiles) : conglomérat sur toute la période affichée.
    const totals = useMemo(() => {
        const sum = (k) => chartData.reduce((s, r) => s + r[k], 0);
        const capa = sum('capa'), planifie = sum('planifie'), charge = sum('charge');
        const round = (n) => Math.round(n * 10) / 10;

        // Surplanification : heures planifiées au-delà du budget, sur les projets présents
        // dans la période (dédupliqués). Signal des chantiers en dépassement/retard.
        const planIds = new Set();
        chartData.forEach(r => r.plannedProjects.forEach(p => { if (p.id) planIds.add(p.id); }));
        let surplanif = 0, nbOver = 0;
        planIds.forEach(id => { const o = overPlanForProject(id); if (o > 0) { surplanif += o; nbOver += 1; } });

        // Suroccupation : consommé au-delà du budget, projets présents dans le consommé.
        const consIds = new Set();
        chartData.forEach(r => r.projects.forEach(p => { if (p.id) consIds.add(p.id); }));
        let suroccup = 0, nbOverOcc = 0;
        consIds.forEach(id => { const o = overOccForProject(id); if (o > 0) { suroccup += o; nbOverOcc += 1; } });

        return {
            capa: round(capa), planifie: round(planifie), charge: round(charge),
            ratePlan: capa > 0 ? Math.round(planifie / capa * 100) : 0,
            rateOcc:  capa > 0 ? Math.round(charge   / capa * 100) : 0,
            ecartPlan: round(planifie - capa),
            ecartOcc:  round(charge   - capa),
            surplanif: round(surplanif),
            nbOver,
            pctSurplanif: planifie > 0 ? Math.round(surplanif / planifie * 100) : 0,
            suroccup: round(suroccup),
            nbOverOcc,
            pctSuroccup: charge > 0 ? Math.round(suroccup / charge * 100) : 0,
        };
    }, [chartData, projectHoursById, selectedWorkshops]);

    const CustomXAxisTick = ({ x, y, payload }) => {
        const item = chartData.find(d => d.weekLabel === payload.value);
        return (
            <g transform={`translate(${x},${y})`}>
                <text x={0} y={0} dy={12} textAnchor="middle" fontSize={11} fill="#6B7280">{payload.value}</text>
                {item?.monthLabel && (
                    <text x={0} y={0} dy={26} textAnchor="middle" fontSize={10} fill="#374151" fontWeight={700}
                        style={{ textTransform: 'capitalize' }}>
                        {item.monthLabel.charAt(0).toUpperCase() + item.monthLabel.slice(1)}
                    </text>
                )}
            </g>
        );
    };

    const CustomTooltip = ({ active, payload }) => {
        if (!active || !payload?.length) return null;
        const d = payload[0]?.payload;
        const over = d.planifie > d.capa;
        return (
            <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{d.weekFullLabel}</div>
                <div style={{ color: '#6B7280', marginBottom: 2 }}>Capacité : <strong>{d.capa}h</strong></div>
                <div style={{ fontWeight: 600, color: over ? '#EF4444' : COLOR_PLANIFIE }}>
                    Planifié : {d.planifie}h{over ? ` (+${Math.round((d.planifie - d.capa) * 10) / 10}h)` : ''}
                </div>
                <div style={{ marginTop: 2, color: COLOR_CHARGE }}>Charge : {d.charge}h</div>
                <div style={{ marginTop: 6, color: '#9CA3AF', fontSize: 11 }}>Clic pour le détail</div>
            </div>
        );
    };

    return (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

            {/* ── Contenu principal ── */}
            <div style={{ flex: 1, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Contrôles */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    {/* Filtres ateliers */}
                    <div style={{ display: 'flex', gap: 6 }}>
                        {Object.entries(WORKSHOP_CONFIG)
                            .filter(([key]) => !isPoseTech || key === 'pose')
                            .map(([key, cfg]) => (
                                <button key={key} onClick={() => toggleWorkshop(key)} style={{
                                    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                                    background: (selectedWorkshops.includes(key) && !isAllMode) ? cfg.color : 'white',
                                    color:      (selectedWorkshops.includes(key) && !isAllMode) ? 'white'   : '#6B7280',
                                    border:     `1px solid ${(selectedWorkshops.includes(key) && !isAllMode) ? cfg.color : '#E5E7EB'}`,
                                }}>
                                    {cfg.label}
                                </button>
                            ))}
                        {!isPoseTech && (
                            <button onClick={() => setSelectedWorkshops([...ALL_WS])} style={{
                                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                background: isAllMode ? '#111827' : 'white',
                                color:      isAllMode ? 'white'   : '#6B7280',
                                border:     `1px solid ${isAllMode ? '#111827' : '#E5E7EB'}`,
                            }}>
                                Tous
                            </button>
                        )}
                    </div>

                    {/* Bascule charge (masquée par défaut) */}
                    <button onClick={() => setShowCharge(v => !v)} style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        background: showCharge ? '#EF4444' : 'white',
                        color:      showCharge ? 'white'   : '#6B7280',
                        border:     `1px solid ${showCharge ? '#EF4444' : '#E5E7EB'}`,
                    }}>
                        {showCharge ? 'Charge sur la courbe ✓' : 'Charge sur la courbe'}
                    </button>

                    {/* Sélecteur de période : direction (Futur/Passé) + menu déroulant + perso */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
                        {/* Toggle direction : quelles tuiles afficher (planification vs consommation) */}
                        <div style={{ display: 'inline-flex', background: '#F3F4F6', borderRadius: 20, padding: 2 }}>
                            {[{ k: 'future', l: 'Futur' }, { k: 'past', l: 'Passé' }].map(o => (
                                <button key={o.k} onClick={() => setDirection(o.k)} style={{
                                    padding: '5px 14px', borderRadius: 18, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                                    background: direction === o.k ? '#111827' : 'transparent',
                                    color:      direction === o.k ? 'white'   : '#6B7280',
                                }}>{o.l}</button>
                            ))}
                        </div>
                        {/* Menu déroulant de période */}
                        <select
                            value={periode}
                            onChange={e => { const v = e.target.value; if (v === 'custom') setPeriode('custom'); else applyPreset(v); }}
                            style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#374151', border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer' }}
                        >
                            <optgroup label="À venir">
                                {PERIODE_PRESETS.filter(p => p.dir === 'future').map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                            </optgroup>
                            <optgroup label="Passé">
                                {PERIODE_PRESETS.filter(p => p.dir === 'past').map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                            </optgroup>
                            <option value="custom">Perso…</option>
                        </select>
                        {periode === 'custom' && (
                            <>
                                <input type="date" value={rangeStart} onChange={e => { setPeriode('custom'); setRangeStart(e.target.value); }}
                                    style={{ padding: '5px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12 }} />
                                <span style={{ color: '#9CA3AF', fontSize: 12 }}>→</span>
                                <input type="date" value={rangeEnd} onChange={e => { setPeriode('custom'); setRangeEnd(e.target.value); }}
                                    style={{ padding: '5px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12 }} />
                            </>
                        )}
                    </div>
                </div>

                {/* Dashboard — synthèse sur toute la période sélectionnée */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                    <Tile label="Capacité" value={`${totals.capa}h`} sub="disponible sur la période" />
                    {direction === 'future' ? (
                        <>
                            <Tile label="Planifié" value={`${totals.planifie}h`} color={COLOR_PLANIFIE} sub="à faire sur la période" />
                            <Tile label="Taux de planification" value={`${totals.ratePlan}%`} color={rateColor(totals.ratePlan)}
                                sub={`écart ${totals.ecartPlan >= 0 ? '+' : ''}${totals.ecartPlan}h`} />
                            <Tile label="Surplanification" value={`${totals.surplanif}h`}
                                color={totals.surplanif > 0 ? '#EF4444' : '#10B981'}
                                onClick={totals.surplanif > 0 ? () => setOverModal('surplanif') : undefined}
                                sub={totals.surplanif > 0 ? `${totals.nbOver} projet${totals.nbOver > 1 ? 's' : ''} au-delà du budget · ${totals.pctSurplanif}% du planifié` : 'aucun dépassement de budget'} />
                        </>
                    ) : (
                        <>
                            <Tile label="Consommé" value={`${totals.charge}h`} color={COLOR_CHARGE} sub="réalisé sur la période" />
                            <Tile label="Taux d'occupation" value={`${totals.rateOcc}%`} color={rateColor(totals.rateOcc)}
                                sub={`écart ${totals.ecartOcc >= 0 ? '+' : ''}${totals.ecartOcc}h`} />
                            <Tile label="Surconsommation" value={`${totals.suroccup}h`}
                                color={totals.suroccup > 0 ? '#EF4444' : '#10B981'}
                                onClick={totals.suroccup > 0 ? () => setOverModal('surocc') : undefined}
                                sub={totals.suroccup > 0 ? `${totals.nbOverOcc} projet${totals.nbOverOcc > 1 ? 's' : ''} au-delà du budget · ${totals.pctSuroccup}% du consommé` : 'aucun dépassement de budget'} />
                        </>
                    )}
                </div>

                {/* Courbe */}
                <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', padding: '20px 16px 8px' }}>
                    <ResponsiveContainer width="100%" height={420}>
                        <ComposedChart data={chartData} onClick={(d) => {
                            if (!d) return;
                            const item = d.activePayload?.[0]?.payload ?? chartData.find(w => w.weekLabel === d.activeLabel);
                            if (item) setSelectedWeekData(item);
                        }} style={{ cursor: 'pointer' }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                            <XAxis dataKey="weekLabel" tick={<CustomXAxisTick />} height={45} />
                            <YAxis tick={{ fontSize: 11 }} unit="h" width={45} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                            <Area
                                type="monotone" dataKey="capa" name="Capacité"
                                fill="#ECFDF5" stroke={COLOR_CAPA} strokeWidth={2} dot={false}
                            />
                            <Line
                                type="monotone" dataKey="planifie" name="Planifié"
                                stroke={COLOR_PLANIFIE} strokeWidth={2.5}
                                activeDot={{ r: 8, cursor: 'pointer', onClick: (_, payload) => setSelectedWeekData(payload.payload) }}
                                dot={(props) => {
                                    const { cx, cy, payload } = props;
                                    return <circle key={`pl-${cx}`} cx={cx} cy={cy} r={4}
                                        fill={payload.planifie > payload.capa ? '#EF4444' : COLOR_PLANIFIE}
                                        stroke="white" strokeWidth={1.5} />;
                                }}
                            />
                            {showCharge && (
                                <Line
                                    type="monotone" dataKey="charge" name="Charge"
                                    stroke={COLOR_CHARGE} strokeWidth={2} strokeDasharray="5 4" dot={false}
                                />
                            )}
                            <ReferenceLine
                                x={todayWeekLabel} stroke="#F59E0B" strokeDasharray="4 4"
                                label={{ value: 'Auj.', position: 'insideTopRight', fontSize: 10, fill: '#F59E0B' }}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>

                {/* Tableau */}
                <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'auto', maxHeight: 380 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#F9FAFB', position: 'sticky', top: 0, zIndex: 1, boxShadow: '0 1px 0 #E5E7EB' }}>
                            <tr>
                                <th rowSpan={2} style={th('left')}>Semaine</th>
                                <th rowSpan={2} style={th('right')}>Capacité (h)</th>
                                <th rowSpan={2} style={th('right', { color: COLOR_PLANIFIE })}>Planifié (h)</th>
                                <th rowSpan={2} style={th('right', { color: COLOR_CHARGE })}>Charge (h)</th>
                                <th colSpan={2} style={th('center', { color: COLOR_PLANIFIE, borderLeft: '1px solid #E5E7EB' })}>Planification</th>
                                <th colSpan={2} style={th('center', { color: COLOR_CHARGE, borderLeft: '1px solid #E5E7EB' })}>Occupation</th>
                            </tr>
                            <tr>
                                <th style={th('right', { borderLeft: '1px solid #E5E7EB' })}>Taux</th>
                                <th style={th('right')}>Écart</th>
                                <th style={th('right', { borderLeft: '1px solid #E5E7EB' })}>Taux</th>
                                <th style={th('right')}>Écart</th>
                            </tr>
                        </thead>
                        <tbody>
                            {chartData.map((row, i) => {
                                const ratePlan  = row.capa > 0 ? Math.round(row.planifie / row.capa * 100) : 0;
                                const rateChg   = row.capa > 0 ? Math.round(row.charge   / row.capa * 100) : 0;
                                const ecartPlan = Math.round((row.planifie - row.capa) * 10) / 10;
                                const ecartChg  = Math.round((row.charge   - row.capa) * 10) / 10;
                                const overPlan  = row.planifie > row.capa;
                                const overChg   = row.charge   > row.capa;
                                const isCurr  = row.weekLabel === todayWeekLabel;
                                const isSel   = selectedWeekData?.weekLabel === row.weekLabel;
                                return (
                                    <tr key={i} onClick={() => setSelectedWeekData(row)} style={{
                                        borderBottom: '1px solid #F3F4F6', cursor: 'pointer',
                                        background: isSel ? '#F0F9FF' : isCurr ? '#FFFBEB' : 'white',
                                    }}>
                                        <td style={{ padding: '9px 14px', fontSize: 12, fontWeight: isCurr ? 700 : 500 }}>
                                            {row.weekFullLabel}
                                            {isCurr && <span style={{ marginLeft: 6, fontSize: 9, background: '#F59E0B', color: 'white', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>ACTUEL</span>}
                                        </td>
                                        <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: 12, color: '#374151' }}>{row.capa}h</td>
                                        <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: overPlan ? '#EF4444' : COLOR_PLANIFIE }}>{row.planifie}h</td>
                                        <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: COLOR_CHARGE }}>{row.charge}h</td>
                                        <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: 12, borderLeft: '1px solid #F3F4F6' }}>
                                            <span style={{ fontWeight: 700, color: rateColor(ratePlan) }}>{ratePlan}%</span>
                                        </td>
                                        <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: overPlan ? '#EF4444' : '#10B981' }}>{overPlan ? `+${ecartPlan}` : ecartPlan}h</td>
                                        <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: 12, borderLeft: '1px solid #F3F4F6' }}>
                                            <span style={{ fontWeight: 700, color: rateColor(rateChg) }}>{rateChg}%</span>
                                        </td>
                                        <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: overChg ? '#EF4444' : '#10B981' }}>{overChg ? `+${ecartChg}` : ecartChg}h</td>
                                    </tr>
                                );
                            })}
                            {chartData.length === 0 && (
                                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>Aucune donnée sur cette période.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Panneau latéral détail semaine ── */}
            {selectedWeekData && (
                <div style={{ width: 320, borderLeft: '1px solid #E5E7EB', background: 'white', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{selectedWeekData.weekFullLabel}</div>
                            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
                                Capa {selectedWeekData.capa}h &nbsp;·&nbsp; Planifié {selectedWeekData.planifie}h &nbsp;·&nbsp; Consommé {selectedWeekData.charge}h
                            </div>
                            {selectedWeekData.planifie > selectedWeekData.capa && (
                                <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: '#EF4444' }}>
                                    Dépassement +{Math.round((selectedWeekData.planifie - selectedWeekData.capa) * 10) / 10}h
                                </div>
                            )}
                        </div>
                        <button onClick={() => setSelectedWeekData(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                            <X size={18} color="#9CA3AF" />
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
                        <ProjectBreakdown
                            title="Planifié"
                            items={selectedWeekData.plannedProjects}
                            total={selectedWeekData.planifie}
                            barColor={COLOR_PLANIFIE}
                            emptyText="Rien de planifié sur cette semaine."
                            overFn={(p) => Math.round(overPlanForProject(p.id) * 10) / 10}
                            overLabel="surplanifié"
                            overSuffix="au-delà du budget restant"
                        />
                        <ProjectBreakdown
                            title="Consommé"
                            items={selectedWeekData.projects}
                            total={selectedWeekData.charge}
                            barColor={COLOR_CHARGE}
                            emptyText="Rien de consommé sur cette semaine."
                            overFn={(p) => Math.round(overOccForProject(p.id) * 10) / 10}
                            overLabel="surconsommé"
                        />
                    </div>
                </div>
            )}

            {overModal && (() => {
                const isPlan = overModal === 'surplanif';
                const ids = new Set();
                chartData.forEach((row) => (isPlan ? row.plannedProjects : row.projects).forEach((p) => { if (p.id) ids.add(p.id); }));
                const nameById = new Map((projects || []).map((p) => [p.id, p.name]));
                const rows = [];
                ids.forEach((id) => {
                    const d = isPlan ? overPlanDetail(id) : overOccDetail(id);
                    if (d.over > 0) {
                        const h = projectHoursById[id];
                        // Détail par service (uniquement les ateliers sélectionnés en haut).
                        const services = selectedWorkshops.map((ws) => ({
                            key: ws,
                            label: WORKSHOP_CONFIG[ws]?.label || ws,
                            budget: h?.budget?.[ws] || 0,
                            consumed: h?.consumed?.[ws] || 0,
                            remaining: Math.max(0, (h?.budget?.[ws] || 0) - (h?.consumed?.[ws] || 0)),
                            planned: h?.planned?.[ws] || 0,
                        }));
                        rows.push({ id, name: nameById.get(id) || '—', a: isPlan ? d.planned : d.consumed, b: isPlan ? d.remaining : d.budget, over: d.over, services });
                    }
                });
                rows.sort((x, y) => y.over - x.over);
                return <OverModal type={overModal} rows={rows} onClose={() => setOverModal(null)} />;
            })()}
        </div>
    );
};

export default CapaciteView;
