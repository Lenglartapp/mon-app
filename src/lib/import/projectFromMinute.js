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
import { FORMULES_STORES_V1 } from '../formulas/storesBateauxMetrage.js';
import { extractMaterialsFromLines } from '../data/demo';
import { uid } from '../utils/uid';
import { isLogEntry } from '../lineLogs';

// Les messages échangés pendant le chiffrage (questions internes…) ne suivent pas dans le projet
// (décision du 2026-10-08) ; le journal des modifications et les photos restent.
const withoutChiffrageMessages = (r) => (Array.isArray(r.comments)
  ? { ...r, comments: r.comments.filter((c) => isLogEntry(c) || c?.type === 'image') }
  : r);

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
  // Le projet prend la version de formules de SON chiffrage (au minimum v2 / v1) : un ancien
  // devis reste sans marge machine de coupe, cohérent avec le tissu chiffré et acheté.
  const param = (name) => Number((minute?.params || []).find(p => p?.name === name)?.value) || 0;
  const maxRow = (k) => rows.reduce((m, r) => Math.max(m, Number(r?.[k]) || 0), 0);
  const vMetrage = Math.max(FORMULES_METRAGE_V2, param('formules_metrage'), maxRow('formules_metrage'));
  const vStores = Math.max(FORMULES_STORES_V1, param('formules_stores'), maxRow('formules_stores'));
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
    // Stores bateaux / velum : le projet suit le nouveau métrage (lignes ajoutées ensuite) ;
    // les lignes reprises du devis gardent le marqueur de leur chiffrage.
    config: { formules_metrage: vMetrage, formules_stores: vStores },
    rows: computeFormulas(rows.map((r) => applySchemaDefaults({ ...withoutChiffrageMessages(r), formules_metrage: Math.max(vMetrage, Number(r.formules_metrage) || 0) }, SCHEMA_64)), SCHEMA_64),
    // Bibliothèque du chiffrage → matériauthèque : fournisseur, référence, coloris,
    // famille, laize, motif et raccords de chaque article utilisé.
    materials: extractMaterialsFromLines(rows, minute?.catalog),
  };
}
