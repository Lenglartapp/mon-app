// src/components/MinuteGrid.jsx
import React, { useState, useCallback, useMemo } from 'react';
import {
    DataGrid,
    GridToolbarContainer,
    GridToolbarColumnsButton,
    GridToolbarFilterButton,
    GridToolbarDensitySelector
} from '@mui/x-data-grid';
import { schemaToGridCols } from '../lib/utils/schemaToGridCols.jsx';
import { recomputeRow } from '../lib/formulas/recomputeRow';

import { Plus, Trash2 } from 'lucide-react';

function CustomToolbar({ onAdd, onDelete, selectedCount }) {
    return (
        <GridToolbarContainer style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', gap: 10, marginRight: 'auto' }}>
                <button
                    onClick={onAdd}
                    style={{ cursor: 'pointer', padding: '6px 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                    <Plus size={16} /> Ajouter
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
}) {
    const [rowSelectionModel, setRowSelectionModel] = useState([]);
    const [detailRow, setDetailRow] = useState(null);

    const handleOpenDetail = useCallback((row) => {
        console.log('Opening detail for row object:', row);
        setDetailRow(row);
    }, []);

    const handleCloseDetail = useCallback(() => {
        setDetailRow(null);
    }, []);

    const handleDetailRowChange = useCallback((updatedRow) => {
        // Update the row in the main rows array
        const newRows = rows.map(r => r.id === updatedRow.id ? updatedRow : r);
        onRowsChange(newRows);
        // Also update the local detail row to reflect changes immediately in the panel
        setDetailRow(updatedRow);
    }, [rows, onRowsChange, setDetailRow]);

    const handleAddRow = useCallback(() => {
        // Placeholder for adding a new row
        // You'll need to define the structure of a new row based on your schema
        const newId = Math.max(...rows.map(r => r.id), 0) + 1;
        const newRow = { id: newId, ...Object.fromEntries(schema.map(col => [col.key, ''])) }; // Basic new row
        onRowsChange([...rows, newRow]);
    }, [rows, onRowsChange, schema]);

    const handleDeleteRows = useCallback(() => {
        const newRows = rows.filter(r => !rowSelectionModel.includes(r.id));
        onRowsChange(newRows);
        setRowSelectionModel([]); // Clear selection after deletion
    }, [rows, onRowsChange, rowSelectionModel]);

    const columns = useMemo(() => {
        return schemaToGridCols(schema, enableCellFormulas, handleOpenDetail);
    }, [schema, enableCellFormulas, handleOpenDetail]);

    // detailRow is now state, no need for useMemo lookup

    const processRowUpdate = useCallback(
        (newRow, oldRow) => {
            const updatedRow = { ...newRow };
            const cellFx = { ...(oldRow.__cellFormulas || {}) };
            let hasOverride = false;

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
        [rows, onRowsChange, schema, formulaCtx]
    );

    const handleProcessRowUpdateError = useCallback((error) => {
        console.error("Row update error:", error);
    }, []);

    return (
        <div style={{ height: 500, width: '100%' }}>
            {title && <h3>{title}</h3>}
            <DataGrid
                rows={rows}
                columns={columns}
                processRowUpdate={processRowUpdate}
                onProcessRowUpdateError={handleProcessRowUpdateError}
                checkboxSelection
                disableColumnResize={false}
                slots={{
                    toolbar: CustomToolbar,
                }}
                slotProps={{
                    toolbar: { onAdd: handleAddRow, onDelete: handleDeleteRows, selectedCount: rowSelectionModel?.length || 0 },
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
            <LineDetailPanel
                open={!!detailRow}
                onClose={handleCloseDetail}
                row={detailRow}
                schema={schema}
                onRowChange={handleDetailRowChange}
            />
        </div>
    );
}
