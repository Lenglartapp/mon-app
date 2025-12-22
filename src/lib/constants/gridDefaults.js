export const RIDEAUX_DEFAULT_VISIBILITY = {
    // Tissu 2
    tissu_deco2: false,
    laize_tissu2: false,
    raccord_v_tissu2: false,
    raccord_h_tissu2: false,
    ml_tissu2: false,
    pa_tissu2: false,
    pv_tissu2: false,

    // Inter-doublure
    interdoublure: false,
    laize_interdoublure: false,
    nb_les_interdoublure: false,
    ml_interdoublure: false,
    pa_interdoublure: false,
    pv_interdoublure: false,

    // Passementerie 1
    passementerie1: false,
    application_passementerie1: false,
    ml_pass1: false,
    pa_pass1: false,
    pv_pass1: false,

    // Passementerie 2
    passementerie2: false,
    application_passementerie2: false,
    ml_pass2: false,
    pa_pass2: false,
    pv_pass2: false,

    // Sous-traitance
    st_pose_pa: false,
    st_pose_pv: false,
    st_conf_pa: false,
    st_conf_pv: false
};

export const DECORS_DEFAULT_VISIBILITY = {
    // ❌ À DÉSACTIVER (Visible = false)

    // Géométrie Rideau
    pair_un: false,
    ampleur: false,
    l_mecanisme: false,
    hauteur_coupe_minutes: false,
    a_plat: false,
    croisement: false,
    retour_g: false,
    retour_d: false,
    envers_visible: false,
    double: false,

    // Structure (Doublure / Inter) - TOUT le bloc doublure/inter masqué
    doublure: false,
    laize_doublure: false,
    ml_doublure: false,
    pa_doublure: false,
    pv_doublure: false,

    inter_doublure: false,
    laize_inter: false,
    ml_inter: false,
    pa_inter: false,
    pv_inter: false,

    // Mécanisme - TOUT le bloc masqué
    type_mecanisme: false,
    modele_mecanisme: false,
    dim_mecanisme: false,
    pa_mecanisme: false,
    pv_mecanisme: false,

    // Pose / Prépa (Masqué selon demande)
    heures_prepa: false,
    pv_prepa: false,
    type_pose: false,
    heures_pose: false,
    pv_pose: false,
    stpausepa: false, // ST Pose masqué
    stpausepv: false,

    // Confection Interne (Masqué selon demande utilisateur)
    heures_confection: false,
    pv_confection: false,

    // ✅ À ACTIVER (Visible = true, implicite par défaut si absent du modèle, mais je note ici pour ceux qui étaient cachés avant)
    // Tissu 2 (COMPLET) -> Doit être visible. Si RIDEAUX cachait par défaut, il faut s'assurer qu'ici c'est visible.
    // Par défaut DataGrid affiche tout sauf si précisé false.
    // Donc on ne met RIEN pour les colonnes qu'on veut VOIR (Tissu 2, Passementerie, etc).
    // SAUF si elles sont masquées par défaut CSS ou autre, mais ici c'est visibilityModel.
    // Le modèle n'a que des clés 'false' pour masquer.

    // Sous-Traitance Confection (Visible)
    stconfpv: true
};

export const STORES_DEFAULT_VISIBILITY = {
    // ❌ À DÉSACTIVER (Visible = false)

    // Géométrie Rideau
    pair_un: false,
    ampleur: false,
    hauteur_coupe_minutes: false,
    a_plat: false,
    croisement: false,
    retour_g: false,
    retour_d: false,
    envers_visible: false,
    double: false,

    // Matières Secondaires (Tissu 2) - Tout Masqué
    tissu_deco2: false,
    laize_tissu_deco2: false,
    motif_deco2: false,
    raccord_v2: false,
    raccord_h2: false,
    ml_tissu_deco2: false,
    pa_tissu_deco2: false,
    pv_tissu_deco2: false,

    // Autres fournitures (Passementerie 2, Doublure, Inter)
    passementerie2: false,
    app_passementerie2: false,
    ml_passementerie2: false,
    pa_passementerie2: false,

    doublure: false,
    laize_doublure: false,
    ml_doublure: false,
    pa_doublure: false,
    pv_doublure: false,

    inter_doublure: false,
    laize_inter: false,
    ml_inter: false,
    pa_inter: false,
    pv_inter: false,

    // Sous-traitance (Ni Pose ni Conf demandées par défaut pour Stores)
    stpausepa: false,
    stpausepv: false,
    stconfpa: false,
    stconfpv: false,

    // ✅ À ACTIVER (Commentaire pour mémoire)
    // Tissu 1, Passementerie 1, Mécanisme, Prépa, Pose, Confection, Synthèse
};
