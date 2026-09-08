import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../../auth';

/**
 * Cache mémoire par (grille, utilisateur) — évite un aller-retour réseau à chaque
 * navigation entre écrans.
 */
const memoryCache = {};

/**
 * Réglages de grille PERSONNELS : filtres de lignes, tri, regroupement.
 *
 * À distinguer de useSharedGridState, qui porte la MISE EN PAGE partagée par
 * toute l'équipe (colonnes masquées, ordre, largeurs). Ce qui masque des LIGNES
 * doit rester personnel : un filtre partagé ferait disparaître des lignes chez
 * les collègues, qui en concluraient qu'elles n'existent pas.
 *
 * @param {string} gridKey
 * @returns {{ data: object|null, loaded: boolean, save: (patch: object) => void }}
 */
export function useUserGridState(gridKey) {
    const { currentUser } = useAuth() || {};
    const userId = currentUser?.id || null;
    const cacheKey = userId && gridKey ? `${userId}::${gridKey}` : null;

    const [data, setData] = useState(() => (cacheKey ? memoryCache[cacheKey] ?? null : null));
    const [loaded, setLoaded] = useState(() => (cacheKey ? cacheKey in memoryCache : false));
    const dataRef = useRef(data);
    const saveTimeoutRef = useRef(null);

    useEffect(() => {
        // Pas d'utilisateur (chargement de session en cours) : on n'invente rien.
        if (!cacheKey) { setLoaded(false); return; }
        if (cacheKey in memoryCache) {
            dataRef.current = memoryCache[cacheKey];
            setData(memoryCache[cacheKey]);
            setLoaded(true);
            return;
        }
        setLoaded(false);
        supabase
            .from('grid_views_user')
            .select('state')
            .eq('grid_key', gridKey)
            .eq('user_id', userId)
            .maybeSingle()
            .then(({ data: row, error }) => {
                // Table pas encore créée (migration non jouée) : on démarre à vide
                // plutôt que de bloquer la grille.
                if (error) console.warn('[useUserGridState] lecture impossible :', error.message);
                const state = row?.state ?? null;
                memoryCache[cacheKey] = state;
                dataRef.current = state;
                setData(state);
                setLoaded(true);
            });
    }, [cacheKey, gridKey, userId]);

    const save = useCallback((patch) => {
        if (!cacheKey) return;
        const merged = { ...dataRef.current, ...patch };
        dataRef.current = merged;
        memoryCache[cacheKey] = merged;
        setData(merged);

        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            supabase
                .from('grid_views_user')
                .upsert(
                    { grid_key: gridKey, user_id: userId, state: merged, updated_at: new Date().toISOString() },
                    { onConflict: 'grid_key,user_id' }
                )
                .then(({ error }) => {
                    if (error) console.warn('[useUserGridState] sauvegarde échouée :', error.message);
                });
        }, 500);
    }, [cacheKey, gridKey, userId]);

    return { data, loaded, save };
}
