import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Cache mémoire partagé entre toutes les instances du hook (durée de vie = session navigateur).
 * Évite le flash quand on navigue entre écrans : la 2e visite est instantanée.
 */
const memoryCache = {};

/**
 * Persiste l'état d'une grille (colonnes, visibilité, meca, conf, widths)
 * dans Supabase pour un partage entre tous les utilisateurs.
 *
 * @param {string} gridKey - Clé unique de la grille (ex: "chiffrage_uuid_rideaux")
 * @returns {{ data: object|null, loaded: boolean, save: (patch: object) => void }}
 */
export function useSharedGridState(gridKey) {
    const [data, setData] = useState(() => memoryCache[gridKey] ?? null);
    const [loaded, setLoaded] = useState(() => gridKey in memoryCache);
    const dataRef = useRef(data);
    const saveTimeoutRef = useRef(null);

    useEffect(() => {
        if (!gridKey) {
            setLoaded(true);
            return;
        }
        // Déjà en cache mémoire → pas besoin de fetch
        if (gridKey in memoryCache) {
            dataRef.current = memoryCache[gridKey];
            setData(memoryCache[gridKey]);
            setLoaded(true);
            return;
        }
        setLoaded(false);
        supabase
            .from('grid_views')
            .select('column_state')
            .eq('grid_key', gridKey)
            .maybeSingle()
            .then(({ data: row }) => {
                const state = row?.column_state ?? null;
                memoryCache[gridKey] = state;
                dataRef.current = state;
                setData(state);
                setLoaded(true);
            });
    }, [gridKey]);

    // Merge partiel + upsert debounced (500ms)
    const save = useCallback((patch) => {
        if (!gridKey) return;
        const merged = { ...dataRef.current, ...patch };
        dataRef.current = merged;
        memoryCache[gridKey] = merged; // mise à jour immédiate du cache
        setData(merged);

        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            supabase
                .from('grid_views')
                .upsert(
                    { grid_key: gridKey, column_state: merged, updated_at: new Date().toISOString() },
                    { onConflict: 'grid_key' }
                )
                .then();
        }, 500);
    }, [gridKey]);

    return { data, loaded, save };
}
