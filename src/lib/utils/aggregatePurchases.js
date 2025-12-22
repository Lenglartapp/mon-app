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
                { key: 'tissu_deco1', mlKey: 'ml_tissu1', paKey: 'pa_tissu1' },
                { key: 'tissu_deco2', mlKey: 'ml_tissu2', paKey: 'pa_tissu2' },
                { key: 'doublure', mlKey: 'ml_doublure', paKey: 'pa_doublure' },
                { key: 'interdoublure', mlKey: 'ml_interdoublure', paKey: 'pa_interdoublure' }, // Was 'inter_doublure'
                { key: 'passementerie1', mlKey: 'ml_pass1', paKey: 'pa_pass1' }, // Was ml_passementerie1
                { key: 'passementerie2', mlKey: 'ml_pass2', paKey: 'pa_pass2' },
            ];

            fabricFields.forEach(f => {
                const name = row[f.key];
                if (name) {
                    // ML is usually per unit in schema, so multiply by row quantity
                    const ml = toNum(row[f.mlKey]) * qtyRow;
                    // PA is usually TOTAL PA in schema line? Let's check recomputeRow.
                    // recomputeRow: next.pa_tissu1 = next.ml_tissu1 * (p1.pa || 0); <- This is TOTAL PA for the line (unit).
                    // Wait, recomputeRow: next.pa_tissu1 is per UNIT (it uses next.ml_tissu1 which is per unit).
                    // So we must multiply by qtyRow.
                    const pa = toNum(row[f.paKey]) * qtyRow;

                    add(aggs.tissus, name, name, ml, pa, { ...baseSource, type: 'Tissu', detail: f.key });
                }
            });

            // 2. Mechanisms (Rail vs Others)
            const typeMeca = row.type_mecanisme;
            const modelMeca = row.modele_mecanisme;

            if (typeMeca) {
                if (typeMeca === 'Rail' && modelMeca) {
                    // Rails -> Linear Meters (ml)
                    const widthCm = toNum(row.largeur_mecanisme); // Was l_mecanisme
                    const ml = (widthCm / 100) * qtyRow;
                    // pa_mecanisme in recomputeRow is (width/100 * price). So it is per unit.
                    const pa = toNum(row.pa_mecanisme) * qtyRow;

                    add(aggs.rails, modelMeca, modelMeca, ml, pa, { ...baseSource, type: 'Rail', detail: `${widthCm} cm` });
                } else if (modelMeca) {
                    // Stores / Tringles -> Units
                    const qty = qtyRow;
                    const pa = toNum(row.pa_mecanisme) * qtyRow;
                    const key = `${typeMeca} - ${modelMeca}`;

                    add(aggs.mecanismes, key, key, qty, pa, { ...baseSource, type: typeMeca, detail: row.modele_mecanisme });
                }
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
