import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { aggregatePurchaseChapters, PURCHASE_CHAPTERS, sumPA } from '../lib/purchases/chapters';
import { ToolbarButton } from '../components/ui/ToolbarControls';

const formatPrice = (p) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(p);
const formatQty = (q) => Number(q).toLocaleString('fr-FR', { maximumFractionDigits: 2 });

export default function ShoppingListScreen({ minutes = [] }) {
    // Le chapitrage est partagé avec la moulinette (lib/purchases/chapters) : les deux
    // écrans doivent ventiler les achats exactement pareil.
    const chapters = useMemo(() => aggregatePurchaseChapters(
        minutes.flatMap(m => (m.lines || []).map(l => ({ ...l, _minute: m.name })))
    ), [minutes]);

    const exportCSV = () => {
        // Generate CSV content
        const header = ['Chapitre', 'Article', 'Total Qté', 'Unité', 'Total HT', 'Zone', 'Pièce', 'Produit', 'Détail', 'Qté Ligne'];
        const rows = [];

        const addRows = (chapter, items) => {
            items.forEach(item => {
                item.sources.forEach(src => {
                    rows.push([
                        chapter,
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

        PURCHASE_CHAPTERS.forEach(ch => addRows(ch.label, chapters[ch.key]));
        addRows('Sous-traitance', chapters.sous_traitance);

        const csvContent = [
            header.join(';'),
            ...rows.map(r => r.map(c => `"${c}"`).join(';'))
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
            {/* Barre du haut : titre de section + export (même style que les autres barres) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 13, color: '#6B7280' }}>
                    Achats consolidés de la minute, ventilés par chapitre (même chapitrage que la moulinette).
                </div>
                <ToolbarButton icon={<Download size={16} />} onClick={exportCSV} title="Exporter le détail en CSV">
                    Exporter CSV
                </ToolbarButton>
            </div>

            {PURCHASE_CHAPTERS.map(ch => (
                <Section key={ch.key} title={ch.label} items={chapters[ch.key]} />
            ))}
            <Section title="Sous-traitance (pose & confection)" items={chapters.sous_traitance} />
        </div>
    );
}

const ROBOTO = 'Roboto, system-ui, sans-serif';
const TH = { padding: '10px 12px', fontSize: 13, fontWeight: 600, color: '#374151', background: '#F4F4F4', borderBottom: '1px solid #E0DED9', textAlign: 'left', whiteSpace: 'nowrap' };
const TD = { padding: '10px 12px', fontSize: 13, color: '#111827', borderBottom: '1px solid #E8E6E2', verticalAlign: 'middle' };

// Chapitre : titre repliable (même rendu que les sections du chiffrage) + tableau au contour des listes.
// Un chapitre reste affiché même vide, avec un total à 0.
function Section({ title, items }) {
    const [open, setOpen] = useState(true);
    return (
        <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 44 }}>
                <button onClick={() => setOpen(o => !o)} title={open ? 'Replier' : 'Déplier'} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9B9A97', display: 'flex', padding: 4, marginLeft: -4 }}>
                    <ChevronDown size={20} style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .2s ease' }} />
                </button>
                <h3 onClick={() => setOpen(o => !o)} style={{ margin: 0, fontSize: 20, fontWeight: 500, color: '#111827', fontFamily: ROBOTO, cursor: 'pointer' }}>{title}</h3>
                <span style={{ color: '#9B9A97', fontSize: 13, fontFamily: ROBOTO, marginLeft: 4, alignSelf: 'flex-end', paddingBottom: 13 }}>
                    {items.length} {items.length > 1 ? 'articles' : 'article'}
                </span>
                <span style={{ marginLeft: 'auto', fontFamily: ROBOTO, fontSize: 18, fontWeight: 500, color: '#111827' }}>{formatPrice(sumPA(items))}</span>
            </div>
            {open && (
                <div style={{ border: '1px solid #E0DED9', borderRadius: 8, overflow: 'hidden', background: 'white' }}>
                    {items.length === 0 ? (
                        <div style={{ padding: '14px 12px', fontSize: 13, color: '#9CA3AF' }}>Aucun article dans ce chapitre.</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={{ ...TH, width: 36 }} />
                                    <th style={TH}>Article</th>
                                    <th style={{ ...TH, textAlign: 'right', width: 160 }}>Quantité</th>
                                    <th style={{ ...TH, textAlign: 'right', width: 160 }}>Coût</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => <ItemRows key={`${item.label}-${idx}`} item={item} last={idx === items.length - 1} />)}
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
    return (
        <>
            <tr onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer', background: open ? '#F7F7F5' : 'white' }}>
                <td style={{ ...TD, ...lastBorder, color: '#9B9A97', textAlign: 'center' }}>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                <td style={{ ...TD, ...lastBorder, fontWeight: 500 }}>{item.label}</td>
                {/* L'unité est portée par la ligne, pas par le chapitre : un même
                    chapitre mélange des articles au mètre et à l'unité. */}
                <td style={{ ...TD, ...lastBorder, textAlign: 'right' }}>{formatQty(item.qty)} <span style={{ color: '#6B7280' }}>{item.unit}</span></td>
                <td style={{ ...TD, ...lastBorder, textAlign: 'right', fontWeight: 600 }}>{formatPrice(item.pa)}</td>
            </tr>
            {open && (
                <tr>
                    <td colSpan={4} style={{ ...TD, padding: '4px 12px 12px 48px', background: '#F7F7F5', ...(last ? { borderBottom: 'none' } : null) }}>
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
