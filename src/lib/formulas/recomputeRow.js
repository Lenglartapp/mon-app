// src/lib/formulas/recomputeRow.js
import { evalFormula } from "./eval.js";

const NVL = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : Number(fallback);
};

const roundStep05 = (val) => {
  if (!Number.isFinite(val)) return 0;
  return Math.ceil(val * 2) / 2;
};

// --- CORE RECOMPUTE FUNCTION ---
export function recomputeRow(row, schema, ctx = {}) {
  const next = { ...row };
  const catalog = ctx.catalog || [];
  const settings = ctx.settings || {};

  // --- 0. DATA ENRICHMENT (AUTO-FILL FROM CATALOG) ---
  // Helper to sync library data to row
  const fillFromCatalog = (nameKey, mapRules) => {
    const name = next[nameKey];
    if (!name) return;

    const item = catalog.find(i => i.name === name);
    if (item) {
      // Iterate rules: { rowKey: itemProperty }
      Object.entries(mapRules).forEach(([rowKey, itemProp]) => {
        // Priority: item[itemProp]
        // Check various casing/naming conventions mainly for dimensions
        let val = item[itemProp];

        // Fallbacks for specific common props if exact key missing
        if (itemProp === 'laize') val = item.laize || item.width || item.dimension || 0;
        if (itemProp === 'raccord_v') val = item.raccord_v || item.vRepeat || 0;
        if (itemProp === 'raccord_h') val = item.raccord_h || item.hRepeat || 0;
        if (itemProp === 'pa') val = item.buyPrice || item.pa || 0;
        if (itemProp === 'pv') val = item.sellPrice || item.pv || 0;

        // Update Row (Always overwrite to ensure truth from library, or only if empty?)
        // User said "Quand je sélectionne... il n'a plus". Implies it should have naturally.
        // We overwrite to ensure data consistency with selection.
        // Except maybe manual overrides? For now, forced sync seems requested.
        if (val !== undefined) next[rowKey] = val;
      });
    }
  };

  // Sync Tissu 1
  fillFromCatalog('tissu_deco1', {
    laize_tissu1: 'laize',
    raccord_v_tissu1: 'raccord_v',
    raccord_h_tissu1: 'raccord_h',
    // We do NOT write PA/PV here strictly, because we calculate total PA/PV later using ML.
    // But we can store unit prices if we wanted specific columns, but schema doesn't have "unit_pa_tissu1".
    // We just need specs for ML calc.
  });

  // Sync Tissu 2
  fillFromCatalog('tissu_deco2', {
    laize_tissu2: 'laize',
    raccord_v_tissu2: 'raccord_v',
    raccord_h_tissu2: 'raccord_h',
  });

  // Sync Doublure
  fillFromCatalog('doublure', { laize_doublure: 'laize' });

  // Sync Inter
  fillFromCatalog('interdoublure', { laize_interdoublure: 'laize' });

  // =========================================================
  // 1a. AUTRES DEPENSES (Extra Expenses)
  // =========================================================
  if (next.produit === "Autre Dépense") {
    const cat = next.categorie || "";
    // 1. Commission Logic
    if (cat.includes("Commission")) {
      const pct = Number(next.pourcentage) || 0;
      const baseCA = Number(ctx.totalCA) || 0;
      next.prix_total = Math.round((baseCA * (pct / 100)) * 100) / 100; // Arrondi 2 décimales standard
      next.total_price = next.prix_total;
      return next;
    }

    // 2. Manual Logic (Fix for Reset Bug)
    // Do not apply Rideaux formulas. We simply return the row to preserve manual inputs.
    if (next.prix_total !== undefined) next.total_price = next.prix_total;
    return next;
  }

  // =========================================================
  // 1. DEPLACEMENTS (Specific Logistics Logic) — Preserved
  // =========================================================
  // =========================================================
  // 1. DEPLACEMENTS (Specific Logistics Logic) — STRICT NEW RULES
  // =========================================================
  if (next.produit === "Déplacement") {
    const nbTech = Math.max(1, NVL(next.nb_tech));
    const nbAR = Math.max(1, NVL(next.nb_allers_retours, 1)); // Default 1 A/R
    const tempsTrajetAR = NVL(next.temps_trajet, 0); // 6h example
    const joursInter = NVL(next.duree_intervention_jours, 0);
    const prixBillet = NVL(next.prix_billet, 0);
    const isDecouchage = next.decouchage === "Oui";

    // A. Calcul Heures Facturées Trajet
    // Règle : Diviser par 2, arrondir à tranche 4h sup, x2.
    // Ex: 6h -> 3h -> 4h -> 8h facturé pour UN A/R.
    // Puis multiplier par nbAR.
    let heuresFactureesUnit = 0;
    if (tempsTrajetAR > 0) {
      const allerSimple = tempsTrajetAR / 2;
      const tranche4h = Math.ceil(allerSimple / 4) * 4;
      heuresFactureesUnit = tranche4h * 2;
    }
    const heuresFactureesTotal = heuresFactureesUnit * nbAR * nbTech; // STRICT: Includes Tech count
    next.heures_facturees = heuresFactureesTotal;

    // B. Coût Main d'Oeuvre (Trajet uniquement)
    const tauxHoraire = NVL(settings.taux_horaire, 35);
    next.cout_mo = heuresFactureesTotal * tauxHoraire;

    // C. Logistique (Nuits & Repas)
    // Nuits : (Jours - 1) * NbTech (Si découchage)
    // Repas : Jours * 2 * NbTech (Si découchage)
    if (isDecouchage && joursInter > 0) {
      next.nb_nuits = Math.max(0, (joursInter - 1) * nbTech);
      next.nb_repas = joursInter * 2 * nbTech;
    } else {
      next.nb_nuits = 0;
      next.nb_repas = 0;
    }

    const priceNuit = NVL(settings.prix_nuit, 180);
    const priceRepas = NVL(settings.prix_repas, 25);

    next.cout_nuits = next.nb_nuits * priceNuit;
    next.cout_repas = next.nb_repas * priceRepas;

    // D. Transport (Billets)
    next.cout_billet_total = prixBillet * nbTech * nbAR;

    // E. TOTAL
    next.total_price = next.cout_mo + next.cout_nuits + next.cout_repas + next.cout_billet_total;
    next.prix_total = next.total_price;

    return next;
  }

  // =========================================================
  // 2. RIDEAUX / MINUTES - STRICT LOGIC
  // =========================================================

  // INPUTS
  const L = NVL(next.largeur);
  const H = NVL(next.hauteur);
  const Ampleur = NVL(next.ampleur, 1);
  const FinitionBas = NVL(next.finition_bas, 0); // Can be negative
  const Croisement = NVL(next.croisement, 0);
  const RetourG = NVL(next.retour_gauche, 0);
  const RetourD = NVL(next.retour_droit, 0);

  // A. CALCULS GÉOMÉTRIQUES
  let A_Plat = 0;
  if (next.paire_ou_un_seul_pan === 'Paire') {
    // Formule: ( ( (Largeur/2) + (Largeur/2 * 0.07) ) * Ampleur + Retour_Gauche ) * 2 + Croisement
    // Note: User prompt says `Retour_Gauche` in the formula. We use RetourG.
    const demiL = L / 2;
    A_Plat = ((demiL + (demiL * 0.07)) * Ampleur + RetourG) * 2 + Croisement;
  } else {
    // Un seul pan: ( (Largeur + (Largeur * 0.07) ) * Ampleur + Retour_Gauche + Retour_Droit )
    A_Plat = ((L + (L * 0.07)) * Ampleur + RetourG + RetourD);
  }
  next.a_plat = A_Plat;

  const H_Coupe = H + FinitionBas + 50;
  next.hauteur_coupe = H_Coupe;

  // H Motif
  // Needs Raccord V Tissu 1. If undefined, 0.
  // We need to fetch fabric data if not present, but let's assume UI/Data flow handles inputs.
  // We use `raccord_v_tissu1`.
  const RaccordV = NVL(next.raccord_v_tissu1, 0);
  let H_Coupe_Motif = H_Coupe;
  if (RaccordV > 0) {
    H_Coupe_Motif = Math.ceil(H_Coupe / RaccordV) * RaccordV + RaccordV;
  }
  next.hauteur_coupe_motif = H_Coupe_Motif;

  // Helper: ML Calculation
  const calcML = (laize, hCoupeBase, hCoupeMotif) => {
    const Laize = NVL(laize, 0);
    if (Laize <= 0) return { nbLes: 0, ml: 0 };

    // Determine H Key
    const H_Key = (hCoupeMotif > hCoupeBase) ? hCoupeMotif : hCoupeBase;

    if (Laize > H_Key) {
      // Railoaded
      return {
        nbLes: 0,
        ml: roundStep05(A_Plat / 100)
      };
    } else {
      // Vertical
      const NbLes = Math.ceil(A_Plat / Laize);
      return {
        nbLes: NbLes,
        ml: (NbLes * H_Key) / 100
      };
    }
  };

  // Helper: Pricing
  const getPrice = (name) => {
    if (!name) return { pa: 0, pv: 0 };
    const item = catalog.find(i => i.name === name);
    return item ? { pa: item.buyPrice || 0, pv: item.sellPrice || 0 } : { pa: 0, pv: 0 };
  };

  // --- STORE SPECIFIC LOGIC ---
  const STORE_BLOCKED_TYPES = [
    'Store Enrouleur',
    'Store Vénitien',
    'Store Californien',
    'Store Canishade'
  ];
  const isStoreBlocked = STORE_BLOCKED_TYPES.includes(next.produit);

  // Sync Toile Finition 1
  fillFromCatalog('toile_finition_1', {
    laize_toile_finition_1: 'laize',
    raccord_v_toile_finition_1: 'raccord_v',
    raccord_h_toile_finition_1: 'raccord_h',
  });

  // Sync Mecanisme Store
  fillFromCatalog('mecanisme_store', {
    // Usually mechanism price is fixed or per meter?
    // User requested "pa_mecanisme_store".
    // We assume catalog item has 'buyPrice' -> 'pa'.
    // If it's a blocked store, maybe price is per unit?
    // We leave pa as is if filled from catalog (via fillFromCatalog helper we need to specify target)
  });
  // Note: fillFromCatalog helper above works for mapped props.
  // We need to map pa -> pa_mecanisme_store explicitly if we want auto-fill price.
  // The user prompt didn't say "auto-fill price from catalog" expressly but implied via "Maintenance des câblages".
  // And "pa_mecanisme_store (number)".
  // Let's assume we fill it if found.
  const itemMecaStore = catalog.find(i => i.name === next.mecanisme_store);
  if (itemMecaStore && next.pa_mecanisme_store === undefined) {
    next.pa_mecanisme_store = itemMecaStore.buyPrice || itemMecaStore.pa || 0;
  }
  if (itemMecaStore && next.pv_mecanisme_store === undefined) {
    next.pv_mecanisme_store = itemMecaStore.sellPrice || itemMecaStore.pv || 0;
  }

  // --- TISSU DECO 1 (RIDEAUX) ---
  const res1 = calcML(next.laize_tissu1, H_Coupe, H_Coupe_Motif);
  next.nb_les_tissu1 = res1.nbLes;
  next.ml_tissu1 = res1.ml;

  const p1 = getPrice(next.tissu_deco1);
  next.pa_tissu1 = next.ml_tissu1 * (p1.pa || 0);
  next.pv_tissu1 = next.ml_tissu1 * (p1.pv || 0);

  // --- TOILE FINITION 1 (STORES) ---
  if (next.toile_finition_1) {
    if (isStoreBlocked) {
      // Bloqué = 0 ? Or just don't calculate?
      // Scheme says BLOQUER (readOnly). Usually means "Not Applicable".
      next.ml_toile_finition_1 = 0;
      next.pa_toile_finition_1 = 0;
      next.pv_toile_finition_1 = 0;
    } else {
      // Store Bateau / Velum -> Calculated like Tissu?
      // Assuming similar logic to Tissu 1 (using H, L, etc) if it's a Fabric.
      // User provided `ml_toile_finition_1` as "Saisie manuelle" in schema.
      // Schema: "ml_toile_finition_1 (number) : ML Toile finition 1 (Saisie manuelle)"
      // So we do NOT calculate ML automatically?
      // "nb_les_toile_finition_1 (number, readOnly)" IS readOnly. So it MUST be calculated?
      // If ML is manual, maybe Nb Les is calculated for info?
      // I will use calcML logic for `nb_les` but trust `ml_toile_finition_1` from input if manual?
      // But prompt says "Remplace le contenu... ml_toile_finition_1... Saisie manuelle".
      // BUT `nb_les_toile_finition_1` is readOnly.
      // I will compute `nb_les`. For `ml`, I will respect manual input unless empty?
      // Actually, standard usually is: Auto-calc, but editable.
      // But here schema says "Saisie manuelle".
      // I will compute prices based on ML.

      const resTF1 = calcML(next.laize_toile_finition_1, next.hauteur || 0, next.hauteur || 0); // Simplified H
      next.nb_les_toile_finition_1 = resTF1.nbLes;

      // ML is manual. We don't overwrite it if it exists?
      // If 0 or undefined, maybe hint? But user said Manual.
      // I wont overwrite ML.

      const pTF1 = getPrice(next.toile_finition_1);
      next.pa_toile_finition_1 = NVL(next.ml_toile_finition_1) * (pTF1.pa || 0);
      next.pv_toile_finition_1 = NVL(next.ml_toile_finition_1) * (pTF1.pv || 0);
    }
  }

  // --- TISSU DECO 2 ---
  // ML Saisie Manuelle
  const p2 = getPrice(next.tissu_deco2);
  next.pa_tissu2 = NVL(next.ml_tissu2) * (p2.pa || 0);
  next.pv_tissu2 = NVL(next.ml_tissu2) * (p2.pv || 0);

  // --- DOUBLURE ---
  // "Considérée comme unie" -> H_Coupe (Base) used, no motif logic
  const resD = calcML(next.laize_doublure, H_Coupe, H_Coupe);
  next.nb_les_doublure = resD.nbLes;
  // Schema says `ml_doublure` is "Saisie manuelle" for Stores now?
  // Check schema again... "ml_doublure (number) : ML Doubl. (Saisie manuelle)".
  // For Rideaux, it was Calculated.
  // RecomputeRow handles both.
  // If it's a Store, ML is manual. If Rideau, Auto.
  // How to distinguish? `produit` stores vs rideaux.
  // I'll assume if `produit` is Store, we respect Manual ML.
  // Or simpler: If `ml_doublure` is filled, use it?
  // But `calcML` overwrites.
  // Logic:
  // If Store -> Manual ML.
  // If Rideau -> Auto ML.
  const isStore = (next.produit || "").toLowerCase().includes("store") || (next.produit || "").includes("Canishade");

  if (isStore) {
    if (isStoreBlocked) {
      next.ml_doublure = 0;
      next.pa_doublure = 0;
      next.pv_doublure = 0;
    } else {
      // Manual ML logic
      const pD = getPrice(next.doublure);
      next.pa_doublure = NVL(next.ml_doublure) * (pD.pa || 0);
      next.pv_doublure = NVL(next.ml_doublure) * (pD.pv || 0);
    }
  } else {
    // Legacy Rideau Logic (Auto)
    next.ml_doublure = resD.ml;
    const pD = getPrice(next.doublure);
    next.pa_doublure = next.ml_doublure * (pD.pa || 0);
    next.pv_doublure = next.ml_doublure * (pD.pv || 0);
  }

  // --- 7. INTER-DOUBLURE ---
  const resI = calcML(next.laize_interdoublure, H_Coupe, H_Coupe);
  next.nb_les_interdoublure = resI.nbLes;
  next.ml_interdoublure = resI.ml;

  const pI = getPrice(next.interdoublure);
  next.pa_interdoublure = next.ml_interdoublure * (pI.pa || 0);
  next.pv_interdoublure = next.ml_interdoublure * (pI.pv || 0);

  // --- 8 & 9. PASSEMENTERIE 1 & 2 ---
  const calcPassML = (app, hCoupe, aPlat) => {
    if (!app || app === '-') return aPlat; // Default logic for '-' based on prompt A_Plat
    // Prompt: SI '-' : A_Plat
    if (app === 'I') return hCoupe;
    if (app === 'U') return (hCoupe * 2) + aPlat;
    if (app === 'L') return hCoupe + aPlat;
    return 0; // Should not happen
  };

  // Pass 1
  const rawMLP1 = calcPassML(next.application_passementerie1, H_Coupe, A_Plat);
  next.ml_pass1 = roundStep05(rawMLP1 / 100);
  const pPass1 = getPrice(next.passementerie1);
  next.pa_pass1 = next.ml_pass1 * (pPass1.pa || 0);
  next.pv_pass1 = next.ml_pass1 * (pPass1.pv || 0);

  // Pass 2
  const rawMLP2 = calcPassML(next.application_passementerie2, H_Coupe, A_Plat);
  next.ml_pass2 = roundStep05(rawMLP2 / 100);
  const pPass2 = getPrice(next.passementerie2);
  next.pa_pass2 = next.ml_pass2 * (pPass2.pa || 0);
  next.pv_pass2 = next.ml_pass2 * (pPass2.pv || 0);

  // --- 10. MECANISME ---
  if (next.type_mecanisme === 'Rail') {
    const pMec = getPrice(next.modele_mecanisme);
    const wMec = NVL(next.largeur_mecanisme) / 100;
    next.pa_mecanisme = wMec * (pMec.pa || 0);
    next.pv_mecanisme = wMec * (pMec.pv || 0);
  } else {
    // Tringle -> Saisie Manuelle (Keep value)
  }

  // --- GENERIC CONFECTION (Decors & Autre) ---
  // A. Tissu 1 (tissu_1)
  fillFromCatalog('tissu_1', {
    laize_tissu_1: 'laize',
    // We don't auto-fill ML (Manual)
  });
  if (next.tissu_1) {
    const pT1 = getPrice(next.tissu_1);
    next.pa_tissu_1 = NVL(next.ml_tissu_1) * (pT1.pa || 0);
    next.pv_tissu_1 = NVL(next.ml_tissu_1) * (pT1.pv || 0);
  }

  // A2. Tissu 2 (tissu_2)
  fillFromCatalog('tissu_2', {
    laize_tissu_2: 'laize',
  });
  if (next.tissu_2) {
    const pT2 = getPrice(next.tissu_2);
    next.pa_tissu_2 = NVL(next.ml_tissu_2) * (pT2.pa || 0);
    next.pv_tissu_2 = NVL(next.ml_tissu_2) * (pT2.pv || 0);
  }

  // B. Passementerie 1 (passementerie_1)
  fillFromCatalog('passementerie_1', {});
  if (next.passementerie_1) {
    const pPass1_Dec = getPrice(next.passementerie_1);
    next.pa_pass_1 = NVL(next.ml_pass_1) * (pPass1_Dec.pa || 0);
    next.pv_pass_1 = NVL(next.ml_pass_1) * (pPass1_Dec.pv || 0);
  }

  // B2. Passementerie 2 (passementerie_2)
  fillFromCatalog('passementerie_2', {});
  if (next.passementerie_2) {
    const pPass2_Dec = getPrice(next.passementerie_2);
    next.pa_pass_2 = NVL(next.ml_pass_2) * (pPass2_Dec.pa || 0);
    next.pv_pass_2 = NVL(next.ml_pass_2) * (pPass2_Dec.pv || 0);
  }

  // C. Mecanisme / Fourniture (mecanisme_fourniture) -> Decors only really
  fillFromCatalog('mecanisme_fourniture', {});
  if (next.mecanisme_fourniture) {
    const pMecaFourn = getPrice(next.mecanisme_fourniture);
    next.pa_mecanisme = NVL(next.quantite) * (pMecaFourn.pa || 0); // Unitary
    next.pv_mecanisme = NVL(next.quantite) * (pMecaFourn.pv || 0);
  }

  // D. Mecanisme GENERIC (Autre Module - field 'mecanisme')
  // No auto-fill, it is text. PA/PV entered manually.

  // 11. PRESTATIONS...
  if (next.mecanisme_fourniture) {
    const pMecaFourn = getPrice(next.mecanisme_fourniture);
    // Assuming Price per Unit? Or user manually adjusts?
    // If it has a price in catalog, we use it. 
    // User didn't specify ML logic for this, just fields.
    // We assume Unitary cost (x1) or Manual.
    // If catalog price exists, we set values (Unitary).
    if (pMecaFourn.pa > 0) next.pa_mecanisme = pMecaFourn.pa;
    if (pMecaFourn.pv > 0) next.pv_mecanisme = pMecaFourn.pv;
  }

  // Mecanisme Store (NEW)
  // Logic: Saisie manuelle PA/PV (Explicit in Schema?)
  // Schema: "pa_mecanisme_store (number) : PA Méca", "pv_mecanisme_store (number) : PV Méca"
  // If we filled it from catalog above, good. Otherwise manual.
  // No L x Price logic specified. Assumed Unitary or Manual total.
  // We don't overwrite if manual.

  // --- 11. PRESTATIONS & SOUS-TRAITANCE ---
  const taux = NVL(settings.taux_horaire, 35);
  next.pv_prepa = NVL(next.heures_prepa) * taux;
  next.pv_pose = NVL(next.heures_pose) * taux;
  next.pv_confection = NVL(next.heures_confection) * taux;

  const coeffST = Number(settings.coef_sous_traitance) || 2;
  next.st_pose_pv = NVL(next.st_pose_pa) * coeffST;
  next.st_conf_pv = NVL(next.st_conf_pa) * coeffST;

  // --- 12. TOTAUX ---
  const totalPriceComponents =
    NVL(next.pv_tissu1) + NVL(next.pv_tissu2) +
    NVL(next.pv_doublure) + NVL(next.pv_interdoublure) +
    NVL(next.pv_pass1) + NVL(next.pv_pass2) +
    NVL(next.pv_mecanisme) +
    NVL(next.pv_tissu_1) + NVL(next.pv_pass_1) + // NEW Decors
    NVL(next.pv_tissu_2) + // NEW Decors T2
    NVL(next.pv_pass_2) + // NEW Decors Pass 2
    NVL(next.pv_interieur) + // NEW Decors Interieur
    NVL(next.pv_toile_finition_1) + NVL(next.pv_mecanisme_store) + // NEW Stores
    NVL(next.pv_prepa) + NVL(next.pv_pose) + NVL(next.pv_confection) +
    NVL(next.st_pose_pv) + NVL(next.st_conf_pv) +
    NVL(next.livraison);

  // Logic: Override unit_price with calculation ONLY if calculation > 0 or if NOT blocked.
  // This allows Manual Entry for "Store Enrouleur" if components are 0.
  if (!isStoreBlocked || totalPriceComponents > 0) {
    next.unit_price = totalPriceComponents;
  }
  // Else: Keep next.unit_price (Manual Input)

  next.total_price = NVL(next.unit_price) * NVL(next.quantite, 1);
  next.prix_total = next.total_price; // ALIAS for ChiffrageScreen legacy usage

  return next;
}
