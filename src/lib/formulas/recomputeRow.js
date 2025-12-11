// src/lib/formulas/recomputeRow.js
import { evalFormula } from "./eval.js";

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

  // 1. First Pass: Calculate all formulas (Get correct ML, but Prices might be stale)
  for (const col of cols) {
    if (!col || !col.key) continue;
    const k = col.key;
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

  // 3. Re-evaluate Totals dependent on Prices (Prix Unitaire, Prix Total)
  // We explicitly re-run these specific formulas because they depend on the PA/PV we just updated.
  const reEval = (key) => {
    const col = cols.find(c => c.key === key);
    const expr = cellFx[key] || col?.formula;
    if (expr) next[key] = evalFormula(expr, next, ctx);
  };

  reEval('prix_unitaire');
  reEval('prix_total');

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
  if (['Rideau', 'Store Enrouleur', 'Store Bateau', 'Store Vénitien', 'Décor de lit', 'Voilage', 'Cache Sommier', 'Coussin'].includes(next.produit)) {
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
  }

  // 2. DEPLACEMENTS (Advanced Logistics Logic)
  // Overwrite unit prices with global settings
  if (next.produit === 'Déplacement') {
    // Inputs
    const nbTech = Number(next.nb_tech) || 1;
    const nbJours = Number(next.nb_jours) || 1;
    const decouche = next.decouche === true; // Checkbox boolean
    const format = next.format_duree || 'Journée';

    // Global Settings
    const taux = Number(settings.taux_horaire) || 35;
    const prixNuit = Number(settings.prix_nuit) || 180;
    const prixRepas = Number(settings.prix_repas) || 25;

    // --- CALCULATIONS ---

    // 1. Heures Totales
    // Base: Journée = 8h, Demi-journée = 4h
    const baseHeures = (format === 'Demi-journée') ? 4 : 8;
    const totalHeures = nbTech * nbJours * baseHeures;
    next.nb_heures = totalHeures;

    // 2. Nuits
    // Si découché = TRUE, alors Nuits = nbTech * nbJours
    // Sinon 0
    const totalNuits = decouche ? (nbTech * nbJours) : 0;
    next.nb_nuits = totalNuits;

    // 3. Repas
    // Si découché = TRUE, alors Repas = nbTech * nbJours * 2 (Midi + Soir)
    // Sinon = nbTech * nbJours * 1 (Midi uniquement)
    const repasParJour = decouche ? 2 : 1;
    const totalRepas = nbTech * nbJours * repasParJour;
    next.nb_repas = totalRepas;

    // --- COSTS ---

    // Main d'Oeuvre
    next.cout_mo = totalHeures * taux;

    // Nuits & Repas
    next.cout_nuits = totalNuits * prixNuit;
    next.cout_repas = totalRepas * prixRepas;

    // Transport
    const transportUnit = Number(next.transport_unitaire) || 0;
    next.transport_total = transportUnit * nbTech;

    // TOTAL FINAL
    next.prix_total = next.cout_mo + next.cout_nuits + next.cout_repas + next.transport_total;

    // Fill hidden defaults if needed
    next.tauxhoraire = taux; // trace
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

  return next;
}
