import React, { useMemo } from 'react';
import {
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Box,
    Chip
} from '@mui/material';
import { ChevronDown, Download } from 'lucide-react';
import { aggregatePurchaseChapters, PURCHASE_CHAPTERS, sumPA } from '../lib/purchases/chapters';
import { COLORS, S } from '../lib/constants/ui';

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

    // Un chapitre reste affiché même vide, avec un total à 0.
    const Section = ({ title, items }) => (
        <div style={{ ...S.modernCard, padding: 24, marginBottom: 24 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16, color: '#374151', textTransform: 'uppercase' }}>
                    {title}
                </Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#166534' }}>
                    {formatPrice(sumPA(items))}
                </Typography>
            </Box>

            {items.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    Aucun article dans ce chapitre.
                </Typography>
            ) : (
                items.map((item, idx) => (
                    <Accordion key={`${item.label}-${idx}`} disableGutters elevation={0} sx={{ border: `1px solid ${COLORS.border}`, '&:before': { display: 'none' }, mb: 1, borderRadius: '8px !important' }}>
                        <AccordionSummary expandIcon={<ChevronDown size={20} />}>
                            <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', pr: 2 }}>
                                <Typography sx={{ fontWeight: 600 }}>{item.label}</Typography>
                                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                    {/* L'unité est portée par la ligne, pas par le chapitre : un même
                                        chapitre mélange des articles au mètre et à l'unité. */}
                                    <Chip
                                        label={`Total : ${formatQty(item.qty)} ${item.unit}`}
                                        size="small"
                                        color="primary"
                                        variant="outlined"
                                    />
                                    <Chip
                                        label={`Coût : ${formatPrice(item.pa)}`}
                                        size="small"
                                        color="default"
                                        variant="outlined"
                                        sx={{ fontWeight: 600, bgcolor: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}
                                    />
                                </div>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ bgcolor: '#f8fafc', borderTop: `1px solid ${COLORS.border}` }}>
                            <Table size="small">

                                <TableHead>
                                    <TableRow>
                                        <TableCell>Minute</TableCell>
                                        <TableCell>Zone</TableCell>
                                        <TableCell>Pièce</TableCell>
                                        <TableCell>Produit</TableCell>
                                        <TableCell>Détail / Dimensions</TableCell>
                                        <TableCell align="right">Qté ({item.unit})</TableCell>
                                        <TableCell align="right">Coût (€)</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {item.sources.map((src, i) => (
                                        <TableRow key={i}>
                                            <TableCell sx={{ color: 'text.secondary' }}>{src.minute}</TableCell>
                                            <TableCell>{src.zone}</TableCell>
                                            <TableCell>{src.piece}</TableCell>
                                            <TableCell>{src.produit}</TableCell>
                                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{src.detail}</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 500 }}>
                                                {formatQty(src.qty)}
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 500 }}>
                                                {formatPrice(src.pa)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </AccordionDetails>
                    </Accordion>
                ))
            )}
        </div>
    );

    return (
        <Box sx={{ p: 0 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>Liste des Achats Consolidée</Typography>
                <button
                    onClick={exportCSV}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 16px',
                        background: '#fff',
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontWeight: 500
                    }}
                >
                    <Download size={16} /> Export CSV
                </button>
            </Box>

            {PURCHASE_CHAPTERS.map(ch => (
                <Section key={ch.key} title={ch.label} items={chapters[ch.key]} />
            ))}
            <Section title="Sous-traitance (Pose & Confection)" items={chapters.sous_traitance} />
        </Box >
    );
}
