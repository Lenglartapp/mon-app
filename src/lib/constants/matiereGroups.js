// src/lib/constants/matiereGroups.js
// Groupes de matières par type de grille.
// Chaque groupe = { id, label, fields[] }
// fields[] = liste des clés de colonnes qui composent ce bloc matière.
// L'ordre des groupes détermine l'ordre d'affichage dans le bouton Matières.

export const RIDEAUX_MATIERE_GROUPS = [
    { id: 'tissu1',         label: 'Tissu 1',         fields: ['tissu_deco1', 'laize_tissu1', 'raccord_v_tissu1', 'raccord_h_tissu1', 'nb_les_tissu1', 'ml_tissu1', 'pa_tissu1', 'pv_tissu1'] },
    { id: 'tissu2',         label: 'Tissu 2',         fields: ['tissu_deco2', 'laize_tissu2', 'raccord_v_tissu2', 'raccord_h_tissu2', 'ml_tissu2', 'pa_tissu2', 'pv_tissu2'] },
    { id: 'doublure',       label: 'Doublure',        fields: ['doublure', 'laize_doublure', 'nb_les_doublure', 'ml_doublure', 'pa_doublure', 'pv_doublure'] },
    { id: 'interdoublure',  label: 'Interdoublure',   fields: ['interdoublure', 'laize_interdoublure', 'nb_les_interdoublure', 'ml_interdoublure', 'pa_interdoublure', 'pv_interdoublure'] },
    { id: 'passementerie1', label: 'Passementerie 1', fields: ['passementerie1', 'application_passementerie1', 'ml_pass1', 'pa_pass1', 'pv_pass1'] },
    { id: 'passementerie2', label: 'Passementerie 2', fields: ['passementerie2', 'application_passementerie2', 'ml_pass2', 'pa_pass2', 'pv_pass2'] },
];

export const STORES_BATEAUX_MATIERE_GROUPS = [
    { id: 'tissu1',   label: 'Tissu 1',  fields: ['toile_finition_1', 'laize_toile_finition_1', 'raccord_v_toile_finition_1', 'raccord_h_toile_finition_1', 'ml_toile_finition_1', 'pa_toile_finition_1', 'pv_toile_finition_1'] },
    { id: 'doublure', label: 'Doublure', fields: ['doublure', 'laize_doublure', 'ml_doublure', 'pa_doublure', 'pv_doublure'] },
];

export const COUSSINS_MATIERE_GROUPS = [
    { id: 'tissu1',         label: 'Tissu 1',         fields: ['tissu_1', 'laize_tissu_1', 'ml_tissu_1', 'pa_tissu_1', 'pv_tissu_1'] },
    { id: 'tissu2',         label: 'Tissu 2',         fields: ['tissu_2', 'laize_tissu_2', 'ml_tissu_2', 'pa_tissu_2', 'pv_tissu_2'] },
    { id: 'interieur',      label: 'Intérieur',       fields: ['type_interieur', 'pa_interieur', 'pv_interieur'] },
    { id: 'passementerie1', label: 'Passementerie 1', fields: ['passementerie_1', 'app_passementerie_1', 'ml_pass_1', 'pa_pass_1', 'pv_pass_1'] },
    { id: 'passementerie2', label: 'Passementerie 2', fields: ['passementerie_2', 'app_passementerie_2', 'ml_pass_2', 'pa_pass_2', 'pv_pass_2'] },
];

export const CACHE_SOMMIER_MATIERE_GROUPS = [
    { id: 'tissu1',         label: 'Tissu 1',         fields: ['tissu_1', 'laize_tissu_1', 'ml_tissu_1', 'pa_tissu_1', 'pv_tissu_1'] },
    { id: 'tissu2',         label: 'Tissu 2',         fields: ['tissu_2', 'laize_tissu_2', 'ml_tissu_2', 'pa_tissu_2', 'pv_tissu_2'] },
    { id: 'passementerie1', label: 'Passementerie 1', fields: ['passementerie_1', 'app_passementerie_1', 'ml_pass_1', 'pa_pass_1', 'pv_pass_1'] },
    { id: 'passementerie2', label: 'Passementerie 2', fields: ['passementerie_2', 'app_passementerie_2', 'ml_pass_2', 'pa_pass_2', 'pv_pass_2'] },
];

export const PLAID_MATIERE_GROUPS = [
    { id: 'tissu1',         label: 'Tissu 1',         fields: ['tissu_1', 'laize_tissu_1', 'ml_tissu_1', 'pa_tissu_1', 'pv_tissu_1'] },
    { id: 'tissu2',         label: 'Tissu 2',         fields: ['tissu_2', 'laize_tissu_2', 'ml_tissu_2', 'pa_tissu_2', 'pv_tissu_2'] },
    { id: 'molleton',       label: 'Molleton',        fields: ['molleton', 'laize_molleton', 'ml_molleton', 'pa_molleton', 'pv_molleton'] },
    { id: 'passementerie1', label: 'Passementerie 1', fields: ['passementerie_1', 'app_passementerie_1', 'ml_pass_1', 'pa_pass_1', 'pv_pass_1'] },
    { id: 'passementerie2', label: 'Passementerie 2', fields: ['passementerie_2', 'app_passementerie_2', 'ml_pass_2', 'pa_pass_2', 'pv_pass_2'] },
];

/**
 * Calcule l'état actif par défaut de chaque groupe
 * à partir du modèle de visibilité initial (initialVisibilityModel).
 * Un groupe est actif si son premier champ n'est PAS masqué dans le modèle.
 */
export function getDefaultMatieres(groups, initialVisibilityModel = {}) {
    const result = {};
    groups.forEach(g => {
        result[g.id] = initialVisibilityModel[g.fields[0]] !== false;
    });
    return result;
}
