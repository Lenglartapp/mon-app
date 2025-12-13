export const calculateProfitability = (rows = [], depRows = [], extraRows = []) => {
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
    const caMinutes = rows.reduce((acc, r) => acc + toNum(r.prix_total), 0);
    const caDeps = depRows.reduce((acc, r) => acc + toNum(r.total_eur), 0); // "total_eur" is standardized for depRows usually
    const caExtras = extraRows.reduce((acc, r) => acc + toNum(r.montant_eur), 0);

    // Note: depRows usually have 'prix_total' or 'total_eur'. 
    // We'll try 'prix_total' first then 'total_eur' if undefined, or just handle at call site.
    // In ChiffrageScreen, depRows are computed via formula, so usually have 'prix_total'. 
    // BUT the old Moulinette used 'total_eur' for manual deps? Let's check schemas.
    // CHIFFRAGE_SCHEMA_DEP usually produces 'prix_total'. 
    // Let's sum 'prix_total' for all lists.

    // Safer Re-sum based entirely on 'prix_total' which is the standard output column
    const sumTotal = (list) => list.reduce((acc, r) => acc + toNum(r.prix_total || r.total_eur || r.montant_eur), 0);

    const CA_Total = sumTotal(rows) + sumTotal(depRows) + sumTotal(extraRows);

    // —————————————————————————————————————————————————————————
    // 2. ACHATS FIXES (B) - Matières uniquement
    // —————————————————————————————————————————————————————————
    // On itère sur les lignes pour extraire PA Tissus, PA Rails, PA Fournitures
    const achatsFixesDetails = {
        tissus: [],
        rails: [],
        fournitures: [],
        total: 0
    };

    let totalAchatsFixes = 0;

    // Maps for aggregation
    // Maps for aggregation
    const mapTissus = new Map();
    const mapRails = new Map();

    // Helper to generate source info
    const getSource = (r, label, qty, price) => ({
        minute: r.produit || "Inconnu",
        zone: r.zone || "-",
        piece: r.piece || "-",
        quantite: qty,
        price: price
    });

    const pushMap = (map, key, label, ml, pa, source) => {
        if (!map.has(key)) map.set(key, { label, ml: 0, pa: 0, sources: [] });
        const item = map.get(key);
        item.ml += ml;
        item.pa += pa;
        item.sources.push(source);
    };

    // Hours Aggregation
    const hoursDetails = {
        prepa: { total: 0, sources: [] },
        confection: { total: 0, sources: [] },
        pose: { total: 0, sources: [] },
        total: 0
    };

    const pushHours = (type, r, h) => {
        if (h > 0) {
            hoursDetails[type].total += h;
            hoursDetails[type].sources.push({
                minute: r.produit,
                zone: r.zone,
                piece: r.piece,
                hours: h
            });
        }
    };

    rows.forEach(r => {
        const q = qty(r);

        // TISSUS (Déco 1, Déco 2, Doublure, Inter)
        if (r.tissu_deco1) {
            const val = toNum(r.pa_tissu_deco1);
            pushMap(mapTissus, `T1_${r.tissu_deco1}`, r.tissu_deco1, toNum(r.ml_tissu_deco1) * q, val, getSource(r, r.tissu_deco1, q, val));
        }
        // Deco 2
        if (r.tissu_deco2) {
            const val = toNum(r.pa_tissu_deco2);
            pushMap(mapTissus, `T2_${r.tissu_deco2}`, r.tissu_deco2, toNum(r.ml_tissu_deco2) * q, val, getSource(r, r.tissu_deco2, q, val));
        }
        // Doublure
        if (r.doublure) {
            const val = toNum(r.pa_doublure);
            pushMap(mapTissus, `D_${r.doublure}`, `Doublure ${r.doublure}`, toNum(r.ml_doublure) * q, val, getSource(r, r.doublure, q, val));
        }
        // Inter
        if (r.inter_doublure) {
            const val = toNum(r.pa_inter);
            pushMap(mapTissus, `I_${r.inter_doublure}`, `Inter ${r.inter_doublure}`, toNum(r.ml_inter) * q, val, getSource(r, r.inter_doublure, q, val));
        }

        // RAILS / MECANISMES
        // Field keys: type_mecanisme, nom_tringle? Schema says 'modele_mecanisme'
        // Let's use 'modele_mecanisme' or 'type_mecanisme'.
        const mecaName = r.modele_mecanisme || r.type_mecanisme;
        if (mecaName) {
            const val = toNum(r.pa_mecanisme);
            const len = toNum(r.l_mecanisme || r.largeur || r.dim_mecanisme);
            pushMap(mapRails, `M_${mecaName}`, mecaName, (len / 100) * q, val, getSource(r, mecaName, q, val));
        }

        // HEURES
        pushHours('prepa', r, toNum(r.heures_prepa));
        pushHours('confection', r, toNum(r.heures_confection));
        pushHours('pose', r, toNum(r.heures_pose));
    });

    hoursDetails.total = hoursDetails.prepa.total + hoursDetails.confection.total + hoursDetails.pose.total;

    // Convert Maps to Arrays
    achatsFixesDetails.tissus = Array.from(mapTissus.values());
    achatsFixesDetails.rails = Array.from(mapRails.values());

    // Sum aggregates
    const sumPA = (arr) => arr.reduce((acc, item) => acc + item.pa, 0);
    totalAchatsFixes = sumPA(achatsFixesDetails.tissus) + sumPA(achatsFixesDetails.rails);
    achatsFixesDetails.total = totalAchatsFixes;

    // —————————————————————————————————————————————————————————
    // 3. CHARGES VARIABLES (D)
    // —————————————————————————————————————————————————————————

    // Aggregates with sources
    const chargesAgg = {
        st_pose: { total: 0, sources: [] },
        st_conf: { total: 0, sources: [] },
        deplacements: { total: 0, sources: [] },
        commissions: { total: 0, sources: [] },
        autres: { total: 0, sources: [] }
    };

    // 3.1 Sous-traitance
    rows.forEach(r => {
        const stp = toNum(r.stpausepa || r.pv_pose_st_pa);
        if (stp > 0) {
            chargesAgg.st_pose.total += stp;
            chargesAgg.st_pose.sources.push(getSource(r, "ST Pose", 1, stp));
        }
        const stc = toNum(r.stconfpa);
        if (stc > 0) {
            chargesAgg.st_conf.total += stc;
            chargesAgg.st_conf.sources.push(getSource(r, "ST Conf", 1, stc));
        }
    });

    // 3.2 Deplacements
    depRows.forEach(r => {
        const val = toNum(r.prix_total || r.total_eur);
        if (val > 0) {
            chargesAgg.deplacements.total += val;
            chargesAgg.deplacements.sources.push({
                minute: r.type_deplacement || "Déplacement",
                price: val
            });
        }
    });

    // 3.3 Commissions & Extras
    extraRows.forEach(r => {
        const val = toNum(r.montant_eur || r.prix_total);
        const label = (r.libelle || "").toLowerCase();
        const cat = (r.categorie || "").toLowerCase();
        const src = { minute: r.libelle || "Charge", price: val };

        if (cat.includes('commission') || label.includes('commission')) {
            chargesAgg.commissions.total += val;
            chargesAgg.commissions.sources.push(src);
        } else {
            chargesAgg.autres.total += val;
            chargesAgg.autres.sources.push(src);
        }
    });

    const Charges_Variables_Total = chargesAgg.st_pose.total + chargesAgg.st_conf.total + chargesAgg.deplacements.total + chargesAgg.commissions.total + chargesAgg.autres.total;

    const chargesDetails = {
        st_pose: chargesAgg.st_pose.total,
        st_conf: chargesAgg.st_conf.total,
        deplacements: chargesAgg.deplacements.total,
        commissions: chargesAgg.commissions.total,
        autres: chargesAgg.autres.total,
        total: Charges_Variables_Total,
        // Detailed objects for Drill Down
        _details: chargesAgg
    };

    // —————————————————————————————————————————————————————————
    // 4. RESULTATS (C, E, G)
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
