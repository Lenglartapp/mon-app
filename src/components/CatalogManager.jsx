import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { DataGrid, GridToolbarContainer, GridToolbarFilterButton } from '@mui/x-data-grid';
import { frFR } from '@mui/x-data-grid/locales';
import { Plus, Trash2 } from 'lucide-react';
import { COLORS } from '../lib/constants/ui';

// Helper Style Island Nav (Copied from ChiffrageScreen)
const getNavStyle = (isActive) => ({
    padding: '6px 16px', // Reduced padding for finer look
    borderRadius: 99,
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    transition: 'all 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
    outline: 'none',
    background: isActive ? '#1E2447' : 'transparent',
    color: isActive ? '#FFFFFF' : '#4B5563',
    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
});

function CatalogToolbar({ onAdd, onDelete, selectedCount }) {
    return (
        <GridToolbarContainer style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', gap: 10, marginRight: 'auto' }}>
                <button
                    onClick={onAdd}
                    style={{ cursor: 'pointer', padding: '6px 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                    <Plus size={16} /> Ajouter Article
                </button>
                {selectedCount > 0 && (
                    <button
                        onClick={onDelete}
                        style={{ cursor: 'pointer', padding: '6px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        <Trash2 size={16} /> Supprimer ({selectedCount})
                    </button>
                )}
            </div>
            <GridToolbarFilterButton />
        </GridToolbarContainer>
    );
}

export default function CatalogManager({ open, onClose, catalog, onCatalogChange, ...props }) {
    const [selectionModel, setSelectionModel] = useState([]);
    const [activeTab, setActiveTab] = React.useState('catalog');
    const [activeCategoryTab, setActiveCategoryTab] = React.useState('tissus'); // New Sub-tab state
    const [localSettings, setLocalSettings] = React.useState(props.settings || { taux_horaire: 135, prix_nuit: 180, prix_repas: 25 });

    // Track previous props to prevent overwrite loops caused by parent re-renders
    const prevSettingsRef = useRef(JSON.stringify(props.settings));

    useEffect(() => {
        const nextStr = JSON.stringify(props.settings);
        if (nextStr !== prevSettingsRef.current) {
            // Only update if external data genuinely changed
            setLocalSettings(props.settings);
            prevSettingsRef.current = nextStr;
        }
    }, [props.settings]);

    const onSettingsChange = props.onSettingsChange;
    // Debounce ref
    const debounceRef = useRef(null);

    const handleSettingChange = (key, val) => {
        // 1. Update local UI immediately
        const finalVal = val === '' ? '' : Number(val);
        const newSettings = { ...localSettings, [key]: finalVal };
        setLocalSettings(newSettings);

        // 2. Debounce parent update
        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            if (onSettingsChange) {
                onSettingsChange(newSettings);
            }
        }, 800);
    };

    const handleDeleteRows = () => {
        const newCatalog = catalog.filter(r => !selectionModel.includes(r.id));
        onCatalogChange(newCatalog);
        setSelectionModel([]);
    };

    const processRowUpdate = (newRow) => {
        // Auto-concat logic: Fournisseur + Référence + Coloris
        const nameParts = [newRow.provider, newRow.reference, newRow.color].filter(Boolean);
        const name = nameParts.length > 0 ? nameParts.join(' ') : 'Article Sans Nom';
        const updatedRow = { ...newRow, name };

        const updatedCatalog = catalog.map(r => r.id === newRow.id ? updatedRow : r);
        onCatalogChange(updatedCatalog);
        return updatedRow;
    };

    // Filtered Rows for DataGrid
    const filteredRows = useMemo(() => {
        if (!catalog) return [];
        if (activeCategoryTab === 'tissus') {
            return catalog.filter(r => ['Tissu', 'Tissus', 'Doublure', 'Doublures', 'Inter', 'Confection'].includes(r.category));
        }
        if (activeCategoryTab === 'rails') {
            return catalog.filter(r => ['Rail', 'Rails', 'Tringle', 'Mecanisme', 'Mécanisme'].includes(r.category));
        }
        if (activeCategoryTab === 'stores') {
            return catalog.filter(r => ['Store', 'Stores', 'Mecanisme Store'].includes(r.category));
        }
        if (activeCategoryTab === 'passementerie') {
            return catalog.filter(r => ['Passementerie'].includes(r.category));
        }
        return catalog;
    }, [catalog, activeCategoryTab]);

    const handleAddRow = () => {
        const newId = catalog.length > 0 ? Math.max(...catalog.map(r => r.id)) + 1 : 1;

        // Determine category based on active tab
        let defaultCategory = 'Tissu';
        if (activeCategoryTab === 'rails') defaultCategory = 'Rail';
        if (activeCategoryTab === 'stores') defaultCategory = 'Store';
        if (activeCategoryTab === 'passementerie') defaultCategory = 'Passementerie';

        const newRow = {
            id: newId,
            name: '', // Will be computed
            provider: '',
            reference: '',
            color: '',
            category: defaultCategory, // Pre-fill based on tab
            buyPrice: undefined,
            sellPrice: undefined,
            width: undefined,
            motif: false,
            raccord_v: undefined,
            raccord_h: undefined,
            unit: 'ml'
        };
        // Auto-compute name immediately
        newRow.name = 'Nouvel Article (à compléter)';
        onCatalogChange([...catalog, newRow]);
    };

    const columns = useMemo(() => {
        const base = [
            { field: 'provider', headerName: 'Fournisseur', width: 140, editable: true },
            { field: 'reference', headerName: 'Référence', width: 140, editable: true },
            { field: 'color', headerName: 'Coloris', width: 120, editable: true },
            { field: 'name', headerName: 'Nom Complet(ID)', width: 250, editable: false, description: 'Généré automatiquement (Fournisseur + Ref + Coloris)' },
        ];

        const priceCols = [
            {
                field: 'buyPrice',
                headerName: 'Prix Achat (€)',
                width: 130,
                editable: (params) => params.row.unit !== 'pce', // Lock if Piece
                type: 'number',
                valueFormatter: (value) => {
                    if (value === undefined || value === null || value === '') return '';
                    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
                },
                renderCell: (params) => {
                    if (params.row.unit === 'pce') {
                        return <span style={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: 11 }}>Voir tableau</span>;
                    }
                    if (params.value === undefined || params.value === null || params.value === '') return '';
                    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(params.value);
                }
            },
            {
                field: 'sellPrice',
                headerName: 'Prix Vente (€)',
                width: 130,
                editable: (params) => params.row.unit !== 'pce', // Lock if Piece
                type: 'number',
                valueFormatter: (value) => {
                    if (value === undefined || value === null || value === '') return '';
                    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
                },
                renderCell: (params) => {
                    if (params.row.unit === 'pce') {
                        return <span style={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: 11 }}>Voir tableau</span>;
                    }
                    if (params.value === undefined || params.value === null || params.value === '') return '';
                    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(params.value);
                }
            },
            {
                field: 'unit',
                headerName: 'Unité',
                width: 100,
                editable: true,
                type: 'singleSelect',
                valueOptions: ['ml', 'm2', 'pce', 'h']
            },
        ];

        const fabricCols = [
            { field: 'width', headerName: 'Laize (cm)', width: 100, editable: true, type: 'number' },
            { field: 'motif', headerName: 'Motif ?', width: 80, editable: true, type: 'boolean' },
            { field: 'raccord_v', headerName: 'Raccord V (cm)', width: 110, editable: true, type: 'number' },
            { field: 'raccord_h', headerName: 'Raccord H (cm)', width: 110, editable: true, type: 'number' },
        ];

        let cols = [...base];

        // PA / PV / Unit: Visible for Tissus, Rails AND Passementerie
        if (['tissus', 'rails', 'passementerie'].includes(activeCategoryTab)) {
            cols = [...cols, ...priceCols];
        }

        // Fabric Specs (Laize, Motif, Raccords): Visible for Tissus ONLY
        if (activeCategoryTab === 'tissus') {
            cols = [...cols, ...fabricCols];
        }

        return cols;
    }, [activeCategoryTab]);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle sx={{ m: 0, p: 2, background: COLORS.page }}>
                {/* Header Row: Titles + Close */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 20 }}>
                        <span
                            onClick={() => setActiveTab('catalog')}
                            style={{ cursor: 'pointer', opacity: activeTab === 'catalog' ? 1 : 0.5, textDecoration: activeTab === 'catalog' ? 'underline' : 'none', fontWeight: activeTab === 'catalog' ? 'bold' : 'normal' }}
                        >
                            Bibliothèque d'Articles
                        </span>
                        <span
                            onClick={() => setActiveTab('settings')}
                            style={{ cursor: 'pointer', opacity: activeTab === 'settings' ? 1 : 0.5, textDecoration: activeTab === 'settings' ? 'underline' : 'none', fontWeight: activeTab === 'settings' ? 'bold' : 'normal' }}
                        >
                            Paramètres Globaux
                        </span>
                    </div>
                    <IconButton onClick={onClose}>
                        <CloseIcon />
                    </IconButton>
                </div>

                {/* Sub-Tabs (Capsule Style) - Centered below title */}
                {activeTab === 'catalog' && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                        <div style={{
                            display: 'inline-flex',
                            background: 'white', // White background as requested
                            padding: 3, // Reduced container padding
                            borderRadius: 99,
                            gap: 4,
                            flexWrap: 'wrap',
                            justifyContent: 'center',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', // Drop Shadow
                            border: '1px solid #f3f4f6' // Subtle border to ensure visibility on white dialog
                        }}>
                            {['tissus', 'rails', 'stores', 'passementerie'].map((tab) => (
                                <button
                                    key={tab}
                                    style={getNavStyle(activeCategoryTab === tab)}
                                    onClick={() => setActiveCategoryTab(tab)}
                                >
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </DialogTitle>
            <DialogContent dividers sx={{ height: '70vh', p: 0, background: 'white' }}>
                {activeTab === 'catalog' ? (
                    <DataGrid
                        rows={filteredRows}
                        columns={columns}
                        processRowUpdate={processRowUpdate}
                        checkboxSelection
                        disableRowSelectionOnClick
                        rowSelectionModel={selectionModel}
                        onRowSelectionModelChange={setSelectionModel}
                        slots={{ toolbar: CatalogToolbar }}
                        slotProps={{
                            toolbar: { onAdd: handleAddRow, onDelete: handleDeleteRows, selectedCount: selectionModel.length }
                        }}
                        localeText={frFR.components.MuiDataGrid.defaultProps.localeText}
                    />
                ) : (
                    <div style={{ padding: 40, display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 600, margin: '0 auto' }}>
                        <h3>Paramètres de Chiffrage par Défaut</h3>
                        <p style={{ color: '#666' }}>Ces valeurs servent de base pour les calculs automatiques (Pose, Confection, Déplacements).</p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                            <div style={{ border: '1px solid #ddd', padding: 20, borderRadius: 8 }}>
                                <TextField
                                    label="Taux Horaire (€/h)"
                                    type="number"
                                    value={localSettings.taux_horaire ?? ''}
                                    onChange={(e) => handleSettingChange('taux_horaire', e.target.value)}
                                    fullWidth
                                    variant="outlined"
                                    InputLabelProps={{ shrink: true }}
                                />
                                <small style={{ display: 'block', marginTop: 8, color: '#888' }}>Utilisé pour la main d'œuvre (Pose, Confection, Prépa).</small>
                            </div>

                            <div style={{ border: '1px solid #ddd', padding: 20, borderRadius: 8 }}>
                                <TextField
                                    label="Prix Nuit Hôtel (€)"
                                    type="number"
                                    value={localSettings.prix_nuit ?? ''}
                                    onChange={(e) => handleSettingChange('prix_nuit', e.target.value)}
                                    fullWidth
                                    variant="outlined"
                                    InputLabelProps={{ shrink: true }}
                                />
                                <small style={{ display: 'block', marginTop: 8, color: '#888' }}>Coût unitaire d'une nuitée par technicien.</small>
                            </div>

                            <div style={{ border: '1px solid #ddd', padding: 20, borderRadius: 8 }}>
                                <TextField
                                    label="Prix Repas (€)"
                                    type="number"
                                    value={localSettings.prix_repas ?? ''}
                                    onChange={(e) => handleSettingChange('prix_repas', e.target.value)}
                                    fullWidth
                                    variant="outlined"
                                    InputLabelProps={{ shrink: true }}
                                />
                                <small style={{ display: 'block', marginTop: 8, color: '#888' }}>Coût unitaire d'un repas par technicien.</small>
                            </div>

                            <div style={{ border: '1px solid #ddd', padding: 20, borderRadius: 8 }}>
                                <TextField
                                    label="Coeff. Marge Sous-traitance"
                                    type="number"
                                    value={localSettings.coef_sous_traitance ?? 2}
                                    onChange={(e) => handleSettingChange('coef_sous_traitance', e.target.value)}
                                    fullWidth
                                    variant="outlined"
                                    inputProps={{ step: "0.1" }}
                                    InputLabelProps={{ shrink: true }}
                                />
                                <small style={{ display: 'block', marginTop: 8, color: '#888' }}>Multiplicateur appliqué au PA sous-traitance pour obtenir le PV.</small>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} variant="contained">Fermer</Button>
            </DialogActions>
        </Dialog>
    );
}
