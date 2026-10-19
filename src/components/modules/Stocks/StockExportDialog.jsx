import React, { useMemo, useState } from 'react';
import { Download, RefreshCw, ClipboardList, FileText } from 'lucide-react';
import MultiSelect from '../../ui/MultiSelect';
import { DaField } from '../../ui/DaForm';
import DaDialog from '../../ui/DaDialog';
import { ToolbarButton } from '../../ui/ToolbarControls';
import { EXPORT_COLUMNS, EXPORT_USAGES, aisleOf, compareLocations, exportStock, groupByArticle, AISLE_TO_COMPLETE, AISLE_NONE } from '../../../lib/inventory/stockImport';

const MUTED = '#6B7280';
const label = { fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 8px' };
const USAGE_ICONS = { update: <RefreshCw size={16} />, count: <ClipboardList size={16} />, view: <FileText size={16} /> };
// Colonnes imposées : sans elles, le fichier ne se réimporte pas correctement.
const LOCKED = { update: ['qty', 'unit'], count: ['location', 'qty', 'unit'], view: [] };

function Check({ checked, onChange, children }) {
    return (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {children}
        </label>
    );
}

/**
 * Préparation d'un export du stock : usage (réimport, comptage, consultation), périmètre
 * (affiché / tout, catégories, allées, affectation) et colonnes. Jamais de valeur d'achat.
 * @param {Array} allItems    toutes les entrées du stock
 * @param {Array} shownItems  entrées affichées à l'écran (filtres compris)
 * @param {Function} statusOf (item) → libellé du statut (Réservé, Libre…)
 */
export default function StockExportDialog({ onClose, allItems = [], shownItems = [], filtered = false, statusOf }) {
    const [usage, setUsage] = useState('update');
    const [scope, setScope] = useState(filtered ? 'shown' : 'all');
    const [columns, setColumns] = useState(EXPORT_USAGES.update.defaults);
    const [includeZero, setIncludeZero] = useState(false);
    const [free, setFree] = useState(true);
    const [reserved, setReserved] = useState(true);
    const [splitAisles, setSplitAisles] = useState(true);
    const [groupItems, setGroupItems] = useState(true);
    const [busy, setBusy] = useState(false);

    const base = useMemo(() => (scope === 'shown' ? shownItems : allItems).filter(i => includeZero || Number(i.qty) !== 0), [scope, shownItems, allItems, includeZero]);
    const categories = useMemo(() => [...new Set(base.map(i => i.category || 'Divers'))].sort(), [base]);
    const aisles = useMemo(() => {
        const set = [...new Set(base.map(i => aisleOf(i.location)))];
        const rank = (k) => (k === AISLE_TO_COMPLETE ? 0 : k === AISLE_NONE ? 2 : 1);
        return set.sort((a, b) => rank(a) - rank(b) || compareLocations(a, b));
    }, [base]);
    const [offCats, setOffCats] = useState(new Set());
    const [offAisles, setOffAisles] = useState(new Set());
    const count = (fn) => base.reduce((m, i) => { const k = fn(i); m[k] = (m[k] || 0) + 1; return m; }, {});
    const catCounts = count(i => i.category || 'Divers');
    const aisleCounts = count(i => aisleOf(i.location));
    const freeCount = base.filter(i => !i.project).length;

    const items = base.filter(i =>
        !offCats.has(i.category || 'Divers')
        && !offAisles.has(aisleOf(i.location))
        && (i.project ? reserved : free));
    // Sélections exprimées en « cochées » pour les menus
    const onCats = categories.filter(c => !offCats.has(c));
    const onAisles = aisles.filter(a => !offAisles.has(a));
    const setOn = (all, setter) => (vals) => setter(new Set(all.filter(x => !vals.includes(x))));
    const lineCount = usage === 'view' && groupItems ? groupByArticle(items).length : items.length;

    const pickUsage = (u) => {
        setUsage(u);
        setColumns([...new Set([...EXPORT_USAGES[u].defaults, ...LOCKED[u]])]);
    };

    const run = async () => {
        setBusy(true);
        try {
            const parts = [];
            if (offCats.size) parts.push(categories.filter(c => !offCats.has(c)).join(', '));
            if (offAisles.size) parts.push(`allées ${aisles.filter(a => !offAisles.has(a)).join(', ')}`);
            if (!free || !reserved) parts.push(free ? 'stock libre' : 'stock réservé');
            await exportStock({ items, usage, columns: [...new Set([...columns, ...LOCKED[usage]])], splitAisles: usage === 'count' && splitAisles, groupItems, statusOf, title: parts.join(' · ') });
            onClose();
        } catch (err) {
            alert("Erreur lors de l'export : " + (err.message || err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <DaDialog
            open
            onClose={onClose}
            title="Exporter le stock"
            subtitle="Choisissez l’usage, ce qu’il faut exporter et les colonnes."
            maxWidth="md"
            footer={<>
                <span style={{ flex: 1, fontSize: 13, color: MUTED }}>
                    {lineCount} ligne{lineCount > 1 ? 's' : ''}{usage === 'count' && splitAisles ? ` · ${new Set(items.map(i => aisleOf(i.location))).size} feuille(s), une par allée` : ''}
                </span>
                <ToolbarButton onClick={onClose}>Annuler</ToolbarButton>
                <ToolbarButton primary icon={<Download size={15} />} disabled={busy || !lineCount} onClick={run}>{busy ? 'Export…' : 'Exporter'}</ToolbarButton>
            </>}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                {/* 1. Usage */}
                <div>
                    <p style={label}>À quoi sert l’export ?</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                        {Object.entries(EXPORT_USAGES).map(([k, u]) => {
                            const on = usage === k;
                            return (
                                <button key={k} type="button" onClick={() => pickUsage(k)} style={{
                                    textAlign: 'left', padding: 14, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                                    border: `1.5px solid ${on ? '#1E2447' : '#E0DED9'}`, background: on ? '#EEF4FD' : 'white',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#111827' }}>{USAGE_ICONS[k]} {u.label}</div>
                                    <div style={{ fontSize: 12, color: MUTED, marginTop: 6, lineHeight: 1.45 }}>{u.hint}</div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 2. Périmètre — menus déroulants à choix multiples */}
                <div>
                    <p style={label}>Quoi exporter ?</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                        <DaField label="Périmètre">
                            <MultiSelect single value={[scope]} onChange={([v]) => setScope(v)} options={[
                                { value: 'all', label: `Tout le stock`, count: allItems.filter(i => includeZero || Number(i.qty) !== 0).length },
                                { value: 'shown', label: `Affiché à l’écran${filtered ? ' (filtré)' : ''}`, count: shownItems.filter(i => includeZero || Number(i.qty) !== 0).length },
                            ]} />
                        </DaField>
                        <DaField label="Allées">
                            <MultiSelect value={onAisles} onChange={setOn(aisles, setOffAisles)} options={aisles.map(a => ({ value: a, label: a, count: aisleCounts[a] }))} />
                        </DaField>
                        <DaField label="Catégories">
                            <MultiSelect value={onCats} onChange={setOn(categories, setOffCats)} options={categories.map(c => ({ value: c, label: c, count: catCounts[c] }))} />
                        </DaField>
                        <DaField label="Affectation">
                            <MultiSelect allLabel="Tout" value={[free && 'free', reserved && 'reserved'].filter(Boolean)}
                                onChange={(v) => { setFree(v.includes('free')); setReserved(v.includes('reserved')); }}
                                options={[{ value: 'free', label: 'Stock libre', count: freeCount }, { value: 'reserved', label: 'Réservé à des dossiers', count: base.length - freeCount }]} />
                        </DaField>
                    </div>
                    <div style={{ marginTop: 12 }}>
                        <Check checked={includeZero} onChange={setIncludeZero}>Inclure les quantités à zéro</Check>
                    </div>
                </div>

                {/* 3. Colonnes */}
                <div>
                    <DaField label="Colonnes" hint={usage !== 'view'
                        ? `Ajoutées d’office : ID (pour retrouver l’article au réimport) et les colonnes à remplir${usage === 'update' ? ' (nouvelle quantité, nouvel emplacement).' : ' (COMPTÉ, nouvel emplacement, remarque).'}`
                        : undefined}>
                        <MultiSelect value={columns} onChange={setColumns}
                            options={EXPORT_COLUMNS.map(c => ({ value: c.key, label: c.label, locked: LOCKED[usage].includes(c.key) }))} />
                    </DaField>
                </div>

                {/* 4. Mise en forme */}
                {usage === 'count' && <Check checked={splitAisles} onChange={setSplitAisles}>Une feuille par allée (à imprimer et répartir entre les équipes)</Check>}
                {usage === 'view' && <Check checked={groupItems} onChange={setGroupItems}>Une ligne par article (quantités de ses différents emplacements additionnées)</Check>}
            </div>
        </DaDialog>
    );
}
