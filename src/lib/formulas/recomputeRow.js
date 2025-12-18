// src/lib/formulas/recomputeRow.js
import { evalFormula } from "./eval.js";

const NVL = (x, y) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : Number(y ?? 0);
};

/**
 * Recalcule toutes les colonnes de type formula + overrides de cellule (__cellFormulas)
 * @param {object} row    Ligne source
 * @param {Array}  schema Colonnes [{key, type, formula, ...}]
 * @returns {object}      Ligne recalculée
 */
export function recomputeRow(row, schema, ctx = {}) {
  const cols = Array.isArray(schema) ? schema : [];
  const cellFx = row?.__cellFormulas || {};
  const next = { ...(row || {}) };

  // 1. First Pass: Calculate all formulas
  // Products that require manual ML input (Decors + Stores)
  const isManualML = /d[ée]cor|coussin|plaid|t[êe]te|tenture|cache|store|canishade/i.test(row?.produit || "");
  const manualFields = ['ml_tissu_deco1', 'ml_tissu_deco2', 'ml_passementerie1', 'ml_passementerie2', 'ml_doublure', 'ml_inter'];

  for (const col of cols) {
    if (!col || !col.key) continue;
    const k = col.key;

    // SAFEGUARD for Decors/Stores: Skip automatic ML calculation
    if (isManualML && manualFields.includes(k)) continue;

    const expr = cellFx[k] || col.formula;
    if (!expr) continue;

    try {
      next[k] = evalFormula(expr, next, ctx);
    } catch {
      // ignore
    }
  }

  // 2. Fabric Logic: dependent on ML (calculated above) and Catalog
  const catalog = ctx.catalog || [];

  const updateFabricPrice = (nameKey, qtyKey, paKey, pvKey) => {
    const fabricName = next[nameKey];
    if (!fabricName) return;

    const item = catalog.find(i => i.name === fabricName);
    if (item) {
      // ML should be up to date from Step 1
      const qty = parseFloat(next[qtyKey]) || 0;
      next[paKey] = qty * (item.buyPrice || 0);
      next[pvKey] = qty * (item.sellPrice || 0);
    }
  };

  if (catalog.length > 0) {
    updateFabricPrice('tissu_deco1', 'ml_tissu_deco1', 'pa_tissu_deco1', 'pv_tissu_deco1');
    updateFabricPrice('tissu_deco2', 'ml_tissu_deco2', 'pa_tissu_deco2', 'pv_tissu_deco2');
    updateFabricPrice('doublure', 'ml_doublure', 'pa_doublure', 'pv_doublure');
    updateFabricPrice('inter_doublure', 'ml_inter', 'pa_inter', 'pv_inter');
  }

  // 3. (Moved to End)

  // --- Mechanism Logic (Rideaux) ---
  if (['Rail', 'Store Bateau', 'Store Enrouleur', 'Store Vénitien', 'Store Californien', 'Store Velum', 'Canishade', 'Tringle'].includes(next.type_mecanisme)) {
    const type = next.type_mecanisme;

    // A. RAIL Logic: Auto-calculation
    if (type === 'Rail') {
      // 1. Find Model
      const modelName = next.modele_mecanisme;
      const modelItem = catalog.find(i => i.name === modelName) || {}; // Should filter by category='Mecanisme'? Assuming unique names

      // 2. Auto-fill Dim
      if (modelItem.dimension) next.dim_mecanisme = modelItem.dimension;

      // 3. Calc Price
      const widthCm = parseFloat(next.l_mecanisme) || 0;
      const metrage = widthCm / 100;

      const buyPrice = modelItem.buyPrice || 0;
      const sellPrice = modelItem.sellPrice || 0;

      next.pa_mecanisme = metrage * buyPrice;
      next.pv_mecanisme = metrage * sellPrice;
    }
    // B. STORE / CANISHADE Logic: Clean up
    else if (type.includes('Store') || type === 'Canishade') {
      // Clear dimension (not applicable/locked)
      next.dim_mecanisme = '';
      // Prices are manual -> Do nothing.
    }
    // C. TRINGLE Logic: Manual
    // Do nothing. Use user input.
  }

  // --- Global Settings Logic (Rideaux / Deplacements) ---

  // --- Global Settings Logic (Rideaux / Deplacements) ---
  const settings = ctx.settings || {}; // Access injected settings

  // 1. RIDEAUX / STORES / DECORS
  // Auto-calculate PV if hours are present (using global hourly rate)
  if (['Rideau', 'Store Enrouleur', 'Store Bateau', 'Store Vénitien', 'Store Californien', 'Store Velum', 'Décor de lit', 'Voilage', 'Cache Sommier', 'Coussin'].includes(next.produit)) {
    const taux = settings.taux_horaire || 35;

    // PV Pose
    if (next.heures_pose > 0) {
      next.pv_pose = next.heures_pose * taux;
    }

    // PV Confection
    if (next.heures_confection > 0) {
      next.pv_confection = next.heures_confection * taux;
    }

    // PV Prepa
    if (next.heures_prepa > 0) {
      next.pv_prepa = next.heures_prepa * taux;
    }

    // 1-BIS. SOUS-TRAITANCE MARGIN (New User Request)
    // Apply dynamic coefficient from settings (default 2)
    const coefST = Number(settings.coef_sous_traitance) || 2;
    // ST Pose
    if (next.stpausepa > 0) {
      next.stpausepv = next.stpausepa * coefST;
    }
    // ST Confection
    if (next.stconfpa > 0) {
      next.stconfpv = next.stconfpa * coefST;
    }
  }

  // 2. DEPLACEMENTS (Advanced Logistics Logic)
  // ─────────────────────────────────────────────────────────────
  // 4) CAS SPÉCIFIQUE : LOGISTIQUE / DÉPLACEMENTS
  // ─────────────────────────────────────────────────────────────
  if (row.produit === "Déplacement") {
    const updates = {};

    // 1. Input Defaults
    const nbTrajets = NVL(row.nb_trajets, 1);
    const tempsTrajet = NVL(row.temps_trajet, 0); // Durée A/R

    // 2. FORCE LOGIC: Heures Intervention available ONLY if 'Prise de côtes'
    let heuresSurPlace = NVL(row.heures_sur_place, 0);
    if (row.type !== "Prise de côtes") {
      heuresSurPlace = 0;
      updates.heures_sur_place = 0; // Force update in state
    }

    // A. Calcul Temps Brut
    const tempsBrut = (tempsTrajet * nbTrajets) + heuresSurPlace;

    // B. Application du Seuil (Règle Métier 4h / 8h)
    let heuresFacturees = 0;
    if (tempsBrut > 0) {
      heuresFacturees = tempsBrut <= 4 ? 4 : 8;
    }
    updates.nb_heures = heuresFacturees;

    // C. Calcul Coûts
    const nbTech = Math.max(1, NVL(row.nb_tech));
    const tauxHoraire = NVL(settings.taux_horaire, 35);

    // Nuits & Repas
    // Règle simplifiée : Découché = 1 nuit + 2 repas. Sinon 1 repas.
    const computedNuits = row.decouche ? nbTech : 0;
    const computedRepas = (row.decouche ? 2 : 1) * nbTech;

    updates.nb_nuits = computedNuits;
    updates.nb_repas = computedRepas;

    const coutMO = heuresFacturees * nbTech * tauxHoraire;
    const coutNuits = computedNuits * NVL(settings.prix_nuit, 180);
    const coutRepas = computedRepas * NVL(settings.prix_repas, 25);

    updates.cout_mo = coutMO;
    updates.cout_nuits = coutNuits;
    updates.cout_repas = coutRepas;

    // D. Total Final
    updates.transport_total = 0; // Removed separate transport cost
    updates.prix_total = coutMO + coutNuits + coutRepas;

    return { ...row, ...updates };
  }



  // --- Hybrid Logic for Autres Dépenses ---
  if (next.produit === 'Autre Dépense') {
    const isCommission = next.categorie && next.categorie.includes('Commission');
    if (isCommission) {
      // Commission logic: Amount = % * Total CA
      const totalCA = ctx.totalCA || 0;
      const pct = parseFloat(next.pourcentage) || 0;
      next.prix_total = (pct * totalCA) / 100;
    }
    // ELSE: Ne pas toucher à next.prix_total (Standard case)
  }

  // 3. Re-evaluate Totals dependent on Prices (Prix Unitaire, Prix Total)
  // We explicitly re-run these specific formulas because they depend on the PA/PV we just updated.
  // MOVED TO END of function to ensure all component prices (Mechanism, Labor) are ready.
  const reEval = (key) => {
    const col = cols.find(c => c.key === key);
    const expr = cellFx[key] || col?.formula;
    if (expr) next[key] = evalFormula(expr, next, ctx);
  };

  reEval('prix_unitaire');
  reEval('prix_total');

  return next;
}
