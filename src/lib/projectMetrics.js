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
const isSubjectToCotes = (row) => /rideau|voilage|store/i.test(String(row?.produit || ''));

export const calculateProjectStats = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const total = rows.length;
  let cotesWeightSum = 0, cotesTotal = 0, prepaOk = 0, poseOk = 0;
  let weightedConfSum = 0, totalConfHours = 0, confBinaryOk = 0;

  rows.forEach(r => {
    if (isSubjectToCotes(r)) {
      cotesWeightSum += getCotesWeight(r.statut_cotes);
      cotesTotal++;
    }
    if (r.statut_prepa === 'Terminé') prepaOk++;
    if (r.statut_pose === 'Terminé') poseOk++;

    if (r.realise_par === 'Sous-Traitant') return;

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
    const itemsWithoutHours = rows.filter(r => r.realise_par !== 'Sous-Traitant' && !(parseFloat(r.heures_confection) > 0)).length;
    pctConf = itemsWithoutHours > 0 ? Math.round((confBinaryOk / itemsWithoutHours) * 100) : 0;
  }

  return {
    total,
    cotesTotal,
    pctCotes: cotesTotal > 0 ? Math.round((cotesWeightSum / cotesTotal) * 100) : null,
    pctPrepa: Math.round((prepaOk / total) * 100),
    pctConf,
    pctPose: Math.round((poseOk / total) * 100),
    raw: {
      cotesValidees: rows.filter(r => r.statut_cotes === 'Validé par chef de projet').length,
      prepaOk, poseOk,
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
const netHoursOfEvent = (evt) => {
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
