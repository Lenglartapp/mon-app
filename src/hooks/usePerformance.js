import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

// ── usePerformanceEntries ──────────────────────────────────────────────────────
export function usePerformanceEntries() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    const { data, error } = await supabase
      .from('performance_entries')
      .select('*')
      .order('updated_at', { ascending: false });
    if (!error) setEntries(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  // Upsert (insert or update) — la contrainte UNIQUE (project_id, service) gère la déduplication
  const upsertEntry = async (entry, currentUserName = '') => {
    const payload = {
      project_id: entry.project_id,
      service: entry.service,
      raisons: entry.raisons || [],
      commentaire: entry.commentaire || '',
      has_sav: entry.has_sav || false,
      heures_sav: entry.heures_sav || 0,
      updated_at: new Date().toISOString(),
    };

    if (entry.id) {
      // UPDATE
      const { data, error } = await supabase
        .from('performance_entries')
        .update(payload)
        .eq('id', entry.id)
        .select();
      if (error) console.error('[Performance] UPDATE error:', error, payload);
      if (!error && data?.[0]) {
        setEntries(prev => prev.map(e => e.id === entry.id ? data[0] : e));
      }
      return { data, error };
    } else {
      // INSERT
      const { data, error } = await supabase
        .from('performance_entries')
        .upsert([payload], { onConflict: 'project_id,service' })
        .select();
      if (error) console.error('[Performance] UPSERT error:', error, payload);
      if (!error && data?.[0]) {
        setEntries(prev => {
          const exists = prev.find(e => e.project_id === payload.project_id && e.service === payload.service);
          if (exists) return prev.map(e => (e.project_id === payload.project_id && e.service === payload.service) ? data[0] : e);
          return [data[0], ...prev];
        });
      }
      return { data, error };
    }
  };

  const deleteEntry = async (id) => {
    const { error } = await supabase.from('performance_entries').delete().eq('id', id);
    if (!error) setEntries(prev => prev.filter(e => e.id !== id));
  };

  return { entries, loading, upsertEntry, deleteEntry, refresh: fetch };
}

// ── usePerformanceActions ──────────────────────────────────────────────────────
export function usePerformanceActions() {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    const { data, error } = await supabase
      .from('performance_actions')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setActions(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const addAction = async (action) => {
    const payload = {
      titre: action.titre,
      description: action.description || '',
      linked_project_id: action.linked_project_id || null,
      linked_raison: action.linked_raison || '',
      responsable: action.responsable || '',
      statut: action.statut || 'A_FAIRE',
      date_cible: action.date_cible || null,
      notes: action.notes || '',
    };
    const { data, error } = await supabase.from('performance_actions').insert([payload]).select();
    if (!error && data?.[0]) setActions(prev => [data[0], ...prev]);
    return { data, error };
  };

  const updateAction = async (id, updates) => {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    // GARDE-FOU DATES — Postgres (date/timestamptz) REFUSE la chaîne vide "" (erreur 22007).
    // Vider le champ date d'une action existante renvoie "" : on convertit "" -> null.
    for (const dateKey of ['date_cible', 'created_at', 'updated_at']) {
      if (payload[dateKey] === '') payload[dateKey] = null;
    }
    const { data, error } = await supabase
      .from('performance_actions')
      .update(payload)
      .eq('id', id)
      .select();
    if (!error && data?.[0]) setActions(prev => prev.map(a => a.id === id ? data[0] : a));
    return { data, error };
  };

  const deleteAction = async (id) => {
    const { error } = await supabase.from('performance_actions').delete().eq('id', id);
    if (!error) setActions(prev => prev.filter(a => a.id !== id));
  };

  return { actions, loading, addAction, updateAction, deleteAction };
}
