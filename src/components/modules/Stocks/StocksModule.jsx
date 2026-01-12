import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import { S } from '../../../lib/constants/ui';
import StockMovementsTab from './StockMovementsTab';

import StockInventoryTab from './StockInventoryTab';
import { useAuth } from '../../../auth';
import { can } from '../../../lib/authz';
import MovementModal from './MovementModal'; // Imported Modal
import { PackagePlus, PackageMinus, ArrowLeftRight } from 'lucide-react'; // Icons

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
    const { currentUser } = useAuth();
    const canEdit = can(currentUser, 'inventory.edit');
    const [tabIndex, setTabIndex] = useState(0);

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState('IN');

    const handleOpenModal = (type) => {
        setModalType(type);
        setModalOpen(true);
    };

    const handleSaveMovement = (data) => {
        onAddMovement({ ...data, type: modalType });
        setModalOpen(false);
    };

    // PLUS BESOIN DE STATE LOCAL POUR LES MOUVEMENTS
    // PLUS BESOIN DE USEMEMO POUR L'INVENTAIRE (C'est Supabase qui gère)

    // Define Tabs
    const TABS = [
        { key: 0, label: "Journal des Mouvements" },
        { key: 1, label: "État du Stock" }
    ];

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#F9F7F2', p: 3, display: 'flex', flexDirection: 'column' }}>
            <div style={{ maxWidth: 1600, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>

                {/* 1. Header Row (Back/Title Left, Actions Right) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                    <div>
                        {onBack && (
                            <button
                                onClick={onBack}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: '#6B7280', fontWeight: 600, fontSize: 13,
                                    marginBottom: 12, padding: 0, display: 'flex', alignItems: 'center', gap: 4
                                }}
                            >
                                ← Retour
                            </button>
                        )}
                        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.5px' }}>Stocks & Approvisionnements</h1>
                    </div>

                    {/* Actions (Aligned with Title) */}
                    <div style={{ display: 'flex', gap: 12, paddingTop: 32 }}>
                        {canEdit && tabIndex === 0 && (
                            <>
                                <Button
                                    variant="contained"
                                    color="success"
                                    startIcon={<PackagePlus size={18} />}
                                    onClick={() => handleOpenModal('IN')}
                                    sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 2 }}
                                >
                                    Entrée
                                </Button>
                                <Button
                                    variant="contained"
                                    color="warning"
                                    startIcon={<PackageMinus size={18} />}
                                    onClick={() => handleOpenModal('OUT')}
                                    sx={{ fontWeight: 700, px: 3, color: 'white', textTransform: 'none', borderRadius: 2 }}
                                >
                                    Sortie
                                </Button>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    startIcon={<ArrowLeftRight size={18} />}
                                    onClick={() => handleOpenModal('MOVE')}
                                    sx={{ fontWeight: 700, px: 3, textTransform: 'none', borderRadius: 2 }}
                                >
                                    Changer Emplacement
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* 2. Nav Row (Centered) */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                    <div style={{
                        background: 'white',
                        borderRadius: 9999,
                        padding: 4,
                        display: 'flex',
                        gap: 4,
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                        border: '1px solid rgba(0,0,0,0.05)'
                    }}>
                        {TABS.map(t => (
                            <button
                                key={t.key}
                                onClick={() => setTabIndex(t.key)}
                                style={{
                                    padding: '8px 20px',
                                    borderRadius: 9999,
                                    fontSize: 14,
                                    fontWeight: 500,
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: tabIndex === t.key ? '#1E2447' : 'transparent',
                                    color: tabIndex === t.key ? 'white' : '#4B5563',
                                    transition: 'all 0.2s',
                                    boxShadow: tabIndex === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                    outline: 'none'
                                }}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 3. Content */}
                <div style={{ flex: 1 }}>
                    {tabIndex === 0 && (
                        <StockMovementsTab
                            movements={movements}
                            onAddMovement={onAddMovement}
                            minutes={minutes}
                            projects={projects}
                            inventory={inventory}
                            canEdit={canEdit}
                        />
                    )}
                    {tabIndex === 1 && (
                        <StockInventoryTab inventory={inventory} projects={projects} movements={movements} />
                    )}
                </div>
            </div>

            {/* MODAL FORM */}
            {modalOpen && (
                <MovementModal
                    open={modalOpen}
                    onClose={() => setModalOpen(false)}
                    type={modalType}
                    onSave={handleSaveMovement}
                    projects={projects}
                    inventory={inventory}
                />
            )}
        </Box>
    );
}
