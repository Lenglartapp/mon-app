import React, { useMemo, useState } from 'react';
import { Box, Paper, Typography, LinearProgress } from '@mui/material';
import {
    TrendingUp, Layers, Package, Activity, ChevronDown
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { countRouleaux, rollsOf, totalCapacity, laizeBreakdown, misplacedRolls, laizeCm, GRANDE_LAIZE_CM } from '../../../lib/warehouse/occupancy';
import DaDialog from '../../ui/DaDialog';
import { STOCK_GROUPS, itemGroupOf } from '../../../lib/inventory/stockStatus';
import { DA_INPUT_STYLE } from '../../../lib/constants/daStyles';
import { DeliveryAlertsCard, DeliveryQualityCard, UpcomingArrivalsCard, DeliveryListDialog, CourseListDialog } from './DeliveryPanels';
import { useDeliveryAlerts, useDeliveryDialogs } from './useDeliveryAlerts';

// Couleurs de la Ventilation du stock (nuancier de la DA).
const GROUP_COLORS = { reserved: '#1B3269', active: '#4A6DB0', remnant: '#CEAB95', dead: '#BB7051' };

// Rouleaux en stock : règle partagée avec la Vue entrepôt (lib/warehouse/occupancy).
// Avant : un tissu sans pièce détaillée comptait 0 (tableau de pièces vide) et un article
// épuisé comptait encore → occupation faussée.

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
            background: 'var(--df-bg)', border: '1px solid var(--df-border)',
            borderRadius: 10, padding: '10px 16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        }}>
            <div style={{ fontSize: 12, color: 'var(--df-muted)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--df-primary-text)' }}>
                {payload[0].value}%
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--df-faint)', marginLeft: 6 }}>occupation</span>
            </div>
        </div>
    );
};

const fmtR = (n) => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString('fr-FR');

/** Capacité et occupation par type de zone : grandes laizes, petites laizes, non ventilé, total. */
function LaizeTable({ laize }) {
    const cell = { fontSize: 13, color: 'var(--df-text)', padding: '5px 0', whiteSpace: 'nowrap' };
    const num = { ...cell, textAlign: 'right' };
    const line = (r, bold) => (
        <tr key={r.key} title={r.key === 'none' ? 'Zones mixtes et tissus sans emplacement connu' : undefined} style={{ borderTop: bold ? '1px solid var(--df-border)' : 'none' }}>
            <td style={{ ...cell, fontWeight: bold ? 600 : 400 }}>{r.label}</td>
            <td style={{ ...num, fontWeight: bold ? 600 : 400 }}>{fmtR(r.rolls)} <span style={{ color: 'var(--df-faint)', fontWeight: 400 }}>/ {r.capacity ? fmtR(r.capacity) : '—'}</span></td>
            <td style={{ ...num, width: 52, fontWeight: 600, color: 'var(--df-text-2)' }}>{r.pct === null ? '—' : `${Math.round(r.pct * 100)} %`}</td>
        </tr>
    );
    return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Roboto, system-ui, sans-serif' }}>
            <thead>
                <tr>
                    <th style={{ textAlign: 'left', fontSize: 12, fontWeight: 500, color: 'var(--df-muted)', paddingBottom: 4 }}>Zones</th>
                    <th style={{ textAlign: 'right', fontSize: 12, fontWeight: 500, color: 'var(--df-muted)', paddingBottom: 4 }}>Rouleaux / capacité</th>
                    <th />
                </tr>
            </thead>
            <tbody>
                {laize.rows.map(r => line(r, false))}
                {line({ key: 'total', label: 'Total', ...laize.total }, true)}
            </tbody>
        </table>
    );
}

/** Tissus rangés dans une zone qui n'est pas de leur laize (information, rien n'est bloqué). */
function MisplacedDialog({ open, onClose, misplaced }) {
    const label = { grande: 'zone grandes laizes', petite: 'zone petites laizes' };
    return (
        <DaDialog open={open} onClose={onClose} title="Rangement à vérifier"
            subtitle={`Grande laize = ${GRANDE_LAIZE_CM} cm et plus · ${fmtR(misplaced.grandeInPetite)} rlx de grande laize en zone petite, ${fmtR(misplaced.petiteInGrande)} rlx de petite laize en zone grande`}
            maxWidth="md" height="70vh">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {misplaced.entries.map((e, i) => (
                    <div key={`${e.item.id}-${e.code}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 8, background: i % 2 === 0 ? 'var(--df-surface-5)' : 'transparent' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--df-text)', width: 44, flexShrink: 0 }}>{e.code}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, color: 'var(--df-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[e.item.fournisseur, e.item.ref || e.item.product, e.item.coloris].filter(Boolean).join(' · ')}</div>
                            <div style={{ fontSize: 12, color: 'var(--df-muted)' }}>{e.item.project || 'Stock libre'}</div>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--df-text-2)', whiteSpace: 'nowrap' }}>laize {fmtR(laizeCm(e.item.laize))} cm · {label[e.zoneType]}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--df-text)', whiteSpace: 'nowrap', width: 56, textAlign: 'right' }}>{fmtR(e.rolls)} rlx</span>
                    </div>
                ))}
            </div>
        </DaDialog>
    );
}

// Chapitre repliable (état mémorisé sur l'appareil).
function Chapter({ id, label, children }) {
    const key = `df_stock_dash_${id}_open`;
    const [open, setOpen] = useState(() => { try { return window.localStorage.getItem(key) !== '0'; } catch { return true; } });
    const toggle = () => setOpen((o) => { try { window.localStorage.setItem(key, o ? '0' : '1'); } catch { /* stockage indisponible */ } return !o; });
    return (
        <section style={{ marginBottom: 28 }}>
            <button type="button" onClick={toggle} aria-expanded={open}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '4px 0', marginBottom: open ? 12 : 0, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Roboto, system-ui, sans-serif', textAlign: 'left' }}>
                <ChevronDown size={18} color="var(--df-text-2)" style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s ease', flexShrink: 0 }} />
                <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--df-text)' }}>{label}</span>
            </button>
            {open && children}
        </section>
    );
}

// Rangée de 3 cartes de même largeur et même hauteur (les listes défilent dans la carte).
const ROW = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gridAutoRows: '420px', gap: 20 };

const TENSION = {
    critique: { color: '#DC2626', text: 'Critique : moins de 15 % libre' },
    attention: { color: '#D97706', text: 'Attention : moins de 30 % libre' },
    ok: { color: '#059669', text: 'Capacité suffisante' },
};

export default function StockDashboardTab({ inventory = [], projects = [], movements = [], zones = [], events = [], onOpenStock }) {
    // Livraisons de tissus (liste de courses Odoo, tous projets) : relues à chaque ouverture du tableau de bord.
    const delivery = useDeliveryAlerts(projects, events);
    const dialogs = useDeliveryDialogs();

    const defaultTo = new Date();
    // Par défaut : le dernier trimestre (13 semaines), une graduation par semaine
    const defaultFrom = new Date(); defaultFrom.setDate(defaultFrom.getDate() - 12 * 7);
    const [dateFrom, setDateFrom] = useState(toInputDate(defaultFrom));
    const [dateTo, setDateTo] = useState(toInputDate(defaultTo));
    const [misplacedOpen, setMisplacedOpen] = useState(false);

    const stats = useMemo(() => {
        // Capacité saisie par emplacement (warehouse_zones), palettes converties selon la laize
        const capacite = totalCapacity(zones);
        const rouleauxEnStock = countRouleaux(inventory);
        const occupancyPct = capacite > 0 ? Math.min(Math.round((rouleauxEnStock / capacite) * 100), 100) : 0;

        // Ventilation du stock de tissu actuel (atelier compris), par famille de statut :
        // mêmes statuts que la colonne Statut de l'inventaire.
        const isMlUnit = (u) => String(u || '').trim().toLowerCase() === 'ml';
        const groups = Object.fromEntries(STOCK_GROUPS.map(g => [g.key, { rolls: 0, ml: 0 }]));
        inventory.forEach(item => {
            const rolls = rollsOf(item);
            if (!rolls) return;
            const g = groups[itemGroupOf(item, projects)];
            g.rolls += rolls;
            if (isMlUnit(item.unit)) g.ml += Number(item.qty) || 0;
        });
        const groupRolls = Object.values(groups).reduce((s, g) => s + g.rolls, 0);

        const freeRouleaux = Math.max(0, capacite - rouleauxEnStock);
        const tensionLevel = freeRouleaux < capacite * 0.15 ? 'critique'
            : freeRouleaux < capacite * 0.30 ? 'attention' : 'ok';

        // Top 10 des tissus en mètres ; leur part se calcule sur les mètres de tissu en stock
        // (avant : mètres ÷ nombre de rouleaux → parts de 258 %).
        const isMl = (u) => String(u || '').trim().toLowerCase() === 'ml';
        const fabrics = inventory.filter(i => isMl(i.unit) && Number(i.qty) > 0);
        const mlTotal = fabrics.reduce((s, i) => s + Number(i.qty), 0);
        const top10 = [...fabrics]
            .sort((a, b) => (Number(b.qty) || 0) - (Number(a.qty) || 0))
            .slice(0, 10);

        return {
            rouleauxEnStock, capacite, occupancyPct, groups, groupRolls, freeRouleaux,
            tensionLevel, top10, mlTotal,
            zonesLoaded: capacite > 0,
            laize: laizeBreakdown(inventory, zones),
            misplaced: misplacedRolls(inventory, zones),
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

        // Historique reconstruit en MÈTRES de tissu (les mouvements sont en ml) puis ramené
        // au taux d'occupation actuel. Avant : on retirait des mètres d'un nombre de
        // ROULEAUX (163 rouleaux − 5 000 ml…) → taux fortement négatifs.
        const isMl = (u) => String(u || '').trim().toLowerCase() === 'ml';
        movements.forEach(m => {
            if (!isMl(m.unit)) return;
            const date = new Date(m.date || m.created_at);
            if (isNaN(date)) return;
            const w = weeks.find(w => date >= w.weekStart && date < w.weekEnd);
            if (!w) return;
            const qty = Number(m.qty) || 0;
            if (m.type === 'IN') w.netChange += qty;
            else if (m.type === 'OUT') w.netChange -= qty;
        });

        const mlNow = inventory.reduce((s, i) => s + (isMl(i.unit) && Number(i.qty) > 0 ? Number(i.qty) : 0), 0);
        const occNow = stats.capacite > 0 ? Math.min(stats.rouleauxEnStock / stats.capacite, 1) : 0;
        let running = mlNow;
        return [...weeks].reverse().map(w => {
            // Taux de la semaine = taux actuel × (mètres en stock cette semaine-là / mètres aujourd'hui).
            // Borné à 0–100 % : avant le début du suivi (mars 2026), une partie du stock n'a pas
            // d'entrée au journal et le calcul passerait sous zéro.
            const occ = mlNow > 0 ? Math.max(0, Math.min(Math.round(occNow * (running / mlNow) * 100), 100)) : 0;
            running -= w.netChange;
            return { weekStart: w.weekStart, label: w.weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), occupancy: occ };
        }).reverse();
    }, [movements, inventory, stats.rouleauxEnStock, stats.capacite]);

    const filteredWeeklyData = useMemo(() => {
        const from = new Date(dateFrom);
        const to = new Date(dateTo); to.setHours(23, 59, 59);
        return allWeeklyData.filter(d => d.weekStart >= from && d.weekStart <= to);
    }, [allWeeklyData, dateFrom, dateTo]);

    const xInterval = Math.max(0, Math.floor(filteredWeeklyData.length / 10) - 1);

    const card = {
        background: 'var(--df-bg)', borderRadius: 16, padding: 20, height: '100%',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
    };

    // Titres des tuiles : Roboto, sans majuscules, comme les titres de sections du chiffrage / projet
    const title = {
        fontSize: 16, fontWeight: 500, color: 'var(--df-text)', fontFamily: 'Roboto, system-ui, sans-serif',
        marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
    };

    const occupancyColor = stats.occupancyPct >= 85 ? 'var(--df-danger)'
        : stats.occupancyPct >= 70 ? '#F59E0B' : 'var(--df-primary)';

    return (
        <div style={{ width: '100%', boxSizing: 'border-box' }}>

            {/* ── CHAPITRE 1 : l'entrepôt aujourd'hui ── */}
            <Chapter id="now" label="État actuel">
                <div className="df-inv-kpis" style={{ ...ROW, marginBottom: 20 }}>

                {/* Occupation générale */}
                <div style={card}>
                    <div style={title}><Activity size={14} color="var(--df-blue)" /> Occupation générale</div>
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                                <svg width="104" height="104" viewBox="0 0 130 130">
                                    <circle cx="65" cy="65" r="56" fill="none" stroke="var(--df-surface-2)" strokeWidth="10" />
                                    <circle cx="65" cy="65" r="56" fill="none" stroke={occupancyColor}
                                        strokeWidth="10" strokeDasharray={352}
                                        strokeDashoffset={352 - (352 * stats.occupancyPct) / 100}
                                        strokeLinecap="round" transform="rotate(-90 65 65)"
                                        style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                                    />
                                </svg>
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: 800, fontSize: 24, color: occupancyColor, lineHeight: 1 }}>{stats.zonesLoaded ? `${stats.occupancyPct}%` : '—'}</span>
                                    <span style={{ fontSize: 12, color: 'var(--df-faint)', fontWeight: 500 }}>plein</span>
                                </div>
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, color: 'var(--df-muted)' }}>
                                    <strong style={{ color: 'var(--df-text)' }}>{fmtR(stats.rouleauxEnStock)}</strong>
                                    {' '}/ <strong style={{ color: 'var(--df-text)' }}>{stats.zonesLoaded ? fmtR(stats.capacite) : '—'}</strong> rouleaux
                                </div>
                                <div style={{ fontWeight: 700, fontSize: 14, marginTop: 6, color: 'var(--df-text)' }}>
                                    {stats.zonesLoaded ? `${fmtR(stats.freeRouleaux)} rouleaux libres` : 'Capacité non définie'}
                                </div>
                                {stats.zonesLoaded && (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 12, color: 'var(--df-text-2)' }}>
                                        <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: TENSION[stats.tensionLevel].color, flexShrink: 0 }} />
                                        {TENSION[stats.tensionLevel].text}
                                    </div>
                                )}
                            </div>
                        </div>
                        <LaizeTable laize={stats.laize} />
                        {stats.misplaced.rolls > 0 && (
                            <button type="button" onClick={() => setMisplacedOpen(true)} title="Voir les tissus concernés"
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '1px dashed var(--df-border)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: 'var(--df-text)', textAlign: 'left' }}>
                                <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: '#D97706', flexShrink: 0 }} />
                                <span><strong>{fmtR(stats.misplaced.rolls)} rouleau{stats.misplaced.rolls > 1 ? 'x' : ''} mal rangé{stats.misplaced.rolls > 1 ? 's' : ''}</strong> (laize ≠ zone)</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Ventilation du stock */}
                <div style={card}>
                    <div style={title}><Layers size={14} color="#9333EA" /> Ventilation du stock</div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
                        {STOCK_GROUPS.map((g) => {
                            const { rolls, ml } = stats.groups[g.key];
                            const pct = stats.groupRolls > 0 ? Math.round((rolls / stats.groupRolls) * 100) : 0;
                            return (
                                <div
                                    key={g.key}
                                    title={onOpenStock ? `${g.hint} — double-clic pour voir ce stock` : g.hint}
                                    onDoubleClick={onOpenStock ? () => onOpenStock({ group: g.key, sortByQty: true }) : undefined}
                                    style={{ cursor: onOpenStock ? 'pointer' : 'default', userSelect: 'none' }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'baseline', gap: 8 }}>
                                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--df-text)', fontFamily: 'Roboto, system-ui, sans-serif' }}>{g.label}</span>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--df-text)', whiteSpace: 'nowrap' }}>
                                            {pct}%{' '}
                                            <span style={{ color: 'var(--df-faint)', fontWeight: 400, fontSize: 11 }}>
                                                {rolls.toLocaleString('fr-FR')} rlx · {Math.round(ml).toLocaleString('fr-FR')} ml
                                            </span>
                                        </span>
                                    </div>
                                    <LinearProgress variant="determinate" value={pct} sx={{
                                        height: 7, borderRadius: 4, bgcolor: 'var(--df-surface-2)',
                                        '& .MuiLinearProgress-bar': { bgcolor: GROUP_COLORS[g.key], borderRadius: 4 }
                                    }} />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Top 10 compact */}
                <div style={card}>
                    <div style={title}><Package size={14} color="var(--df-text)" /> Top 10 occupation</div>
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {stats.top10.map((item, i) => {
                            const pct = stats.mlTotal > 0 ? Math.round((Number(item.qty) / stats.mlTotal) * 100) : 0;
                            return (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '7px 10px', borderRadius: 8,
                                    background: i % 2 === 0 ? 'var(--df-surface-5)' : 'transparent',
                                }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--df-faint)', width: 18, flexShrink: 0 }}>{i + 1}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--df-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {item.product || 'N/A'}
                                        </div>
                                        {(() => {
                                            const g = STOCK_GROUPS.find((x) => x.key === itemGroupOf(item, projects));
                                            return (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--df-muted)', minWidth: 0 }}>
                                                    {g && (
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, color: 'var(--df-text-2)', fontWeight: 500 }}>
                                                            <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: GROUP_COLORS[g.key] }} />{g.label}
                                                        </span>
                                                    )}
                                                    {item.project && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>· {item.project}</span>}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--df-text)' }}>{Number(item.qty).toLocaleString('fr-FR')} <span style={{ fontWeight: 400, color: 'var(--df-muted)' }}>ml</span></div>
                                        <div style={{ fontSize: 10, color: 'var(--df-faint)' }}>{pct}%</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                </div>

                {/* Courbe pleine largeur */}
            <div style={{ ...card, padding: '24px 28px', height: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                    <div style={title}>
                        <TrendingUp size={14} color="#7C3AED" />
                        Taux d'occupation hebdomadaire
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        {/* Période : mêmes champs date que le planning (Capacité), sans libellé flottant */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                                type="date" aria-label="Du" value={dateFrom} max={dateTo}
                                onChange={e => setDateFrom(e.target.value)}
                                style={{ ...DA_INPUT_STYLE, width: 'auto', height: 30, fontSize: 12, padding: '0 8px' }}
                            />
                            <span style={{ color: 'var(--df-faint-2)', fontSize: 13 }}>→</span>
                            <input
                                type="date" aria-label="Au" value={dateTo} min={dateFrom} max={toInputDate(new Date())}
                                onChange={e => setDateTo(e.target.value)}
                                style={{ ...DA_INPUT_STYLE, width: 'auto', height: 30, fontSize: 12, padding: '0 8px' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 16, marginLeft: 8 }}>
                            {[
                                { color: 'var(--df-danger)', label: 'Critique (>85%)' },
                                { color: '#F59E0B', label: 'Attention (>70%)' },
                            ].map((l, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke={l.color} strokeWidth="2" strokeDasharray="4 3" /></svg>
                                    <span style={{ fontSize: 11, color: 'var(--df-faint)' }}>{l.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {filteredWeeklyData.length > 0 ? (
                    <div style={{ width: '100%', height: 240 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={filteredWeeklyData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--df-surface-2)" vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--df-faint)' }} tickLine={false} axisLine={false} interval={xInterval} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--df-faint)' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} width={44} />
                                <Tooltip content={<CustomTooltip />} />
                                <ReferenceLine y={85} stroke="var(--df-danger)" strokeDasharray="4 4" strokeOpacity={0.45}
                                    label={{ value: 'Critique', position: 'right', fontSize: 10, fill: 'var(--df-danger)' }} />
                                <ReferenceLine y={70} stroke="#F59E0B" strokeDasharray="4 4" strokeOpacity={0.45}
                                    label={{ value: 'Attention', position: 'right', fontSize: 10, fill: '#F59E0B' }} />
                                <Line type="monotone" dataKey="occupancy" stroke="var(--df-primary)" strokeWidth={2.5}
                                    dot={false} activeDot={{ r: 5, fill: 'var(--df-primary)', stroke: 'white', strokeWidth: 2 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.35 }}>
                        <span style={{ fontSize: 14 }}>Aucune donnée sur cette période.</span>
                    </div>
                )}
            </div>
            </Chapter>

            {/* ── CHAPITRE 2 : livraisons de tissus à venir (liste de courses Odoo) ── */}
            <Chapter id="next" label="À venir">
                <div className="df-inv-kpis" style={ROW}>
                    <UpcomingArrivalsCard state={delivery} card={card} title={title} onOpenList={dialogs.openList} onOpenItem={dialogs.openItem} />
                    <DeliveryQualityCard state={delivery} card={card} title={title} onOpenList={dialogs.openList} />
                    <DeliveryAlertsCard state={delivery} card={card} title={title} onOpenList={dialogs.openList} onOpenItem={dialogs.openItem} />
                </div>
            </Chapter>

            <MisplacedDialog open={misplacedOpen} onClose={() => setMisplacedOpen(false)} misplaced={stats.misplaced} />
            <DeliveryListDialog
                open={!!dialogs.listFilter} filter={dialogs.listFilter} onFilter={dialogs.setListFilter}
                onClose={() => dialogs.setListFilter(null)} state={delivery} onOpenItem={dialogs.openItem}
            />
            <CourseListDialog project={dialogs.courseProject} onClose={() => dialogs.setCourseProject(null)} />
        </div>
    );
}
