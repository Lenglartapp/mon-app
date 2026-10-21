import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function SupabaseMigration({ projects, events, minutes }) {
    const [loading, setLoading] = useState(false);
    const [log, setLog] = useState("");

    const handleMigration = async () => {
        if (!confirm("Voulez-vous migrer TOUTES les données locales vers Supabase ?")) return;

        setLoading(true);
        setLog("Démarrage de la migration...");
        const idMap = {}; // Map old_id -> new_uuid

        try {
            // 1. MIGRATION DES PROJETS
            for (const p of projects) {
                setLog(l => l + `\nMigration projet: ${p.name}...`);

                const budget = p.budget || { prepa: 0, conf: 0, pose: 0 };
                const payload = {
                    name: p.name || "Sans nom",
                    manager: p.manager || null,
                    status: p.status || 'En cours',
                    notes: p.notes || null,
                    deadline: p.due ? new Date(p.due).toISOString() : null,
                    budget_prepa: parseFloat(budget.prepa || 0),
                    budget_conf: parseFloat(budget.conf || 0),
                    budget_pose: parseFloat(budget.pose || 0),
                    source_minute_id: p.sourceMinuteId || null,
                    rows: p.rows || [],
                    wall: p.wall || [],
                    config: p.config || {}
                };

                const { data, error } = await supabase.from('projects').insert(payload).select().single();

                if (error) {
                    setLog(l => l + ` ❌ Erreur: ${error.message}`);
                    continue;
                }
                if (p.id && data.id) {
                    idMap[p.id] = data.id;
                    setLog(l => l + ` ✅ OK`);
                }
            }

            // 2. MIGRATION DES EVENTS
            setLog(l => l + `\n\nMigration Planning...`);
            let eventCount = 0;
            for (const evt of events) {
                const oldPid = evt.meta?.projectId || evt.projectId;
                const newPid = idMap[oldPid]; // Peut être null si projet pas migré ou sans ID

                if (oldPid && !newPid) {
                    console.warn(`Event ${evt.title} orphelin de projet ${oldPid}`);
                }

                const payload = {
                    id: String(evt.id),
                    resource_id: evt.resourceId || "Inconnu",
                    project_id: newPid || null,
                    title: evt.title || "Activite",
                    type: evt.type || "default",
                    start_time: evt.meta?.start || new Date().toISOString(),
                    end_time: evt.meta?.end || new Date().toISOString(),
                    meta: evt.meta || {}
                };

                // On ignore l'erreur unique key pour events
                const { error } = await supabase.from('events').insert(payload);
                if (!error) eventCount++;
            }
            setLog(l => l + ` ${eventCount} events migrés.`);

            // 3. MIGRATION MINUTES (Chiffrage)
            if (minutes && minutes.length > 0) {
                setLog(l => l + `\n\nMigration Chiffrage (${minutes.length} devis)...`);
                for (const m of minutes) {
                    const payload = {
                        id: String(m.id),
                        name: m.name || "Devis sans nom",
                        client: m.client || "",
                        status: m.status || 'DRAFT',
                        version: m.version || 1,
                        notes: m.notes || "",
                        lines: m.lines || [],
                        deplacements: m.deplacements || [],
                        params: m.params || [],
                        extras: m.extras || [],
                        // Total HT est calculé à la volée en local, on ne le stocke pas forcément ou on le recalcule ?
                        // Pour l'instant on stocke 0, ou on essaie de lire s'il est dispo.
                        total_ht: 0
                    };

                    const { error } = await supabase.from('minutes').insert(payload);
                    if (error) setLog(l => l + `\n❌ Err Minute ${m.name}: ${error.details}`);
                    else setLog(l => l + `\n✅ Minute ${m.name} migrée.`);
                }
            }

            // 4. MIGRATION STOCK
            const rawStock = localStorage.getItem("inventory.items");
            if (rawStock) {
                const items = JSON.parse(rawStock);
                setLog(l => l + `\n\nMigration Stock (${items.length} articles)...`);
                let stockCount = 0;
                for (const item of items) {
                    const payload = {
                        // On laisse Supabase générer UUID, sauf si on veut garder l'ancien ID
                        // Si ancien ID est UUID valide, on le garde. Sinon on laisse faire.
                        name: item.name,
                        description: item.ref || "",
                        category: item.family || 'General',
                        stock_quantity: parseFloat(item.stock || 0),
                        unit: item.unit || 'u',
                        min_threshold: parseFloat(item.minStock || 0),
                        supplier: item.supplier || "",
                        location: item.location || ""
                    };
                    const { error } = await supabase.from('inventory_items').insert(payload);
                    if (error) {
                        setLog(l => l + `\n❌ Err Stock ${item.name}: ${error.message}`);
                    } else {
                        stockCount++;
                    }
                }
                setLog(l => l + `\n✅ ${stockCount} articles de stock migrés.`);
            }

            setLog(l => l + `\n\n✅ MIGRATION COMPLÈTE TERMINÉE !`);
            alert("Migration terminée avec succès !");

        } catch (err) {
            console.error(err);
            setLog(l => l + `\n💥 CRASH: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: 20, background: '#eee', marginTop: 50, borderTop: '2px solid red' }}>
            <h3>⚠️ Zone Admin : Migration DB Complète</h3>
            <p>Transfère les données du navigateur (LocalStorage) vers Supabase.</p>

            <button
                onClick={handleMigration}
                disabled={loading}
                style={{ padding: '10px 20px', background: loading ? '#999' : 'var(--df-danger-text)', color: 'white', fontWeight: 'bold' }}
            >
                {loading ? 'Migration en cours...' : 'Lancer la Migration (Projets, Events, Devis, Stock)'}
            </button>
            {log && (
                <pre style={{ marginTop: 10, padding: 10, background: 'black', color: '#0f0', maxHeight: 200, overflow: 'auto', fontSize: 11 }}>
                    {log}
                </pre>
            )}
        </div>
    );
}
