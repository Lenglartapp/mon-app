import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import { S } from '../../../lib/constants/ui';
import StockMovementsTab from './StockMovementsTab';
import StockInventoryTab from './StockInventoryTab';

// Mock Data for initial state
export default function StocksModule({
    minutes = [],
    projects = [],
    onBack,
    // On récupère les props injectées par App.jsx
    inventory = [],
    movements = [],
    onAddMovement
}) {
    const [tabIndex, setTabIndex] = useState(0);

    // PLUS BESOIN DE STATE LOCAL POUR LES MOUVEMENTS
    // PLUS BESOIN DE USEMEMO POUR L'INVENTAIRE (C'est Supabase qui gère)

    // Define Tabs
    const TABS = [
        { key: 0, label: "Journal des Mouvements" },
        { key: 1, label: "État du Stock" }
    ];

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#F9F7F2', p: 3, display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    {onBack && (
                        <Button
                            startIcon={<ArrowBackIcon />}
                            onClick={onBack}
                            variant="outlined"
                            sx={{ bgcolor: 'white', border: '1px solid #E5E7EB', color: '#374151', textTransform: 'none', fontWeight: 600 }}
                        >
                            Retour
                        </Button>
                    )}
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#1F2937', m: 0 }}>
                        Stocks & Approvisionnements
                    </Typography>
                </Box>

                {/* Custom Pills similar to Chiffrage/Production */}
                <div style={S.pills}>
                    {TABS.map(t => (
                        <button
                            key={t.key}
                            style={S.pill(tabIndex === t.key)}
                            onClick={() => setTabIndex(t.key)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1 }}>
                {tabIndex === 0 && (
                    <StockMovementsTab
                        movements={movements}
                        onAddMovement={onAddMovement}
                        minutes={minutes} // Fallback
                        projects={projects} // Main source for Production items
                        inventory={inventory} // <--- AJOUT INDISPENSABLE
                    />
                )}
                {tabIndex === 1 && (
                    <StockInventoryTab inventory={inventory} projects={projects} movements={movements} />
                )}
            </Box>
        </Box>
    );
}
