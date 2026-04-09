import React, { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, eachWeekOfInterval, eachDayOfInterval, isWeekend, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { X } from 'lucide-react';
import {
    ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { useAuth } from '../../auth';

const WORK_HOURS_PER_DAY = 9;

const WORKSHOP_CONFIG = {
    conf:  { label: 'Confection',   color: '#3B82F6' },
    pose:  { label: 'Pose',         color: '#10B981' },
    prepa: { label: 'Préparation',  color: '#F59E0B' },
};

const CapaciteView = ({ localUsers, localEvents }) => {
    const today = new Date();
    const { currentUser } = useAuth();
    const isPoseTech = currentUser?.role === 'pose';

    const [selectedWorkshops, setSelectedWorkshops] = useState(isPoseTech ? ['pose'] : ['conf', 'pose', 'prepa']);
    const [rangeStart, setRangeStart] = useState(format(subMonths(today, 1), 'yyyy-MM-dd'));
    const [rangeEnd,   setRangeEnd]   = useState(format(addMonths(today, 2), 'yyyy-MM-dd'));
    const [selectedWeekData, setSelectedWeekData] = useState(null);

    const missions      = useMemo(() => localEvents.filter(e => e.type === 'mission'),  [localEvents]);
    const closures      = useMemo(() => localEvents.filter(e => e.type === 'closure'),  [localEvents]);
    const absences      = useMemo(() => localEvents.filter(e => e.type === 'absence'),  [localEvents]);
    const planningEvts  = useMemo(() => localEvents.filter(e =>
        e.type !== 'mission' && e.type !== 'closure' && e.type !== 'absence' &&
        e.resourceId !== 'backlog_confection'
    ), [localEvents]);

    const filteredUsers = useMemo(() =>
        localUsers.filter(u => selectedWorkshops.includes(u.role)),
        [localUsers, selectedWorkshops]
    );

    const weeks = useMemo(() => {
        const s = startOfWeek(new Date(rangeStart), { weekStartsOn: 1 });
        const e = startOfWeek(new Date(rangeEnd),   { weekStartsOn: 1 });
        if (s > e) return [];
        return eachWeekOfInterval({ start: s, end: e }, { weekStartsOn: 1 });
    }, [rangeStart, rangeEnd]);

    const isInterimActiveOnDay = (user, dayStr) => {
        if (!(user.first_name?.startsWith('Interim') || user.is_interim)) return true;
        return missions.some(m =>
            m.resourceId === user.id &&
            m.type === 'mission' &&
            m.meta?.status !== 'ended' &&
            format(new Date(m.meta.start), 'yyyy-MM-dd') <= dayStr &&
            (format(new Date(m.meta.end), 'yyyy-MM-dd') >= '2099' ||
             format(new Date(m.meta.end), 'yyyy-MM-dd') >= dayStr)
        );
    };

    const isClosureOnDay = (dayStr) =>
        closures.some(c =>
            format(new Date(c.meta.start), 'yyyy-MM-dd') <= dayStr &&
            format(new Date(c.meta.end),   'yyyy-MM-dd') >= dayStr
        );

    const absenceHoursOnDay = (userId, dayStr) => {
        return absences
            .filter(e => e.resourceId === userId && e.date === dayStr)
            .reduce((total, abs) => {
                if (!abs.meta?.start || !abs.meta?.end) return total + WORK_HOURS_PER_DAY;
                const sh = new Date(abs.meta.start).getHours() + new Date(abs.meta.start).getMinutes() / 60;
                const eh = new Date(abs.meta.end).getHours()   + new Date(abs.meta.end).getMinutes()   / 60;
                return total + Math.max(0, eh - sh);
            }, 0);
    };

    const eventHours = (evt) => {
        if (!evt.meta?.start || !evt.meta?.end) return 0;
        return Math.max(0, (new Date(evt.meta.end) - new Date(evt.meta.start)) / 3_600_000);
    };

    const chartData = useMemo(() => {
        const weekUserIds = new Set(filteredUsers.map(u => u.id));
        return weeks.map(weekStart => {
            const weekEnd  = endOfWeek(weekStart, { weekStartsOn: 1 });
            const workDays = eachDayOfInterval({ start: weekStart, end: weekEnd }).filter(d => !isWeekend(d));

            // ── Capacité ──
            let capaHours = 0;
            filteredUsers.forEach(user => {
                workDays.forEach(day => {
                    const dayStr = format(day, 'yyyy-MM-dd');
                    if (isClosureOnDay(dayStr)) return;
                    if (!isInterimActiveOnDay(user, dayStr)) return;
                    const absH = absenceHoursOnDay(user.id, dayStr);
                    capaHours += Math.max(0, WORK_HOURS_PER_DAY - absH);
                });
            });

            // ── Charge ──
            const weekStr    = format(weekStart, 'yyyy-MM-dd');
            const weekEndStr = format(weekEnd,   'yyyy-MM-dd');
            const weekEvts   = planningEvts.filter(e =>
                weekUserIds.has(e.resourceId) &&
                e.date >= weekStr && e.date <= weekEndStr
            );
            const chargeHours = weekEvts.reduce((s, e) => s + eventHours(e), 0);

            // ── Détail projets ──
            const projectMap = {};
            weekEvts.forEach(e => {
                const key = e.meta?.projectId || e.title || '—';
                if (!projectMap[key]) projectMap[key] = { name: e.title || '—', hours: 0 };
                projectMap[key].hours += eventHours(e);
            });

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
                capa:   Math.round(capaHours   * 10) / 10,
                charge: Math.round(chargeHours * 10) / 10,
                projects: Object.values(projectMap).sort((a, b) => b.hours - a.hours),
            };
        });
    }, [weeks, filteredUsers, planningEvts, missions, closures, absences]);

    const toggleWorkshop = (ws) => {
        setSelectedWorkshops(prev =>
            prev.includes(ws)
                ? prev.length > 1 ? prev.filter(w => w !== ws) : prev
                : [...prev, ws]
        );
    };

    const todayWeekLabel = `S${format(today, 'w')}`;

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
        const over = d.charge > d.capa;
        return (
            <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{d.weekFullLabel}</div>
                <div style={{ color: '#6B7280', marginBottom: 2 }}>Capacité : <strong>{d.capa}h</strong></div>
                <div style={{ fontWeight: 600, color: over ? '#EF4444' : '#10B981' }}>
                    Charge : {d.charge}h{over ? ` (+${Math.round((d.charge - d.capa) * 10) / 10}h)` : ''}
                </div>
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
                                    background: selectedWorkshops.includes(key) ? cfg.color : 'white',
                                    color:      selectedWorkshops.includes(key) ? 'white'   : '#6B7280',
                                    border:     `1px solid ${selectedWorkshops.includes(key) ? cfg.color : '#E5E7EB'}`,
                                }}>
                                    {cfg.label}
                                </button>
                            ))}
                        {!isPoseTech && (
                            <button onClick={() => setSelectedWorkshops(['conf', 'pose', 'prepa'])} style={{
                                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                background: selectedWorkshops.length === 3 ? '#111827' : 'white',
                                color:      selectedWorkshops.length === 3 ? 'white'   : '#6B7280',
                                border:     `1px solid ${selectedWorkshops.length === 3 ? '#111827' : '#E5E7EB'}`,
                            }}>
                                Tous
                            </button>
                        )}
                    </div>

                    {/* Sélecteur de période */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                        <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)}
                            style={{ padding: '5px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12 }} />
                        <span style={{ color: '#9CA3AF', fontSize: 12 }}>→</span>
                        <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)}
                            style={{ padding: '5px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12 }} />
                        <button onClick={() => {
                            setRangeStart(format(subMonths(today, 1), 'yyyy-MM-dd'));
                            setRangeEnd(format(addMonths(today, 2),   'yyyy-MM-dd'));
                        }} style={{ padding: '5px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: 'white', color: '#374151' }}>
                            Réinitialiser
                        </button>
                    </div>
                </div>

                {/* Courbe */}
                <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', padding: '20px 16px 8px' }}>
                    <ResponsiveContainer width="100%" height={300}>
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
                                fill="#EFF6FF" stroke="#3B82F6" strokeWidth={2} dot={false}
                            />
                            <Line
                                type="monotone" dataKey="charge" name="Charge planifiée"
                                stroke="#EF4444" strokeWidth={2.5}
                                activeDot={{ r: 8, cursor: 'pointer', onClick: (_, payload) => setSelectedWeekData(payload.payload) }}
                                dot={(props) => {
                                    const { cx, cy, payload } = props;
                                    return <circle key={`dot-${cx}`} cx={cx} cy={cy} r={4}
                                        fill={payload.charge > payload.capa ? '#EF4444' : '#10B981'}
                                        stroke="white" strokeWidth={1.5} />;
                                }}
                            />
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
                                {['Semaine', 'Capacité (h)', 'Charge (h)', 'Taux (%)', 'Écart (h)'].map((h, i) => (
                                    <th key={h} style={{ padding: '10px 16px', textAlign: i === 0 ? 'left' : 'right', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {chartData.map((row, i) => {
                                const rate    = row.capa > 0 ? Math.round(row.charge / row.capa * 100) : 0;
                                const over    = row.charge > row.capa;
                                const isCurr  = row.weekLabel === todayWeekLabel;
                                const isSel   = selectedWeekData?.weekLabel === row.weekLabel;
                                return (
                                    <tr key={i} onClick={() => setSelectedWeekData(row)} style={{
                                        borderBottom: '1px solid #F3F4F6', cursor: 'pointer',
                                        background: isSel ? '#F0F9FF' : isCurr ? '#FFFBEB' : 'white',
                                    }}>
                                        <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: isCurr ? 700 : 500 }}>
                                            {row.weekFullLabel}
                                            {isCurr && <span style={{ marginLeft: 6, fontSize: 9, background: '#F59E0B', color: 'white', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>ACTUEL</span>}
                                        </td>
                                        <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, color: '#374151' }}>{row.capa}h</td>
                                        <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: over ? '#EF4444' : '#374151' }}>{row.charge}h</td>
                                        <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12 }}>
                                            <span style={{ fontWeight: 700, color: rate > 100 ? '#EF4444' : rate > 80 ? '#F59E0B' : '#10B981' }}>{rate}%</span>
                                        </td>
                                        <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: over ? '#EF4444' : '#10B981' }}>
                                            {over ? `+${Math.round((row.charge - row.capa) * 10) / 10}h` : `${Math.round((row.charge - row.capa) * 10) / 10}h`}
                                        </td>
                                    </tr>
                                );
                            })}
                            {chartData.length === 0 && (
                                <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>Aucune donnée sur cette période.</td></tr>
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
                                Charge {selectedWeekData.charge}h &nbsp;/&nbsp; Capa {selectedWeekData.capa}h
                            </div>
                            {selectedWeekData.charge > selectedWeekData.capa && (
                                <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: '#EF4444' }}>
                                    Dépassement +{Math.round((selectedWeekData.charge - selectedWeekData.capa) * 10) / 10}h
                                </div>
                            )}
                        </div>
                        <button onClick={() => setSelectedWeekData(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                            <X size={18} color="#9CA3AF" />
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: 10 }}>
                            Projets planifiés ({selectedWeekData.projects.length})
                        </div>
                        {selectedWeekData.projects.length === 0 ? (
                            <div style={{ color: '#9CA3AF', fontSize: 12, textAlign: 'center', marginTop: 20 }}>Aucun projet planifié.</div>
                        ) : (
                            selectedWeekData.projects.map((p, i) => {
                                const pct = selectedWeekData.charge > 0 ? Math.round(p.hours / selectedWeekData.charge * 100) : 0;
                                return (
                                    <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                            <span style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{p.name}</span>
                                            <span style={{ fontWeight: 700, fontSize: 13, color: '#374151' }}>{Math.round(p.hours * 10) / 10}h</span>
                                        </div>
                                        <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2 }}>
                                            <div style={{ height: 4, width: `${pct}%`, background: '#3B82F6', borderRadius: 2 }} />
                                        </div>
                                        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{pct}% de la charge hebdo</div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CapaciteView;
