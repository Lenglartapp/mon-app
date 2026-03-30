import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

// ── Helpers rideau/voilage ────────────────────────────────────────────────────
export const isRideauVoilage = (produit) => /rideau|voilage/i.test(String(produit || ''));

// Calcule le nouveau statut_expedition en tenant compte du statut existant et de la partie expédiée
export const computeExpeditionStatus = (currentStatus, partie) => {
    // Non rideau/voilage ou complet → binaire
    if (!partie || partie === 'complet') return 'Expédié';

    if (partie === 'rail') {
        if (currentStatus === 'Rideau expédié') return 'Rail + Rideau expédié';
        return 'Rail expédié';
    }
    if (partie === 'rideau') {
        if (currentStatus === 'Rail expédié') return 'Rail + Rideau expédié';
        return 'Rideau expédié';
    }
    return 'Expédié';
};

export const useShipments = () => {
    const [shipments, setShipments] = useState([]);
    const [items, setItems] = useState([]);
    const [colis, setColis] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchAll = async () => {
        setLoading(true);
        const [{ data: sData }, { data: iData }, { data: cData }] = await Promise.all([
            supabase.from('expeditions').select('*').order('created_at', { ascending: false }),
            supabase.from('expedition_items').select('*').order('ordre'),
            supabase.from('expedition_colis').select('*').order('ordre'),
        ]);
        if (sData) setShipments(sData);
        if (iData) setItems(iData);
        if (cData) setColis(cData);
        setLoading(false);
    };

    useEffect(() => { fetchAll(); }, []);

    // ── Générer la prochaine référence ──────────────────────────────────────
    const nextReference = (existing) => {
        const year = new Date().getFullYear();
        const prefix = `EXP-${year}-`;
        const nums = existing
            .filter(s => s.reference?.startsWith(prefix))
            .map(s => parseInt(s.reference.replace(prefix, ''), 10))
            .filter(n => !isNaN(n));
        const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
        return `${prefix}${String(next).padStart(3, '0')}`;
    };

    // ── CRUD Expéditions ────────────────────────────────────────────────────
    const createShipment = async (fields) => {
        const reference = fields.reference?.trim() || nextReference(shipments);
        const payload = { ...fields, reference, statut: 'Brouillon' };
        const { data, error } = await supabase.from('expeditions').insert([payload]).select();
        if (!error && data?.[0]) {
            setShipments(prev => [data[0], ...prev]);
            return data[0];
        }
        return null;
    };

    const updateShipment = async (id, updates) => {
        const { error } = await supabase
            .from('expeditions')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (!error) setShipments(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const deleteShipment = async (id) => {
        await supabase.from('expeditions').delete().eq('id', id);
        setShipments(prev => prev.filter(s => s.id !== id));
        setItems(prev => prev.filter(i => i.expedition_id !== id));
    };

    // ── CRUD Items ──────────────────────────────────────────────────────────
    // newItems : array of { type, project_id, row_id, piece, produit, partie?, description?, quantite?, notes? }
    const addItems = async (expeditionId, newItems) => {
        const payload = newItems.map(({ piece_name: _pn, ...item }, idx) => ({ ...item, expedition_id: expeditionId, ordre: idx }));
        const { data, error } = await supabase.from('expedition_items').insert(payload).select();
        if (!error && data) setItems(prev => [...prev, ...data]);
        return !error;
    };

    const removeItem = async (itemId) => {
        await supabase.from('expedition_items').delete().eq('id', itemId);
        setItems(prev => prev.filter(i => i.id !== itemId));
    };

    // ── Validation expédition ───────────────────────────────────────────────
    const validateShipment = async (shipmentId, projects, onUpdateProject) => {
        await updateShipment(shipmentId, {
            statut: 'Expédiée',
            date_expedition: new Date().toISOString().split('T')[0],
        });

        const ouvrageItems = items.filter(i => i.expedition_id === shipmentId && i.type === 'ouvrage');

        // Regrouper par projet
        const byProject = {};
        for (const item of ouvrageItems) {
            if (!byProject[item.project_id]) byProject[item.project_id] = [];
            byProject[item.project_id].push(item);
        }

        for (const [projectId, expItems] of Object.entries(byProject)) {
            const project = projects.find(p => String(p.id) === String(projectId));
            if (!project) continue;

            const updatedRows = (project.rows || []).map(r => {
                const matching = expItems.find(i => i.row_id === r.id);
                if (!matching) return r;

                const newStatus = computeExpeditionStatus(r.statut_expedition, matching.partie);
                return { ...r, statut_expedition: newStatus };
            });

            onUpdateProject(projectId, { rows: updatedRows });
        }
    };

    // ── CRUD Colis ──────────────────────────────────────────────────────────
    const createColis = async (expeditionId, fields) => {
        const existing = colis.filter(c => c.expedition_id === expeditionId);
        const ordre = existing.length;
        const payload = { ...fields, expedition_id: expeditionId, ordre, item_ids: [] };
        const { data, error } = await supabase.from('expedition_colis').insert([payload]).select();
        if (!error && data?.[0]) {
            setColis(prev => [...prev, data[0]]);
            return data[0];
        }
        return null;
    };

    const updateColis = async (colisId, updates) => {
        const { error } = await supabase.from('expedition_colis').update(updates).eq('id', colisId);
        if (!error) setColis(prev => prev.map(c => c.id === colisId ? { ...c, ...updates } : c));
    };

    const deleteColis = async (colisId) => {
        await supabase.from('expedition_colis').delete().eq('id', colisId);
        setColis(prev => prev.filter(c => c.id !== colisId));
    };

    const toggleItemInColis = async (colisId, itemId) => {
        const c = colis.find(x => x.id === colisId);
        if (!c) return;
        const current = c.item_ids || [];
        const next = current.includes(itemId)
            ? current.filter(id => id !== itemId)
            : [...current, itemId];
        await updateColis(colisId, { item_ids: next });
    };

    // ── Helpers ─────────────────────────────────────────────────────────────
    const itemsForShipment = (shipmentId) => items.filter(i => i.expedition_id === shipmentId);
    const colisForShipment = (shipmentId) => colis.filter(c => c.expedition_id === shipmentId).sort((a, b) => a.ordre - b.ordre);

    const shipmentForRow = (rowId) => {
        const item = items.find(i => i.row_id === rowId && i.type === 'ouvrage');
        if (!item) return null;
        return shipments.find(s => s.id === item.expedition_id) || null;
    };

    return {
        shipments,
        items,
        colis,
        loading,
        createShipment,
        updateShipment,
        deleteShipment,
        addItems,
        removeItem,
        validateShipment,
        createColis,
        updateColis,
        deleteColis,
        toggleItemInColis,
        itemsForShipment,
        colisForShipment,
        shipmentForRow,
        refresh: fetchAll,
    };
};
