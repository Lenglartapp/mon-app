import React, { useState, useMemo } from 'react';
import { calculateProfitability, calculateTargetCA } from '../../../lib/financial/profitabilityCalculator';
import ProfitabilitySimulatorModal from './ProfitabilitySimulatorModal';
import { COLORS, S } from '../../../lib/constants/ui';

// Formatters
const nfEur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const pct = (val) => `${Math.round(val || 0)} %`;

export default function MoulinetteView({ rows, depRows, extraRows }) {
    const data = useMemo(() => calculateProfitability(rows, depRows, extraRows), [rows, depRows, extraRows]);
    const [showSimulator, setShowSimulator] = useState(false);

    return (
        <div style={{ position: 'relative' }}>
            {/* STICKY HEADER DASHBOARD */}
            <div style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                background: '#f9fafb',
                paddingBottom: 20,
                borderBottom: `1px solid ${COLORS.border}`,
                marginBottom: 20,
                backgroundColor: "#F3F4F6"
            }}>
                <Dashboard data={data} onOpenSimulator={() => setShowSimulator(true)} />
            </div>

            <div style={{ display: "grid", gap: 16 }}>
                {/* SECTION 1: ACHATS FIXES */}
                <ExpandableCard
                    title="ACHATS FIXES (Matières)"
                    amount={data.achats_fixes_details.total}
                    defaultOpen={true}
                >
                    <DetailGroup title="Tissus & Doublures" items={data.achats_fixes_details.tissus} />
                    <DetailGroup title="Rails & Mécanismes" items={data.achats_fixes_details.rails} />
                </ExpandableCard>

                {/* SECTION 2: CHARGES VARIABLES */}
                <ExpandableCard
                    title="CHARGES VARIABLES"
                    amount={data.charges_details.total}
                    defaultOpen={true}
                >
                    <ChargesTable details={data.charges_details} />
                </ExpandableCard>

                {/* SECTION 3: HEURES DE PRODUCTION */}
                <ExpandableCard
                    title="HEURES DE PRODUCTION"
                    amount={data.hours_details.total}
                    amountSuffix="h"
                    defaultOpen={true}
                >
                    <HoursTable details={data.hours_details} />
                </ExpandableCard>
            </div>

            {/* SIMULATOR MODAL */}
            {showSimulator && (
                <ProfitabilitySimulatorModal
                    currentData={data}
                    onClose={() => setShowSimulator(false)}
                />
            )}
        </div>
    );
}

// —————————————————————————————————————————————————————————
// COMPONENTS
// —————————————————————————————————————————————————————————

function Dashboard({ data, onOpenSimulator }) {
    const { kpis } = data;
    return (
        <div style={{
            background: 'white',
            borderRadius: 12,
            padding: 16,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr) auto',
            gap: 16,
            alignItems: 'center'
        }}>
            <KPI label="CA Total" value={nfEur0.format(kpis.ca_total)} size="lg" />

            <KPI
                label="Marge Brute"
                value={nfEur0.format(kpis.marge_brute)}
                sub={pct(kpis.marge_brute_pct)}
                color={kpis.marge_brute_pct < 30 ? 'red' : 'green'}
            />

            <KPI
                label="Contribution"
                value={nfEur0.format(kpis.contribution)}
                sub={pct(kpis.contribution_pct)}
                color="blue"
            />

            <KPI label="Total Heures" value={nf0.format(kpis.total_heures) + ' h'} />

            <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 8,
                padding: '8px 12px'
            }}>
                <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 600, textTransform: 'uppercase' }}>Contribution Horaire</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#1e3a8a' }}>
                    {nfEur0.format(kpis.contribution_horaire)}<small style={{ fontSize: 14 }}>/h</small>
                </div>
            </div>

            {/* BUTTON */}
            <div>
                <button
                    onClick={onOpenSimulator}
                    style={{
                        background: COLORS.primary,
                        color: 'white',
                        border: 'none',
                        borderRadius: 8,
                        padding: '10px 16px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                >
                    <span>🎯</span> Objectif
                </button>
            </div>
        </div>
    );
}

function KPI({ label, value, sub, size = 'md', color }) {
    const styleVal = {
        fontSize: size === 'lg' ? 20 : 18,
        fontWeight: 700,
        color: color === 'red' ? '#dc2626' : color === 'green' ? '#16a34a' : color === 'blue' ? '#2563eb' : '#111827'
    };
    return (
        <div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>{label}</div>
            <div style={styleVal}>{value}</div>
            {sub && <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{sub}</div>}
        </div>
    );
}

function ExpandableCard({ title, amount, amountSuffix = "", children, defaultOpen }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div style={{ background: 'white', borderRadius: 12, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '12px 16px',
                    background: '#f9fafb',
                    borderBottom: isOpen ? `1px solid ${COLORS.border}` : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                }}
            >
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{title}</span>
                    <span style={{ background: '#e5e7eb', padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
                        {nfEur0.format(amount).replace('€', amountSuffix || '€')}
                    </span>
                </div>
                <div style={{ color: '#9ca3af' }}>{isOpen ? '▲' : '▼'}</div>
            </div>
            {isOpen && <div style={{ padding: 16 }}>{children}</div>}
        </div>
    );
}

// —————————————————————————————————————————————————————————
// DRILL DOWN ROWS
// —————————————————————————————————————————————————————————

function DrillDownRow({ label, mainValue, subValue, sources, type = 'price' }) {
    const [open, setOpen] = useState(false);

    return (
        <div style={{ borderBottom: '1px solid #f3f4f6' }}>
            <div
                style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', cursor: 'pointer', alignItems: 'center' }}
                onClick={() => setOpen(!open)}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>{open ? '▼' : '▶'}</span>
                    <span style={{ fontWeight: 500 }}>{label}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600 }}>{mainValue}</div>
                    {subValue && <div style={{ fontSize: 11, color: '#6b7280' }}>{subValue}</div>}
                </div>
            </div>

            {open && sources && sources.length > 0 && (
                <div style={{ background: '#f9fafb', padding: '8px 12px', borderRadius: 8, marginBottom: 8, fontSize: 13 }}>
                    <table style={{ width: '100%' }}>
                        <tbody>
                            {sources.map((src, i) => (
                                <tr key={i}>
                                    <td style={{ padding: '2px 0', color: '#4b5563' }}>
                                        {src.minute} <span style={{ opacity: 0.5 }}>({src.piece || '-'}/{src.zone || '-'})</span>
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '2px 0', color: '#6b7280' }}>
                                        {/* Qty or Hours */}
                                        {src.quantite && `${src.quantite}u`}
                                        {src.hours && `${src.hours}h`}
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '2px 0', fontWeight: 500 }}>
                                        {/* Price or Hours */}
                                        {src.price !== undefined && nfEur0.format(src.price)}
                                        {src.hours !== undefined && ''}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function DetailGroup({ title, items }) {
    if (!items || items.length === 0) return null;
    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#9ca3af', marginBottom: 8 }}>{title}</div>
            {items.map((item, idx) => (
                <DrillDownRow
                    key={idx}
                    label={item.label}
                    mainValue={nfEur0.format(item.pa)}
                    subValue={`${nf0.format(item.ml)} ${item.label.includes('Tissu') ? 'ml' : 'm'}`}
                    sources={item.sources}
                />
            ))}
        </div>
    );
}

function ChargesTable({ details }) {
    const raw = details._details; // Access the detailed object with sources
    const items = [
        { label: 'Déplacements', ...raw.deplacements },
        { label: 'Sous-traitance Pose', ...raw.st_pose },
        { label: 'Sous-traitance Confection', ...raw.st_conf },
        { label: 'Commissions', ...raw.commissions },
        { label: 'Autres Extras', ...raw.autres },
    ].filter(r => r.total > 0);

    if (items.length === 0) return <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>Aucune charge variable.</div>;

    return (
        <div>
            {items.map((item, idx) => (
                <DrillDownRow
                    key={idx}
                    label={item.label}
                    mainValue={nfEur0.format(item.total)}
                    sources={item.sources}
                />
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '2px solid #e5e7eb', marginTop: 8 }}>
                <div style={{ fontWeight: 700 }}>TOTAL</div>
                <div style={{ fontWeight: 800 }}>{nfEur0.format(details.total)}</div>
            </div>
        </div>
    );
}

function HoursTable({ details }) {
    const items = [
        { label: 'Confection', ...details.confection },
        { label: 'Pose', ...details.pose },
        { label: 'Préparation', ...details.prepa },
    ].filter(r => r.total > 0);

    if (items.length === 0) return <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>Aucune heure saisie.</div>;

    return (
        <div>
            {items.map((item, idx) => (
                <DrillDownRow
                    key={idx}
                    label={`Heures ${item.label}`}
                    mainValue={`${nf0.format(item.total)} h`}
                    sources={item.sources}
                    type="hours"
                />
            ))}
        </div>
    );
}


