// src/lib/projectMetrics.js
// SOURCE UNIQUE des métriques projet (avancement + heures par service).
// Utilisé à la fois par le dashboard du dossier (DashboardTiles) et par
// l'Assistant Programmation (planning) → garantit des chiffres identiques.

import { differenceInMinutes } from 'date-fns';

// ─────────────────────────────────────────────────────────────
// 1. AVANCEMENT (cotes / prépa / confection / pose)
//    Calcul déplacé tel quel depuis DashboardTiles — ne pas modifier
//    sans répercuter sur le dashboard (même fonction partagée).
// ─────────────────────────────────────────────────────────────

const CONF_WEIGHTS_RIDEAUX = {
  'Non démarré': 0,
  'Coupé': 0.10,
  'Assemblé': 0.70,
  'Plis terminés': 0.95,
  'Emballé': 1.0,
  'En cours': 0.35,
  'Terminé': 1.0,
};

const CONF_WEIGHTS_STORES_BATEAUX = {
  'Non démarré': 0,
  'Ourlet fait': 0.30,
  'Fourreau terminé': 0.70,
  'Ficelle terminée': 0.95,
  'Emballé': 1.0,
  'En cours': 0.35,
  'Terminé': 1.0,
};

const getConfWeight = (row) => {
  const produit = String(row.produit || '').toLowerCase();
  const status = row.statut_conf || 'Non démarré';
  if (/rideau|voilage/i.test(produit)) return CONF_WEIGHTS_RIDEAUX[status] ?? 0;
  if (/store.*(bateau|velum)/i.test(produit)) return CONF_WEIGHTS_STORES_BATEAUX[status] ?? 0;
  return status === 'Terminé' ? 1.0 : 0;
};

const COTES_WEIGHTS = {
  'Cote non prenable': 0,
  'Déduction restante à faire': 0.70,
  'Définitive': 0.80,
  'Validé par chef de projet': 1.0,
  'Non exploitable': 0,
};

const getCotesWeight = (statut) => COTES_WEIGHTS[statut] ?? 0;
// Paire décentrée : le parent (rail) ne compte pas pour les cotes (ce sont les enfants/rideaux qui sont mesurés)
const isSubjectToCotes = (row) =>
  row?.pair_role !== 'parent' && /rideau|voilage|store/i.test(String(row?.produit || ''));

// Coussins, plaids, cache-sommiers → confection uniquement, pas de prépa ni pose
// Paire décentrée : la prépa/pose (le rail) est portée par le PARENT — les 2 enfants ne comptent pas.
const isSubjectToPrepaAndPose = (row) =>
  row?.pair_role !== 'left' && row?.pair_role !== 'right' &&
  !/coussin|plaid|cache.sommier/i.test(String(row?.produit || ''));

// ─── Résumé ST pour une tuile (conf ou pose) ────────────────────────────────
// Retourne une string lisible ex: "Voilages sous-traités" / "Voilages R+2 sous-traités"
const buildStSummary = (stRows) => {
  if (!stRows.length) return null;
  // Grouper par produit
  const byProduct = {};
  stRows.forEach(r => {
    const prod = String(r.produit || '').trim();
    if (!byProduct[prod]) byProduct[prod] = [];
    byProduct[prod].push(r);
  });
  const parts = [];
  Object.entries(byProduct).forEach(([prod, productRows]) => {
    const label = prod ? prod + 's' : 'Articles'; // "Voilage" → "Voilages"
    parts.push(label + ' sous-traités');
  });
  return parts.join(' · ');
};

// Détermine le mode d'une tuile service (conf ou pose)
// mode: 'normal' | 'all_st' | 'mix_st' | 'not_applicable'
const getServiceMode = (budgetHours, stRows, internalRows) => {
  const hasBudget = budgetHours > 0;
  const hasST = stRows.length > 0;
  if (!hasBudget && !hasST) return 'not_applicable';
  if (!hasBudget && hasST)  return 'all_st';
  if (hasBudget && hasST)   return 'mix_st';
  return 'normal';
};

// % d'avancement pour les lignes sous-traitées (Non démarré=0, En cours=50, Terminé=100)
const pctFromStRows = (stRows, statusField) => {
  if (!stRows.length) return 0;
  const sum = stRows.reduce((acc, r) => {
    const s = r[statusField] || 'Non démarré';
    return acc + (s === 'Terminé' ? 1 : s === 'En cours' ? 0.5 : 0);
  }, 0);
  return Math.round((sum / stRows.length) * 100);
};

export const calculateProjectStats = (rows, budget = {}) => {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const total = rows.length;
  let cotesWeightSum = 0, cotesTotal = 0;
  let prepaOk = 0, prepaTotal = 0;
  let poseOk = 0, poseTotal = 0;
  let weightedConfSum = 0, totalConfHours = 0, confBinaryOk = 0;

  rows.forEach(r => {
    if (isSubjectToCotes(r)) {
      cotesWeightSum += getCotesWeight(r.statut_cotes);
      cotesTotal++;
    }
    if (isSubjectToPrepaAndPose(r)) {
      prepaTotal++;
      poseTotal++;
      if (r.statut_prepa === 'Terminé') prepaOk++;
      if (r.statut_pose === 'Terminé') poseOk++;
    }

    if (r.realise_par === 'Sous-Traitant') return;
    // Paire décentrée : le parent (rail) ne porte pas de confection → exclu du comptage conf
    if (r.pair_role === 'parent') return;

    const hours = parseFloat(r.heures_confection) || 0;
    if (hours > 0) {
      weightedConfSum += hours * getConfWeight(r);
      totalConfHours += hours;
    } else {
      if (r.statut_conf === 'Terminé') confBinaryOk++;
    }
  });

  let pctConf;
  if (totalConfHours > 0) {
    pctConf = Math.round((weightedConfSum / totalConfHours) * 100);
  } else {
    const itemsWithoutHours = rows.filter(r => r.realise_par !== 'Sous-Traitant' && r.pair_role !== 'parent' && !(parseFloat(r.heures_confection) > 0)).length;
    pctConf = itemsWithoutHours > 0 ? Math.round((confBinaryOk / itemsWithoutHours) * 100) : 0;
  }

  // ── Modes conf / pose ──────────────────────────────────────────────────────
  const stConfRows = rows.filter(r => (parseFloat(r.st_conf_pa) || 0) > 0);
  const stPoseRows = rows.filter(r => (parseFloat(r.st_pose_pa) || 0) > 0);
  const internalConfRows = rows.filter(r => !((parseFloat(r.st_conf_pa) || 0) > 0));
  const internalPoseRows = rows.filter(r => !((parseFloat(r.st_pose_pa) || 0) > 0));

  const confMode = getServiceMode(budget.conf || 0, stConfRows, internalConfRows);
  const poseMode = getServiceMode(budget.pose || 0, stPoseRows, internalPoseRows);

  // Pour all_st : % basé sur statuts ST (Non démarré/En cours/Terminé)
  const pctConfST = pctFromStRows(stConfRows, 'statut_conf');
  const pctPoseST = pctFromStRows(stPoseRows, 'statut_pose');

  // % final conf selon mode
  const pctConfFinal = confMode === 'all_st' ? pctConfST
    : confMode === 'mix_st' ? Math.round((pctConf + pctConfST) / 2)
    : confMode === 'not_applicable' ? null
    : pctConf;

  // % final pose selon mode
  const pctPoseBase = poseTotal > 0 ? Math.round((poseOk / poseTotal) * 100) : 0;
  const pctPoseFinal = poseMode === 'all_st' ? pctPoseST
    : poseMode === 'mix_st' ? Math.round((pctPoseBase + pctPoseST) / 2)
    : poseMode === 'not_applicable' ? null
    : poseTotal > 0 ? Math.round((poseOk / poseTotal) * 100) : null;

  return {
    total,
    cotesTotal,
    pctCotes: cotesTotal > 0 ? Math.round((cotesWeightSum / cotesTotal) * 100) : null,
    pctPrepa: prepaTotal > 0 ? Math.round((prepaOk / prepaTotal) * 100) : null,
    pctConf: pctConfFinal,
    pctPose: pctPoseFinal,
    confMode, poseMode,
    stConfSummary: buildStSummary(stConfRows),
    stPoseSummary: buildStSummary(stPoseRows),
    raw: {
      cotesValidees: rows.filter(r => r.statut_cotes === 'Validé par chef de projet').length,
      prepaOk, prepaTotal,
      poseOk, poseTotal,
      confHouresDone: Math.round(weightedConfSum),
      confHouresTotal: Math.round(totalConfHours),
    },
  };
};

// ─────────────────────────────────────────────────────────────
// 2. HEURES PAR SERVICE (budget / consommé / planifié / restant)
//    Réplique la logique "réalisé" du dossier (ProductionProjectScreen) :
//    consommé = import + événements VALIDÉS, mapping type→service, règle
//    8h/j (>5h consécutives → -1h pause).
// ─────────────────────────────────────────────────────────────

// Mapping type d'événement → service (identique au dossier)
export const serviceOfEventType = (type) => {
  const t = String(type || '').toLowerCase();
  if (t === 'rdv' || t === 'prepa' || t === 'metrage') return 'prepa';
  if (t === 'atelier' || t === 'conf' || t === 'confection') return 'conf';
  if (t === 'chantier' || t === 'pose' || t === 'installation') return 'pose';
  return null;
};

// Heures nettes d'un événement (règle pause déjeuner)
export const netHoursOfEvent = (evt) => {
  const start = new Date(evt.meta?.start || evt.date);
  const end = new Date(evt.meta?.end || evt.date);
  const rawMinutes = differenceInMinutes(end, start);
  const netMinutes = rawMinutes > 300 ? rawMinutes - 60 : rawMinutes;
  return Math.max(0, netMinutes / 60);
};

const emptyServices = () => ({ prepa: 0, conf: 0, pose: 0 });

/**
 * Heures par service pour un projet.
 * @returns { budget, consumed, planned, remaining } — chacun { prepa, conf, pose }
 */
export const computeProjectHours = (project, events) => {
  const budget = {
    prepa: Number(project?.budget?.prepa) || 0,
    conf: Number(project?.budget?.conf) || 0,
    pose: Number(project?.budget?.pose) || 0,
  };

  const consumed = emptyServices();
  const planned = emptyServices();

  // Base importée (projets repris en cours) → comptée comme consommée
  const imp = project?.consumed_import || {};
  consumed.prepa += Number(imp.prepa) || 0;
  consumed.conf += Number(imp.conf) || 0;
  consumed.pose += Number(imp.pose) || 0;

  (events || []).forEach(evt => {
    if (evt.meta?.projectId !== project?.id) return;
    if (evt.type === 'absence') return;
    const svc = serviceOfEventType(evt.type);
    if (!svc) return;
    const h = netHoursOfEvent(evt);
    // Validé = consommé (réalisé) ; sinon = planifié (programmé non fait)
    if (evt.meta?.status === 'validated') consumed[svc] += h;
    else planned[svc] += h;
  });

  const remaining = {
    prepa: budget.prepa - consumed.prepa,
    conf: budget.conf - consumed.conf,
    pose: budget.pose - consumed.pose,
  };

  return { budget, consumed, planned, remaining };
};
