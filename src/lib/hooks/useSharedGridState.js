import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Cache mémoire partagé entre toutes les instances du hook (durée de vie = session navigateur).
 * Évite le flash quand on navigue entre écrans : la 2e visite est instantanée.
 */
const memoryCache = {};

/**
 * Persiste la MISE EN PAGE d'une grille (colonnes masquées, ordre, épinglage,
 * largeurs, groupes méca/conf) dans Supabase, PARTAGÉE entre tous les
 * utilisateurs. Les filtres de lignes, le tri et le regroupement sont personnels
 * et vivent dans useUserGridState.
 *
 * @param {string} gridKey     - Clé de la grille, portée par dossier
 *                               (ex: "minute_<id>_chiff_rideaux")
 * @param {string} [templateKey] - Clé de repli servant de MODÈLE quand le dossier
 *                               n'a pas encore de mise en page propre (l'ancienne
 *                               clé globale, ex: "chiff_rideaux").
 * @returns {{ data: object|null, loaded: boolean, save: (patch: object) => void }}
 */
export function useSharedGridState(gridKey, templateKey = null) {
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
        let cancelled = false;

        const apply = (state) => {
            if (cancelled) return;
            memoryCache[gridKey] = state;
            dataRef.current = state;
            setData(state);
            setLoaded(true);
        };

        supabase
            .from('grid_views')
            .select('column_state')
            .eq('grid_key', gridKey)
            .maybeSingle()
            .then(({ data: row }) => {
                if (cancelled) return;
                const state = row?.column_state ?? null;

                // MODÈLE DE DÉPART — un dossier qui n'a pas encore sa propre mise en
                // page hérite de la mise en page globale historique (`templateKey`).
                // Sans ça, la bascule « une mise en page par dossier » ferait repartir
                // chaque projet de zéro : le BPP Rideaux, par exemple, afficherait ses
                // 114 colonnes au lieu des 22 réglées par l'atelier.
                // Le modèle n'est PAS réécrit : il sert de point de départ, et la
                // première modification enregistre une ligne propre au dossier.
                if (state === null && templateKey && templateKey !== gridKey) {
                    supabase
                        .from('grid_views')
                        .select('column_state')
                        .eq('grid_key', templateKey)
                        .maybeSingle()
                        .then(({ data: tpl }) => apply(tpl?.column_state ?? null));
                    return;
                }
                apply(state);
            });

        return () => { cancelled = true; };
    }, [gridKey, templateKey]);

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
