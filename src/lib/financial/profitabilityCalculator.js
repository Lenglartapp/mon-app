export const calculateProfitability = (rows = [], depRows = [], extraRows = [], commissionRate = 3.5) => {
    // Helper to safely convert to number
    const toNum = (v) => {
        const n = Number(String(v ?? "").replace(",", "."));
        return Number.isFinite(n) ? n : 0;
    };

    // Helper for quantity awareness
    const qty = (r) => Math.max(1, toNum(r?.quantite));

    // —————————————————————————————————————————————————————————
    // 1. CALCUL DU CA TOTAL (A)
    // —————————————————————————————————————————————————————————
    // CA is purely the Sum of Sales Prices (prix_total) of Main Rows and Logistics (Deplacements)
    const sumTotal = (list) => list.reduce((acc, r) => acc + toNum(r.prix_total || r.total_eur || r.montant_eur), 0);
    // FIX: Do NOT include extraRows (Autres Dépenses) in CA, they are charges only.
    const CA_Total = sumTotal(rows) + sumTotal(depRows);

    // —————————————————————————————————————————————————————————
    // 2. ACHATS FIXES (B) - Matières uniquement
    // —————————————————————————————————————————————————————————
    const achatsFixesDetails = {
        tissus: [],
        rails: [],
        stores: [], // NEW
        total: 0
    };

    const mapTissus = new Map();
    const mapRails = new Map();
    const mapStores = new Map(); // NEW

    // Helper to generate source info
    const getSource = (r, qty, price) => ({
        minute: r.produit || "Inconnu",
        zone: r.zone || "-",
        piece: r.piece || "-",
        quantite: qty,
        price: price
    });

    const pushMap = (map, label, ml, pa, source) => {
        // Group precisely by the visible label text
        const key = String(label).trim();
        if (!key || key === "undefined") return; // Skip empty

        if (!map.has(key)) map.set(key, { label: key, ml: 0, pa: 0, sources: [] });
        const item = map.get(key);
        item.ml += ml;
        item.pa += pa;
        if (source) item.sources.push(source);
    };

    rows.forEach(r => {
        const q = qty(r);

        // --- TISSUS (Shared) ---
        if (r.tissu_1) {
            pushMap(mapTissus, r.tissu_1, toNum(r.ml_tissu_1) * q, toNum(r.pa_tissu_1) * q, getSource(r, q, toNum(r.pa_tissu_1) * q));
        }
        if (r.tissu_2) {
            pushMap(mapTissus, r.tissu_2, toNum(r.ml_tissu_2) * q, toNum(r.pa_tissu_2) * q, getSource(r, q, toNum(r.pa_tissu_2) * q));
        }
        if (r.passementerie_1) {
            pushMap(mapTissus, r.passementerie_1, toNum(r.ml_pass_1) * q, toNum(r.pa_pass_1) * q, getSource(r, q, toNum(r.pa_pass_1) * q));
        }
        if (r.tissu_deco1) {
            pushMap(mapTissus, r.tissu_deco1, toNum(r.ml_tissu1) * q, toNum(r.pa_tissu1) * q, getSource(r, q, toNum(r.pa_tissu1) * q));
        }
        if (r.toile_finition_1) {
            pushMap(mapTissus, r.toile_finition_1, toNum(r.ml_toile_finition_1) * q, toNum(r.pa_toile_finition_1) * q, getSource(r, q, toNum(r.pa_toile_finition_1) * q));
        }
        if (r.tissu_deco2) {
            pushMap(mapTissus, r.tissu_deco2, toNum(r.ml_tissu2) * q, toNum(r.pa_tissu2) * q, getSource(r, q, toNum(r.pa_tissu2) * q));
        }
        if (r.doublure) {
            pushMap(mapTissus, r.doublure, toNum(r.ml_doublure) * q, toNum(r.pa_doublure) * q, getSource(r, q, toNum(r.pa_doublure) * q));
        }
        if (r.interdoublure) {
            pushMap(mapTissus, r.interdoublure, toNum(r.ml_interdoublure) * q, toNum(r.pa_interdoublure) * q, getSource(r, q, toNum(r.pa_interdoublure) * q));
        }
        if (r.passementerie1) {
            pushMap(mapTissus, r.passementerie1, toNum(r.ml_pass1) * q, toNum(r.pa_pass1) * q, getSource(r, q, toNum(r.pa_pass1) * q));
        }
        if (r.passementerie2) {
            pushMap(mapTissus, r.passementerie2, toNum(r.ml_pass2) * q, toNum(r.pa_pass2) * q, getSource(r, q, toNum(r.pa_pass2) * q));
        }

        // --- RAILS & STORES ---
        const prodStr = String(r.produit || "");
        const isBateau = /bateau|vélum|velum/i.test(prodStr);
        const isStore = /store|canishade/i.test(prodStr) && !isBateau;

        if (isStore) {
            // STORES (Enrouleurs, Californiens, etc.)
            const storeName = r.mecanisme_store || r.modele_mecanisme || r.nom_tringle;
            const paStoreNum = toNum(r.pa_mecanisme_store) > 0 ? toNum(r.pa_mecanisme_store) : (toNum(r.pa_meca) + toNum(r.pa_mecanisme) + toNum(r.pa_mecanisme_bis));
            const val = paStoreNum * q;
            if (storeName && val > 0) {
                pushMap(mapStores, storeName, q, val, getSource(r, q, val));
            }
        } else {
            // RAILS, BATEAUX, TRINGLES, DECOR MECANISMES
            const mecaName = r.nom_tringle || r.modele_mecanisme || r.type_mecanisme || r.mecanisme_fourniture;
            const val = (toNum(r.pa_meca) + toNum(r.pa_mecanisme) + toNum(r.pa_mecanisme_bis)) * q;

            if (mecaName && val > 0) {
                let len = 0;
                if (r.type_mecanisme === 'Rail' || r.nom_tringle) {
                    len = (toNum(r.largeur_mecanisme || r.l_mecanisme) / 100) * q;
                } else {
                    len = q;
                }
                pushMap(mapRails, mecaName, len, val, getSource(r, q, val));
            }
        }
    });

    // Convert Maps
    achatsFixesDetails.tissus = Array.from(mapTissus.values()).sort((a, b) => a.label.localeCompare(b.label, "fr", { numeric: true }));
    achatsFixesDetails.rails = Array.from(mapRails.values()).sort((a, b) => a.label.localeCompare(b.label, "fr", { numeric: true }));
    achatsFixesDetails.stores = Array.from(mapStores.values()).sort((a, b) => a.label.localeCompare(b.label, "fr", { numeric: true }));

    const sumPA = (arr) => arr.reduce((acc, item) => acc + item.pa, 0);
    const totalAchatsFixes = sumPA(achatsFixesDetails.tissus) + sumPA(achatsFixesDetails.rails) + sumPA(achatsFixesDetails.stores);
    achatsFixesDetails.total = totalAchatsFixes;

    // —————————————————————————————————————————————————————————
    // 3. CHARGES VARIABLES (D)
    // —————————————————————————————————————————————————————————
    const chargesAgg = {
        st_pose: { total: 0, sources: [] },
        st_conf: { total: 0, sources: [] },
        deplacements: { total: 0, sources: [] },
        commissions: { total: 0, sources: [] },
        autres: { total: 0, sources: [] }
    };

    // 3.1 Sous-traitance
    rows.forEach(r => {
        const q = qty(r);
        const stp = toNum(r.st_pose_pa) * q; // Strict key st_pose_pa
        if (stp > 0) {
            chargesAgg.st_pose.total += stp;
            chargesAgg.st_pose.sources.push(getSource(r, q, stp));
        }
        const stc = toNum(r.st_conf_pa) * q; // Strict key st_conf_pa
        if (stc > 0) {
            chargesAgg.st_conf.total += stc;
            chargesAgg.st_conf.sources.push(getSource(r, q, stc));
        }
    });

    // 3.2 Deplacements (COSTS ONLY: Nuits + Repas + Billets)
    depRows.forEach(r => {
        // Exclude MO (Labor) -> It goes to Hours
        const cNuits = toNum(r.cout_nuits);
        const cRepas = toNum(r.cout_repas);
        const cTrans = toNum(r.cout_billet_total);
        const costs = cNuits + cRepas + cTrans;
        const type = r.type_deplacement || "Déplacement";

        if (costs > 0) {
            chargesAgg.deplacements.total += costs;

            // BREAKDOWN (User request: Ventilate by Nuits, Repas, Transports)
            if (cNuits > 0) {
                chargesAgg.deplacements.sources.push({
                    minute: `${type} - Nuits`,
                    price: cNuits,
                    zone: '-', piece: '-'
                });
            }
            if (cRepas > 0) {
                chargesAgg.deplacements.sources.push({
                    minute: `${type} - Repas`,
                    price: cRepas,
                    zone: '-', piece: '-'
                });
            }
            if (cTrans > 0) {
                chargesAgg.deplacements.sources.push({
                    minute: `${type} - Transports`,
                    price: cTrans,
                    zone: '-', piece: '-'
                });
            }
        }
    });

    // 3.3 Commissions & Extras
    extraRows.forEach(r => {
        const val = toNum(r.montant_eur || r.prix_total);
        // Better Labeling: Category - Label
        const labelRaw = (r.libelle || "").trim();
        const cat = (r.categorie || "").trim();

        let displayLabel = labelRaw || "Charge";
        if (cat && labelRaw) {
            displayLabel = `${cat} - ${labelRaw}`;
        } else if (cat) {
            displayLabel = cat;
        }

        const catLower = cat.toLowerCase();
        const labelLower = labelRaw.toLowerCase();

        chargesAgg.autres.total += val;
        chargesAgg.autres.sources.push({ minute: displayLabel, price: val });
    });

    // 3.4 Commission Dynamique
    const commissionValue = CA_Total * (commissionRate / 100);
    if (commissionValue > 0) {
        chargesAgg.commissions.total += commissionValue;
        chargesAgg.commissions.sources.push({ minute: `Commission (${commissionRate}%)`, price: commissionValue });
    }

    const Charges_Variables_Total =
        chargesAgg.st_pose.total +
        chargesAgg.st_conf.total +
        chargesAgg.deplacements.total +
        chargesAgg.commissions.total +
        chargesAgg.autres.total;

    const chargesDetails = {
        st_pose: chargesAgg.st_pose.total,
        st_conf: chargesAgg.st_conf.total,
        deplacements: chargesAgg.deplacements.total,
        commissions: chargesAgg.commissions.total,
        autres: chargesAgg.autres.total,
        total: Charges_Variables_Total,
        _details: chargesAgg
    };

    // —————————————————————————————————————————————————————————
    // 4. HEURES DE PRODUCTION (Total Hours)
    // —————————————————————————————————————————————————————————
    const hoursDetails = {
        prepa: { total: 0, sources: [] },
        confection: { total: 0, sources: [] },
        pose: { total: 0, sources: [] },
        deplacements: { total: 0, sources: [] }, // NEW CATEGORY
        total: 0
    };

    const pushHours = (type, r, h, labelOverride) => {
        if (h > 0) {
            hoursDetails[type].total += h;
            hoursDetails[type].sources.push({
                minute: labelOverride || r.produit,
                zone: r.zone,
                piece: r.piece,
                hours: h
            });
        }
    };

    // Rows Hours
    rows.forEach(r => {
        const q = qty(r);
        pushHours('prepa', r, toNum(r.heures_prepa) * q);
        pushHours('confection', r, toNum(r.heures_confection) * q);
        pushHours('pose', r, toNum(r.heures_pose) * q);
    });

    // Logistics Hours (Billable Travel Hours)
    depRows.forEach(r => {
        const h = toNum(r.heures_facturees);
        if (h > 0) {
            pushHours('deplacements', r, h, r.type_deplacement || "Déplacement");
        }
    });

    hoursDetails.total =
        hoursDetails.prepa.total +
        hoursDetails.confection.total +
        hoursDetails.pose.total +
        hoursDetails.deplacements.total;

    // —————————————————————————————————————————————————————————
    // 5. RESULTATS
    // —————————————————————————————————————————————————————————
    const Marge_Brute = CA_Total - totalAchatsFixes;
    const Contribution = Marge_Brute - Charges_Variables_Total;
    const Contribution_Horaire = hoursDetails.total > 0 ? Contribution / hoursDetails.total : 0;

    return {
        kpis: {
            ca_total: CA_Total,
            achats_fixes: totalAchatsFixes,
            marge_brute: Marge_Brute,
            marge_brute_pct: CA_Total > 0 ? (Marge_Brute / CA_Total) * 100 : 0,
            charges_variables: Charges_Variables_Total,
            contribution: Contribution,
            contribution_pct: CA_Total > 0 ? (Contribution / CA_Total) * 100 : 0,
            total_heures: hoursDetails.total,
            contribution_horaire: Contribution_Horaire
        },
        achats_fixes_details: achatsFixesDetails,
        charges_details: chargesDetails,
        hours_details: hoursDetails
    };
};

// —————————————————————————————————————————————————————————
// SIMULATEUR INVERSE
// —————————————————————————————————————————————————————————
export const calculateTargetCA = (targetHourlyContrib, currentData) => {
    // Formula:
    // Contrib_Cible = Target_Hourly * Total_Hours
    // Contrib = Marge_Brute - Charges_Variables
    // Marge_Brute = CA - Achats_Fixes
    // Charges_Variables = Fix_Vars (Transport, ST, Autres) + Commissions (% of CA)

    // CA - Achats_Fixes - (Fix_Vars + Rate_Com * CA) = Target_Hourly * Total_Hours
    // CA (1 - Rate_Com) = Target_Hourly * Total_Hours + Achats_Fixes + Fix_Vars
    // CA_Target = (Target_Hourly * Total_Hours + Achats_Fixes + Fix_Vars) / (1 - Rate_Com)

    const { kpis, charges_details } = currentData;

    // 1. Determine implied Commission Rate based on CURRENT totals
    // If CA is 0, we can't determine rate, assume 0.
    const currentCA = kpis.ca_total;
    const currentComs = charges_details.commissions;
    let rateCom = 0;
    if (currentCA > 0) {
        rateCom = currentComs / currentCA;
    }

    // 2. Fixed Variables (Absolute amounts that don't scale with CA typically, or assumed fixed for sim)
    // ST and Deplacements might scale, but usually ST is per unit, so fixed for a given quantity configuration.
    // We assume the simulator is "What price should I sell THIS configuration at?", so quantity/costs are fixed.
    const fixedVars = charges_details.st_pose + charges_details.st_conf + charges_details.deplacements + charges_details.autres;

    // 3. Achats Fixes
    const achatsFixes = kpis.achats_fixes;

    // 4. Target Contribution
    const targetContrib = targetHourlyContrib * kpis.total_heures;

    // 5. Calculate
    // CA * (1 - rate) = targetContrib + achatsFixes + fixedVars
    const divisor = 1 - rateCom;

    if (divisor <= 0.01) return 0; // Integrity check

    const numerator = targetContrib + achatsFixes + fixedVars;
    return numerator / divisor;
};
