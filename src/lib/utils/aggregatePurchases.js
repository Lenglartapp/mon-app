export function aggregatePurchases(minutes = []) {
    const aggs = {
        tissus: {},
        rails: {},
        mecanismes: {},
        sous_traitance: {},
    };

    // Helper to init or update an entry
    const add = (store, key, label, quantity, price, source) => {
        if (!key) return;
        if (!store[key]) {
            store[key] = {
                label,
                total_qty: 0,
                total_pa: 0,
                sources: []
            };
        }
        const safeQty = Number(quantity) || 0;
        const safePrice = Number(price) || 0;

        store[key].total_qty += safeQty;
        store[key].total_pa += safePrice;
        store[key].sources.push({
            ...source,
            quantite_ligne: safeQty,
            cout_ligne: safePrice
        });
    };

    const toNum = (v) => {
        const n = Number(String(v ?? "").replace(",", "."));
        return Number.isFinite(n) ? n : 0;
    };

    // Iterate over all minutes
    minutes.forEach(minute => {
        const lines = minute.lines || [];

        lines.forEach(row => {
            const qtyRow = toNum(row.quantite) || 1;
            const baseSource = {
                minute: minute.name,
                zone: row.zone,
                piece: row.piece,
                produit: row.produit,
            };

            // 1. Tissus & Confection (Tissu 1, Tissu 2, Doublure, Inter, Passementerie 1 & 2)
            // STRICT KEYS MAPPING
            const fabricFields = [
                // RIDEAUX
                { key: 'tissu_deco1', mlKey: 'ml_tissu1', paKey: 'pa_tissu1' },
                { key: 'tissu_deco2', mlKey: 'ml_tissu2', paKey: 'pa_tissu2' },
                { key: 'doublure', mlKey: 'ml_doublure', paKey: 'pa_doublure' },
                { key: 'interdoublure', mlKey: 'ml_interdoublure', paKey: 'pa_interdoublure' }, // Was 'inter_doublure'
                { key: 'passementerie1', mlKey: 'ml_pass1', paKey: 'pa_pass1' }, // Rideaux Pass 1
                { key: 'passementerie2', mlKey: 'ml_pass2', paKey: 'pa_pass2' },

                // DECORS (Underscored keys)
                { key: 'tissu_1', mlKey: 'ml_tissu_1', paKey: 'pa_tissu_1' },
                { key: 'tissu_2', mlKey: 'ml_tissu_2', paKey: 'pa_tissu_2' },
                { key: 'passementerie_1', mlKey: 'ml_pass_1', paKey: 'pa_pass_1' },
                { key: 'passementerie_2', mlKey: 'ml_pass_2', paKey: 'pa_pass_2' },
                // Interior/Garniture (Decors)
                // Using 'type_interieur' as name, and 'pa_interieur' as price. No ML.
                { key: 'type_interieur', mlKey: null, paKey: 'pa_interieur' },

                // STORES
                { key: 'toile_finition_1', mlKey: 'ml_toile_finition_1', paKey: 'pa_toile_finition_1' },
            ];

            fabricFields.forEach(f => {
                const name = row[f.key];
                if (name) {
                    // ML is usually per unit in schema, so multiply by row quantity
                    // Handle case where mlKey is null (e.g. Interieur)
                    const unitML = f.mlKey ? toNum(row[f.mlKey]) : 0;
                    const ml = unitML * qtyRow;

                    // PA is usually TOTAL PA for the line (unit).
                    const pa = toNum(row[f.paKey]) * qtyRow;

                    add(aggs.tissus, name, name, ml, pa, { ...baseSource, type: 'Tissu', detail: f.key });
                }
            });

            // 2. Mechanisms (Rail vs Others)
            // A. RIDEAUX (Rail / Tringle / Store legacy?)
            const typeMeca = row.type_mecanisme;
            const modelMeca = row.modele_mecanisme;

            if (typeMeca) {
                if (typeMeca === 'Rail' && modelMeca) {
                    // Rails -> Linear Meters (ml)
                    const widthCm = toNum(row.largeur_mecanisme);
                    const ml = (widthCm / 100) * qtyRow;
                    const pa = toNum(row.pa_mecanisme) * qtyRow;

                    add(aggs.rails, modelMeca, modelMeca, ml, pa, { ...baseSource, type: 'Rail', detail: `${widthCm} cm` });
                } else if (modelMeca) {
                    // Tringles / Autres -> Units
                    const qty = qtyRow;
                    const pa = toNum(row.pa_mecanisme) * qtyRow;
                    const key = `${typeMeca} - ${modelMeca}`;

                    add(aggs.mecanismes, key, key, qty, pa, { ...baseSource, type: typeMeca, detail: row.modele_mecanisme });
                }
            }

            // B. DECORS (Mecanisme Fourniture)
            if (row.mecanisme_fourniture) {
                const name = row.mecanisme_fourniture;
                const pa = toNum(row.pa_mecanisme) * qtyRow;
                // Assuming Unitary
                add(aggs.mecanismes, name, name, qtyRow, pa, { ...baseSource, type: 'Fourniture Décors', detail: name });
            }

            // C. STORES (Mecanisme Store)
            if (row.mecanisme_store) {
                const name = row.mecanisme_store;
                const pa = toNum(row.pa_mecanisme_store) * qtyRow;
                add(aggs.mecanismes, name, name, qtyRow, pa, { ...baseSource, type: 'Méca Store', detail: name });
            }

            // 3. Sous-traitance (Pose & Confection)
            // Schema keys: st_pose_pa, st_conf_pa
            const stPoseCost = toNum(row.st_pose_pa);
            if (stPoseCost > 0) {
                add(aggs.sous_traitance, 'Sous-traitance Pose', 'Sous-traitance Pose', qtyRow, stPoseCost * qtyRow, { ...baseSource, type: 'ST Pose', detail: 'Forfait Pose' });
            }

            const stConfCost = toNum(row.st_conf_pa);
            if (stConfCost > 0) {
                add(aggs.sous_traitance, 'Sous-traitance Confection', 'Sous-traitance Confection', qtyRow, stConfCost * qtyRow, { ...baseSource, type: 'ST Conf', detail: 'Forfait Confection' });
            }
        });
    });

    // Convert objects to sorted arrays
    const toArray = (store) => Object.values(store).sort((a, b) => a.label.localeCompare(b.label));

    return {
        tissus: toArray(aggs.tissus),
        rails: toArray(aggs.rails),
        mecanismes: toArray(aggs.mecanismes),
        sous_traitance: toArray(aggs.sous_traitance)
    };
}
