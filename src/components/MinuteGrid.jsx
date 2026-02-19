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
import { useGridColumnState } from '../lib/hooks/useGridColumnState'; // Import hook

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
    isMobile = false, // <--- NEW Mobile Prop
    gridKey // <--- NEW explicit key for persistence
}) {
    const [rowSelectionModel, setRowSelectionModel] = useState([]);
    const [detailRowId, setDetailRowId] = useState(null);

    const navigate = useNavigate();

    // Generate unique Grid ID for persistence
    const gridId = React.useMemo(() => {
        // If gridKey is provided, we make it GLOBAL (User Preference) across all projects.
        // This is better UX: you set your "Rideaux" column width once, and it applies to all projects.
        if (gridKey) return `grid_pref_v1_${gridKey}`;

        // Fallback for legacy usage (per instance)
        if (projectId) return `prod_${projectId}_${title || 'grid'}`;
        if (minuteId) return `minute_${minuteId}_${title || 'grid'}`;
        return `grid_${title || 'default'}`;
    }, [projectId, minuteId, title, gridKey]);

    // Use persistence hook
    const {
        columnVisibilityModel,
        onColumnVisibilityModelChange,
        onColumnWidthChange,
        initialState: persistedInitialState,
        savedDimensions // <--- Extracted here for use in columns useMemo
    } = useGridColumnState(gridId, initialVisibilityModel);

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
        // DEBUG: Verify catalog before schema generation
        const lutron = catalog.find(x => x.name.toLowerCase().includes('lutron'));
        console.log("🧐 MinuteGrid: Generating Cols. Catalog Size:", catalog.length, "Lutron Unit:", lutron?.unit);

        const cols = schemaToGridCols(schema, enableCellFormulas, handleOpenDetail, catalog, railOptions, handlePhotoChange, onDuplicateRow, hideCroquis, readOnly);

        // --- HOTFIX: Force Dynamic Options for modele_mecanisme in MinuteGrid ---
        const mecaCol = cols.find(c => c.field === 'modele_mecanisme');
        if (mecaCol) {
            console.log("🔥 HOTFIX v2 INITIALIZED. MecaCol found. OLD Type:", mecaCol.type);
            // FORCE TYPE TO SINGLESELECT (Fixes 'string' issue)
            mecaCol.type = 'singleSelect';
            mecaCol.editable = true;
            // CLEAR ANY CUSTOM RENDERER
            mecaCol.renderEditCell = undefined;
            mecaCol.valueFormatter = undefined;


            mecaCol.valueOptions = (params) => {
                const row = params.row || {};
                const typeMeca = row.type_mecanisme;
                console.log("🔥 HOTFIX RUNNING. Type:", typeMeca);

                // Get base catalog items for rails/mech
                const baseItems = catalog.filter(item => ['Rail', 'Tringle', 'Mecanisme', 'Mécanisme', 'Store'].includes(item.category));

                let results = [];
                if (typeMeca === 'Rail') {
                    results = baseItems.filter(a => !a.unit || a.unit === 'ml');
                } else if (typeMeca === 'Tringle' || typeMeca === 'Rail Motorisé') {
                    results = baseItems.filter(a => a.unit === 'pce');
                } else {
                    results = baseItems;
                }

                console.log("🔥 HOTFIX RESULTS:", results.length, results.map(r => r.name));
                return results.map(a => a.name);
            };
        } else {
            // console.warn("Hotfix skipped: 'modele_mecanisme' col not found in this schema.");
        }
        // -----------------------------------------------------------------------

        // MOBILE OPTIMIZATION
        if (isMobile) {
            // Force only specific columns: Piece, Produit, Statuts
            const mobileKeys = ['piece', 'produit', 'statut_cotes', 'statut_prepa', 'statut_conf', 'statut_pose'];
            return cols.filter(c => mobileKeys.includes(c.field) || c.field === 'detail');
        }

        // --- PERSISTENCE OVERRIDE ---
        // Manually apply saved widths to columns
        if (savedDimensions && Object.keys(savedDimensions).length > 0) {
            return cols.map(c => {
                if (savedDimensions[c.field]) {
                    return { ...c, width: savedDimensions[c.field], flex: undefined }; // Remove flex if width is forced
                }
                return c;
            });
        }

        return cols;
    }, [schema, enableCellFormulas, handleOpenDetail, catalog, railOptions, handlePhotoChange, onDuplicateRow, hideCroquis, readOnly, isMobile, savedDimensions]);

    // detailRow is now state, no need for useMemo lookup

    const processRowUpdate = useCallback(
        (newRow, oldRow) => {
            let updatedRow = { ...newRow };
            const cellFx = { ...(oldRow.__cellFormulas || {}) };
            let hasOverride = false;

            // 1. Check for Catalog Auto-fill
            const changedKey = Object.keys(newRow).find(k => newRow[k] !== oldRow[k]);

            // List of columns that might be linked to catalog
            const isCatalogColumn = changedKey && (
                changedKey.includes('tissu') ||
                changedKey.includes('doublure') ||
                changedKey.includes('passementerie') ||
                changedKey === 'produit' ||
                changedKey === 'modele_mecanisme' ||
                changedKey === 'toile_finition_1'
            );

            if (isCatalogColumn) {
                const articleName = newRow[changedKey];
                const article = catalog.find(a => a.name === articleName);

                if (article) {
                    const mapping = {};

                    if (changedKey === 'tissu_deco1') {
                        mapping.laize = 'laize_tissu1';
                        mapping.rv = 'raccord_v_tissu1';
                        mapping.rh = 'raccord_h_tissu1';
                        mapping.pa = 'pa_tissu1';
                        mapping.pv = 'pv_tissu1';
                    } else if (changedKey === 'tissu_deco2') {
                        mapping.laize = 'laize_tissu2';
                        mapping.rv = 'raccord_v_tissu2';
                        mapping.rh = 'raccord_h_tissu2';
                        mapping.pa = 'pa_tissu2';
                        mapping.pv = 'pv_tissu2';
                    } else if (changedKey === 'tissu_1') {
                        mapping.laize = 'laize_tissu_1';
                        mapping.pa = 'pa_tissu_1';
                        mapping.pv = 'pv_tissu_1';
                    } else if (changedKey === 'tissu_2') {
                        mapping.laize = 'laize_tissu_2';
                        mapping.pa = 'pa_tissu_2';
                        mapping.pv = 'pv_tissu_2';
                    } else if (changedKey === 'toile_finition_1') {
                        mapping.laize = 'laize_toile_finition_1';
                        mapping.rv = 'raccord_v_toile_finition_1';
                        mapping.rh = 'raccord_h_toile_finition_1';
                        mapping.pa = 'pa_toile_finition_1';
                        mapping.pv = 'pv_toile_finition_1';
                    } else if (changedKey === 'doublure') {
                        mapping.laize = 'laize_doublure';
                        mapping.pa = 'pa_doublure';
                        mapping.pv = 'pv_doublure';
                    } else if (changedKey === 'interdoublure') {
                        mapping.laize = 'laize_interdoublure';
                        mapping.pa = 'pa_interdoublure';
                        mapping.pv = 'pv_interdoublure';
                    } else if (changedKey === 'inter_doublure') {
                        mapping.laize = 'laize_inter';
                        mapping.pa = 'pa_inter';
                        mapping.pv = 'pv_inter';
                    } else if (changedKey === 'passementerie1' || changedKey === 'passementerie_1') {
                        mapping.pa = changedKey === 'passementerie1' ? 'pa_pass1' : 'pa_pass_1';
                        mapping.pv = changedKey === 'passementerie1' ? 'pv_pass1' : 'pv_pass_1';
                    } else if (changedKey === 'passementerie2' || changedKey === 'passementerie_2') {
                        mapping.pa = changedKey === 'passementerie2' ? 'pa_pass2' : 'pa_pass_2';
                        mapping.pv = changedKey === 'passementerie2' ? 'pv_pass2' : 'pv_pass_2';
                    } else if (changedKey === 'produit') {
                        // Generic fallback
                    } else if (changedKey === 'modele_mecanisme') {
                        // Use UNIT to determine if we auto-fill PA/PV.
                        // 'ml' (Rail) -> Auto-fill from catalog (calculated by formula then)
                        // 'pce' (Lutron) -> Do NOT auto-fill (manual entry or reference table)
                        if (!article.unit || article.unit === 'ml') {
                            console.log("⚡️ Auto-filling PA/PV for ml mechanism:", article.name);
                            mapping.pa = 'pa_mecanisme';
                            mapping.pv = 'pv_mecanisme';
                        } else {
                            console.log("✋ Skipping PA/PV auto-fill for piece mechanism:", article.name);
                        }
                    }

                    // Apply updates based on mapping
                    if (mapping.laize && schema.some(c => c.key === mapping.laize)) updatedRow[mapping.laize] = article.width;
                    if (mapping.pa && schema.some(c => c.key === mapping.pa)) updatedRow[mapping.pa] = article.buyPrice;
                    if (mapping.pv && schema.some(c => c.key === mapping.pv)) updatedRow[mapping.pv] = article.sellPrice;

                    if (mapping.motif && schema.some(c => c.key === mapping.motif)) {
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
        [rows, onRowsChange, schema, formulaCtx, catalog, currentUser]
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
                    key={gridId} // Force remount when gridId changes
                    rows={rows}
                    columns={columns}
                    // Auto height to avoid vertical scrollbars
                    autoHeight
                    processRowUpdate={processRowUpdate}
                    onProcessRowUpdateError={handleProcessRowUpdateError}
                    checkboxSelection
                    disableRowSelectionOnClick // <--- Prevents row selection on click
                    disableColumnResize={false}
                    columnVisibilityModel={columnVisibilityModel}
                    onColumnVisibilityModelChange={onColumnVisibilityModelChange}
                    onColumnWidthChange={onColumnWidthChange}
                    initialState={persistedInitialState}
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
