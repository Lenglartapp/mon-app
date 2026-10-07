import React, { useState, useMemo } from 'react';
import { calculateProfitability, calculateTargetCA } from '../../../lib/financial/profitabilityCalculator';
import { PURCHASE_CHAPTERS, ST_LABELS, sumPA } from '../../../lib/purchases/chapters';
import ProfitabilitySimulatorModal from './ProfitabilitySimulatorModal';
import { ChevronDown, ChevronRight, Target } from 'lucide-react';
import { ToolbarButton } from '../../ui/ToolbarControls';

const ROBOTO = 'Roboto, system-ui, sans-serif';

// Formatters
const nfEur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const pct = (val) => `${Math.round(val || 0)} %`;

export default function MoulinetteView({ rows, depRows, extraRows, commissionRate = 3.5, onUpdateCommission }) {
    const data = useMemo(() => calculateProfitability(rows, depRows, extraRows, commissionRate), [rows, depRows, extraRows, commissionRate]);
    const [showSimulator, setShowSimulator] = useState(false);

    return (
        <div style={{ position: 'relative' }}>
            {/* Bandeau des chiffres clés, collant : fond blanc, sans cadre, sans ombre ni trait */}
            <div style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                background: '#FFFFFF',
                padding: '16px 0',
                marginBottom: 8,
            }}>
                <Dashboard data={data} onOpenSimulator={() => setShowSimulator(true)} />
            </div>

            <div>
                {/* SECTION 1: ACHATS FIXES */}
                <ExpandableCard
                    title="Achats fixes (matières)"
                    amount={data.achats_fixes_details.total}
                    defaultOpen={true}
                >
                    {PURCHASE_CHAPTERS.map(ch => (
                        <DetailGroup key={ch.key} title={ch.label} items={data.achats_fixes_details[ch.key]} />
                    ))}
                </ExpandableCard>

                {/* SECTION 2: CHARGES VARIABLES */}
                <ExpandableCard
                    title="Charges variables"
                    amount={data.charges_details.total}
                    defaultOpen={true}
                >
                    <ChargesTable details={data.charges_details} commissionRate={commissionRate} onUpdateCommission={onUpdateCommission} />
                </ExpandableCard>

                {/* SECTION 3: HEURES DE PRODUCTION */}
                <ExpandableCard
                    title="Heures de production"
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

// 7 chiffres clés, tous au même format, sur une seule ligne quand la place le permet (les pourcentages sont des
// indicateurs à part entière), puis le bouton Objectif.
function Dashboard({ data, onOpenSimulator }) {
    const { kpis } = data;
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            {/* Une ligne sur ordinateur ; passe à la ligne sur tablette au lieu de se chevaucher */}
            <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '14px 28px' }}>
                <KPI label="CA total" value={nfEur0.format(kpis.ca_total)} />
                <KPI label="Marge brute" value={nfEur0.format(kpis.marge_brute)} />
                <KPI label="% marge brute" value={pct(kpis.marge_brute_pct)} alert={kpis.marge_brute_pct < 30} />
                <KPI label="Contribution" value={nfEur0.format(kpis.contribution)} />
                <KPI label="% contribution" value={pct(kpis.contribution_pct)} />
                <KPI label="Total heures" value={nf0.format(kpis.total_heures) + ' h'} />
                <KPI label="Contribution horaire" value={<>{nfEur0.format(kpis.contribution_horaire)}<span style={{ fontSize: 16, color: '#6B7280' }}> /h</span></>} highlight />
            </div>
            <div style={{ paddingBottom: 2, marginLeft: 16 }}>
                <ToolbarButton primary icon={<Target size={16} />} onClick={onOpenSimulator} title="Simuler un objectif de rentabilité">
                    Objectif
                </ToolbarButton>
            </div>
        </div>
    );
}

// Chiffre clé : libellé gris, grand chiffre Roboto fin (même taille pour tous).
// `alert` : marge sous le seuil (rouge) ; `highlight` : indicateur principal (bleu nuit).
function KPI({ label, value, alert, highlight }) {
    return (
        <div style={{ whiteSpace: 'nowrap' }}>
            <div style={{ fontSize: 13, color: '#9B9A97', fontFamily: ROBOTO, marginBottom: 2 }}>{label}</div>
            <div style={{ fontFamily: ROBOTO, fontSize: 28, fontWeight: 300, lineHeight: 1.15, color: alert ? '#DC2626' : highlight ? '#1E2447' : '#111827' }}>
                {value}
            </div>
        </div>
    );
}

// Section repliable : même rendu que les sections de tableaux du chiffrage (flèche, titre Roboto,
// montant en texte) ; le contenu est posé dans un cadre fin, comme les tableaux.
function ExpandableCard({ title, amount, amountSuffix = "", children, defaultOpen }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 44 }}>
                <button onClick={() => setIsOpen(!isOpen)} title={isOpen ? 'Replier' : 'Déplier'} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9B9A97', display: 'flex', padding: 4, marginLeft: -4 }}>
                    <ChevronDown size={20} style={{ transform: isOpen ? 'none' : 'rotate(-90deg)', transition: 'transform .2s ease' }} />
                </button>
                <h3 onClick={() => setIsOpen(!isOpen)} style={{ margin: 0, fontSize: 20, fontWeight: 500, color: '#111827', fontFamily: ROBOTO, cursor: 'pointer' }}>{title}</h3>
                <span style={{ marginLeft: 'auto', fontFamily: ROBOTO, fontSize: 18, fontWeight: 500, color: '#111827' }}>
                    {nfEur0.format(amount).replace('€', amountSuffix || '€')}
                </span>
            </div>
            {isOpen && <div style={{ border: '1px solid #E0DED9', borderRadius: 8, background: 'white', padding: '0 16px', overflow: 'hidden' }}>{children}</div>}
        </div>
    );
}

// —————————————————————————————————————————————————————————
// DRILL DOWN ROWS
// —————————————————————————————————————————————————————————

function DrillDownRow({ label, mainValue, subValue, sources, type = 'price' }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="df-moul-row" style={{ borderBottom: '1px solid #E8E6E2' }}>
            <div
                style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', cursor: 'pointer', alignItems: 'center', fontSize: 14 }}
                onClick={() => setOpen(!open)}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#9B9A97', display: 'flex' }}>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
                    <span style={{ fontWeight: 500, color: '#111827' }}>{label}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{mainValue}</div>
                    {subValue && <div style={{ fontSize: 12, color: '#6B7280' }}>{subValue}</div>}
                </div>
            </div>

            {open && sources && sources.length > 0 && (
                <div style={{ background: '#F7F7F5', padding: '8px 12px', borderRadius: 8, marginBottom: 10, fontSize: 13 }}>
                    <table style={{ width: '100%' }}>
                        <tbody>
                            {sources.map((src, i) => (
                                <tr key={i}>
                                    <td style={{ padding: '2px 0', color: '#4b5563' }}>
                                        {src.minute} <span style={{ opacity: 0.5 }}>({src.piece || '-'}/{src.zone || '-'})</span>
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '2px 0', color: '#6b7280' }}>
                                        {/* Achats : quantité dans l'unité de la ligne (ml ou u). Heures : brut. */}
                                        {src.unit ? `${nf0.format(src.qty)} ${src.unit}` : null}
                                        {src.hours && `${src.hours}h`}
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '2px 0', fontWeight: 500 }}>
                                        {src.pa !== undefined && nfEur0.format(src.pa)}
                                        {src.price !== undefined && nfEur0.format(src.price)}
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

// Un chapitre reste affiché même vide, avec un total à 0 : la structure ne bouge pas
// d'un chiffrage à l'autre.
function DetailGroup({ title, items = [] }) {
    return (
        <div>
            {/* Bandeau gris pleine largeur (comme l'en-tête des tableaux de la Liste Achats) :
                chapitre à gauche, total tout à droite ; le détail reste en blanc dessous. */}
            <div className="df-moul-chapter" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 -16px', padding: '10px 16px', background: '#F4F4F4', borderBottom: '1px solid #E0DED9' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', fontFamily: ROBOTO }}>{title}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', fontFamily: ROBOTO }}>{nfEur0.format(sumPA(items))}</div>
            </div>
            {items.length === 0 ? (
                <div style={{ fontSize: 13, color: '#9CA3AF', padding: '8px 0' }}>Aucun achat dans ce chapitre.</div>
            ) : items.map((item, idx) => (
                <DrillDownRow
                    key={idx}
                    label={item.label}
                    mainValue={nfEur0.format(item.pa)}
                    subValue={`${nf0.format(item.qty)} ${item.unit}`}
                    sources={item.sources}
                />
            ))}
        </div>
    );
}

function ChargesTable({ details, commissionRate, onUpdateCommission }) {
    const raw = details._details; // Access the detailed object with sources
    // Tous les chapitres restent affichés, même à 0 : la structure ne bouge pas
    // d'un chiffrage à l'autre.
    const items = [
        { label: 'Déplacements', ...raw.deplacements },
        { label: ST_LABELS.pose, ...raw.st_pose },
        { label: ST_LABELS.confection, ...raw.st_conf },
        { label: 'Commission commerciale', isCommission: true, ...raw.commissions },
        { label: 'Autres extras', ...raw.autres },
    ];

    return (
        <div>
            {items.map((item, idx) => {
                if (item.isCommission) {
                    return (
                        <CommissionDrillDownRow
                            key="commission"
                            label={item.label}
                            mainValue={nfEur0.format(item.total)}
                            rate={commissionRate}
                            onUpdate={onUpdateCommission}
                        />
                    );
                }
                return (
                    <DrillDownRow
                        key={idx}
                        label={item.label}
                        mainValue={nfEur0.format(item.total)}
                        sources={item.sources}
                    />
                );
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontFamily: ROBOTO, fontSize: 15 }}>
                <div style={{ fontWeight: 600, color: '#111827' }}>Total</div>
                <div style={{ fontWeight: 600, color: '#111827' }}>{nfEur0.format(details.total)}</div>
            </div>
        </div>
    );
}

function CommissionDrillDownRow({ label, mainValue, rate, onUpdate }) {
    const [open, setOpen] = useState(false);
    const [localRate, setLocalRate] = useState(rate);

    // Sync if parent updates
    React.useEffect(() => {
        setLocalRate(rate);
    }, [rate]);

    const handleBlur = () => {
        const num = Number(String(localRate).replace(',', '.'));
        if (!isNaN(num) && num >= 0 && onUpdate) {
            onUpdate(num);
        } else {
            setLocalRate(rate); // Revert on bad input
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.target.blur();
        }
    };

    return (
        <div style={{ borderBottom: '1px solid #E8E6E2' }}>
            <div
                style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', cursor: 'pointer', alignItems: 'center', fontSize: 14 }}
                onClick={() => setOpen(!open)}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#9B9A97', display: 'flex' }}>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
                    <span style={{ fontWeight: 500, color: '#111827' }}>{label} <span style={{ color: '#6B7280', fontWeight: 400 }}>· {String(rate).replace('.', ',')} %</span></span>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 600, color: '#111827' }}>
                    {mainValue}
                </div>
            </div>

            {open && (
                <div style={{ background: '#F7F7F5', padding: '10px 14px', borderRadius: 8, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>Taux de commission</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                            type="number"
                            step="0.1"
                            value={localRate}
                            onChange={(e) => setLocalRate(e.target.value)}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                width: 70,
                                textAlign: 'right',
                                padding: '6px 8px',
                                borderRadius: 6,
                                border: '1px solid #E0DED9',
                                fontSize: 14,
                                fontWeight: 600
                            }}
                        />
                        <span style={{ color: '#6b7280', fontSize: 14, fontWeight: 600 }}>%</span>
                    </div>
                </div>
            )}
        </div>
    );
}

function HoursTable({ details }) {
    const items = [
        { label: 'Confection', ...details.confection },
        { label: 'Pose', ...details.pose },
        { label: 'Préparation', ...details.prepa },
        { label: 'Déplacements (Trajet)', ...details.deplacements },
    ].filter(r => r.total > 0);

    if (items.length === 0) return <div style={{ color: '#9CA3AF', fontSize: 13, padding: '10px 0' }}>Aucune heure saisie.</div>;

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


