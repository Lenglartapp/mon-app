// src/components/MinuteGrid.jsx
import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    DataGrid,
    GridToolbarContainer,
    GridToolbarColumnsButton,
    GridToolbarFilterButton,
    GridToolbarDensitySelector
} from '@mui/x-data-grid';
import { frFR } from '@mui/x-data-grid/locales';
import { schemaToGridCols } from '../lib/utils/schemaToGridCols.jsx';
import { recomputeRow } from '../lib/formulas/recomputeRow';
import { generateRowLogs } from '../lib/utils/logUtils';

import { Plus, Trash2, FileDown, FileUp } from 'lucide-react';

function CustomToolbar({ onAdd, onDelete, selectedCount, onImportExcel, readOnly }) {
    const fileInputRef = React.useRef(null);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file && onImportExcel) {
            onImportExcel(file);
        }
        // Reset input
        e.target.value = '';
    };

    return (
        <GridToolbarContainer style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', gap: 10, marginRight: 'auto' }}>
                {!readOnly && (
                    <button
                        onClick={onAdd}
                        style={{ cursor: 'pointer', padding: '6px 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        <Plus size={16} /> Ajouter
                    </button>
                )}
                {selectedCount > 0 && !readOnly && (
                    <button
                        onClick={onDelete}
                        style={{ cursor: 'pointer', padding: '6px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        <Trash2 size={16} /> Supprimer ({selectedCount})
                    </button>
                )}

                {/* Excel Actions */}
                {onImportExcel && !readOnly && (
                    <>
                        <button
                            onClick={handleImportClick}
                            style={{ cursor: 'pointer', padding: '6px 12px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6, color: '#374151' }}
                            title="Importer un fichier Excel rempli"
                        >
                            <FileUp size={16} /> Importer
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept=".xlsx, .xls"
                            onChange={handleFileChange}
                        />
                    </>
                )}
            </div>
            <GridToolbarColumnsButton />
            <GridToolbarFilterButton />
            <GridToolbarDensitySelector />
        </GridToolbarContainer>
    );
}

const EMPTY_CTX = {};

import LineDetailPanel from './LineDetailPanel';

export default function MinuteGrid({
    rows,
    onRowsChange,
    schema,
    enableCellFormulas = true,
    formulaCtx = {},
    title,
    catalog = [],
    railOptions = [],
    onAdd,
    initialVisibilityModel = {},
    onImportExcel,
    onDuplicateRow,
    hideCroquis = false,
    minuteId,    // <--- NEW
    projectId,   // <--- NEW for Production
    onRowClick,   // <--- NEW for Panel Opening
    readOnly = false, // <--- NEW ReadOnly Mode

    currentUser, // <--- NEW IDENTITY
    isMobile = false // <--- NEW Mobile Prop
}) {
    const [rowSelectionModel, setRowSelectionModel] = useState([]);
    const [detailRowId, setDetailRowId] = useState(null);
    const [columnVisibilityModel, setColumnVisibilityModel] = useState(initialVisibilityModel);

    const navigate = useNavigate();

    // Navigate to nested route for detail
    const handleOpenDetail = useCallback((row) => {
        console.log('Click row:', row.id);
        if (onRowClick) {
            onRowClick(row.id); // On appelle le parent (ChiffrageScreen ou ProductionProjectScreen)
        }
    }, [onRowClick]);

    const handleDetailRowChange = useCallback((updatedRow) => {
        // Update the row in the main rows array
        const newRows = rows.map(r => r.id === updatedRow.id ? updatedRow : r);
        onRowsChange(newRows);
    }, [rows, onRowsChange]);

    const handleAddRow = useCallback(() => {
        if (onAdd) {
            onAdd();
            return;
        }
        // Placeholder for adding a new row
        // You'll need to define the structure of a new row based on your schema
        const newId = Math.max(...rows.map(r => r.id), 0) + 1;
        const newRow = { id: newId, ...Object.fromEntries(schema.map(col => [col.key, ''])) }; // Basic new row
        onRowsChange([...rows, newRow]);
    }, [rows, onRowsChange, schema, onAdd]);

    const handleDeleteRows = useCallback(() => {
        const newRows = rows.filter(r => !rowSelectionModel.includes(r.id));
        onRowsChange(newRows);
        setRowSelectionModel([]); // Clear selection after deletion
    }, [rows, onRowsChange, rowSelectionModel]);

    // Callback specific for Photo Cell update (bypass standard edit mode)
    const handlePhotoChange = useCallback((id, field, value) => {
        const newRows = rows.map(r => {
            if (r.id === id) {
                return { ...r, [field]: value };
            }
            return r;
        });
        onRowsChange(newRows);
    }, [rows, onRowsChange]);

    const columns = useMemo(() => {
        const cols = schemaToGridCols(schema, enableCellFormulas, handleOpenDetail, catalog, railOptions, handlePhotoChange, onDuplicateRow, hideCroquis, readOnly);

        // MOBILE OPTIMIZATION
        if (isMobile) {
            // Force only specific columns: Piece, Produit, Statuts
            // Note: 'statut' might need to cover multiple fields like 'statut_conf', 'statut_pose' etc.
            // Or we rely on 'detail' column or specific keys.
            // User asked for "Vitales: piece, produit, statut".
            const mobileKeys = ['piece', 'produit', 'statut_cotes', 'statut_prepa', 'statut_conf', 'statut_pose'];
            return cols.filter(c => mobileKeys.includes(c.field) || c.field === 'detail');
        }
        return cols;
    }, [schema, enableCellFormulas, handleOpenDetail, catalog, railOptions, handlePhotoChange, onDuplicateRow, hideCroquis, readOnly, isMobile]);

    // detailRow is now state, no need for useMemo lookup

    const processRowUpdate = useCallback(
        (newRow, oldRow) => {
            let updatedRow = { ...newRow };
            const cellFx = { ...(oldRow.__cellFormulas || {}) };
            let hasOverride = false;

            // 1. Check for Catalog Auto-fill
            // Detect which column changed and if it's a catalog-linked column
            const changedKey = Object.keys(newRow).find(k => newRow[k] !== oldRow[k]);

            // List of columns that might be linked to catalog (e.g. tissu_deco_1, tissu_deco_2, doublure, produit)
            const isCatalogColumn = changedKey && (
                changedKey.includes('tissu') ||
                changedKey.includes('doublure') ||
                changedKey === 'produit'
            );

            if (isCatalogColumn) {
                const articleName = newRow[changedKey];
                const article = catalog.find(a => a.name === articleName);

                if (article) {
                    // Define specific mappings for known catalog columns
                    const mapping = {};

                    if (changedKey === 'tissu_deco1') {
                        mapping.laize = 'laize_tissu_deco1';
                        mapping.motif = 'motif_deco1';
                        mapping.rv = 'raccord_v1';
                        mapping.rh = 'raccord_h1';
                        mapping.pa = 'pa_tissu_deco1';
                        mapping.pv = 'pv_tissu_deco1';
                    } else if (changedKey === 'tissu_deco2') {
                        mapping.laize = 'laize_tissu_deco2';
                        mapping.motif = 'motif_deco2';
                        mapping.rv = 'raccord_v2';
                        mapping.rh = 'raccord_h2';
                        mapping.pa = 'pa_tissu_deco2';
                        mapping.pv = 'pv_tissu_deco2';
                    } else if (changedKey === 'doublure') {
                        mapping.laize = 'laize_doublure';
                        mapping.pa = 'pa_doublure';
                        mapping.pv = 'pv_doublure';
                        // Doublure usually has no motif/raccord logic in this schema context, but safe to ignore if undefined
                    } else if (changedKey === 'inter_doublure') {
                        mapping.laize = 'laize_inter';
                        mapping.pa = 'pa_inter';
                        mapping.pv = 'pv_inter';
                    } else if (changedKey === 'produit') {
                        // Generic fallback for simple product selection if needed
                        // But usually 'produit' is the category, not the fabric itself.
                        // Keeping empty to avoid unwanted overwrites unless specific logic is requested.
                    }

                    // Apply updates based on mapping
                    if (mapping.laize && schema.some(c => c.key === mapping.laize)) updatedRow[mapping.laize] = article.width;
                    // Logic moved to recomputeRow.j (Calculation based on ML)
                    // if (mapping.pa && schema.some(c => c.key === mapping.pa)) updatedRow[mapping.pa] = article.buyPrice;
                    // if (mapping.pv && schema.some(c => c.key === mapping.pv)) updatedRow[mapping.pv] = article.sellPrice;

                    if (mapping.motif && schema.some(c => c.key === mapping.motif)) {
                        // Motif is text in schema ("Motif Déco 1"), assuming boolean or text conversion
                        // If article.motif is bool, maybe convert to "Oui"/"Non" or keep bool if schema allows
                        updatedRow[mapping.motif] = article.motif ? "Oui" : "Non";
                    }

                    if (article.motif) {
                        if (mapping.rv && schema.some(c => c.key === mapping.rv)) updatedRow[mapping.rv] = article.raccord_v;
                        if (mapping.rh && schema.some(c => c.key === mapping.rh)) updatedRow[mapping.rh] = article.raccord_h;
                    } else {
                        if (mapping.rv && schema.some(c => c.key === mapping.rv)) updatedRow[mapping.rv] = 0;
                        if (mapping.rh && schema.some(c => c.key === mapping.rh)) updatedRow[mapping.rh] = 0;
                    }
                }
            }

            // 2. Handle Formulas
            schema.forEach((col) => {
                if (col.type === 'formula' || enableCellFormulas) {
                    const key = col.key;
                    const oldVal = oldRow[key];
                    const newVal = newRow[key];

                    if (newVal !== oldVal) {
                        const strVal = String(newVal || "");
                        if (strVal.startsWith("=")) {
                            cellFx[key] = strVal.substring(1);
                            hasOverride = true;
                        } else if (col.formula && !strVal.startsWith("=")) {
                            cellFx[key] = strVal;
                            hasOverride = true;
                        }
                    }
                }
            });

            if (hasOverride) {
                updatedRow.__cellFormulas = cellFx;
            }

            // 3. Force parse numbers
            schema.forEach(col => {
                const val = updatedRow[col.key];
                if (col.type === 'number' && val !== undefined && val !== null && val !== "") {
                    // Only parse if it's NOT a formula string
                    if (!String(val).startsWith("=")) {
                        const n = parseFloat(String(val).replace(",", "."));
                        if (!isNaN(n)) {
                            updatedRow[col.key] = n;
                        }
                    }
                }
            });

            // 4. AUTO-LOG SYSTEM (New)
            // Use shared logic for consistency with Detail Panel
            const author = currentUser?.name || currentUser?.email || 'Utilisateur';
            const logs = generateRowLogs(oldRow, newRow, schema, author);

            if (logs.length > 0) {
                const prevComments = Array.isArray(oldRow.comments) ? oldRow.comments : [];
                updatedRow.comments = [...prevComments, ...logs];
            }

            try {
                const recomputed = recomputeRow(updatedRow, schema, formulaCtx);
                const newRows = rows.map(r => (r.id === recomputed.id ? recomputed : r));
                setTimeout(() => onRowsChange(newRows), 0);
                return recomputed;
            } catch (e) {
                console.error("Erreur calcul", e);
                return oldRow;
            }
        },
        [rows, onRowsChange, schema, formulaCtx, catalog]
    );

    const handleProcessRowUpdateError = useCallback((error) => {
        console.error("Row update error:", error);
    }, []);

    const MobileCard = ({ row }) => {
        const statusOpt = row.statut_pose ? { label: row.statut_pose, color: '#065F46', bg: '#ECFDF5' } : { label: 'À faire', color: '#6B7280', bg: '#F3F4F6' };
        // Simple logic for status display - adjusting as per schema
        // Taking 'statut_conf' or 'statut_pose' as primary status or 'statut_cotes'
        // Priority: Pose > Conf > Prepa > Cotes
        let mainStatus = { label: '—', bg: '#F3F4F6', color: '#6B7280' };
        if (row.statut_pose === 'Terminé') mainStatus = { label: 'Posé', bg: '#ECFDF5', color: '#065F46' };
        else if (row.statut_conf === 'Terminé') mainStatus = { label: 'Confectionné', bg: '#FDF2F8', color: '#9D174D' };
        else if (row.statut_prepa === 'Terminé') mainStatus = { label: 'Prêt', bg: '#F5F3FF', color: '#5B21B6' };
        else if (row.statut_cotes === 'Définitive') mainStatus = { label: 'Coté', bg: '#EFF6FF', color: '#1E40AF' };

        return (
            <div
                onClick={() => handleOpenDetail(row)}
                style={{
                    background: 'white', borderRadius: 12, padding: 16, marginBottom: 12,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #E5E7EB',
                    display: 'flex', flexDirection: 'column', gap: 10
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{row.piece || 'Sans pièce'}</div>
                        <div style={{ fontSize: 13, color: '#4B5563', marginTop: 2 }}>{row.produit || '—'}</div>
                    </div>
                    <div style={{
                        padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: mainStatus.bg, color: mainStatus.color, textTransform: 'uppercase'
                    }}>
                        {mainStatus.label}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#6B7280', borderTop: '1px solid #F9FAFB', paddingTop: 8 }}>
                    <div>L: <span style={{ color: '#111827', fontWeight: 600 }}>{row.largeur || '—'}</span></div>
                    <div>H: <span style={{ color: '#111827', fontWeight: 600 }}>{row.hauteur || '—'}</span></div>
                    {/* Add more vital info here if needed */}
                </div>
            </div>
        );
    };

    return (
        <div style={{ width: '100%' }}>
            {title && <h3>{title}</h3>}

            {isMobile ? (
                <div className="mobile-grid-cards">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>{rows.length} Lignes</span>
                        {!readOnly && <button onClick={handleAddRow} style={{ background: '#2563EB', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>+ Ajouter</button>}
                    </div>
                    {rows.length === 0 ? (
                        <div style={{ padding: 30, textAlign: 'center', color: '#9CA3AF', background: 'transparent', borderRadius: 8, border: '1px dashed #D1D5DB' }}>Aucune ligne</div>
                    ) : (
                        rows.map(row => <MobileCard key={row.id} row={row} />)
                    )}
                </div>
            ) : (
                <DataGrid
                    rows={rows}
                    columns={columns}
                    // Auto height to avoid vertical scrollbars
                    autoHeight
                    processRowUpdate={processRowUpdate}
                    onProcessRowUpdateError={handleProcessRowUpdateError}
                    checkboxSelection
                    disableColumnResize={false}
                    localeText={frFR.components.MuiDataGrid.defaultProps.localeText}
                    slots={{
                        toolbar: CustomToolbar,
                    }}
                    slotProps={{
                        toolbar: {
                            onAdd: handleAddRow,
                            onDelete: handleDeleteRows,
                            selectedCount: rowSelectionModel?.length || 0,
                            onImportExcel,
                            readOnly
                        },
                    }}
                    rowSelectionModel={rowSelectionModel}
                    onRowSelectionModelChange={(newSelection) => setRowSelectionModel(newSelection)}
                    columnVisibilityModel={columnVisibilityModel}
                    onColumnVisibilityModelChange={(newModel) => {
                        console.log('Visibility model changed:', newModel);
                        setColumnVisibilityModel(newModel);
                    }}
                    onCellClick={(params, event) => {
                        if (params.field === 'detail') {
                            event.stopPropagation(); // Prevent row selection if possible
                            handleOpenDetail(params.row);
                        }
                    }}
                />
            )}
        </div>
    );
}
