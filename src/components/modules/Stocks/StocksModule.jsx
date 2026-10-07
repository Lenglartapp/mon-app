import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import { S } from '../../../lib/constants/ui';
import StockMovementsTab from './StockMovementsTab';

import StockInventoryTab from './StockInventoryTab';
import StockDashboardTab from './StockDashboardTab';
import StockRequestsPanel from './StockRequestsPanel';
import { useAuth } from '../../../auth';
import { can } from '../../../lib/authz';
import MovementModal from './MovementModal'; // Imported Modal
import { useWarehouseZones } from '../../../hooks/useSupabase';
import { PackagePlus, PackageMinus, ArrowLeftRight } from 'lucide-react'; // Icons
import { ToolbarButton } from '../../ui/ToolbarControls';

// Mock Data for initial state
export default function StocksModule({
    minutes = [],
    projects = [],
    onBack,
    // On récupère les props injectées par App.jsx
    inventory = [],
    movements = [],
    onAddMovement,
    onBulkMovement,
    onUpdateItem,
    onStockChanged
}) {
    const { currentUser } = useAuth();
    const canEdit = can(currentUser, 'inventory.edit');
    const { zones } = useWarehouseZones();
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
        { key: 0, label: "Dashboard" },
        { key: 1, label: "Journal des mouvements" },
        { key: 2, label: "État du stock" },
        { key: 3, label: "Mise à disposition" }
    ];

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#FFFFFF', p: 3, display: 'flex', flexDirection: 'column', width: '100%' }}>
            {/* Contenu centré (1600 px max), comme Logistique / Performance */}
            <div style={{ width: '100%', maxWidth: 1600, margin: '0 auto', display: 'flex', flexDirection: 'column', flex: 1 }}>

                {/* 1. Header Row (Back/Title Left, Actions Right) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                    <div>
                        {onBack && (
                            <button
                                onClick={onBack}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: '#6B7280', fontWeight: 600, fontSize: 13,
                                    marginBottom: 4, padding: 0, display: 'flex', alignItems: 'center', gap: 4
                                }}
                            >
                                ← Retour
                            </button>
                        )}
                        <h1 style={{ fontSize: 32, fontWeight: 400, fontFamily: 'Roboto, system-ui, sans-serif', color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>Inventaire</h1>
                    </div>

                </div>

                {/* 2. Onglets : mêmes pastilles que les vues du chiffrage (Minutes / Liste Achats / Moulinette),
                    sans cadre autour ; un peu d'air avant le contenu */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginBottom: 36 }}>
                    {TABS.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTabIndex(t.key)}
                            style={{
                                padding: '8px 20px',
                                borderRadius: 99,
                                fontSize: 14,
                                fontWeight: 500,
                                border: 'none',
                                cursor: 'pointer',
                                background: tabIndex === t.key ? '#1E2447' : 'transparent',
                                color: tabIndex === t.key ? '#FFFFFF' : '#4B5563',
                                transition: 'all 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
                                boxShadow: tabIndex === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                outline: 'none'
                            }}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* 3. Content */}
                <div style={{ flex: 1 }}>
                    {tabIndex === 0 && (
                        <StockDashboardTab
                            inventory={inventory}
                            projects={projects}
                            movements={movements}
                            zones={zones}
                        />
                    )}
                    {tabIndex === 1 && (
                        <StockMovementsTab
                            movements={movements}
                            onAddMovement={onAddMovement}
                            minutes={minutes}
                            projects={projects}
                            inventory={inventory}
                            canEdit={canEdit}
                            actions={canEdit ? (
                                <>
                                    <ToolbarButton icon={<PackagePlus size={16} />} onClick={() => handleOpenModal('IN')}>Entrée</ToolbarButton>
                                    <ToolbarButton icon={<PackageMinus size={16} />} onClick={() => handleOpenModal('OUT')}>Sortie</ToolbarButton>
                                    <ToolbarButton icon={<ArrowLeftRight size={16} />} onClick={() => handleOpenModal('MOVE')}>Changer d'emplacement</ToolbarButton>
                                </>
                            ) : null}
                        />
                    )}
                    {tabIndex === 2 && (
                        <StockInventoryTab
                            inventory={inventory}
                            projects={projects}
                            movements={movements}
                            onBulkMovement={onBulkMovement}
                            onUpdateItem={onUpdateItem}
                            zones={zones}
                        />
                    )}
                    {tabIndex === 3 && (
                        <StockRequestsPanel inventory={inventory} onStockChanged={onStockChanged} />
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
                    zones={zones}
                />
            )}
        </Box>
    );
}
