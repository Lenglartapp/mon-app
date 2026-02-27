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
  const getPrice = ctx.getPrice || ((name) => {
    if (!name) return { pa: 0, pv: 0 };
    const item = catalog.find(i => i.name === name);
    return item ? { pa: item.buyPrice || 0, pv: item.sellPrice || 0 } : { pa: 0, pv: 0 };
  });

  // --- 0. DATA ENRICHMENT (AUTO-FILL FROM CATALOG) ---
  const fillFromCatalog = (nameKey, mapRules) => {
    const name = next[nameKey];
    if (!name) return;
    const item = catalog.find(i => i.name === name);
    if (item) {
      Object.entries(mapRules).forEach(([rowKey, itemProp]) => {
        let val = item[itemProp];
        if (itemProp === 'laize') val = item.laize || item.width || item.dimension || 0;
        if (itemProp === 'raccord_v') val = item.raccord_v || item.vRepeat || 0;
        if (itemProp === 'raccord_h') val = item.raccord_h || item.hRepeat || 0; // Added this back as it was in original
        if (itemProp === 'pa') val = item.buyPrice || item.pa || 0;
        if (itemProp === 'pv') val = item.sellPrice || item.pv || 0;
        if (val !== undefined) next[rowKey] = val;
      });
    }
  };

  // 1a. AUTRES DEPENSES (Extra Expenses)
  if (next.produit === "Autre Dépense" || next.section === 'autre') {
    if (next.categorie?.includes("Commission")) {
      const pct = NVL(next.pourcentage);
      const baseCA = NVL(ctx.totalCA);
      next.prix_total = Math.round((baseCA * (pct / 100)) * 100) / 100;
      next.total_price = next.prix_total;
      return next;
    }
    next.total_price = NVL(next.prix_total);
    return next;
  }

  // 1b. DEPLACEMENTS (Specific Logistics)
  if (next.produit === "Déplacement") {
    const nbTech = Math.max(1, NVL(next.nb_tech));
    const nbAR = Math.max(1, NVL(next.nb_allers_retours, 1));
    const tempsTrajetAR = NVL(next.temps_trajet, 0);
    const joursInter = NVL(next.duree_intervention_jours, 0);
    const prixBillet = NVL(next.prix_billet, 0);
    const isDecouchage = next.decouchage === "Oui";

    let heuresFactureesUnit = 0;
    if (tempsTrajetAR > 0) {
      const tranche4h = Math.ceil((tempsTrajetAR / 2) / 4) * 4;
      heuresFactureesUnit = tranche4h * 2;
    }
    const heuresFactureesTotal = heuresFactureesUnit * nbAR * nbTech;
    next.heures_facturees = heuresFactureesTotal;
    const tauxHoraire = NVL(settings.taux_horaire, 35);
    next.cout_mo = heuresFactureesTotal * tauxHoraire;

    if (isDecouchage && joursInter > 0) {
      next.nb_nuits = Math.max(0, (joursInter - 1) * nbTech);
      next.nb_repas = joursInter * 2 * nbTech;
    } else {
      next.nb_nuits = 0; next.nb_repas = 0;
    }
    next.cout_nuits = next.nb_nuits * NVL(settings.prix_nuit, 180);
    next.cout_repas = next.nb_repas * NVL(settings.prix_repas, 25);
    next.cout_billet_total = prixBillet * nbTech * nbAR;
    next.total_price = next.cout_mo + next.cout_nuits + next.cout_repas + next.cout_billet_total;
    next.prix_total = next.total_price;
    return next;
  }

  // =========================================================
  // 2. PRODUCT-SPECIFIC CALCULATIONS (IDEALLY ISOLATED)
  // =========================================================
  const isRideau = /rideau|voilage/i.test(String(next.produit || ""));
  const isStore = /store|canishade/i.test(String(next.produit || ""));

  if (isRideau) {
    // A. Sync Fabric Specs
    fillFromCatalog('tissu_deco1', { laize_tissu1: 'laize', raccord_v_tissu1: 'raccord_v', raccord_h_tissu1: 'raccord_h' });
    fillFromCatalog('tissu_deco2', { laize_tissu2: 'laize', raccord_v_tissu2: 'raccord_v', raccord_h_tissu2: 'raccord_h' });
    fillFromCatalog('doublure', { laize_doublure: 'laize' });
    fillFromCatalog('interdoublure', { laize_interdoublure: 'laize' });

    // B. Geometry
    if (!next.largeur && next.largeur_mecanisme) next.largeur = next.largeur_mecanisme;
    const L = NVL(next.largeur);
    const H = NVL(next.hauteur);
    const Ampleur = NVL(next.ampleur, 0);
    const FinitionBas = NVL(next.finition_bas, 0);
    const Croisement = NVL(next.croisement, 0);
    const RetourG = NVL(next.retour_gauche, 0);
    const RetourD = NVL(next.retour_droit, 0);

    const isOnePanel = (next.paire_ou_un_seul_pan || "").startsWith("Un seul pan");
    const A_Plat = isOnePanel ? ((L + (L * 0.10)) * Ampleur + RetourG + RetourD) : (((L / 2) + (L / 2 * 0.10)) * Ampleur + RetourG) * 2 + Croisement;
    next.a_plat = A_Plat;
    const H_Coupe = H + FinitionBas + 50;
    next.hauteur_coupe = H_Coupe;

    // C. ML & Costs
    const RaccordV = NVL(next.raccord_v_tissu1, 0);
    next.hauteur_coupe_motif = (RaccordV > 0) ? Math.ceil(H_Coupe / RaccordV) * RaccordV + RaccordV : H_Coupe; // Added + RaccordV back

    const calcML = (laize, hC, hCM) => {
      if (!laize || laize <= 0) return { nbLes: 0, ml: 0 };
      // Determine H Key
      const H_Key = (hCM > hC) ? hCM : hC;

      if (laize > H_Key) {
        // Railoaded
        return {
          nbLes: 0,
          ml: roundStep05(A_Plat / 100)
        };
      } else {
        // Vertical
        const NbLes = Math.ceil(A_Plat / laize);
        return {
          nbLes: NbLes,
          ml: roundStep05((NbLes * H_Key) / 100)
        };
      }
    };

    // Tissu 1
    const res1 = calcML(NVL(next.laize_tissu1), H_Coupe, next.hauteur_coupe_motif);
    next.nb_les_tissu1 = res1.nbLes; next.ml_tissu1 = res1.ml;
    const p1 = getPrice(next.tissu_deco1);
    next.pa_tissu1 = next.ml_tissu1 * (p1.pa || 0); next.pv_tissu1 = next.ml_tissu1 * (p1.pv || 0);

    // Tissu 2
    const res2 = calcML(NVL(next.laize_tissu2), H_Coupe, H_Coupe); // Tissu 2 is considered unie
    next.nb_les_tissu2 = res2.nbLes; next.ml_tissu2 = res2.ml;
    const p2 = getPrice(next.tissu_deco2);
    next.pa_tissu2 = next.ml_tissu2 * (p2.pa || 0); next.pv_tissu2 = next.ml_tissu2 * (p2.pv || 0);

    // Doublure
    const resD = calcML(NVL(next.laize_doublure), H_Coupe, H_Coupe);
    next.nb_les_doublure = resD.nbLes; next.ml_doublure = resD.ml;
    const pD = getPrice(next.doublure);
    next.pa_doublure = next.ml_doublure * (pD.pa || 0); next.pv_doublure = next.ml_doublure * (pD.pv || 0);

    // Interdoublure
    const resI = calcML(NVL(next.laize_interdoublure), H_Coupe, H_Coupe);
    next.nb_les_interdoublure = resI.nbLes; next.ml_interdoublure = resI.ml;
    const pI = getPrice(next.interdoublure);
    next.pa_interdoublure = next.ml_interdoublure * (pI.pa || 0); next.pv_interdoublure = next.ml_interdoublure * (pI.pv || 0);

    // Passementerie
    const calcPassML = (app) => {
      if (!app || app === '-') return A_Plat;
      if (app === 'I') return H_Coupe;
      if (app === 'U') return (H_Coupe * 2) + A_Plat;
      if (app === 'L') return H_Coupe + A_Plat;
      return 0;
    };
    next.ml_pass1 = roundStep05(calcPassML(next.application_passementerie1) / 100);
    const pP1 = getPrice(next.passementerie1);
    next.pa_pass1 = next.ml_pass1 * (pP1.pa || 0); next.pv_pass1 = next.ml_pass1 * (pP1.pv || 0);

    next.ml_pass2 = roundStep05(calcPassML(next.application_passementerie2) / 100);
    const pP2 = getPrice(next.passementerie2);
    next.pa_pass2 = next.ml_pass2 * (pP2.pa || 0); next.pv_pass2 = next.ml_pass2 * (pP2.pv || 0);

    // Mecanisme
    if (next.type_mecanisme === 'Rail') {
      const pM = getPrice(next.modele_mecanisme);
      const wM = NVL(next.largeur_mecanisme) / 100;
      next.pa_mecanisme = wM * (pM.pa || 0); next.pv_mecanisme = wM * (pM.pv || 0);
    }
  }

  if (isStore) {
    // Sync Toile Finition 1
    fillFromCatalog('toile_finition_1', {
      laize_toile_finition_1: 'laize',
      raccord_v_toile_finition_1: 'raccord_v',
      raccord_h_toile_finition_1: 'raccord_h',
    });

    // Sync Mecanisme Store
    const itemMecaStore = catalog.find(i => i.name === next.mecanisme_store);
    if (itemMecaStore) {
      if (next.pa_mecanisme_store === undefined || next.pa_mecanisme_store === 0) { // Only fill if not manually set
        next.pa_mecanisme_store = itemMecaStore.buyPrice || itemMecaStore.pa || 0;
      }
      if (next.pv_mecanisme_store === undefined || next.pv_mecanisme_store === 0) { // Only fill if not manually set
        next.pv_mecanisme_store = itemMecaStore.sellPrice || itemMecaStore.pv || 0;
      }
    }

    // Toile Finition 1 (ML is manual, but prices are calculated)
    const pTF1 = getPrice(next.toile_finition_1);
    next.pa_toile_finition_1 = NVL(next.ml_toile_finition_1) * (pTF1.pa || 0);
    next.pv_toile_finition_1 = NVL(next.ml_toile_finition_1) * (pTF1.pv || 0);

    // Doublure (ML is manual for stores)
    const pD = getPrice(next.doublure);
    next.pa_doublure = NVL(next.ml_doublure) * (pD.pa || 0);
    next.pv_doublure = NVL(next.ml_doublure) * (pD.pv || 0);

    const isBateau = /bateau|velum|vélum/i.test(next.produit || "");
    if (isBateau) {
      // For Store Bateau/Velum, mecanisme_fourniture is used for the mechanism
      fillFromCatalog('mecanisme_fourniture', {});
      const pM = getPrice(next.mecanisme_fourniture);
      next.pa_mecanisme = NVL(next.quantite) * (pM.pa || 0);
      next.pv_mecanisme = NVL(next.quantite) * (pM.pv || 0);
    }
    // Generic Store logic for manually entered P.U. handled later
  }

  // --- 10. DECOR PRODUCTS (Coussins, Plaids, etc.) ---
  const isDecor = /coussin|plaid|cache-sommier|mobilier|tenture/i.test(String(next.produit || ""));

  if (isDecor) {
    // A. Fabrics (Underscored keys for Decors)
    fillFromCatalog('tissu_1', { laize_tissu_1: 'laize' });
    if (next.tissu_1) {
      const pT1 = getPrice(next.tissu_1);
      // ml_tissu_1 is MANUALLY entered for Decors (no auto-calc)
      next.pa_tissu_1 = NVL(next.ml_tissu_1) * (pT1.pa || 0);
      next.pv_tissu_1 = NVL(next.ml_tissu_1) * (pT1.pv || 0);
    }
    fillFromCatalog('tissu_2', { laize_tissu_2: 'laize' });
    if (next.tissu_2) {
      const pT2 = getPrice(next.tissu_2);
      next.pa_tissu_2 = NVL(next.ml_tissu_2) * (pT2.pa || 0);
      next.pv_tissu_2 = NVL(next.ml_tissu_2) * (pT2.pv || 0);
    }

    // B. Passementerie
    fillFromCatalog('passementerie_1', {});
    if (next.passementerie_1) {
      const pP1D = getPrice(next.passementerie_1);
      next.pa_pass_1 = NVL(next.ml_pass_1) * (pP1D.pa || 0);
      next.pv_pass_1 = NVL(next.ml_pass_1) * (pP1D.pv || 0);
    }
    fillFromCatalog('passementerie_2', {});
    if (next.passementerie_2) {
      const pP2D = getPrice(next.passementerie_2);
      next.pa_pass_2 = NVL(next.ml_pass_2) * (pP2D.pa || 0);
      next.pv_pass_2 = NVL(next.ml_pass_2) * (pP2D.pv || 0);
    }

    // C. Interior / Mechanism (Shared)
    if (next.type_interieur) {
      const pInt = getPrice(next.type_interieur);
      next.pa_interieur = NVL(next.quantite) * (pInt.pa || 0);
      next.pv_interieur = NVL(next.quantite) * (pInt.pv || 0);
    }
    if (next.mecanisme_fourniture && NVL(next.pa_mecanisme) === 0) {
      const pMF = getPrice(next.mecanisme_fourniture);
      next.pa_mecanisme = NVL(next.quantite) * (pMF.pa || 0);
      next.pv_mecanisme = NVL(next.quantite) * (pMF.pv || 0);
    }

    // Molleton (NEW for Tenture)
    fillFromCatalog('molleton', {});
    if (next.molleton) {
      const pMoll = getPrice(next.molleton);
      next.pa_molleton = NVL(next.ml_molleton) * (pMoll.pa || 0);
      next.pv_molleton = NVL(next.ml_molleton) * (pMoll.pv || 0);
    }

    // D. Baguettes (NEW for Tenture)
    fillFromCatalog('baguette_1', {});
    if (next.baguette_1) {
      const pB1 = getPrice(next.baguette_1);
      next.pa_baguette_1 = NVL(next.ml_baguette_1) * (pB1.pa || 0);
      next.pv_baguette_1 = NVL(next.ml_baguette_1) * (pB1.pv || 0);
    }
    fillFromCatalog('baguette_2', {});
    if (next.baguette_2) {
      const pB2 = getPrice(next.baguette_2);
      next.pa_baguette_2 = NVL(next.ml_baguette_2) * (pB2.pa || 0);
      next.pv_baguette_2 = NVL(next.ml_baguette_2) * (pB2.pv || 0);
    }
  } else if (!isRideau && !isStore) {
    // --- 11. GENERIC OTHERS ---
    // Minimal logic for products not specifically handled
    if (next.tissu_1) {
      const pT1 = getPrice(next.tissu_1);
      next.pa_tissu_1 = NVL(next.ml_tissu_1) * (pT1.pa || 0);
      next.pv_tissu_1 = NVL(next.ml_tissu_1) * (pT1.pv || 0);
    }
  }

  // --- 11. PRESTATIONS & SOUS-TRAITANCE ---
  const taux = NVL(settings.taux_horaire, 135); // Changed from 35 to 135 as per common settings
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
    NVL(next.pv_mecanisme) + NVL(next.pv_mecanisme_bis) +
    NVL(next.pv_tissu_1) + NVL(next.pv_pass_1) +
    NVL(next.pv_tissu_2) + NVL(next.pv_pass_2) +
    NVL(next.pv_interieur) + NVL(next.pv_toile_finition_1) + NVL(next.pv_mecanisme_store) +
    NVL(next.pv_baguette_1) + NVL(next.pv_baguette_2) + NVL(next.pv_molleton) +
    NVL(next.pv_prepa) + NVL(next.pv_pose) + NVL(next.pv_confection) +
    NVL(next.st_pose_pv) + NVL(next.st_conf_pv) +
    NVL(next.livraison);

  // Safeguard: If components > 0, we use it. If 0 and we have a manual unit_price, keep it.
  if (totalPriceComponents > 0) {
    next.unit_price = totalPriceComponents / NVL(next.quantite, 1);
  }

  next.total_price = totalPriceComponents > 0 ? totalPriceComponents : NVL(next.unit_price) * NVL(next.quantite, 1);
  next.prix_total = next.total_price;

  return next;
}
