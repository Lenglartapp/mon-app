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
import { aggregatePurchases } from '../lib/utils/aggregatePurchases';
import { COLORS, S } from '../lib/constants/ui';

const formatPrice = (p) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(p);

export default function ShoppingListScreen({ minutes = [] }) {
    const { tissus, rails, mecanismes, sous_traitance } = useMemo(() => aggregatePurchases(minutes), [minutes]);

    const exportCSV = () => {
        // Generate CSV content
        const header = ['Type', 'Article', 'Total Qty', 'Unité', 'Total HT', 'Zone', 'Pièce', 'Produit', 'Détail', 'Qté Ligne'];
        const rows = [];

        const addRows = (category, items, unit) => {
            items.forEach(item => {
                item.sources.forEach(src => {
                    rows.push([
                        category,
                        item.label,
                        item.total_qty.toString().replace('.', ','),
                        unit,
                        item.total_pa.toString().replace('.', ','),
                        src.zone,
                        src.piece,
                        src.produit,
                        src.detail || '',
                        src.quantite_ligne.toString().replace('.', ',')
                    ]);
                });
            });
        };

        addRows('Tissu', tissus, 'ml');
        addRows('Rail', rails, 'ml');
        addRows('Mécanisme', mecanismes, 'u');
        addRows('Sous-traitance', sous_traitance, 'intervention');

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

    const Section = ({ title, items, unit }) => (
        <div style={{ ...S.modernCard, padding: 24, marginBottom: 24 }}>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 700, fontSize: 16, color: '#374151', textTransform: 'uppercase' }}>
                {title}
            </Typography>

            {items.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    Aucun article dans cette section.
                </Typography>
            ) : (
                items.map((item, idx) => (
                    <Accordion key={`${item.label}-${idx}`} disableGutters elevation={0} sx={{ border: `1px solid ${COLORS.border}`, '&:before': { display: 'none' }, mb: 1, borderRadius: '8px !important' }}>
                        <AccordionSummary expandIcon={<ChevronDown size={20} />}>
                            <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', pr: 2 }}>
                                <Typography sx={{ fontWeight: 600 }}>{item.label}</Typography>
                                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                    <Chip
                                        label={`Total : ${Number(item.total_qty).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${unit}`}
                                        size="small"
                                        color="primary"
                                        variant="outlined"
                                    />
                                    <Chip
                                        label={`Coût : ${formatPrice(item.total_pa)}`}
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
                                        <TableCell align="right">Qté ({unit})</TableCell>
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
                                                {Number(src.quantite_ligne).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 500 }}>
                                                {formatPrice(src.cout_ligne)}
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

            <Section title="Tissus & Confection" items={tissus} unit="ml" />
            <Section title="Rails (au mètre linéaire)" items={rails} unit="ml" />
            <Section title="Mécanismes & Stores (à l'unité)" items={mecanismes} unit="u" />
            <Section title="Sous-traitance (Pose & Confection)" items={sous_traitance} unit="intervention" />
        </Box >
    );
}
