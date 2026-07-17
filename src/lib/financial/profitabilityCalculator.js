import { aggregatePurchaseChapters, ST_LABELS } from '../purchases/chapters';

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
    // Chapitrage délégué au module partagé avec la liste d'achats (lib/purchases/chapters).
    const chapters = aggregatePurchaseChapters(rows);
    const achatsFixesDetails = {
        tissus: chapters.tissus,
        passementerie: chapters.passementerie,
        rails: chapters.rails,
        stores: chapters.stores,
        total: chapters.total,
    };
    const totalAchatsFixes = chapters.total;

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

    // 3.1 Sous-traitance — agrégée par le module partagé, comme la liste d'achats.
    // Elle reste une charge variable ici : ce n'est pas un achat matière.
    const stItem = (label) => chapters.sous_traitance.find(i => i.label === label);
    for (const [key, label] of [['st_pose', ST_LABELS.pose], ['st_conf', ST_LABELS.confection]]) {
        const item = stItem(label);
        if (item) chargesAgg[key] = { total: item.pa, sources: item.sources };
    }

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
