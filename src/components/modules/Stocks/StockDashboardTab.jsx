import React, { useMemo } from 'react';
import { Box, Grid, Paper, Typography, LinearProgress, Divider } from '@mui/material';
import { 
    AlertTriangle, 
    TrendingUp, 
    Layers, 
    Package, 
    CheckCircle2, 
    Clock,
    Activity,
    ArrowUpRight
} from 'lucide-react';
import { S, COLORS } from '../../../lib/constants/ui';

const CAPACITY_PLACEHOLDER = 5000; // Unités au total

export default function StockDashboardTab({ inventory = [], projects = [], movements = [] }) {
    
    // --- 1. Calculs des données ---
    
    const stats = useMemo(() => {
        // Occupation globale
        const totalQty = inventory.reduce((acc, item) => acc + (Number(item.qty) || 0), 0);
        const occupancyPct = Math.min(Math.round((totalQty / CAPACITY_PLACEHOLDER) * 100), 100);

        // Ventilation
        let reserved = 0;
        let deadStock = 0;
        
        inventory.forEach(item => {
            const q = Number(item.qty) || 0;
            if (item.project) {
                // Check project status for dead stock if project is archived
                const proj = projects.find(p => p.name === item.project || p.nom_dossier === item.project);
                if (proj?.status === 'ARCHIVED') deadStock += q;
                else reserved += q;
            } else if (item.location?.toLowerCase().includes('mort')) {
                deadStock += q;
            }
        });

        const freeSpace = Math.max(0, CAPACITY_PLACEHOLDER - totalQty);
        
        // Top 10
        const sortedInventory = [...inventory]
            .sort((a, b) => (Number(b.qty) || 0) - (Number(a.qty) || 0))
            .slice(0, 10);

        // Tension (Simulation basée sur projets actifs sans stock suffisant)
        const tensionAlerts = projects.filter(p => {
            if (p.status === 'DONE' || p.status === 'ARCHIVED' || p.status === 'Livré') return false;
            const hasStock = inventory.some(i => i.project === p.name || i.project === p.nom_dossier);
            return !hasStock;
        }).slice(0, 3);

        return {
            totalQty,
            occupancyPct,
            reserved,
            deadStock,
            freeSpace,
            top10: sortedInventory,
            tensionAlerts
        };
    }, [inventory, projects]);

    // --- 2. Styles Helper ---
    const cardStyle = {
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        height: '100%',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        border: '1px solid rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column'
    };

    const sectionTitleStyle = {
        fontSize: '14px',
        fontWeight: 700,
        color: '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    };

    return (
        <Box sx={{ flexGrow: 1, p: 1 }}>
            <Grid container spacing={3}>
                
                {/* BLOC 1: TAUX D'OCCUPATION (MAJEUR) */}
                <Grid item xs={12} md={4}>
                    <div style={cardStyle}>
                        <div style={sectionTitleStyle}>
                            <Activity size={18} color="#2563EB" /> 
                            Occupation Générale
                        </div>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                            <Box sx={{ position: 'relative', display: 'inline-flex', mb: 2 }}>
                                {/* Simple circular gauge with SVG */}
                                <svg width="160" height="160" viewBox="0 0 160 160">
                                    <circle cx="80" cy="80" r="70" fill="none" stroke="#E5E7EB" strokeWidth="12" />
                                    <circle 
                                        cx="80" cy="80" r="70" fill="none" stroke="#1E2447" 
                                        strokeWidth="12" strokeDasharray={440} 
                                        strokeDashoffset={440 - (440 * stats.occupancyPct) / 100}
                                        strokeLinecap="round"
                                        transform="rotate(-90 80 80)"
                                        style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                                    />
                                </svg>
                                <Box sx={{
                                    top: 0, left: 0, bottom: 0, right: 0,
                                    position: 'absolute', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    flexDirection: 'column'
                                }}>
                                    <Typography variant="h3" sx={{ fontWeight: 800, color: '#1E2447' }}>
                                        {stats.occupancyPct}%
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#6B7280', fontWeight: 600 }}>
                                        PLEIN
                                    </Typography>
                                </Box>
                            </Box>
                            <Typography variant="body2" sx={{ textAlign: 'center', color: '#6B7280' }}>
                                <strong>{stats.totalQty.toLocaleString()}</strong> unités occupées sur <strong>{CAPACITY_PLACEHOLDER.toLocaleString()}</strong> de capacité théorique.
                            </Typography>
                        </Box>
                    </div>
                </Grid>

                {/* BLOC 2: VISION VENTILÉE (GRAPHIQUE ANNEAU) */}
                <Grid item xs={12} md={4}>
                    <div style={cardStyle}>
                        <div style={sectionTitleStyle}>
                            <Layers size={18} color="#9333EA" /> 
                            Ventilation du Stock
                        </div>
                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            {[
                                { label: 'Stock Réservé', val: stats.reserved, color: '#1E2447', icon: <CheckCircle2 size={14} /> },
                                { label: 'Stock Mort', val: stats.deadStock, color: '#EF4444', icon: <Clock size={14} /> },
                                { label: 'Espace Libre', val: stats.freeSpace, color: '#10B981', icon: <TrendingUp size={14} /> }
                            ].map((item, i) => {
                                const pct = Math.round((item.val / CAPACITY_PLACEHOLDER) * 100);
                                return (
                                    <Box key={i} sx={{ mb: 2 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, alignItems: 'center' }}>
                                            <Typography variant="body2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <span style={{ color: item.color }}>{item.icon}</span> {item.label}
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                {pct}% <span style={{ color: '#9CA3AF', fontWeight: 400, fontSize: 11 }}>({item.val.toLocaleString()})</span>
                                            </Typography>
                                        </Box>
                                        <LinearProgress 
                                            variant="determinate" 
                                            value={pct} 
                                            sx={{ 
                                                height: 8, 
                                                borderRadius: 4, 
                                                bgcolor: '#F3F4F6',
                                                '& .MuiLinearProgress-bar': { bgcolor: item.color, borderRadius: 4 }
                                            }} 
                                        />
                                    </Box>
                                );
                            })}
                        </Box>
                    </div>
                </Grid>

                {/* BLOC 3: ANTICIPATION DE TENSION */}
                <Grid item xs={12} md={4}>
                    <div style={cardStyle}>
                        <div style={sectionTitleStyle}>
                            <AlertTriangle size={18} color="#F59E0B" /> 
                            Alertes de Tension Immineante
                        </div>
                        <Box sx={{ flex: 1 }}>
                            {stats.tensionAlerts.length > 0 ? (
                                stats.tensionAlerts.map((p, i) => (
                                    <Paper key={i} elevation={0} sx={{ p: 2, mb: 1.5, bgcolor: '#FFFBEB', border: '1px solid #FEF3C7', borderRadius: '12px' }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <Box>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#92400E' }}>
                                                    Projet: {p.nom}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: '#B45309', display: 'block', mt: 0.5 }}>
                                                    Métrages chiffrés mais non réceptionnés. Volume estimé critique.
                                                </Typography>
                                            </Box>
                                            <ArrowUpRight size={16} color="#B45309" />
                                        </Box>
                                    </Paper>
                                ))
                            ) : (
                                <Box sx={{ textAlign: 'center', mt: 4, opacity: 0.5 }}>
                                    <CheckCircle2 size={40} style={{ marginBottom: 8 }} />
                                    <Typography variant="body2">Aucune tension détectée sur le flux entrant.</Typography>
                                </Box>
                            )}
                        </Box>
                    </div>
                </Grid>

                {/* BLOC 4: TOP 10 OCCUPATIONS (LARGE) */}
                <Grid item xs={12}>
                    <div style={cardStyle}>
                        <div style={sectionTitleStyle}>
                            <Package size={18} color="#111827" /> 
                            Top 10 des Références par Occupation
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '12px', color: '#6B7280', fontSize: '11px', textTransform: 'uppercase' }}>Référence / Tissu</th>
                                        <th style={{ textAlign: 'left', padding: '12px', color: '#6B7280', fontSize: '11px', textTransform: 'uppercase' }}>Projet Associé</th>
                                        <th style={{ textAlign: 'left', padding: '12px', color: '#6B7280', fontSize: '11px', textTransform: 'uppercase' }}>Emplacement</th>
                                        <th style={{ textAlign: 'right', padding: '12px', color: '#6B7280', fontSize: '11px', textTransform: 'uppercase' }}>Quantité</th>
                                        <th style={{ textAlign: 'right', padding: '12px', color: '#6B7280', fontSize: '11px', textTransform: 'uppercase' }}>% Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.top10.map((item, i) => (
                                        <tr key={i} style={{ borderTop: i === 0 ? 'none' : '1px solid #F3F4F6' }}>
                                            <td style={{ padding: '12px', fontWeight: 600, fontSize: '14px' }}>
                                                <div>{item.product || 'N/A'}</div>
                                                <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 400 }}>Réf: {item.ref || '-'}</div>
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                {item.project ? (
                                                    <span style={{ background: '#EFF6FF', color: '#1E40AF', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                                                        {item.project}
                                                    </span>
                                                ) : <span style={{ color: '#9CA3AF', fontSize: '12px' }}>Stock Libre</span>}
                                            </td>
                                            <td style={{ padding: '12px', fontSize: '13px', color: '#4B5563' }}>{item.location || '-'}</td>
                                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>{Number(item.qty).toLocaleString()}</td>
                                            <td style={{ padding: '12px', textAlign: 'right' }}>
                                                {stats.totalQty > 0 ? Math.round((Number(item.qty) / stats.totalQty) * 100) : 0}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </Grid>

            </Grid>
        </Box>
    );
}
