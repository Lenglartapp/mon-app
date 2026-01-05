import React, { useState, useCallback } from 'react';
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

    const handleAddRow = () => {
        const newId = catalog.length > 0 ? Math.max(...catalog.map(r => r.id)) + 1 : 1;
        const newRow = {
            id: newId,
            name: '', // Will be computed
            provider: '',
            reference: '',
            color: '',
            category: '',
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

    // Helper for Category Chips (Pastel/Cute Style)
    const stringToColor = (string) => {
        if (!string) return '#eee';
        let hash = 0;
        for (let i = 0; i < string.length; i++) {
            hash = string.charCodeAt(i) + ((hash << 5) - hash);
        }
        // Generate color
        const c = (hash & 0x00ffffff).toString(16).toUpperCase();
        const hex = "00000".substring(0, 6 - c.length) + c;

        // Mix with white for pastel (Soft & Cute)
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        const mix = (val) => Math.round((val + 255) / 2);

        return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
    };

    const columns = [
        { field: 'provider', headerName: 'Fournisseur', width: 140, editable: true },
        { field: 'reference', headerName: 'Référence', width: 140, editable: true },
        { field: 'color', headerName: 'Coloris', width: 120, editable: true },
        // Name is hidden but maintained as the ID for other components
        { field: 'name', headerName: 'Nom Complet(ID)', width: 250, editable: false, description: 'Généré automatiquement (Fournisseur + Ref + Coloris)' },
        {
            field: 'category',
            headerName: 'Catégorie',
            width: 150,
            editable: true,
            type: 'singleSelect',
            valueOptions: ['Tissu', 'Rail', 'Passementerie'],
            renderCell: (params) => {
                if (!params.value) return null;
                let color = 'default';
                if (['Tissu', 'Confection', 'Doublure', 'Inter'].includes(params.value)) color = 'primary';
                else if (params.value === 'Rail' || params.value === 'Tringle') color = 'secondary';
                else if (params.value === 'Passementerie') color = 'warning';

                return (
                    <Chip
                        label={params.value}
                        color={color}
                        variant="filled"
                        size="small"
                        sx={{ fontWeight: 500 }}
                    />
                );
            }
        },
        {
            field: 'buyPrice',
            headerName: 'Prix Achat (€)',
            width: 130,
            editable: true,
            type: 'number',
            valueFormatter: (value) => {
                if (value === undefined || value === null || value === '') return '';
                return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
            }
        },
        {
            field: 'sellPrice',
            headerName: 'Prix Vente (€)',
            width: 130,
            editable: true,
            type: 'number',
            valueFormatter: (value) => {
                if (value === undefined || value === null || value === '') return '';
                return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
            }
        },
        { field: 'width', headerName: 'Laize (cm)', width: 100, editable: true, type: 'number' },
        { field: 'motif', headerName: 'Motif ?', width: 80, editable: true, type: 'boolean' },
        { field: 'raccord_v', headerName: 'Raccord V (cm)', width: 110, editable: true, type: 'number' },
        { field: 'raccord_h', headerName: 'Raccord H (cm)', width: 110, editable: true, type: 'number' },
        {
            field: 'unit',
            headerName: 'Unité',
            width: 100,
            editable: true,
            type: 'singleSelect',
            valueOptions: ['ml', 'm2', 'pce', 'h']
        },
    ];

    const [activeTab, setActiveTab] = React.useState('catalog');
    const [localSettings, setLocalSettings] = React.useState(props.settings || { taux_horaire: 135, prix_nuit: 180, prix_repas: 25 });

    // Track previous props to prevent overwrite loops caused by parent re-renders
    const prevSettingsRef = React.useRef(JSON.stringify(props.settings));

    React.useEffect(() => {
        const nextStr = JSON.stringify(props.settings);
        if (nextStr !== prevSettingsRef.current) {
            // Only update if external data genuinely changed
            setLocalSettings(props.settings);
            prevSettingsRef.current = nextStr;
        }
    }, [props.settings]);

    const onSettingsChange = props.onSettingsChange;

    // Debounce ref
    const debounceRef = React.useRef(null);

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

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 20 }}>
                    <span
                        onClick={() => setActiveTab('catalog')}
                        style={{ cursor: 'pointer', opacity: activeTab === 'catalog' ? 1 : 0.5, textDecoration: activeTab === 'catalog' ? 'underline' : 'none' }}
                    >
                        Bibliothèque d'Articles
                    </span>
                    <span
                        onClick={() => setActiveTab('settings')}
                        style={{ cursor: 'pointer', opacity: activeTab === 'settings' ? 1 : 0.5, textDecoration: activeTab === 'settings' ? 'underline' : 'none' }}
                    >
                        Paramètres Globaux
                    </span>
                </div>
                <IconButton onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ height: '70vh', p: 0 }}>
                {activeTab === 'catalog' ? (
                    <DataGrid
                        rows={catalog}
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
