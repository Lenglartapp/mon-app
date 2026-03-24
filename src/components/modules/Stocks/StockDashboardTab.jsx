import React, { useMemo, useState } from 'react';
import { Box, Paper, Typography, LinearProgress, TextField } from '@mui/material';
import {
    AlertTriangle, TrendingUp, Layers, Package,
    CheckCircle2, Clock, Activity, ArrowUpRight
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

const PALETTE_TO_ROULEAUX = 10;

const computeTotalCapacity = (zones) => {
    if (!zones || zones.length === 0) return 0;
    return zones.reduce((acc, z) => {
        if (!z.capacite) return acc;
        if (z.type === 'palettes') return acc + z.capacite * PALETTE_TO_ROULEAUX;
        if (z.type === 'rouleaux' || z.type === 'reception') return acc + z.capacite;
        return acc;
    }, 0);
};

const countRouleaux = (inventory) =>
    inventory.reduce((acc, item) => {
        if (item.category !== 'Tissu') return acc;
        return acc + (Array.isArray(item.pieces) ? item.pieces.length : 1);
    }, 0);

const getISOWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1) - day);
    d.setHours(0, 0, 0, 0);
    return d;
};

const toInputDate = (date) => date.toISOString().split('T')[0];

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: 'white', border: '1px solid #E5E7EB',
            borderRadius: 10, padding: '10px 16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        }}>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1E2447' }}>
                {payload[0].value}%
                <span style={{ fontSize: 12, fontWeight: 400, color: '#9CA3AF', marginLeft: 6 }}>occupation</span>
            </div>
        </div>
    );
};

export default function StockDashboardTab({ inventory = [], projects = [], movements = [], zones = [] }) {

    const defaultTo = new Date();
    const defaultFrom = new Date(); defaultFrom.setDate(defaultFrom.getDate() - 51 * 7);
    const [dateFrom, setDateFrom] = useState(toInputDate(defaultFrom));
    const [dateTo, setDateTo] = useState(toInputDate(defaultTo));

    const stats = useMemo(() => {
        const totalCapacity = computeTotalCapacity(zones);
        const capacite = totalCapacity > 0 ? totalCapacity : 790;
        const rouleauxEnStock = countRouleaux(inventory);
        const occupancyPct = capacite > 0 ? Math.min(Math.round((rouleauxEnStock / capacite) * 100), 100) : 0;

        let reserved = 0, deadStock = 0;
        inventory.forEach(item => {
            if (item.category !== 'Tissu') return;
            const q = Array.isArray(item.pieces) ? item.pieces.length : 1;
            const proj = item.project ? projects.find(p => p.name === item.project) : null;
            if (proj?.status === 'ARCHIVED') deadStock += q;
            else if (item.project) reserved += q;
            else if (item.location?.toLowerCase().includes('mort')) deadStock += q;
        });

        const freeRouleaux = Math.max(0, capacite - rouleauxEnStock);
        const tensionLevel = freeRouleaux < capacite * 0.15 ? 'critique'
            : freeRouleaux < capacite * 0.30 ? 'attention' : 'ok';

        const top10 = [...inventory]
            .sort((a, b) => (Number(b.qty) || 0) - (Number(a.qty) || 0))
            .slice(0, 10);

        const activeWithoutStock = projects.filter(p => {
            if (['DONE', 'ARCHIVED', 'Livré'].includes(p.status)) return false;
            return !inventory.some(i => i.project === p.name);
        });

        return {
            rouleauxEnStock, capacite, occupancyPct, reserved, deadStock, freeRouleaux,
            tensionLevel, top10, tensionAlerts: activeWithoutStock.slice(0, 3),
            zonesLoaded: totalCapacity > 0,
        };
    }, [inventory, projects, zones]);

    const allWeeklyData = useMemo(() => {
        const now = new Date();
        const weeks = Array.from({ length: 52 }, (_, i) => {
            const ref = new Date(now);
            ref.setDate(ref.getDate() - (51 - i) * 7);
            const weekStart = getISOWeekStart(ref);
            const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
            return { weekStart, weekEnd, netChange: 0 };
        });

        movements.forEach(m => {
            const date = new Date(m.date || m.created_at);
            if (isNaN(date)) return;
            const w = weeks.find(w => date >= w.weekStart && date < w.weekEnd);
            if (!w) return;
            const qty = Number(m.qty) || 1;
            if (m.type === 'IN') w.netChange += qty;
            else if (m.type === 'OUT') w.netChange -= qty;
        });

        let running = stats.rouleauxEnStock;
        return [...weeks].reverse().map(w => {
            const occ = stats.capacite > 0 ? Math.min(Math.round((running / stats.capacite) * 100), 100) : 0;
            running -= w.netChange;
            return { weekStart: w.weekStart, label: w.weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), occupancy: occ };
        }).reverse();
    }, [movements, stats.rouleauxEnStock, stats.capacite]);

    const filteredWeeklyData = useMemo(() => {
        const from = new Date(dateFrom);
        const to = new Date(dateTo); to.setHours(23, 59, 59);
        return allWeeklyData.filter(d => d.weekStart >= from && d.weekStart <= to);
    }, [allWeeklyData, dateFrom, dateTo]);

    const xInterval = Math.max(0, Math.floor(filteredWeeklyData.length / 10) - 1);

    const card = {
        background: 'white', borderRadius: 16, padding: 20, height: '100%',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
    };

    const title = {
        fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase',
        letterSpacing: '0.07em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6,
    };

    const occupancyColor = stats.occupancyPct >= 85 ? '#EF4444'
        : stats.occupancyPct >= 70 ? '#F59E0B' : '#1E2447';

    return (
        <div style={{ width: '100%', boxSizing: 'border-box' }}>

            {/* ── LIGNE 1 : 4 blocs égaux ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 20 }}>

                {/* Occupation générale */}
                <div style={card}>
                    <div style={title}><Activity size={14} color="#2563EB" /> Occupation Générale</div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                        <div style={{ position: 'relative', display: 'inline-flex' }}>
                            <svg width="130" height="130" viewBox="0 0 130 130">
                                <circle cx="65" cy="65" r="56" fill="none" stroke="#F3F4F6" strokeWidth="10" />
                                <circle cx="65" cy="65" r="56" fill="none" stroke={occupancyColor}
                                    strokeWidth="10" strokeDasharray={352}
                                    strokeDashoffset={352 - (352 * stats.occupancyPct) / 100}
                                    strokeLinecap="round" transform="rotate(-90 65 65)"
                                    style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                                />
                            </svg>
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 800, fontSize: 28, color: occupancyColor, lineHeight: 1 }}>{stats.occupancyPct}%</span>
                                <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.08em' }}>PLEIN</span>
                            </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 12, color: '#6B7280' }}>
                                <strong style={{ color: '#111827' }}>{stats.rouleauxEnStock.toLocaleString()}</strong>
                                {' '}/ <strong style={{ color: '#111827' }}>{stats.capacite.toLocaleString()}</strong> rouleaux
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4, color: stats.freeRouleaux < 50 ? '#EF4444' : '#10B981' }}>
                                {stats.freeRouleaux} libres
                            </div>
                        </div>
                    </div>
                </div>

                {/* Ventilation du stock */}
                <div style={card}>
                    <div style={title}><Layers size={14} color="#9333EA" /> Ventilation du Stock</div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
                        {[
                            { label: 'Réservé (projets)', val: stats.reserved, color: '#1E2447', icon: <CheckCircle2 size={13} /> },
                            { label: 'Stock Mort', val: stats.deadStock, color: '#EF4444', icon: <Clock size={13} /> },
                            { label: 'Emplacements libres', val: stats.freeRouleaux, color: '#10B981', icon: <TrendingUp size={13} /> },
                        ].map((item, i) => {
                            const pct = Math.round((item.val / stats.capacite) * 100);
                            return (
                                <div key={i}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ color: item.color }}>{item.icon}</span>{item.label}
                                        </span>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
                                            {pct}% <span style={{ color: '#9CA3AF', fontWeight: 400, fontSize: 11 }}>({item.val})</span>
                                        </span>
                                    </div>
                                    <LinearProgress variant="determinate" value={pct} sx={{
                                        height: 7, borderRadius: 4, bgcolor: '#F3F4F6',
                                        '& .MuiLinearProgress-bar': { bgcolor: item.color, borderRadius: 4 }
                                    }} />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Alertes de tension */}
                <div style={card}>
                    <div style={title}>
                        <AlertTriangle size={14} color={stats.tensionLevel === 'critique' ? '#EF4444' : '#F59E0B'} />
                        Alertes de Tension
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{
                            padding: 12, borderRadius: 10,
                            background: stats.tensionLevel === 'critique' ? '#FEF2F2' : stats.tensionLevel === 'attention' ? '#FFFBEB' : '#F0FDF4',
                            border: `1px solid ${stats.tensionLevel === 'critique' ? '#FECACA' : stats.tensionLevel === 'attention' ? '#FEF3C7' : '#BBF7D0'}`,
                        }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Espace libre entrepôt
                            </div>
                            <div style={{ fontWeight: 800, fontSize: 22, marginTop: 2, color: stats.tensionLevel === 'critique' ? '#DC2626' : stats.tensionLevel === 'attention' ? '#D97706' : '#059669' }}>
                                {stats.freeRouleaux} rouleaux
                            </div>
                            <div style={{ fontSize: 11, color: '#6B7280' }}>
                                {stats.tensionLevel === 'critique' ? '⚠️ Critique — <15% libre'
                                    : stats.tensionLevel === 'attention' ? '⚡ Attention — <30% libre'
                                    : '✅ Capacité suffisante'}
                            </div>
                        </div>
                        {stats.tensionAlerts.length > 0 ? (
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', marginBottom: 8 }}>
                                    PROJETS SANS STOCK
                                </div>
                                {stats.tensionAlerts.map((p, i) => (
                                    <div key={i} style={{ padding: '8px 10px', marginBottom: 6, background: '#FFFBEB', border: '1px solid #FEF3C7', borderRadius: 8 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>{p.nom || p.name || `Projet #${p.id}`}</span>
                                            <ArrowUpRight size={13} color="#B45309" />
                                        </div>
                                        <div style={{ fontSize: 11, color: '#B45309' }}>Tissu non réceptionné</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.35 }}>
                                <CheckCircle2 size={28} style={{ marginBottom: 6 }} />
                                <span style={{ fontSize: 12 }}>Aucun projet en attente.</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Top 10 compact */}
                <div style={card}>
                    <div style={title}><Package size={14} color="#111827" /> Top 10 par Occupation</div>
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {stats.top10.map((item, i) => {
                            const pct = stats.rouleauxEnStock > 0 ? Math.round((Number(item.qty) / stats.rouleauxEnStock) * 100) : 0;
                            return (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '7px 10px', borderRadius: 8,
                                    background: i % 2 === 0 ? '#FAFAFA' : 'transparent',
                                }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', width: 18, flexShrink: 0 }}>{i + 1}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {item.product || 'N/A'}
                                        </div>
                                        {item.project && (
                                            <div style={{ fontSize: 10, color: '#1E40AF', fontWeight: 600 }}>{item.project}</div>
                                        )}
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{Number(item.qty).toLocaleString()}</div>
                                        <div style={{ fontSize: 10, color: '#9CA3AF' }}>{pct}%</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── LIGNE 2 : Courbe pleine largeur ── */}
            <div style={{ ...card, padding: '24px 28px', height: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                    <div style={title}>
                        <TrendingUp size={14} color="#7C3AED" />
                        Taux d'Occupation Hebdomadaire
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <TextField
                            type="date" size="small" label="Du"
                            value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            inputProps={{ max: dateTo }}
                            sx={{ width: 155, '& .MuiInputBase-input': { fontSize: '13px' } }}
                        />
                        <TextField
                            type="date" size="small" label="Au"
                            value={dateTo} onChange={e => setDateTo(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            inputProps={{ min: dateFrom, max: toInputDate(new Date()) }}
                            sx={{ width: 155, '& .MuiInputBase-input': { fontSize: '13px' } }}
                        />
                        <div style={{ display: 'flex', gap: 16, marginLeft: 8 }}>
                            {[
                                { color: '#EF4444', label: 'Critique (>85%)' },
                                { color: '#F59E0B', label: 'Attention (>70%)' },
                            ].map((l, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke={l.color} strokeWidth="2" strokeDasharray="4 3" /></svg>
                                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{l.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {filteredWeeklyData.length > 0 ? (
                    <div style={{ width: '100%', height: 240 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={filteredWeeklyData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} interval={xInterval} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} width={44} />
                                <Tooltip content={<CustomTooltip />} />
                                <ReferenceLine y={85} stroke="#EF4444" strokeDasharray="4 4" strokeOpacity={0.45}
                                    label={{ value: 'Critique', position: 'right', fontSize: 10, fill: '#EF4444' }} />
                                <ReferenceLine y={70} stroke="#F59E0B" strokeDasharray="4 4" strokeOpacity={0.45}
                                    label={{ value: 'Attention', position: 'right', fontSize: 10, fill: '#F59E0B' }} />
                                <Line type="monotone" dataKey="occupancy" stroke="#1E2447" strokeWidth={2.5}
                                    dot={false} activeDot={{ r: 5, fill: '#1E2447', stroke: 'white', strokeWidth: 2 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.35 }}>
                        <span style={{ fontSize: 14 }}>Aucune donnée sur cette période.</span>
                    </div>
                )}
            </div>

        </div>
    );
}
