import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import { S } from '../../../lib/constants/ui';
import StockMovementsTab from './StockMovementsTab';
import StockInventoryTab from './StockInventoryTab';

// Mock Data for initial state
const INITIAL_MOVEMENTS = [
    { id: 1, date: new Date().toISOString(), type: 'IN', user: 'Aristide LENGLART', product: 'Velours Royal', ref: 'TIS-001', qty: 50, unit: 'ml', location: 'Étagère A1', project: 'Mme DUPONT' },
    { id: 2, date: new Date(Date.now() - 86400000).toISOString(), type: 'OUT', user: 'Aristide LENGLART', product: 'Velours Royal', ref: 'TIS-001', qty: 10, unit: 'ml', location: 'Étagère A1', project: 'Mme DUPONT' },
];

export default function StocksModule({ minutes = [], projects = [], onBack }) {
    const [tabIndex, setTabIndex] = useState(0);
    const [movements, setMovements] = useState(INITIAL_MOVEMENTS);

    const handleAddMovement = (movement) => {
        const newMov = {
            ...movement,
            id: Date.now(),
            date: new Date().toISOString(),
        };
        setMovements(prev => [newMov, ...prev]);
    };

    // Compute Inventory from Movements
    // In a real app this would be server-side or a more robust reducer
    const inventory = useMemo(() => {
        const inv = {};
        // Sort by date asc to replay history
        const sorted = [...movements].sort((a, b) => new Date(a.date) - new Date(b.date));

        sorted.forEach(mov => {
            const key = `${mov.product}_${mov.location}`; // Aggregate by Product + Location
            if (!inv[key]) {
                inv[key] = {
                    id: key,
                    product: mov.product,
                    ref: mov.ref,
                    location: mov.location,
                    qty: 0,
                    project: mov.project, // Last project association wins or 'Stock'
                    unit: mov.unit,
                    category: mov.category
                };
            }

            if (mov.type === 'IN') {
                inv[key].qty += Number(mov.qty);
            } else {
                inv[key].qty -= Number(mov.qty);
            }
        });

        // Filter out zero or negative qty if desired, or keep to show out of stock
        return Object.values(inv).filter(i => i.qty > 0);
    }, [movements]);

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
                        onAddMovement={handleAddMovement}
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
