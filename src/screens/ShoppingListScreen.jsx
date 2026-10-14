import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download, X } from 'lucide-react';
import { aggregatePurchaseChapters, PURCHASE_CHAPTERS, sumPA } from '../lib/purchases/chapters';
import { ToolbarButton } from '../components/ui/ToolbarControls';
import ConditionFilterButton from '../components/ui/ConditionFilterButton';
import { ValueFilter, CopyTableButton } from '../components/purchases/purchaseTools';
import { FILTER_FIELDS, withCatalogInfo, passes, formatQty, sortItems, DEFAULT_SORT } from '../lib/purchases/supplierInfo';
import { isConditionActive, matchConditions } from '../components/FilterPanel';

const formatPrice = (p) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(p);

export default function ShoppingListScreen({ minutes = [], catalog = [] }) {
    // Le chapitrage est partagé avec la moulinette (lib/purchases/chapters) : les deux
    // écrans doivent ventiler les achats exactement pareil.
    const chapters = useMemo(() => {
        const raw = aggregatePurchaseChapters(
            minutes.flatMap(m => (m.lines || []).map(l => ({ ...l, _minute: m.name })))
        );
        const byName = new Map((catalog || []).filter(i => i?.name).map(i => [i.name, i]));
        const out = {};
        [...PURCHASE_CHAPTERS.map(ch => ch.key), 'sous_traitance'].forEach(k => {
            out[k] = (raw[k] || []).map(it => withCatalogInfo(it, byName));
        });
        return out;
    }, [minutes, catalog]);

    // Filtre GLOBAL à conditions (même bouton « Filtrer » que les listes Chiffrages / Projets),
    // sur tous les chapitres + filtres d'en-tête PAR tableau.
    const [conditions, setConditions] = useState([]);
    const [tableFilters, setTableFilters] = useState({});
    const allItems = useMemo(() => [...PURCHASE_CHAPTERS.flatMap(ch => chapters[ch.key] || []), ...(chapters.sous_traitance || [])], [chapters]);
    const filterSchema = useMemo(() => {
        const opts = (k) => [...new Set(allItems.map(it => String(it[k] || '').trim()).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
        return [
            { key: 'fournisseur', label: 'Fournisseur', type: 'select', options: opts('fournisseur') },
            { key: 'reference', label: 'Référence', type: 'select', options: opts('reference') },
            { key: 'coloris', label: 'Coloris', type: 'select', options: opts('coloris') },
            { key: 'laize', label: 'Laize (cm)', type: 'number' },
            { key: 'qty', label: 'Quantité', type: 'number' },
            { key: 'unit', label: 'Unité', type: 'select', options: opts('unit') },
            { key: 'pa', label: 'Coût (€)', type: 'number' },
        ];
    }, [allItems]);
    const hasConditions = conditions.some(isConditionActive);
    const visible = (key) => (chapters[key] || []).filter(it =>
        (!hasConditions || matchConditions(conditions, it)) && passes(it, tableFilters[key]));
    const hasTableFilters = Object.values(tableFilters).some(f => Object.values(f || {}).some(Boolean));
    const setTableFilter = (key) => (field, set) => setTableFilters(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [field]: set } }));

    const exportCSV = () => {
        // Generate CSV content
        const header = ['Chapitre', 'Fournisseur', 'Référence', 'Coloris', 'Laize', 'Article', 'Total Qté', 'Unité', 'Total HT', 'Zone', 'Pièce', 'Produit', 'Détail', 'Qté Ligne'];
        const rows = [];

        const addRows = (chapter, items) => {
            items.forEach(item => {
                item.sources.forEach(src => {
                    rows.push([
                        chapter,
                        item.fournisseur,
                        item.reference,
                        item.coloris,
                        item.laize,
                        item.label,
                        String(item.qty).replace('.', ','),
                        item.unit,
                        String(item.pa).replace('.', ','),
                        src.zone,
                        src.piece,
                        src.produit,
                        src.detail || '',
                        String(src.qty).replace('.', ',')
                    ]);
                });
            });
        };

        // L'export suit les filtres affichés.
        PURCHASE_CHAPTERS.forEach(ch => addRows(ch.label, visible(ch.key)));
        addRows('Sous-traitance', visible('sous_traitance'));

        const csvContent = [
            header.join(';'),
            ...rows.map(r => r.map(c => `"${c ?? ''}"`).join(';'))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'liste_achats_detaillee.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div>
            {/* Barre du haut : filtre à conditions (tous chapitres) et export, comme les autres listes */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                {hasTableFilters && (
                    <button type="button" onClick={() => setTableFilters({})} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', color: '#1E2447', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginRight: 'auto' }}>
                        <X size={14} /> Effacer les filtres des tableaux
                    </button>
                )}
                <ConditionFilterButton schema={filterSchema} conditions={conditions} onChange={setConditions} />
                <ToolbarButton icon={<Download size={16} />} onClick={exportCSV} title="Exporter le détail en CSV">
                    Exporter CSV
                </ToolbarButton>
            </div>

            {PURCHASE_CHAPTERS.map(ch => (
                <Section
                    key={ch.key}
                    title={ch.label}
                    allItems={chapters[ch.key] || []}
                    items={visible(ch.key)}
                    filters={tableFilters[ch.key] || {}}
                    onFilter={setTableFilter(ch.key)}
                />
            ))}
            <Section
                title="Sous-traitance (pose & confection)"
                copyable={false}
                allItems={chapters.sous_traitance || []}
                items={visible('sous_traitance')}
                filters={tableFilters.sous_traitance || {}}
                onFilter={setTableFilter('sous_traitance')}
            />
        </div>
    );
}

const ROBOTO = 'Roboto, system-ui, sans-serif';
const TH = { padding: '10px 12px', fontSize: 13, fontWeight: 600, color: '#374151', background: '#F4F4F4', borderBottom: '1px solid #E0DED9', textAlign: 'left', whiteSpace: 'nowrap' };
const TD = { padding: '10px 12px', fontSize: 13, color: '#111827', borderBottom: '1px solid #E8E6E2', verticalAlign: 'middle' };

// Chapitre : titre repliable (même rendu que les sections du chiffrage) + tableau au contour des listes.
// Un chapitre reste affiché même vide, avec un total à 0.
function Section({ title, items: filtered, allItems = filtered, filters = {}, onFilter, copyable = true }) {
    const [open, setOpen] = useState(true);
    // Tri de la colonne choisie ; par défaut la plus grande quantité d'abord.
    const [sort, setSort] = useState(DEFAULT_SORT);
    const items = useMemo(() => sortItems(filtered, sort), [filtered, sort]);
    return (
        <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 44 }}>
                <button onClick={() => setOpen(o => !o)} title={open ? 'Replier' : 'Déplier'} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9B9A97', display: 'flex', padding: 4, marginLeft: -4 }}>
                    <ChevronDown size={20} style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .2s ease' }} />
                </button>
                <h3 onClick={() => setOpen(o => !o)} style={{ margin: 0, fontSize: 20, fontWeight: 500, color: '#111827', fontFamily: ROBOTO, cursor: 'pointer' }}>{title}</h3>
                <span style={{ color: '#9B9A97', fontSize: 13, fontFamily: ROBOTO, marginLeft: 4, alignSelf: 'flex-end', paddingBottom: 13 }}>
                    {items.length} {items.length > 1 ? 'articles' : 'article'}{items.length !== allItems.length ? ` sur ${allItems.length}` : ''}
                </span>
                <span style={{ marginLeft: 'auto' }} />
                {copyable && items.length > 0 && <CopyTableButton items={items} />}
                <span style={{ fontFamily: ROBOTO, fontSize: 18, fontWeight: 500, color: '#111827' }}>{formatPrice(sumPA(items))}</span>
            </div>
            {open && (
                <div style={{ border: '1px solid #E0DED9', borderRadius: 8, overflow: 'hidden', background: 'white' }}>
                    {allItems.length === 0 ? (
                        <div style={{ padding: '14px 12px', fontSize: 13, color: '#9CA3AF' }}>Aucun article dans ce chapitre.</div>
                    ) : (
                        // Sélectionnable à la souris (glisser puis Cmd+C) pour coller dans un e-mail.
                        <table style={{ width: '100%', borderCollapse: 'collapse', userSelect: 'text' }}>
                            <thead>
                                <tr>
                                    <th style={{ ...TH, width: 36 }} />
                                    {FILTER_FIELDS.map(f => (
                                        <th key={f.key} style={TH}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                {f.label}
                                                {onFilter && (
                                                    <ValueFilter label={f.label} items={allItems} field={f.key} value={filters[f.key] || null} onChange={(set) => onFilter(f.key, set)} variant="icon" sort={sort} onSort={setSort} />
                                                )}
                                            </span>
                                        </th>
                                    ))}
                                    <th style={{ ...TH, textAlign: 'right', width: 70 }}>Laize</th>
                                    <th style={{ ...TH, textAlign: 'right', width: 140 }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            Quantité
                                            {onFilter && <ValueFilter label="Quantité" items={allItems} field="qtyLabel" numeric sortKey="qty" value={filters.qtyLabel || null} onChange={(set) => onFilter('qtyLabel', set)} variant="icon" sort={sort} onSort={setSort} />}
                                        </span>
                                    </th>
                                    <th style={{ ...TH, textAlign: 'right', width: 140 }}>Coût</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => <ItemRows key={`${item.label}-${idx}`} item={item} last={idx === items.length - 1} />)}
                                {items.length === 0 && (
                                    <tr><td colSpan={7} style={{ ...TD, borderBottom: 'none', color: '#9CA3AF' }}>Aucun article ne correspond aux filtres.</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}

// Ligne d'article : clic pour déplier le détail par ligne de minute (zone, pièce, produit, dimensions).
function ItemRows({ item, last }) {
    const [open, setOpen] = useState(false);
    const lastBorder = last && !open ? { borderBottom: 'none' } : null;
    // Un clic ouvre le détail ; un glisser (sélection de texte pour copier) ne l'ouvre pas.
    const onRowClick = () => { if (!String(window.getSelection?.() || '').trim()) setOpen(o => !o); };
    return (
        <>
            <tr onClick={onRowClick} style={{ cursor: 'pointer', background: open ? '#F7F7F5' : 'white' }}>
                <td style={{ ...TD, ...lastBorder, color: '#9B9A97', textAlign: 'center' }}>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                <td style={{ ...TD, ...lastBorder, fontWeight: 500 }}>{item.fournisseur || <span style={{ color: '#D1D5DB' }}>—</span>}</td>
                <td style={{ ...TD, ...lastBorder }}>{item.reference}</td>
                <td style={{ ...TD, ...lastBorder }}>{item.coloris}</td>
                <td style={{ ...TD, ...lastBorder, textAlign: 'right', color: '#6B7280' }}>{item.laize || ''}</td>
                {/* L'unité est portée par la ligne, pas par le chapitre : un même
                    chapitre mélange des articles au mètre et à l'unité. */}
                <td style={{ ...TD, ...lastBorder, textAlign: 'right' }} title={item.arrondiStores ? 'Métrage des stores arrondi au demi-mètre supérieur (une fois pour ce tissu)' : undefined}>
                    {formatQty(item.qty)} <span style={{ color: '#6B7280' }}>{item.unit}</span>
                    {item.arrondiStores && <div style={{ fontSize: 11, color: '#9B9A97' }}>stores arrondis au ½ m</div>}
                </td>
                <td style={{ ...TD, ...lastBorder, textAlign: 'right', fontWeight: 600 }}>{formatPrice(item.pa)}</td>
            </tr>
            {open && (
                <tr>
                    <td colSpan={7} style={{ ...TD, padding: '4px 12px 12px 48px', background: '#F7F7F5', ...(last ? { borderBottom: 'none' } : null) }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {['Minute', 'Zone', 'Pièce', 'Produit', 'Détail / dimensions'].map(h => (
                                        <th key={h} style={{ ...TH, background: 'transparent', fontSize: 12, color: '#6B7280', padding: '8px 8px' }}>{h}</th>
                                    ))}
                                    <th style={{ ...TH, background: 'transparent', fontSize: 12, color: '#6B7280', padding: '8px 8px', textAlign: 'right' }}>Qté ({item.unit})</th>
                                    <th style={{ ...TH, background: 'transparent', fontSize: 12, color: '#6B7280', padding: '8px 8px', textAlign: 'right' }}>Coût</th>
                                </tr>
                            </thead>
                            <tbody>
                                {item.sources.map((src, i) => {
                                    const cell = { padding: '7px 8px', fontSize: 13, color: '#374151', borderBottom: i === item.sources.length - 1 ? 'none' : '1px solid #E8E6E2' };
                                    return (
                                        <tr key={i}>
                                            <td style={{ ...cell, color: '#6B7280' }}>{src.minute}</td>
                                            <td style={cell}>{src.zone}</td>
                                            <td style={cell}>{src.piece}</td>
                                            <td style={cell}>{src.produit}</td>
                                            <td style={{ ...cell, color: '#6B7280' }}>{src.detail}</td>
                                            <td style={{ ...cell, textAlign: 'right' }}>{formatQty(src.qty)}</td>
                                            <td style={{ ...cell, textAlign: 'right', fontWeight: 500 }}>{formatPrice(src.pa)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </td>
                </tr>
            )}
        </>
    );
}

