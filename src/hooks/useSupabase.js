import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

// --- PROJETS ---
export const useProjects = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchProjects = async () => {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('updated_at', { ascending: false });
        if (!error) setProjects(data || []);
        setLoading(false);
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
            due: toIsoString(project.due), // Date de livraison

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

        // 2. Préparation pour la DB
        const dbUpdates = { ...updates };

        // Conversion Dates ISO
        if (updates.due) dbUpdates.due = new Date(updates.due).toISOString();
        if (updates.updatedAt) dbUpdates.updated_at = new Date(updates.updatedAt).toISOString();
        if (updates.createdAt) dbUpdates.created_at = new Date(updates.createdAt).toISOString();

        // Nettoyage des clés JS
        delete dbUpdates.due;
        delete dbUpdates.updatedAt;
        delete dbUpdates.createdAt;

        // Mapping CamelCase -> SnakeCase
        if (updates.sourceMinuteId) {
            dbUpdates.source_minute_id = updates.sourceMinuteId;
            delete dbUpdates.sourceMinuteId;
        }

        await supabase.from('projects').update(dbUpdates).eq('id', id);
    };

    const deleteProject = async (id) => {
        setProjects(prev => prev.filter(p => p.id !== id));
        await supabase.from('projects').delete().eq('id', id);
    };

    return { projects, loading, addProject, updateProject, deleteProject, refreshProjects: fetchProjects };
};

// --- MINUTES (CHIFFRAGE) ---
export const useMinutes = () => {
    const [minutes, setMinutes] = useState([]);

    const fetchMinutes = async () => {
        const { data, error } = await supabase.from('minutes').select('*').order('updated_at', { ascending: false });
        if (!error) {
            // Mapping : DB 'lines' -> Frontend 'tables'
            // Fallback to [] if null to avoid crashes
            const formatted = data.map(m => ({
                ...m,
                tables: m.lines || [],
                budgetSnapshot: m.budget_snapshot || { prepa: 0, conf: 0, pose: 0 }
            }));
            setMinutes(formatted);
        }
    };

    useEffect(() => { fetchMinutes(); }, []);

    const updateMinute = async (id, updates) => {
        const dbUpdates = { ...updates };
        if (updates.tables) {
            dbUpdates.lines = updates.tables;
            delete dbUpdates.tables;
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
            budget_snapshot: minute.budgetSnapshot || {}
        };

        delete dbMinute.tables;
        delete dbMinute.createdAt;
        delete dbMinute.updatedAt;
        delete dbMinute.budgetSnapshot;

        const { data, error } = await supabase.from('minutes').insert([dbMinute]).select();

        if (data && data.length > 0) {
            const newMinute = data[0];
            const frontendMinute = {
                ...newMinute,
                tables: newMinute.lines,
                createdAt: newMinute.created_at,
                updatedAt: newMinute.updated_at,
                budgetSnapshot: newMinute.budget_snapshot
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

    return { minutes, addMinute, updateMinute, deleteMinute, refreshMinutes: fetchMinutes };
};

// --- CATALOG (BIBLIOTHEQUE) ---
export const useCatalog = () => {
    const [catalog, setCatalog] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchCatalog = async () => {
        setLoading(true);
        // Supabase Select
        const { data, error } = await supabase.from('catalog').select('*').order('name');
        if (!error) {
            // Ensure numeric values are numbers
            const formatted = (data || []).map(item => ({
                ...item,
                price: Number(item.price || 0)
            }));
            setCatalog(formatted);
        } else {
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
            return data[0];
        }
        if (error) console.error("Erreur add item:", error);
        return null;
    };

    const updateItem = async (id, updates) => {
        const { error } = await supabase.from('catalog').update(updates).eq('id', id);
        if (!error) {
            setCatalog(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
        } else {
            console.error("Erreur update item:", error);
        }
    };

    const deleteItem = async (id) => {
        const { error } = await supabase.from('catalog').delete().eq('id', id);
        if (!error) {
            setCatalog(prev => prev.filter(i => i.id !== id));
        } else {
            console.error("Erreur delete item:", error);
        }
    };

    return { catalog, loading, addItem, updateItem, deleteItem, refreshCatalog: fetchCatalog };
};

// --- APP SETTINGS (GLOBAL CONFIG) ---
export const useAppSettings = () => {
    const [settings, setSettings] = useState({ hourlyRate: 50, vatRate: 20 }); // Defaults
    const [loading, setLoading] = useState(true);

    const fetchSettings = async () => {
        setLoading(true);
        // On suppose une ligne unique avec id='global_config'
        let { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('id', 'global_config')
            .single();

        if (error && error.code === 'PGRST116') {
            // Row not found, create it
            const defaultSettings = { hourlyRate: 50, vatRate: 20 };
            const { data: newData, error: insertError } = await supabase
                .from('app_settings')
                .insert([{ id: 'global_config', value: defaultSettings }])
                .select()
                .single();

            if (newData) data = newData;
        }

        if (data?.value) {
            setSettings(data.value);
        }
        setLoading(false);
    };

    useEffect(() => { fetchSettings(); }, []);

    const updateSettings = async (newSettings) => {
        // Optimistic
        setSettings(newSettings);

        const { error } = await supabase
            .from('app_settings')
            .update({ value: newSettings, updated_at: new Date() })
            .eq('id', 'global_config');

        if (error) {
            console.error("Erreur update settings:", error);
            // Revert or alert?
            alert("Erreur de sauvegarde des paramètres.");
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

            if (error) {
                console.error("Erreur chargement planning:", error);
            }

            if (data) {
                // MAPPING INVERSE : DB (Snake) -> Frontend (Camel)
                const formatted = data.map(e => {
                    // Sécurité pour la date (extrait YYYY-MM-DD depuis l'ISO)
                    const dateStr = e.start_time ? e.start_time.split('T')[0] : null;

                    return {
                        ...e,
                        id: String(e.id), // Sécurité : on veut du texte pour l'ID
                        resourceId: e.resource_id, // C'est ICI que ça se jouait !

                        // C'EST ICI LA CORRECTION CRUCIALE 👇
                        date: dateStr,

                        // On reconstruit l'objet meta que le PlanningScreen attend
                        meta: {
                            ...(e.meta || {}),
                            start: e.start_time, // La DB a stocké start_time
                            end: e.end_time,     // La DB a stocké end_time
                            projectId: e.project_id
                        }
                    };
                });
                setEvents(formatted);
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

    return { events, updateEvent };
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
        console.log("TENTATIVE AJOUT MOUVEMENT:", movement); // Debug Console

        // A. Enregistrer dans l'historique (LOGS)
        const logEntry = {
            date: new Date().toISOString(),
            type: movement.type,
            product: movement.product,
            qty: Number(movement.qty),
            unit: movement.unit,
            user_name: movement.user,
            location: movement.location,
            project: movement.project,
            reason: movement.reason || null
        };

        const { error: logError } = await supabase.from('inventory_logs').insert([logEntry]);

        if (logError) {
            console.error("Erreur SQL Logs:", logError);
            alert(`Erreur lors de l'historique : ${logError.message}`);
            return;
        }

        // B. Mettre à jour le Stock (ITEMS)
        const existingItem = inventory.find(i =>
            i.product === movement.product &&
            i.location === movement.location &&
            (i.project === movement.project || (!i.project && !movement.project))
        );

        let itemError = null;

        if (existingItem) {
            // UPDATE
            const newQty = movement.type === 'IN'
                ? Number(existingItem.qty) + Number(movement.qty)
                : Number(existingItem.qty) - Number(movement.qty);

            const res = await supabase.from('inventory_items')
                .update({ qty: newQty, updated_at: new Date() })
                .eq('id', existingItem.id);
            itemError = res.error;
        } else if (movement.type === 'IN') {
            // INSERT
            // Attention : Si une colonne ici n'existe pas dans la DB, ça plantera
            const res = await supabase.from('inventory_items').insert([{
                product: movement.product,
                ref: movement.ref,
                location: movement.location,
                qty: Number(movement.qty),
                unit: movement.unit,
                project: movement.project,
                category: movement.category // Vérifier que cette colonne existe
            }]);
            itemError = res.error;
        }

        if (itemError) {
            console.error("Erreur SQL Items:", itemError);
            alert(`Erreur lors de la mise à jour du stock : ${itemError.message}\n(Code: ${itemError.code})`);
        } else {
            // Succès total
            fetchStocks();
        }
    };

    return { inventory, movements, loading, addMovement, refreshStocks: fetchStocks };
};
