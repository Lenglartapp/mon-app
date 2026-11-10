// src/lib/projectSavStatus.js
// Statut projet « SAV » automatique, à partir des lignes :
//  - dès qu'une ligne a Statut Prépa, Conf ou Pose = « SAV », le projet passe en SAV ;
//    son statut d'avant est mémorisé dans `config.status_avant_sav` (champ existant : pas
//    de nouvelle colonne en base) ;
//  - quand plus aucune ligne n'est en SAV, il revient à ce statut.
// Un SAV posé À LA MAIN (sans statut mémorisé) n'est jamais retiré automatiquement.
// Un projet archivé n'est pas touché.
import { STATUT_SAV } from './constants/statutsProduction.js';

const STATUT_KEYS = ['statut_prepa', 'statut_conf', 'statut_pose'];

export const rowsHaveSav = (rows) => (rows || []).some(
    (r) => r && STATUT_KEYS.some((k) => r[k] === STATUT_SAV),
);

/** Patch à appliquer au projet ({ status, config }) ou null si rien ne change. */
export function syncProjectSavStatus(project, rows) {
    if (!project) return null;
    const status = project.status || 'TODO';
    if (status === 'ARCHIVED') return null;
    const config = project.config || {};
    const hasSav = rowsHaveSav(rows);
    if (hasSav && status !== 'SAV') {
        return { status: 'SAV', config: { ...config, status_avant_sav: status } };
    }
    if (!hasSav && status === 'SAV' && config.status_avant_sav) {
        const { status_avant_sav: previous, ...rest } = config;
        return { status: previous, config: rest };
    }
    return null;
}
