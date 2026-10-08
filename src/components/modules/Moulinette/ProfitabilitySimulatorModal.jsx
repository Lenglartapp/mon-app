import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const ROBOTO = 'Roboto, system-ui, sans-serif';

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

    // Case D: Remise (négatif) ou majoration (positif) en % du prix actuel.
    // Le CA devient CA × (1 + p) ; la contribution suit : CA × (1 − commissions) − coûts fixes.
    const handleChangeRemise = (val) => {
        const p = (parseFloat(val) || 0) / 100;
        const newCA = Math.max(0, currentCA * (1 + p));
        const value = newCA * (1 - Com_Rate) - Fixed_Costs;
        const hourly = value / H;
        const percent = newCA > 0 ? (value / newCA) * 100 : 0;
        setValues({ hourly, value, percent });
        setTargetCA(newCA);
    };
    // Remise / majoration correspondant au CA cible, quel que soit le levier utilisé.
    const remisePct = currentCA > 0 && Number.isFinite(targetCA) ? (targetCA / currentCA - 1) * 100 : 0;

    const delta = targetCA - currentData.kpis.ca_total;

    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0,
            background: 'rgba(17,24,39,0.4)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div onClick={(e) => e.stopPropagation()} style={{
                background: 'white', borderRadius: 12, width: 'min(600px, calc(100vw - 32px))', overflow: 'hidden',
                boxShadow: '0 20px 40px rgba(17,24,39,0.18)', fontFamily: ROBOTO,
            }}>
                {/* En-tête : titre Roboto + sous-titre, croix de fermeture */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '22px 28px 16px', borderBottom: '1px solid #E8E6E2' }}>
                    <div>
                        <div style={{ fontSize: 24, fontWeight: 400, color: '#111827' }}>Simulateur de rentabilité</div>
                        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
                            Modifiez un paramètre (ou appliquez une remise / majoration), les autres s'ajustent.
                        </div>
                    </div>
                    <button onClick={onClose} title="Fermer" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9B9A97', display: 'flex', padding: 4 }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: '20px 28px 24px' }}>
                    {/* Les 3 leviers : chacun recalcule les deux autres et le CA cible */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 24 }}>
                        <InputBlock label="Contribution horaire" suffix="€/h" value={values.hourly} onChange={handleChangeHourly} />
                        <InputBlock label="Contribution" suffix="€" value={values.value} onChange={handleChangeValue} />
                        <InputBlock
                            label="% contribution"
                            suffix="%"
                            value={values.percent}
                            onChange={handleChangePercent}
                            max={100 - (Com_Rate * 100) - 1} // max safety
                        />
                    </div>

                    {/* 4e levier : remise (négatif) ou majoration (positif) en % du prix actuel, saisie libre */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', marginBottom: 24, paddingTop: 18, borderTop: '1px solid #E8E6E2' }}>
                        <div style={{ width: 180 }}>
                            <InputBlock label="Remise / majoration" suffix="%" value={remisePct} onChange={handleChangeRemise} />
                        </div>
                        <div style={{ fontSize: 12, color: '#9B9A97', paddingBottom: 12 }}>
                            Négatif = remise (ex. −5), positif = majoration (ex. 10), sur le prix actuel.
                        </div>
                    </div>

                    {/* Résultat : grand chiffre, sans encadré coloré */}
                    <div style={{ fontSize: 13, color: '#9B9A97' }}>Chiffre d'affaires cible</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', marginTop: 2 }}>
                        <div style={{ fontSize: 40, fontWeight: 300, color: '#1E2447', lineHeight: 1.1 }}>
                            {targetCA === Infinity ? 'Impossible' : nfEur0.format(targetCA)}
                        </div>
                        {targetCA !== Infinity && (
                            <div style={{ fontSize: 14, color: '#6B7280' }}>
                                {delta > 0 ? '+' : ''}{nfEur0.format(delta)} par rapport au CA actuel
                            </div>
                        )}
                    </div>

                    <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5, marginTop: 20, paddingTop: 14, borderTop: '1px solid #E8E6E2' }}>
                        Paramètres fixes : heures ({nf2.format(H)} h), coûts fixes matériel compris ({nfEur0.format(Fixed_Costs)}) et taux de commission ({(Com_Rate * 100).toFixed(1).replace('.', ',')} %).
                    </div>
                </div>
            </div>
        </div>
    );
}

function InputBlock({ label, suffix, value, onChange, max }) {
    const [localValue, setLocalValue] = useState(Number(value).toFixed(2));
    const focused = useRef(false);

    useEffect(() => {
        if (!focused.current) {
            setLocalValue(Number(value).toFixed(2));
        }
    }, [value]);

    const handleFocus = (e) => {
        focused.current = true;
        e.target.select();
    };

    const handleChange = (e) => {
        const raw = e.target.value;
        setLocalValue(raw);
        onChange(raw);
    };

    const handleBlur = () => {
        focused.current = false;
        setLocalValue(Number(parseFloat(localValue) || 0).toFixed(2));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, color: '#6B7280', whiteSpace: 'nowrap' }}>{label}</label>
            <div style={{ position: 'relative' }}>
                <input
                    type="number"
                    value={localValue}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    style={{
                        width: '100%',
                        padding: '10px 12px',
                        paddingRight: 30,
                        borderRadius: 8,
                        border: '1px solid #E0DED9',
                        fontSize: 16,
                        fontWeight: 500,
                        fontFamily: 'inherit',
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
                    color: '#9B9A97'
                }}>
                    {suffix}
                </span>
            </div>
        </div>
    );
}
