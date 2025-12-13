import React, { useState, useEffect } from 'react';
import { COLORS } from '../../../lib/constants/ui';

const nfEur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

export default function ProfitabilitySimulatorModal({ currentData, onClose }) {
    // 1. EXTRACT CONSTANTS
    // H (Heures Totales)
    const H = Math.max(0.1, currentData.kpis.total_heures); // Avoid div by zero

    // Com_Rate (Taux de commission actuel)
    const currentCA = currentData.kpis.ca_total;
    const currentComs = currentData.charges_details.commissions;
    const Com_Rate = currentCA > 0 ? (currentComs / currentCA) : 0;

    // Fixed_Costs (Achats Fixes + Charges Variables Fixes)
    // = Total Achats Fixes + (Total Charges Variables - Commissions)
    const Fixed_Costs = currentData.kpis.achats_fixes
        + (currentData.charges_details.total - currentComs);

    // 2. STATE
    // We store the 3 values. Initial state = Current Values.
    const [values, setValues] = useState({
        hourly: currentData.kpis.contribution_horaire,
        value: currentData.kpis.contribution,
        percent: currentData.kpis.contribution_pct
    });

    const [targetCA, setTargetCA] = useState(currentData.kpis.ca_total);

    // 3. HANDLERS

    // Case A: Change Hourly
    const handleChangeHourly = (val) => {
        const hourly = parseFloat(val) || 0;
        const value = hourly * H;

        // CA = (Value + Fix) / (1 - Rate)
        const newCA = (value + Fixed_Costs) / (1 - Com_Rate);
        const percent = newCA > 0 ? (value / newCA) * 100 : 0;

        setValues({ hourly, value, percent });
        setTargetCA(newCA);
    };

    // Case B: Change Value (Absolute Contribution)
    const handleChangeValue = (val) => {
        const value = parseFloat(val) || 0;
        const hourly = value / H;

        const newCA = (value + Fixed_Costs) / (1 - Com_Rate);
        const percent = newCA > 0 ? (value / newCA) * 100 : 0;

        setValues({ hourly, value, percent });
        setTargetCA(newCA);
    };

    // Case C: Change Percent
    const handleChangePercent = (val) => {
        const percent = parseFloat(val) || 0;
        const R = percent / 100;

        // Protection against impossible request (e.g. Margin + Com > 100%)
        // Denominator = 1 - Com_Rate - R
        const denominator = 1 - Com_Rate - R;

        if (denominator <= 0.01) {
            // Edge case: Infinite CA required
            setValues({ ...values, percent });
            setTargetCA(Infinity);
            return;
        }

        // Value = (R * Fixed) / Denom
        const value = (R * Fixed_Costs) / denominator;
        const hourly = value / H;
        const newCA = (value + Fixed_Costs) / (1 - Com_Rate);

        setValues({ hourly, value, percent });
        setTargetCA(newCA);
    };

    const delta = targetCA - currentData.kpis.ca_total;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                background: 'white', borderRadius: 16, padding: '24px 32px', width: 500,
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 20 }}>🎯 Simulateur de Rentabilité</h2>
                        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                            Modifiez un paramètre, les autres s'ajustent.
                        </div>
                    </div>
                    <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 24, cursor: 'pointer', color: '#9ca3af' }}>×</button>
                </div>

                {/* INPUT GRID */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>

                    {/* INPUT A: HOURLY */}
                    <InputBlock
                        label="Contrib. Horaire"
                        suffix="€/h"
                        value={values.hourly}
                        onChange={handleChangeHourly}
                        color="blue"
                    />

                    {/* INPUT B: VALUE */}
                    <InputBlock
                        label="Contrib. Valeur"
                        suffix="€"
                        value={values.value}
                        onChange={handleChangeValue}
                    />

                    {/* INPUT C: PERCENT */}
                    <InputBlock
                        label="Contrib. %"
                        suffix="%"
                        value={values.percent}
                        onChange={handleChangePercent}
                        max={100 - (Com_Rate * 100) - 1} // max safety
                    />
                </div>

                {/* RESULT CARD */}
                <div style={{ background: '#f0f9ff', padding: 20, borderRadius: 12, marginBottom: 24, border: '1px solid #bae6fd' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                        <div style={{ fontSize: 13, color: '#0369a1', fontWeight: 600, textTransform: 'uppercase' }}>
                            Chiffre d'Affaires Cible
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: delta > 0 ? '#dc2626' : '#16a34a' }}>
                            {delta > 0 ? '+' : ''}{nfEur0.format(delta)}
                        </div>
                    </div>

                    <div style={{ fontSize: 36, fontWeight: 800, color: '#0c4a6e', lineHeight: 1 }}>
                        {targetCA === Infinity ? "IMPOSSIBLE" : nfEur0.format(targetCA)}
                    </div>
                </div>

                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, background: '#f9fafb', padding: 12, borderRadius: 8 }}>
                    <strong>Paramètres fixes :</strong> Heures ({nf2.format(H)}h), Coûts Fixes (+Matériel) ({nfEur0.format(Fixed_Costs)}) et Taux Commission ({(Com_Rate * 100).toFixed(1)}%).
                </div>
            </div>
        </div>
    );
}

function InputBlock({ label, suffix, value, onChange, color = 'gray', max }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#4b5563', whiteSpace: 'nowrap' }}>{label}</label>
            <div style={{ position: 'relative' }}>
                <input
                    type="number"
                    value={Number(value).toFixed(2)} // Display nicely
                    onChange={e => onChange(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '10px 12px',
                        paddingRight: 30,
                        borderRadius: 8,
                        border: `2px solid ${color === 'blue' ? COLORS.primary : '#e5e7eb'}`,
                        fontSize: 16,
                        fontWeight: 700,
                        color: '#111827',
                        outline: 'none',
                        boxSizing: 'border-box'
                    }}
                />
                <span style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#9ca3af'
                }}>
                    {suffix}
                </span>
            </div>
        </div>
    );
}
