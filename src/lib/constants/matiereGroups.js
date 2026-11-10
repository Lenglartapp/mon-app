// src/lib/constants/matiereGroups.js
// Groupes de matières par type de grille.
// Chaque groupe = { id, label, fields[] }
// fields[] = liste des clés de colonnes qui composent ce bloc matière.
// L'ordre des groupes détermine l'ordre d'affichage dans le bouton Matières.

// Groupes matière côté PRODUCTION (BPF rideaux). Contrairement au chiffrage, pas de
// colonnes de prix (PA/PV) : à la place, chaque matière embarque ses cotes propres —
// hauteur de coupe et appiècement (qui existent en version T1 / T2 / doublure / inter).
// Les finitions de doublure (déduction, piquage bas, doubl. fin. bas) restent hors du
// groupe : ce sont des détails de confection, pas la matière elle-même.
export const RIDEAUX_PROD_MATIERE_GROUPS = [
    { id: 'tissu1',         label: 'Tissu 1',         fields: ['tissu_deco1', 'laize_tissu1', 'raccord_v_tissu1', 'raccord_h_tissu1', 'hauteur_coupe', 'nb_raccords_motifs', 'hauteur_coupe_motif', 'ml_tissu1', 'reste_les'] },
    { id: 'tissu2',         label: 'Tissu 2',         fields: ['tissu_deco2', 'laize_tissu2', 'raccord_v_tissu2', 'raccord_h_tissu2', 'hauteur_coupe_t2', 'nb_raccords_motifs_t2', 'hauteur_coupe_motif_t2', 'ml_tissu2', 'reste_les_t2'] },
    { id: 'doublure',       label: 'Doublure',        fields: ['doublure', 'laize_doublure', 'hauteur_coupe_doublure', 'ml_doublure', 'reste_les_doublure'] },
    { id: 'interdoublure',  label: 'Interdoublure',   fields: ['inter_doublure', 'laize_inter', 'hauteur_coupe_inter', 'ml_inter_doublure', 'reste_les_inter'] },
    { id: 'passementerie1', label: 'Passementerie 1', fields: ['passementerie1', 'application_passementerie1', 'ml_pass1'] },
    { id: 'passementerie2', label: 'Passementerie 2', fields: ['passementerie2', 'application_passementerie2', 'ml_pass2'] },
    { id: 'embrasse',       label: 'Embrasse',        fields: ['embrasse'] },
];

export const RIDEAUX_MATIERE_GROUPS = [
    { id: 'tissu1',         label: 'Tissu 1',         fields: ['tissu_deco1', 'laize_tissu1', 'raccord_v_tissu1', 'raccord_h_tissu1', 'nb_les_tissu1', 'ml_tissu1', 'pa_tissu1', 'pv_tissu1'] },
    { id: 'tissu2',         label: 'Tissu 2',         fields: ['tissu_deco2', 'laize_tissu2', 'raccord_v_tissu2', 'raccord_h_tissu2', 'nb_les_tissu2', 'ml_tissu2', 'pa_tissu2', 'pv_tissu2'] },
    { id: 'doublure',       label: 'Doublure',        fields: ['doublure', 'laize_doublure', 'nb_les_doublure', 'ml_doublure', 'pa_doublure', 'pv_doublure'] },
    { id: 'interdoublure',  label: 'Interdoublure',   fields: ['interdoublure', 'laize_interdoublure', 'nb_les_interdoublure', 'ml_interdoublure', 'pa_interdoublure', 'pv_interdoublure'] },
    { id: 'passementerie1', label: 'Passementerie 1', fields: ['passementerie1', 'application_passementerie1', 'ml_pass1', 'pa_pass1', 'pv_pass1'] },
    { id: 'passementerie2', label: 'Passementerie 2', fields: ['passementerie2', 'application_passementerie2', 'ml_pass2', 'pa_pass2', 'pv_pass2'] },
    { id: 'embrasse',       label: 'Embrasse',        fields: ['embrasse', 'pa_embrasse', 'pv_embrasse'] },
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
    // (pas de Passementerie 2 : le tableau Cache-sommier n'a pas ces colonnes)
];

export const PLAID_MATIERE_GROUPS = [
    { id: 'tissu1',         label: 'Tissu 1',         fields: ['tissu_1', 'laize_tissu_1', 'ml_tissu_1', 'pa_tissu_1', 'pv_tissu_1'] },
    { id: 'tissu2',         label: 'Tissu 2',         fields: ['tissu_2', 'laize_tissu_2', 'ml_tissu_2', 'pa_tissu_2', 'pv_tissu_2'] },
    { id: 'molleton',       label: 'Molleton',        fields: ['molleton', 'laize_molleton', 'ml_molleton', 'pa_molleton', 'pv_molleton'] },
    { id: 'passementerie1', label: 'Passementerie 1', fields: ['passementerie_1', 'app_passementerie_1', 'ml_pass_1', 'pa_pass_1', 'pv_pass_1'] },
    { id: 'passementerie2', label: 'Passementerie 2', fields: ['passementerie_2', 'app_passementerie_2', 'ml_pass_2', 'pa_pass_2', 'pv_pass_2'] },
];

// Mobilier / tête de lit et tenture murale : pas de bouton Matières pour l'instant, mais ces
// groupes servent à la règle « tissu retiré → infos vidées » (cf. utils/matiereClear.js).
export const MOBILIER_MATIERE_GROUPS = [
    { id: 'tissu1',         label: 'Tissu 1',         fields: ['tissu_1', 'laize_tissu_1', 'ml_tissu_1', 'pa_tissu_1', 'pv_tissu_1'] },
    { id: 'tissu2',         label: 'Tissu 2',         fields: ['tissu_2', 'laize_tissu_2', 'ml_tissu_2', 'pa_tissu_2', 'pv_tissu_2'] },
    { id: 'molleton',       label: 'Molleton',        fields: ['molleton', 'laize_molleton', 'ml_molleton', 'pa_molleton', 'pv_molleton'] },
    { id: 'passementerie1', label: 'Passementerie 1', fields: ['passementerie_1', 'app_passementerie_1', 'ml_pass_1', 'pa_pass_1', 'pv_pass_1'] },
    { id: 'passementerie2', label: 'Passementerie 2', fields: ['passementerie_2', 'app_passementerie_2', 'ml_pass_2', 'pa_pass_2', 'pv_pass_2'] },
];

export const TENTURE_MURALE_MATIERE_GROUPS = [
    { id: 'tissu1',         label: 'Tissu 1',         fields: ['tissu_1', 'laize_tissu_1', 'ml_tissu_1', 'pa_tissu_1', 'pv_tissu_1'] },
    { id: 'molleton',       label: 'Molleton',        fields: ['molleton', 'ml_molleton', 'pa_molleton', 'pv_molleton'] },
    { id: 'passementerie1', label: 'Passementerie 1', fields: ['passementerie_1', 'app_passementerie_1', 'ml_pass_1', 'pa_pass_1', 'pv_pass_1'] },
];

// Tous les groupes matière, production et chiffrage confondus. Le 1er champ d'un groupe est
// le nom de la matière ; les suivants sont ses informations liées.
export const ALL_MATIERE_GROUPS = [
    ...RIDEAUX_PROD_MATIERE_GROUPS, ...RIDEAUX_MATIERE_GROUPS, ...STORES_BATEAUX_MATIERE_GROUPS,
    ...COUSSINS_MATIERE_GROUPS, ...CACHE_SOMMIER_MATIERE_GROUPS, ...PLAID_MATIERE_GROUPS,
    ...MOBILIER_MATIERE_GROUPS, ...TENTURE_MURALE_MATIERE_GROUPS,
];

// Remplissage depuis le catalogue quand on CHOISIT une matière : nom → colonnes à remplir
// (laize, raccords V / H, PA, PV). Seules les colonnes présentes dans le tableau sont écrites.
export const CATALOG_FILL = {
    tissu_deco1:      { laize: 'laize_tissu1', rv: 'raccord_v_tissu1', rh: 'raccord_h_tissu1', pa: 'pa_tissu1', pv: 'pv_tissu1' },
    tissu_deco2:      { laize: 'laize_tissu2', rv: 'raccord_v_tissu2', rh: 'raccord_h_tissu2', pa: 'pa_tissu2', pv: 'pv_tissu2' },
    tissu_1:          { laize: 'laize_tissu_1', pa: 'pa_tissu_1', pv: 'pv_tissu_1' },
    tissu_2:          { laize: 'laize_tissu_2', pa: 'pa_tissu_2', pv: 'pv_tissu_2' },
    toile_finition_1: { laize: 'laize_toile_finition_1', rv: 'raccord_v_toile_finition_1', rh: 'raccord_h_toile_finition_1', pa: 'pa_toile_finition_1', pv: 'pv_toile_finition_1' },
    doublure:         { laize: 'laize_doublure', pa: 'pa_doublure', pv: 'pv_doublure' },
    interdoublure:    { laize: 'laize_interdoublure', pa: 'pa_interdoublure', pv: 'pv_interdoublure' },
    inter_doublure:   { laize: 'laize_inter', pa: 'pa_inter', pv: 'pv_inter' },
    passementerie1:   { pa: 'pa_pass1', pv: 'pv_pass1' },
    passementerie_1:  { pa: 'pa_pass_1', pv: 'pv_pass_1' },
    passementerie2:   { pa: 'pa_pass2', pv: 'pv_pass2' },
    passementerie_2:  { pa: 'pa_pass_2', pv: 'pv_pass_2' },
};

// Groupes mécanisme pour la grille Rideaux (bouton Configuration)
export const RIDEAUX_MECA_GROUPS = [
    { id: 'meca',     label: 'Méca',     fields: ['type_mecanisme', 'modele_mecanisme', 'pa_mecanisme', 'pv_mecanisme'] },
    { id: 'meca_bis', label: 'Méca Bis', fields: ['mecanisme_bis', 'pa_mecanisme_bis', 'pv_mecanisme_bis'] },
];

// Groupes détail confection pour la grille Rideaux (bouton Configuration)
export const RIDEAUX_CONF_GROUPS = [
    { id: 'croisement', label: 'Croisement', fields: ['croisement'] },
    { id: 'retour_g',   label: 'Retour G',   fields: ['retour_gauche'] },
    { id: 'retour_d',   label: 'Retour D',   fields: ['retour_droit'] },
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
