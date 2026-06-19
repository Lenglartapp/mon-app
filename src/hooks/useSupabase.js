import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { db } from '../lib/offlineDb';
import { queueMutation } from '../lib/syncQueue';
import { calculateProfitability } from '../lib/financial/profitabilityCalculator';

// --- PROJETS ---
// PERF — Liste blanche des colonnes LÉGÈRES pour la LISTE des projets.
// On exclut volontairement la colonne `rows` (et `materials`, `wall`, `documents`…)
// qui contiennent le gros du JSON (lignes de production, photos, fil d'activité).
// ⚠️ NE JAMAIS faire `select('*')` pour une liste : chaque champ ajouté dans `rows`
// regonflerait la requête et ferait réapparaître la latence. Pour le détail complet,
// utiliser loadProjectDetail(id) ci-dessous.
const PROJECT_LIST_COLUMNS = 'id,name,manager,status,notes,budget,deadline,due,created_at,updated_at,source_minute_id';

export const useProjects = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchProjects = async () => {
        // 0. Affichage INSTANTANÉ depuis le cache local (stale-while-revalidate).
        try {
            const cached = await db.projects.toArray();
            if (cached.length > 0) setProjects(cached);
        } catch { /* ignore */ }

        // 1. Tentative rapide : colonnes légères uniquement.
        let { data, error } = await supabase
            .from('projects')
            .select(PROJECT_LIST_COLUMNS)
            .order('updated_at', { ascending: false });

        // 2. Repli sûr : si une colonne n'existe pas (dérive de schéma), on ne casse
        //    jamais l'app — on retombe sur select('*'). Le warn permet de repérer la
        //    colonne fautive et de réparer la liste blanche.
        if (error) {
            console.warn('[useProjects] select léger échoué, repli sur select(*) :', error.message);
            ({ data, error } = await supabase
                .from('projects')
                .select('*')
                .order('updated_at', { ascending: false }));
        }

        if (!error && data) {
            setProjects(data);
            db.projects.bulkPut(data).catch(() => {});
        } else {
            // Hors ligne ou erreur réseau : charger depuis IndexedDB
            const cached = await db.projects.toArray();
            if (cached.length > 0) setProjects(cached);
        }
        setLoading(false);
    };

    // Charge le projet COMPLET (avec `rows` et tout le JSON lourd) à l'ouverture,
    // puis le fusionne dans la liste en mémoire. La liste reste légère ; seul le
    // projet ouvert porte ses données lourdes.
    const loadProjectDetail = async (id) => {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('id', id)
            .single();
        if (error || !data) {
            console.error('[useProjects] loadProjectDetail échoué :', error?.message);
            return null;
        }
        setProjects(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
        db.projects.put(data).catch(() => {});
        return data;
    };

    // Charge TOUS les projets COMPLETS (avec `rows`) en une fois. Réservé aux écrans
    // qui agrègent l'ensemble des lignes (Planning capacité, Stocks/Inventaire, Logistique).
    // Idempotent (ne recharge pas si déjà fait), avec option force.
    const fullProjectsLoadedRef = useRef(false);
    const loadAllProjects = async (force = false) => {
        if (fullProjectsLoadedRef.current && !force) return;
        fullProjectsLoadedRef.current = true;
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('updated_at', { ascending: false });
        if (!error && data) {
            setProjects(data);
            db.projects.bulkPut(data).catch(() => {});
        } else {
            fullProjectsLoadedRef.current = false; // autorise un nouvel essai
        }
    };

    useEffect(() => { fetchProjects(); }, []);

    const addProject = async (project) => {
        // Helper pour garantir le format ISO (évite l'erreur "out of range")
        const toIsoString = (val) => val ? new Date(val).toISOString() : null;

        // 1. Préparation de l'objet pour la Base de Données
        const dbProject = {
            ...project,
            // Mapping des dates
            created_at: toIsoString(project.createdAt || new Date()),
            updated_at: toIsoString(project.updatedAt || new Date()),
            deadline: toIsoString(project.due || project.deadline), // Date de livraison

            // Mapping CamelCase -> SnakeCase
            source_minute_id: project.sourceMinuteId || null,

            // Les autres champs (budget, manager, notes, config) passent directement 
            // car ils ont le même nom ou sont gérés dynamiquement
        };

        // 2. Nettoyage des clés Javascript qui n'existent pas en base
        delete dbProject.createdAt;
        delete dbProject.updatedAt;
        delete dbProject.sourceMinuteId;

        // 3. Envoi à Supabase
        const { data, error } = await supabase.from('projects').insert([dbProject]).select();

        // 4. Mise à jour du state local (Mapping DB -> Frontend)
        if (data && data.length > 0) {
            const newProj = data[0];
            const frontendProject = {
                ...newProj,
                // On remet les noms que le frontend attend
                createdAt: newProj.created_at,
                updatedAt: newProj.updated_at,
                sourceMinuteId: newProj.source_minute_id
            };
            setProjects([frontendProject, ...projects]);
        } else if (error) {
            console.error("Erreur création projet:", error);
        }

        return { data, error };
    };

    const updateProject = async (id, updates) => {
        // 1. Optimistic UI (Mise à jour immédiate)
        setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));

        // 2. Mise à jour du cache IndexedDB immédiatement (persistance offline)
        db.projects.where('id').equals(id).modify(updates).catch(() => {});

        // 3. Préparation pour la DB
        const dbUpdates = { ...updates };

        // Conversion Dates ISO
        if (updates.deadline) dbUpdates.deadline = new Date(updates.deadline).toISOString();
        else if (updates.due) { dbUpdates.deadline = new Date(updates.due).toISOString(); delete dbUpdates.due; }
        if (updates.updatedAt) dbUpdates.updated_at = new Date(updates.updatedAt).toISOString();
        if (updates.createdAt) dbUpdates.created_at = new Date(updates.createdAt).toISOString();

        // Nettoyage des clés JS (due est une vraie colonne DB, on ne la supprime pas)
        delete dbUpdates.updatedAt;
        delete dbUpdates.createdAt;

        // Mapping CamelCase -> SnakeCase
        if (updates.sourceMinuteId) {
            dbUpdates.source_minute_id = updates.sourceMinuteId;
            delete dbUpdates.sourceMinuteId;
        }

        // 4. Nettoyer les photos pending (base64) des rows avant envoi à Supabase
        if (dbUpdates.rows) {
            dbUpdates.rows = dbUpdates.rows.map(row => {
                const cleanRow = { ...row };
                for (const key of Object.keys(cleanRow)) {
                    if (Array.isArray(cleanRow[key]) && cleanRow[key].some(p => p?.pending)) {
                        cleanRow[key] = cleanRow[key].filter(p => !p?.pending);
                    }
                }
                return cleanRow;
            });
        }

        // 5. Envoi Supabase ; si hors ligne → enfile pour sync ultérieure
        const { error } = await supabase.from('projects').update(dbUpdates).eq('id', id);
        if (error) {
            queueMutation('projects', id, dbUpdates).catch(() => {});
        }
    };

    const deleteProject = async (id) => {
        setProjects(prev => prev.filter(p => p.id !== id));
        await supabase.from('projects').delete().eq('id', id);
    };

    return { projects, loading, addProject, updateProject, deleteProject, refreshProjects: fetchProjects, loadProjectDetail, loadAllProjects };
};

// --- MINUTES (CHIFFRAGE) ---
const formatMinutes = (data) => data.map(m => ({
    ...m,
    tables: m.lines || [],
    budgetSnapshot: m.budget_snapshot || { prepa: 0, conf: 0, pose: 0 },
    parentId: m.parent_id || null,
    createdAt: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
    updatedAt: m.updated_at ? new Date(m.updated_at).getTime() : Date.now(),
}));

// PERF — Liste blanche des colonnes LÉGÈRES pour la LISTE des chiffrages.
// On exclut les gros blobs JSONB : lines, deplacements, params, extras/extraDepenses,
// catalog (bibliothèque par minute), matieres, settings, budget_snapshot, modules
// (qui contient l'historique des statuts et grossit). La liste n'affiche que des KPI
// déjà précalculés en base (ca_total, marge_*…).
// ⚠️ NE JAMAIS faire `select('*')` ici. Détail complet → loadMinuteDetail(id).
const MINUTE_LIST_COLUMNS = 'id,name,client,status,version,notes,owner,delivery_date,parent_id,ca_total,marge_eur,marge_pct,renta_hh,created_at,updated_at';

export const useMinutes = () => {
    const [minutes, setMinutes] = useState([]);

    const fetchMinutes = async () => {
        // 0. Affichage INSTANTANÉ depuis le cache local (stale-while-revalidate).
        //    Sans ça, les chiffrages n'apparaissaient pas tout de suite (ex. Cmd+K)
        //    car ils attendaient le réseau, contrairement aux projets déjà cachés.
        try {
            const cached = await db.minutes.toArray();
            if (cached.length > 0) setMinutes(formatMinutes(cached));
        } catch { /* table absente / ancien schéma : on ignore */ }

        // 1. Tentative rapide : colonnes légères uniquement.
        let { data, error } = await supabase
            .from('minutes')
            .select(MINUTE_LIST_COLUMNS)
            .order('updated_at', { ascending: false });

        // 2. Repli sûr si dérive de schéma (colonne manquante) → select('*').
        if (error) {
            console.warn('[useMinutes] select léger échoué, repli sur select(*) :', error.message);
            ({ data, error } = await supabase
                .from('minutes')
                .select('*')
                .order('updated_at', { ascending: false }));
        }

        if (!error && data) {
            setMinutes(formatMinutes(data));
            db.minutes.clear().then(() => db.minutes.bulkPut(data)).catch(() => {});
        }
    };

    // Charge la minute COMPLÈTE (lines, deplacements, params, catalog…) à l'ouverture
    // et la fusionne dans la liste en mémoire. Retourne la minute formatée (ou null).
    const loadMinuteDetail = async (id) => {
        const { data, error } = await supabase
            .from('minutes')
            .select('*')
            .eq('id', id)
            .single();
        if (error || !data) {
            console.error('[useMinutes] loadMinuteDetail échoué :', error?.message);
            return null;
        }
        const [full] = formatMinutes([data]);
        setMinutes(prev => prev.map(m => m.id === id ? { ...m, ...full } : m));
        return full;
    };

    // Charge TOUTES les minutes COMPLÈTES (avec `lines`/`deplacements`) en une fois.
    // Réservé aux écrans qui agrègent l'ensemble (Stocks/Inventaire : index tissus).
    const fullMinutesLoadedRef = useRef(false);
    const loadAllMinutes = async (force = false) => {
        if (fullMinutesLoadedRef.current && !force) return;
        fullMinutesLoadedRef.current = true;
        const { data, error } = await supabase
            .from('minutes')
            .select('*')
            .order('updated_at', { ascending: false });
        if (!error && data) setMinutes(formatMinutes(data));
        else fullMinutesLoadedRef.current = false; // autorise un nouvel essai
    };

    useEffect(() => { fetchMinutes(); }, []);

    const updateMinute = async (id, updates) => {
        const dbUpdates = { ...updates };
        if (updates.tables) {
            dbUpdates.lines = updates.tables;
            delete dbUpdates.tables;
        }

        // ⛔️ SÉCURITÉ DONNÉES (anti-perte) — filet de sécurité ultime :
        // NE JAMAIS écraser des lignes/déplacements/dépenses NON VIDES par un tableau VIDE.
        // Protège contre un save accidentel (ex. éditeur monté avant le chargement complet).
        // Si un jour il faut vraiment vider un devis, le faire via une action dédiée explicite.
        const curForGuard = minutes.find(m => m.id === id);
        for (const key of ['lines', 'deplacements', 'extraDepenses']) {
            if (Array.isArray(dbUpdates[key]) && dbUpdates[key].length === 0) {
                const prev = curForGuard?.[key];
                if (Array.isArray(prev) && prev.length > 0) {
                    console.warn(`[updateMinute] BLOQUÉ : écrasement de ${key} (${prev.length} → 0) refusé sur ${id}`);
                    delete dbUpdates[key];
                }
            }
        }

        // --- KPI CENTRALISÉ (Étape 1) ---
        // Dès que les lignes / déplacements / dépenses changent — quel que soit le
        // chemin d'édition (grille, panneau détail, import, taux) — on recalcule et
        // on persiste ca_total + marges. Garantit que la liste des chiffrages reste
        // toujours cohérente avec les prix_total, sans cache périmé.
        const touchesLines = 'lines' in updates || 'tables' in updates
            || 'deplacements' in updates || 'extraDepenses' in updates;
        if (touchesLines) {
            const cur = minutes.find(m => m.id === id) || {};
            const lines  = dbUpdates.lines !== undefined ? dbUpdates.lines : (cur.lines || []);
            const deps   = 'deplacements'  in updates ? (updates.deplacements  || []) : (cur.deplacements  || []);
            const extras = 'extraDepenses' in updates ? (updates.extraDepenses || []) : (cur.extraDepenses || []);
            const { kpis } = calculateProfitability(lines, deps, extras);
            const computed = {
                ca_total:  kpis.ca_total            || 0,
                marge_eur: kpis.contribution        || 0,
                marge_pct: kpis.contribution_pct    || 0,
                renta_hh:  kpis.contribution_horaire || 0,
            };
            Object.assign(dbUpdates, computed);
            // aligne aussi le state local optimiste (mêmes valeurs que la BDD)
            updates = { ...updates, ...computed };
        }

        // Mapping BudgetSnapshot -> budget_snapshot
        if (updates.budgetSnapshot) {
            dbUpdates.budget_snapshot = updates.budgetSnapshot;
            delete dbUpdates.budgetSnapshot;
        }

        // Mapping Dates
        if (updates.updatedAt) {
            dbUpdates.updated_at = new Date(updates.updatedAt).toISOString();
            delete dbUpdates.updatedAt;
        }

        // Mapping parentId -> parent_id
        if ('parentId' in updates) {
            dbUpdates.parent_id = updates.parentId || null;
            delete dbUpdates.parentId;
        }

        // GARDE-FOU base64 — ne jamais persister les photos `pending` (data:base64) :
        // elles sont des placeholders locaux remplacés par une URL Storage après sync.
        // Sans ça, des images base64 s'accumulent dans `lines` et alourdissent le détail.
        // (Symétrique au nettoyage déjà présent dans updateProject.)
        for (const key of ['lines', 'deplacements', 'extraDepenses']) {
            if (Array.isArray(dbUpdates[key])) {
                dbUpdates[key] = dbUpdates[key].map(row => {
                    if (!row || typeof row !== 'object') return row;
                    const cleanRow = { ...row };
                    for (const f of Object.keys(cleanRow)) {
                        if (Array.isArray(cleanRow[f]) && cleanRow[f].some(p => p?.pending)) {
                            cleanRow[f] = cleanRow[f].filter(p => !p?.pending);
                        }
                    }
                    return cleanRow;
                });
            }
        }

        // --- RELIABILITY FIX: Wait for DB first ---
        const { error } = await supabase.from('minutes').update(dbUpdates).eq('id', id);

        if (error) {
            console.error("Erreur update minute:", error);
            // On ne met PAS à jour le state local si erreur
            return;
        }

        // Success: Update local state to reflect changes
        // Note: For perfect sync we could re-fetch, but merging updates is usually fine if no other data changed.
        setMinutes(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    };

    const addMinute = async (minute) => {
        const linesData = minute.tables || minute.lines || [];

        // Fonction helper pour garantir le format ISO
        const toIsoString = (val) => {
            if (!val) return new Date().toISOString();
            // Si c'est déjà un chiffre (timestamp) ou une string, on le convertit en Date puis en ISO
            return new Date(val).toISOString();
        };

        const dbMinute = {
            ...minute,
            lines: linesData,
            created_at: toIsoString(minute.createdAt),
            updated_at: toIsoString(minute.updatedAt),
            budget_snapshot: minute.budgetSnapshot || {},
            parent_id: minute.parentId || null,
        };

        delete dbMinute.tables;
        delete dbMinute.createdAt;
        delete dbMinute.updatedAt;
        delete dbMinute.budgetSnapshot;
        delete dbMinute.parentId;

        const { data, error } = await supabase.from('minutes').insert([dbMinute]).select();

        if (data && data.length > 0) {
            const newMinute = data[0];
            const frontendMinute = {
                ...newMinute,
                tables: newMinute.lines,
                createdAt: newMinute.created_at,
                updatedAt: newMinute.updated_at,
                budgetSnapshot: newMinute.budget_snapshot,
                parentId: newMinute.parent_id || null,
            };
            setMinutes([frontendMinute, ...minutes]);
        } else {
            console.error("Erreur ajout minute:", error);
        }
        return { data, error };
    };

    const deleteMinute = async (id) => {
        // Optimistic delete is usually safer than update, but consistent with reliability:
        const { error } = await supabase.from('minutes').delete().eq('id', id);
        if (!error) {
            setMinutes(prev => prev.filter(m => m.id !== id));
        } else {
            console.error("Erreur delete minute:", error);
        }
    };

    return {
        minutes,
        addMinute,
        updateMinute,
        deleteMinute,
        refreshMinutes: fetchMinutes,
        loadMinuteDetail,
        loadAllMinutes,
    };
};

// --- CATALOG (BIBLIOTHEQUE) ---
// PERF — Cache module-level : le catalogue est une donnée de RÉFÉRENCE quasi statique,
// inutile de la recharger à chaque montage (ChiffrageRoot, ChiffrageScreen, CatalogManager…).
// On mémorise le résultat ET la requête en vol pour dédupliquer les appels concurrents.
let _catalogCache = null;
let _catalogPromise = null;
const fetchCatalogOnce = (force = false) => {
    if (!force && _catalogCache) return Promise.resolve(_catalogCache);
    if (!force && _catalogPromise) return _catalogPromise;
    _catalogPromise = supabase.from('catalog').select('*').order('name').then(({ data, error }) => {
        if (error) { _catalogPromise = null; throw error; }
        // Postgres lowercases column names (buyprice/sellprice) → remap to camelCase
        const formatted = (data || []).map(item => ({
            ...item,
            price: Number(item.price || 0),
            buyPrice: Number(item.buyprice ?? item.buyPrice ?? item.buy_price ?? 0),
            sellPrice: Number(item.sellprice ?? item.sellPrice ?? item.sell_price ?? 0),
        }));
        _catalogCache = formatted;
        _catalogPromise = null;
        return formatted;
    });
    return _catalogPromise;
};

export const useCatalog = () => {
    const [catalog, setCatalog] = useState(_catalogCache || []);
    const [loading, setLoading] = useState(!_catalogCache);

    const fetchCatalog = async (force = false) => {
        setLoading(true);
        try {
            const formatted = await fetchCatalogOnce(force);
            setCatalog(formatted);
        } catch (error) {
            console.error("Erreur fetch catalog:", error);
        }
        setLoading(false);
    };

    useEffect(() => { fetchCatalog(); }, []);

    const addItem = async (item) => {
        // Prepare for DB
        const dbItem = { ...item };
        // Ensure price is number
        if (dbItem.price) dbItem.price = Number(dbItem.price);

        const { data, error } = await supabase.from('catalog').insert([dbItem]).select();

        if (data && data[0]) {
            setCatalog(prev => [...prev, data[0]]);
            if (_catalogCache) _catalogCache = [..._catalogCache, data[0]]; // garde le cache cohérent
            return data[0];
        }
        if (error) console.error("Erreur add item:", error);
        return null;
    };

    const updateItem = async (id, updates) => {
        const { error } = await supabase.from('catalog').update(updates).eq('id', id);
        if (!error) {
            setCatalog(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
            if (_catalogCache) _catalogCache = _catalogCache.map(i => i.id === id ? { ...i, ...updates } : i);
        } else {
            console.error("Erreur update item:", error);
        }
    };

    const deleteItem = async (id) => {
        const { error } = await supabase.from('catalog').delete().eq('id', id);
        if (!error) {
            setCatalog(prev => prev.filter(i => i.id !== id));
            if (_catalogCache) _catalogCache = _catalogCache.filter(i => i.id !== id);
        } else {
            console.error("Erreur delete item:", error);
        }
    };

    // refreshCatalog force le rechargement réseau (invalide le cache).
    return { catalog, loading, addItem, updateItem, deleteItem, refreshCatalog: () => fetchCatalog(true) };
};

// --- CATALOG RAIL (GLOBAL LECTURE/ECRITURE POUR LES ADMINS) ---
// PERF — Cache module-level (cf. useCatalog) : donnée de référence, ne pas recharger
// à chaque ouverture de chiffrage.
let _railCache = null;
let _railPromise = null;
const fetchRailsOnce = (force = false) => {
    if (!force && _railCache) return Promise.resolve(_railCache);
    if (!force && _railPromise) return _railPromise;
    _railPromise = supabase.from('catalog_rail').select('*').order('name').then(({ data, error }) => {
        if (error) { _railPromise = null; throw error; }
        const formatted = (data || []).map(item => ({
            ...item,
            // Postgres renvoie les noms de colonnes non quotés en minuscules (buyprice, sellprice)
            buyPrice: Number(item.buyprice ?? item.buyPrice ?? 0),
            sellPrice: Number(item.sellprice ?? item.sellPrice ?? 0),
            coef: Number(item.coef ?? 2),
        }));
        _railCache = formatted;
        _railPromise = null;
        return formatted;
    });
    return _railPromise;
};

export const useCatalogRail = () => {
    const [catalogRails, setCatalogRails] = useState(_railCache || []);
    const [loadingRails, setLoadingRails] = useState(!_railCache);

    const fetchCatalogRails = async (force = false) => {
        setLoadingRails(true);
        try {
            const formatted = await fetchRailsOnce(force);
            setCatalogRails(formatted);
        } catch (error) {
            console.error("Erreur fetch catalog_rail:", error);
        }
        setLoadingRails(false);
    };

    useEffect(() => { fetchCatalogRails(); }, []);

    const addRail = async (item) => {
        const dbItem = { ...item };
        // Prepare payload for Postgres mapping (lowercase)
        const payload = {
            name: dbItem.name,
            provider: dbItem.provider,
            reference: dbItem.reference,
            color: dbItem.color,
            category: dbItem.category,
            buyprice: Number(dbItem.buyPrice || 0),
            sellprice: Number(dbItem.sellPrice || 0),
            coef: Number(dbItem.coef || 2),
            unit: dbItem.unit || 'ml'
        };

        const { data, error } = await supabase.from('catalog_rail').insert([payload]).select();

        if (data && data[0]) {
            const returnedItem = data[0];
            const formattedItem = {
                ...returnedItem,
                buyPrice: Number(returnedItem.buyprice ?? returnedItem.buyPrice ?? 0),
                sellPrice: Number(returnedItem.sellprice ?? returnedItem.sellPrice ?? 0),
            };
            setCatalogRails(prev => [...prev, formattedItem]);
            if (_railCache) _railCache = [..._railCache, formattedItem];
            return formattedItem;
        }
        if (error) console.error("Erreur add rail:", error);
        return null;
    };

    const updateRail = async (id, updates) => {
        const payload = { ...updates };
        if ('buyPrice' in payload) {
            payload.buyprice = payload.buyPrice;
            delete payload.buyPrice;
        }
        if ('sellPrice' in payload) {
            payload.sellprice = payload.sellPrice;
            delete payload.sellPrice;
        }

        const { error } = await supabase.from('catalog_rail').update(payload).eq('id', id);
        if (!error) {
            setCatalogRails(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
            if (_railCache) _railCache = _railCache.map(i => i.id === id ? { ...i, ...updates } : i);
        } else {
            console.error("Erreur update rail:", error);
        }
    };

    const deleteRail = async (id) => {
        const { error } = await supabase.from('catalog_rail').delete().eq('id', id);
        if (!error) {
            setCatalogRails(prev => prev.filter(i => i.id !== id));
            if (_railCache) _railCache = _railCache.filter(i => i.id !== id);
        } else {
            console.error("Erreur delete rail:", error);
        }
    };

    return { catalogRails, loadingRails, addRail, updateRail, deleteRail, refreshCatalogRails: () => fetchCatalogRails(true) };
};

// --- APP SETTINGS (GLOBAL CONFIG) ---
// PERF — Cache module-level : config globale rechargée jusqu'ici à chaque montage
// (ChiffrageRoot + ChiffrageScreen). Donnée de référence → un seul fetch partagé.
const DEFAULT_SETTINGS = { hourlyRate: 135, vatRate: 20, prix_nuit: 180, prix_repas: 25, coef_sous_traitance: 2 };
let _settingsCache = null;
let _settingsPromise = null;
const fetchSettingsOnce = (force = false) => {
    if (!force && _settingsCache) return Promise.resolve(_settingsCache);
    if (!force && _settingsPromise) return _settingsPromise;
    _settingsPromise = (async () => {
        let { data, error } = await supabase
            .from('app_settings')
            .select('*')
            .eq('id', 'global_config')
            .single();

        if (error && error.code === 'PGRST116') {
            // Row not found, create it with defaults
            const defaultPayload = { id: 'global_config', taux_horaire_default: 135, frais_hotel_default: 180 };
            const { data: newData } = await supabase
                .from('app_settings')
                .insert([defaultPayload])
                .select()
                .single();
            if (newData) data = newData;
        }

        const mapped = data ? {
            hourlyRate: data.taux_horaire_default ?? 135,
            taux_horaire: data.taux_horaire_default ?? 135, // Alias
            prix_nuit: data.frais_hotel_default ?? 180,
            vatRate: data.tva_default ?? 20,
            prix_repas: data.frais_repas_default ?? 25,
            coef_sous_traitance: data.coef_marge_st_default ?? 2,
        } : { ...DEFAULT_SETTINGS };
        _settingsCache = mapped;
        _settingsPromise = null;
        return mapped;
    })();
    return _settingsPromise;
};

export const useAppSettings = () => {
    const [settings, setSettings] = useState(_settingsCache || DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(!_settingsCache);

    const fetchSettings = async (force = false) => {
        setLoading(true);
        try {
            const mapped = await fetchSettingsOnce(force);
            setSettings(mapped);
        } catch (e) {
            console.error("Erreur fetch settings:", e);
        }
        setLoading(false);
    };

    useEffect(() => { fetchSettings(); }, []);

    const updateSettings = async (newSettings) => {
        // Optimistic
        setSettings(newSettings);
        _settingsCache = newSettings; // garde le cache cohérent pour les prochains montages

        // Map App Keys -> DB Columns
        const dbPayload = {
            taux_horaire_default: newSettings.hourlyRate || newSettings.taux_horaire,
            frais_hotel_default: newSettings.prix_nuit,
            tva_default: newSettings.vatRate,
            frais_repas_default: newSettings.prix_repas,
            coef_marge_st_default: newSettings.coef_sous_traitance,
            updated_at: new Date()
        };

        const { error } = await supabase
            .from('app_settings')
            .update(dbPayload)
            .eq('id', 'global_config');

        if (error) {
            console.error("Erreur update settings:", error);
            alert("Erreur de sauvegarde des paramètres (Vérifiez que les colonnes existent en base).");
        }
    };

    return { settings, loading, updateSettings };
};

// --- PLANNING ---
export const useEvents = () => {
    const [events, setEvents] = useState([]);

    useEffect(() => {
        const fetchEvents = async () => {
            const { data, error } = await supabase.from('events').select('*');

            if (!error && data) {
                // MAPPING INVERSE : DB (Snake) -> Frontend (Camel)
                const formatted = data.map(e => {
                    const dateStr = e.start_time ? e.start_time.split('T')[0] : null;
                    return {
                        ...e,
                        id: String(e.id),
                        resourceId: e.resource_id,
                        date: dateStr,
                        meta: {
                            ...(e.meta || {}),
                            start: e.start_time,
                            end: e.end_time,
                            projectId: e.project_id
                        }
                    };
                });
                setEvents(formatted);
                db.events.bulkPut(formatted).catch(() => {});
            } else {
                // Hors ligne ou erreur réseau : charger depuis IndexedDB
                const cached = await db.events.toArray();
                if (cached.length > 0) setEvents(cached);
            }
        };

        fetchEvents();
    }, []);

    const updateEvent = async (event) => {
        // 1. Mise à jour locale (Optimistic)
        setEvents(prev => {
            const exists = prev.find(e => e.id === event.id);
            return exists ? prev.map(e => e.id === event.id ? event : e) : [...prev, event];
        });

        // 2. Envoi DB avec gestion d'erreur
        // Mapping des propriétés Frontend -> DB (SnakeCase)
        const dbEvent = {
            id: String(event.id),
            resource_id: event.resourceId || event.resource_id,
            project_id: event.meta?.projectId || event.project_id || null,
            start_time: event.meta?.start || event.start_time,
            end_time: event.meta?.end || event.end_time,
            type: event.type,
            title: event.title,
            meta: event.meta
        };

        const { error } = await supabase.from('events').upsert(dbEvent);

        if (error) {
            console.error("ERREUR CRITIQUE PLANNING:", error);
            alert(`Erreur sauvegarde planning : ${error.message}`);
        }
    };

    const deleteEvent = async (id) => {
        // 1. Mise à jour locale (Optimistic)
        setEvents(prev => prev.filter(e => e.id !== id));

        // 2. Suppression DB
        const { error } = await supabase.from('events').delete().eq('id', id);

        if (error) {
            console.error("ERREUR SUPPRESSION EVENT:", error);
            alert(`Erreur suppression planning : ${error.message}`);
        }
    };

    return { events, updateEvent, deleteEvent };
};

// --- STOCKS (INVENTAIRE) ---
export const useStocks = () => {
    const [inventory, setInventory] = useState([]);
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchStocks = async () => {
        setLoading(true);
        const { data: invData, error: invError } = await supabase.from('inventory_items').select('*').order('product');
        if (invError) console.error("Erreur Fetch Stock:", invError);
        if (invData) setInventory(invData);

        const { data: logData, error: logError } = await supabase.from('inventory_logs').select('*').order('date', { ascending: false });
        if (logError) console.error("Erreur Fetch Logs:", logError);

        if (logData) {
            const formattedLogs = logData.map(l => ({ ...l, user: l.user_name }));
            setMovements(formattedLogs);
        }
        setLoading(false);
    };

    useEffect(() => { fetchStocks(); }, []);

    const addMovement = async (movement) => {
        try {
            // A. Identifier l'item cible dans le stock
            const existingItem = inventory.find(i =>
                i.product === movement.product &&
                i.location === movement.location &&
                (i.project === movement.project || (!i.project && !movement.project))
            );

            // B. Préparation des LOGS à créer (Unitaire si pièces présentes à l'entrée)
            const logsToCreate = [];
            const hasDetailedPieces = Array.isArray(movement.pieces) && movement.pieces.length > 0;

            if (movement.type === 'IN' && hasDetailedPieces) {
                // Création d'une ligne d'historique par pièce reçue
                movement.pieces.forEach((p, idx) => {
                    logsToCreate.push({
                        type: 'IN',
                        product: movement.product,
                        qty: Number(p.qty),
                        unit: movement.unit,
                        user_name: movement.user,
                        location: p.location || movement.location,
                        project: movement.project,
                        reason: `Réception ${p.name || `Pièce ${idx + 1}`}`,
                        pieces_names: p.name || `Pièce ${idx + 1}`,
                        date: new Date().toISOString()
                    });
                });
            } else if (movement.type === 'OUT' && hasDetailedPieces) {
                // Cas d'une sortie avec détail par pièces (Reste)
                // On s'attend à ce que movement.pieces contienne les pièces avec leur NOUVELLE quantité (le reste)
                // On doit calculer la consommation réelle pour faire les logs
                movement.pieces.forEach((p, idx) => {
                    const initialPiece = existingItem?.pieces?.find(ip => ip.id === p.id);
                    if (initialPiece) {
                        const consumed = Number(initialPiece.qty) - Number(p.p_qty || p.qty);
                        const locChanged = p.location && initialPiece.location !== p.location;

                        if (consumed > 0 || locChanged) {
                            const pieceName = p.name || initialPiece.name || `Pièce ${idx + 1}`;
                            let reason = `Consommation ${pieceName}`;
                            if (locChanged) reason += ` | Déplacé de ${initialPiece.location || 'N/A'} vers ${p.location}`;

                            logsToCreate.push({
                                type: 'OUT',
                                product: movement.product,
                                qty: Math.max(0, consumed),
                                unit: movement.unit,
                                user_name: movement.user,
                                location: p.location || initialPiece.location || movement.location,
                                project: movement.project,
                                reason: reason,
                                pieces_names: pieceName,
                                date: new Date().toISOString()
                            });
                        }
                    }
                });
            } else {
                // Log standard pour les autres types de mouvements
                let pieceInfo = '';
                if (movement.type === 'OUT' && hasDetailedPieces) {
                    const selected = movement.pieces.find(p => p.selected);
                    if (selected) {
                        const idx = movement.pieces.findIndex(p => p.id === selected.id);
                        pieceInfo = ` (Sur Pièce ${idx + 1})`;
                    }
                }

                logsToCreate.push({
                    type: movement.type,
                    product: movement.product,
                    qty: Number(movement.qty),
                    unit: movement.unit,
                    user_name: movement.user,
                    location: movement.location,
                    project: movement.project,
                    reason: (movement.reason || (movement.type === 'MOVE' ? `Déplacement depuis ${movement.from_location}` : 'Mouvement manuel')) + pieceInfo,
                    pieces_names: movement.piece_name || null, // Champ pour mouvement simple
                    date: new Date().toISOString()
                });
            }

            // C. Mise à jour de l'INVENTAIRE (Stock groupé)
            let itemError = null;

            if (movement.type === 'MOVE') {
                // Transfert : décrémenter source, incrémenter destination
                const sourceItem = inventory.find(i => i.product === movement.product && i.location === movement.from_location);
                if (sourceItem) {
                    await supabase.from('inventory_items').update({ qty: Number(sourceItem.qty) - Number(movement.qty) }).eq('id', sourceItem.id);
                }
                const destItem = inventory.find(i => i.product === movement.product && i.location === movement.location);
                if (destItem) {
                    const { error } = await supabase.from('inventory_items').update({ qty: Number(destItem.qty) + Number(movement.qty) }).eq('id', destItem.id);
                    itemError = error;
                } else {
                    const { error } = await supabase.from('inventory_items').insert([{
                        product: movement.product, location: movement.location, qty: Number(movement.qty),
                        unit: movement.unit, project: movement.project, category: movement.category, pieces: movement.pieces || []
                    }]);
                    itemError = error;
                }
            } else {
                // IN or OUT
                if (existingItem) {
                    let newQty = movement.type === 'IN' ? Number(existingItem.qty) + Number(movement.qty) : Number(existingItem.qty) - Number(movement.qty);
                    let newPieces = Array.isArray(existingItem.pieces) ? [...existingItem.pieces] : [];

                    if (movement.type === 'IN' && hasDetailedPieces) {
                        newPieces = [...newPieces, ...movement.pieces];
                    } else if (movement.type === 'OUT' && hasDetailedPieces) {
                        // Si on a le détail des pièces (le reste), on remplace tout
                        newPieces = movement.pieces.map(p => ({ ...p, qty: Number(p.p_qty || p.qty) })).filter(p => p.qty > 0);
                        newQty = newPieces.reduce((sum, p) => sum + p.qty, 0);
                    } else if (movement.type === 'OUT' && movement.piece_name && newPieces.length > 0) {
                        // Sortie ciblée sur une pièce spécifique (ex: expédition tissu)
                        newPieces = newPieces.map(p =>
                            p.name === movement.piece_name
                                ? { ...p, qty: Math.max(0, Number(p.qty) - Number(movement.qty)) }
                                : p
                        );
                    }

                    // Toujours recalculer qty depuis la somme des pièces quand elles existent (source de vérité)
                    if (newPieces.length > 0) {
                        newQty = newPieces.reduce((sum, p) => sum + Number(p.qty), 0);
                    }

                    const { error } = await supabase.from('inventory_items').update({ qty: Math.max(0, newQty), pieces: newPieces }).eq('id', existingItem.id);
                    itemError = error;
                } else if (movement.type === 'IN') {
                    const { error } = await supabase.from('inventory_items').insert([{
                        product: movement.product, location: movement.location, qty: Number(movement.qty),
                        unit: movement.unit, project: movement.project, category: movement.category, pieces: movement.pieces || []
                    }]);
                    itemError = error;
                }
            }

            if (itemError) throw itemError;

            // D. Finir par l'insertion des LOGS
            const { error: logError } = await supabase.from('inventory_logs').insert(logsToCreate);
            if (logError) throw logError;

            fetchStocks();
            return { success: true };
        } catch (error) {
            console.error('Erreur addMovement:', error);
            alert(`Erreur : ${error.message}`);
            return { success: false, error };
        }
    };

    const bulkUpdateInventory = async (updates, user) => {
        setLoading(true);
        try {
            const logsToCreate = [];

            for (const update of updates) {
                // 1. Mise à jour de l'item (Qty et/ou Location)
                const itemUpdates = {};
                if (update.hasQtyChange) itemUpdates.qty = Math.max(0, update.newTotalQty);
                if (update.hasLocChange) itemUpdates.location = update.newLocation;

                if (Object.keys(itemUpdates).length > 0) {
                    const { error: itemError } = await supabase
                        .from('inventory_items')
                        .update(itemUpdates)
                        .eq('id', update.id);

                    if (itemError) throw itemError;
                }

                // 2. Préparation des logs
                // Log de Sortie si Qty a baissé
                if (update.hasQtyChange) {
                    logsToCreate.push({
                        type: 'OUT',
                        product: update.product,
                        qty: Number(update.qtyToRemove),
                        unit: update.unit,
                        user_name: user,
                        location: update.newLocation || update.location,
                        project: update.project,
                        reason: update.reason || 'SOLDE / DÉSTOCKAGE EXCEL',
                        date: new Date().toISOString()
                    });
                }

                // Log de Déplacement si Location a changé
                if (update.hasLocChange) {
                    logsToCreate.push({
                        type: 'MOVE',
                        product: update.product,
                        qty: Number(update.newTotalQty),
                        unit: update.unit,
                        user_name: user,
                        location: update.newLocation,
                        project: update.project,
                        reason: `DÉPLACEMENT EXCEL (De ${update.oldLocation || 'N/A'} vers ${update.newLocation})`,
                        date: new Date().toISOString()
                    });
                }
            }

            // 3. Insertion des logs en une seule fois
            if (logsToCreate.length > 0) {
                const { error: logError } = await supabase.from('inventory_logs').insert(logsToCreate);
                if (logError) throw logError;
            }

            fetchStocks();
            return { success: true, count: updates.length };
        } catch (error) {
            console.error('Erreur bulkUpdateInventory:', error);
            alert(`Erreur lors de la mise à jour groupée : ${error.message}`);
            return { success: false, error };
        } finally {
            setLoading(false);
        }
    };

    return {
        inventory,
        movements,
        loading,
        addMovement,
        refreshStocks: fetchStocks,
        bulkUpdateInventory
    };
};

// --- WAREHOUSE ZONES ---
export const useWarehouseZones = () => {
    const [zones, setZones] = useState([]);

    useEffect(() => {
        supabase
            .from('warehouse_zones')
            .select('code, allee, niveau, niveau_label, type, section, capacite, capacite_unite, label_carte, description')
            .eq('is_storage', true)
            .order('section')
            .order('code')
            .then(({ data, error }) => {
                if (error) console.error("Erreur fetch warehouse_zones:", error);
                if (data) setZones(data);
            });
    }, []);

    return { zones };
};
