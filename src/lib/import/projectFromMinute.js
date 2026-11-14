// Construction d'un projet de production à partir d'une minute chiffrée.
// UNIQUE source de vérité, partagée par :
//   • la création manuelle « Nouveau projet › Import d'une minute » (ProjectListScreen) ;
//   • la création automatique quand le devis Odoo de la minute passe en commande
//     (useOdooOrderProjects).
// Les deux chemins donnent donc exactement le même projet (lignes, formules, budget, matières).

import { SCHEMA_64 } from '../schemas/production.js';
import { computeFormulas } from '../formulas/compute.js';
import { applySchemaDefaults } from '../utils/schemaDefaults.js';
import { FORMULES_METRAGE_COURANTE } from '../formulas/metrageVersion';
import { regrouperRideauxProduction } from '../schemas/production/rideaux';
import { FORMULES_STORES_COURANTE, isStoresMetrageRow } from '../formulas/storesBateauxMetrage.js';
import { extractMaterialsFromLines } from '../data/demo';
import { uid } from '../utils/uid';
import { ligneSansHistoriqueDevis } from '../projectOrigin.js';

// Rien de l'historique du devis ne suit dans le projet (décision du 2026-11-14, après celle du
// 2026-10-08 sur les messages) : ni messages, ni photos, ni journal des modifications.

// Budget d'heures recalculé depuis les lignes (source de vérité, plutôt qu'un snapshot).
export function budgetFromRows(rows) {
  let prepa = 0, conf = 0, pose = 0;
  (rows || []).forEach((r) => {
    const qty = Number(r.quantite) || 1;
    prepa += (Number(r.heures_prepa) || 0) * qty;
    conf += (Number(r.heures_confection) || 0) * qty;
    pose += (Number(r.heures_pose) || 0) * qty;
  });
  return { prepa, conf, pose };
}

/**
 * @param {object} minute  minute COMPLÈTE ({ id, name, owner, notes, lines })
 * @param {object} [opts]  { name, deliveryDate, location, intervention_type, expedition_type }
 * @returns {object} projet au format attendu par addProject (useProjects)
 */
export function buildProjectFromMinute(minute, opts = {}) {
  const rows = minute?.lines || [];
  // Tout NOUVEAU projet prend les formules courantes (marge machine de coupe 10 cm comprise),
  // même s'il vient d'un ancien chiffrage : la production compte donc ~10 cm de plus par lé
  // que le devis d'origine (choix assumé, novembre 2026). Les projets existants ne changent pas.
  const param = (name) => Number((minute?.params || []).find(p => p?.name === name)?.value) || 0;
  const maxRow = (k) => rows.reduce((m, r) => Math.max(m, Number(r?.[k]) || 0), 0);
  const vMetrage = Math.max(FORMULES_METRAGE_COURANTE, param('formules_metrage'), maxRow('formules_metrage'));
  const vStores = Math.max(FORMULES_STORES_COURANTE, param('formules_stores'), maxRow('formules_stores'));
  return {
    id: uid(),
    name: opts.name || minute?.name || 'Nouveau Projet',
    sourceMinuteId: minute?.id || null,
    budget: budgetFromRows(rows),
    manager: minute?.owner || undefined,
    notes: minute?.notes || undefined,
    deadline: opts.deliveryDate || null,
    location: opts.location || null,
    intervention_type: opts.intervention_type || null,
    expedition_type: opts.expedition_type || null,
    // Défauts du schéma (étiquettes à « Non ») sur les lignes reprises du devis, comme l'ajout
    // manuel d'une ligne ; chaque ligne passe au moins en formules de métrage courantes.
    // Stores bateaux / velum : le projet suit le métrage courant (lignes ajoutées ensuite) ;
    // une ligne reprise du devis DÉJÀ en métrage automatique (marqueur ≥ v1) passe en version
    // courante ; une ligne sans marqueur (métrage saisi à la main) reste sans marqueur.
    config: { formules_metrage: vMetrage, formules_stores: vStores },
    // v4 : ML des rideaux couchés regroupés sur tout le projet (cotes du devis à ce stade).
    rows: regrouperRideauxProduction(computeFormulas(rows.map((r) => applySchemaDefaults({
      ...ligneSansHistoriqueDevis(r),
      formules_metrage: Math.max(vMetrage, Number(r.formules_metrage) || 0),
      ...(isStoresMetrageRow(r) ? { formules_stores: Math.max(vStores, Number(r.formules_stores) || 0) } : {}),
    }, SCHEMA_64)), SCHEMA_64)),
    // Bibliothèque du chiffrage → matériauthèque : fournisseur, référence, coloris,
    // famille, laize, motif et raccords de chaque article utilisé.
    materials: extractMaterialsFromLines(rows, minute?.catalog),
  };
}
