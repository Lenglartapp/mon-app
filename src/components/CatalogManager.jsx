import React, { useState, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
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
            name: 'Nouvel Article',
            category: 'Tissu',
            buyPrice: 0,
            sellPrice: 0,
            width: 140,
            motif: false,
            raccord_v: 0,
            raccord_h: 0,
            unit: 'ml'
        };
        onCatalogChange([...catalog, newRow]);
    };

    const handleDeleteRows = () => {
        const newCatalog = catalog.filter(r => !selectionModel.includes(r.id));
        onCatalogChange(newCatalog);
        setSelectionModel([]);
    };

    const processRowUpdate = (newRow) => {
        const updatedCatalog = catalog.map(r => r.id === newRow.id ? newRow : r);
        onCatalogChange(updatedCatalog);
        return newRow;
    };

    const columns = [
        { field: 'name', headerName: 'Nom', width: 250, editable: true },
        {
            field: 'category',
            headerName: 'Catégorie',
            width: 150,
            editable: true,
            type: 'singleSelect',
            valueOptions: ['Tissu', 'Voilage', 'Doublure', 'Tringle', 'Store', 'Accessoire', 'Main d\'œuvre']
        },
        {
            field: 'buyPrice',
            headerName: 'Prix Achat (€)',
            width: 130,
            editable: true,
            type: 'number',
            valueFormatter: (value) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
        },
        {
            field: 'sellPrice',
            headerName: 'Prix Vente (€)',
            width: 130,
            editable: true,
            type: 'number',
            valueFormatter: (value) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
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
    const settings = props.settings || { taux_horaire: 35, prix_nuit: 180, prix_repas: 25 };
    const onSettingsChange = props.onSettingsChange;

    const handleSettingChange = (key, val) => {
        if (onSettingsChange) {
            // Allow empty string to clear input, otherwise number
            const finalVal = val === '' ? '' : Number(val);
            onSettingsChange({ ...settings, [key]: finalVal });
        }
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
                                    value={settings.taux_horaire ?? ''}
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
                                    value={settings.prix_nuit ?? ''}
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
                                    value={settings.prix_repas ?? ''}
                                    onChange={(e) => handleSettingChange('prix_repas', e.target.value)}
                                    fullWidth
                                    variant="outlined"
                                    InputLabelProps={{ shrink: true }}
                                />
                                <small style={{ display: 'block', marginTop: 8, color: '#888' }}>Coût unitaire d'un repas par technicien.</small>
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
