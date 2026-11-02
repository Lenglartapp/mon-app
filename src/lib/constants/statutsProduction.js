// src/lib/constants/statutsProduction.js
// -----------------------------------------------------------------------------
// Statuts d'avancement d'une ligne de production (Prépa / Conf / Pose).
// « SAV » ferme chaque liste : la ligne a été terminée une fois et revient en
// service après-vente. Pour les avancements (projectMetrics), elle compte donc
// comme TERMINÉE — passer par `isTermine`, jamais `=== 'Terminé'`.
// -----------------------------------------------------------------------------

export const STATUT_SAV = 'SAV';

export const STATUT_PREPA_OPTIONS = ['Non démarré', 'En cours', 'Terminé', STATUT_SAV];
export const STATUT_POSE_OPTIONS = ['Non démarré', 'Méca posé', 'Accroché', 'Terminé', 'Reprise', STATUT_SAV];

export const STATUT_CONF_RIDEAUX_OPTIONS = ['Non démarré', 'Coupé', 'Assemblé', 'Plis terminés', 'Emballé', STATUT_SAV];
export const STATUT_CONF_STORES_BATEAUX_OPTIONS = ['Non démarré', 'Ourlet fait', 'Fourreau terminé', 'Ficelle terminée', 'Emballé', STATUT_SAV];
export const STATUT_CONF_SIMPLE_OPTIONS = ['Non démarré', 'En cours', 'Terminé', STATUT_SAV];

/** Terminé, ou terminé puis repassé en SAV. */
export const isTermine = (statut) => statut === 'Terminé' || statut === STATUT_SAV;
