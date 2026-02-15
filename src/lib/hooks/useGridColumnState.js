import { useState, useCallback, useEffect } from 'react';

/**
 * Hook to persist DataGrid column state (width, order, visibility) to localStorage.
 * @param {string} gridId - Unique identifier for the grid (e.g. "minute_123_rideaux")
 * @param {object} initialVisibilityModel - Default visibility model
 * @returns {object} props to pass to DataGrid
 */
export function useGridColumnState(gridId, initialVisibilityModel = {}) {
    const STORAGE_KEY = `grid_state_v1_${gridId}`;

    // Load state from localStorage or use defaults
    const getSavedState = useCallback((key) => {
        try {
            const saved = localStorage.getItem(key);
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed.visibilityModel || initialVisibilityModel;
            }
        } catch (e) {
            console.warn("Failed to load grid state", e);
        }
        return initialVisibilityModel;
    }, [initialVisibilityModel]);

    const [columnVisibilityModel, setColumnVisibilityModel] = useState(() => getSavedState(STORAGE_KEY));

    // Update state when gridId changes
    useEffect(() => {
        setColumnVisibilityModel(getSavedState(STORAGE_KEY));
    }, [STORAGE_KEY, getSavedState]);

    const getInitialState = useCallback((key) => {
        try {
            const saved = localStorage.getItem(key);
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    columns: {
                        columnVisibilityModel: parsed.visibilityModel,
                        orderedFields: parsed.orderedFields,
                        dimensions: parsed.dimensions,
                    }
                };
            }
        } catch (e) {
            // ignore
        }
        return undefined;
    }, []);

    const [initialState, setInitialState] = useState(() => getInitialState(STORAGE_KEY));

    // Update initialState when gridId changes
    useEffect(() => {
        setInitialState(getInitialState(STORAGE_KEY));
    }, [STORAGE_KEY, getInitialState]);

    // Save state to localStorage (debounced ideally, but direct for now is fine for simple usage)
    const saveState = useCallback((newState) => {
        try {
            const current = localStorage.getItem(STORAGE_KEY) ? JSON.parse(localStorage.getItem(STORAGE_KEY)) : {};
            const merged = { ...current, ...newState };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        } catch (e) {
            console.warn("Failed to save grid state", e);
        }
    }, [STORAGE_KEY]);

    const onColumnVisibilityModelChange = useCallback((newModel) => {
        setColumnVisibilityModel(newModel);
        saveState({ visibilityModel: newModel });
    }, [saveState]);

    const onColumnWidthChange = useCallback((params) => {
        // params: { colDef, element, width }
        // We need to save all dimensions, but DataGrid only gives us single update event usually?
        // Actually DataGrid `onColumnWidthChange` gives the resized column.
        // To restore, we need `initialState.columns.dimensions`.
        // We can't easily get *all* widths from this event alone without keeping state.
        // Simplified approach: We rely on DataGrid's internal state export if available, 
        // OR we just save this specific column's new width into a map.

        try {
            const current = localStorage.getItem(STORAGE_KEY) ? JSON.parse(localStorage.getItem(STORAGE_KEY)) : {};
            const dimensions = current.dimensions || {};
            dimensions[params.colDef.field] = params.width;
            saveState({ dimensions });
        } catch (e) {
            // ignore
        }
    }, [STORAGE_KEY, saveState]);

    const onColumnOrderChange = useCallback((params) => {
        // params: { field, targetIndex, oldIndex } - varies by version?
        // Actually MUI X v5/v6 `onColumnOrderChange` passes `GridColumnOrderChangeParams`.
        // But to *restore* order, we need `orderedFields`.
        // It's better to use `apiRef` if possible, but we want to avoid `apiRef` dependency if we can.
        // Let's stick to width and visibility for now as requested by user ("champ piece... j'élargis").
        // Order is less critical and harder to capture without `apiRef`.
    }, []);

    // Hydrate initial state with saved dimensions
    // We need to construct `initialState` prop for DataGrid.
    // Done in useState above.

    // Extract dimensions for manual override if needed
    const savedDimensions = initialState?.columns?.dimensions || {};

    return {
        columnVisibilityModel,
        onColumnVisibilityModelChange,
        onColumnWidthChange,
        initialState, // Pass this to DataGrid prop `initialState` (for order/etc)
        savedDimensions // Pass this to MinuteGrid to override column widths manually
    };
}
