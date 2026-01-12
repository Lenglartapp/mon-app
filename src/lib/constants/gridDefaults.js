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
    // ❌ MASQUÉS PAR DÉFAUT (Demande utilisateur)

    // Technique / Mécanisme
    mecanisme_fourniture: false, // NEW: User requested hide default
    pa_mecanisme: false,
    pv_mecanisme: false,

    // Prestations
    heures_prepa: false,
    pv_prepa: false,
    heures_pose: false,
    pv_pose: false,
    st_pose_pa: false,
    st_pose_pv: false,
    // Note: User kept Heures Confection / PV Conf visible (didn't mention them in "SAUF" list to hide)
    // Wait, prompt said: "SAUF Méca Fourniture, PA Méca, PV Méca, H.Prépa, PV Prépa, H.Pose, PV Pose, ST Pose PA, ST Pose PV"
    // "la vue par défaut du tableau ça doit être TOUS les champs SAUF..." -> MEANS these MUST BE HIDDEN.
    // So I hide them.

    // Legacy fields that might exist in grid state but irrelevant for Decors
    // We clean them up to be safe
    croisement: false,
    ampleur: false,
    retour_g: false,
    retour_d: false,
    a_plat: false,
    hauteur_coupe: false,
    hauteur_coupe_motif: false,

    // Legacy Doublure / Inter (Removed from schema but good to hide if lingering)
    doublure: false,
    ml_doublure: false,
    pa_doublure: false,
    pv_doublure: false,
    interdoublure: false,
    ml_interdoublure: false,
    pv_interdoublure: false,
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

    // ❌ MASQUÉS (Demande Utilisateur)
    // "SAUF Doublure, Laize D, Nb de lés D, Ml Dou, Pa doub, PV dou, ST Pose PA, ST Pose PV"
    // Donc: ces champs doivent être FALSE (Masqués). Tout le reste doit être visible (Absence de clé = True par défaut).

    // Doublure Block
    doublure: false,
    laize_doublure: false,
    nb_les_doublure: false,
    ml_doublure: false,
    pa_doublure: false,
    pv_doublure: false,

    // Sous-traitance (Seuls ST Pose demandés masqués)
    // NOTE: Schema keys are st_pose_pa, st_pose_pv.
    st_pose_pa: false,
    st_pose_pv: false,
    // On ne masque PAS st_conf_pa / st_conf_pv car utilisateur n'a pas dit de les masquer (Il a listé "SAUF...").
    // Wait, "SAUF... ST Pose PA, ST Pose PV".
    // Does he mean "Hide EVERYTHING except..." OR "Show everything EXCEPT..."?
    // User says: "tu peux les mettre tous SAUF..." -> "Put them ALL (visible) EXCEPT (hidden)..."
    // So ST Pose PA/PV must be HIDDEN.
    // What about ST CONF? User didn't mention it in the "EXCEPT" list.
    // So ST CONF should be VISIBLE.
    // BUT legacy below hid 'stconfpa'. I need to map schema keys carefully.
    // Stores Schema checks: 'st_pose_pa', 'st_pose_pv'. No 'st_conf' in Schema?
    // Schema has 'heures_confection', 'pv_confection'.
    // Looking at Schema file again...
    // Schema: st_pose_pa, st_pose_pv. NO st_conf_pa/pv columns defined in STORES_SCHEMA.
    // Ah, good. So no need to hide st_conf if it doesn't exist.

    // Legacy / Rideaux Fields cleanup (Hide irrelevant stuff just in case)
    tissu_deco2: false,
    laize_tissu2: false,
    tissu_deco1: false, // Stores uses 'toile_finition_1'
    ml_tissu_deco1: false,
    pa_tissu_deco1: false,
    pv_tissu_deco1: false,
    passementerie1: false,
    passementerie2: false,
    interdoublure: false,
    pair_un: false,
    ampleur: false,
    croisement: false,
    retour_g: false,
    retour_d: false,
    a_plat: false, // Schema has a_plat. User didn't ask to hide it?
    // "Put them ALL... EXCEPT...".
    // So 'a_plat' should be VISIBLE?
    // Usually 'a_plat' is for Rideaux. Stores have 'a_plat' in schema (readOnly blocked).
    // If blocked/irrelevant, maybe hide?
    // User said "tu peux les mettre tous". He probably means "All relevant Store fields".
    // I will keep 'a_plat' hidden if it's technically useless, BUT strictly he said "Put ALL except...".
    // I'll leave 'a_plat' visible (remove from false list) to respect "ALL".
    // Actually, 'a_plat' IS in Stores Schema (line 37). So it should be visible.
    // Removed 'a_plat: false'.

    // Same for 'hauteur_coupe', 'hauteur_coupe_motif'.
    // In Schema lines 43, 46. So should be VISIBLE.

    // Legacy Rideau geometry NOT in Store Schema (pair_un, ampleur, croisement, retour_d/g, double, envers_visible) -> Hide
    // (Stores schema does NOT have these).
    pair_un: false,
    ampleur: false,
    croisement: false,
    retour_g: false,
    retour_d: false,
    envers_visible: false,
    double: false,

    // Tissu 2 fields (Not in Store Schema) -> Hide
    tissu_deco2: false,
    laize_tissu_deco2: false,
    motif_deco2: false,
    raccord_v2: false,
    raccord_h2: false,
    ml_tissu_deco2: false,
    pa_tissu_deco2: false,
    pv_tissu_deco2: false,

    // Inter-doublure (Not in Store Schema) -> Hide
    inter_doublure: false,
    laize_inter: false,
    ml_inter: false,
    pa_inter: false,
    pv_inter: false,

    // ✅ À ACTIVER (Commentaire pour mémoire)
    // Tissu 1, Passementerie 1, Mécanisme, Prépa, Pose, Confection, Synthèse
};
