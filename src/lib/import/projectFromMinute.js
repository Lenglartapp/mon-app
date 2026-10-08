// Construction d'un projet de production à partir d'une minute chiffrée.
// UNIQUE source de vérité, partagée par :
//   • la création manuelle « Nouveau projet › Import d'une minute » (ProjectListScreen) ;
//   • la création automatique quand le devis Odoo de la minute passe en commande
//     (useOdooOrderProjects).
// Les deux chemins donnent donc exactement le même projet (lignes, formules, budget, matières).

import { SCHEMA_64 } from '../schemas/production.js';
import { computeFormulas } from '../formulas/compute.js';
import { applySchemaDefaults } from '../utils/schemaDefaults.js';
import { FORMULES_METRAGE_V2 } from '../formulas/metrageVersion';
import { extractMaterialsFromLines } from '../data/demo';
import { uid } from '../utils/uid';

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
    // manuel d'une ligne ; nouveau projet → formules de métrage v2 (projet + chaque ligne).
    config: { formules_metrage: FORMULES_METRAGE_V2 },
    rows: computeFormulas(rows.map((r) => applySchemaDefaults({ ...r, formules_metrage: FORMULES_METRAGE_V2 }, SCHEMA_64)), SCHEMA_64),
    materials: extractMaterialsFromLines(rows),
  };
}
