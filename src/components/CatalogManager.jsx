import React, { useState, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
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

export default function CatalogManager({ open, onClose, catalog, onCatalogChange }) {
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

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Bibliothèque d'Articles (Tissuthèque)
                <IconButton onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ height: '70vh', p: 0 }}>
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
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} variant="contained">Fermer</Button>
            </DialogActions>
        </Dialog>
    );
}
