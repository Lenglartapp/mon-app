// src/lib/constants/views.js
// ================== VUES PAR DÉFAUT ==================

export const DEFAULT_VIEWS = {
  // ÉTIQUETTES : toutes les colonnes visibles (libre)
  etiquettes: {
    rideaux: null,
    // stores classiques : pas d'étiquette, absent de cet écran
    stores_bateaux: null,
  },

  // Minutes (chiffrage)
  chiffrage: {
    minute: null,
  },

  // Minutes (vue par défaut utilisée par ChiffrageScreen → viewKey="minutes")
  minutes: {
    rideaux: [
      "sel", "detail", "zone", "piece", "produit", "type_confection",
      "l_mecanisme", "largeur", "hauteur", "hauteur_coupe_minutes",
      "pair_un", "ampleur", "a_plat", "croisement", "retour_g", "retour_d",
      "envers_visible", "double",
      "tissu_deco1", "laize_tissu_deco1", "motif_deco1", "raccord_v1", "raccord_h1",
      "ml_tissu_deco1", "pa_tissu_deco1", "pv_tissu_deco1",
      "doublure", "laize_doublure", "ml_doublure", "pa_doublure", "pv_doublure",
      "type_rail", "nom_tringle", "diametre_tringle", "supp_mecanisme",
      "pa_meca", "pv_meca",
      "heures_prepa", "pv_prepa",
      "type_pose", "heures_pose", "pv_pose",
      "heures_confection", "pv_confection",
      "livraison", "prix_unitaire", "quantite", "prix_total"
    ],
    stores: [
      "sel", "detail", "zone", "piece", "produit", "type_confection",
      "l_mecanisme", "largeur", "hauteur", "hauteur_coupe_minutes",
      "pair_un", "ampleur", "a_plat", "croisement", "retour_g", "retour_d",
      "envers_visible", "double",
      "tissu_deco1", "laize_tissu_deco1", "motif_deco1", "raccord_v1", "raccord_h1",
      "ml_tissu_deco1", "pa_tissu_deco1", "pv_tissu_deco1",
      "doublure", "laize_doublure", "ml_doublure", "pa_doublure", "pv_doublure",
      "type_rail", "nom_tringle", "diametre_tringle", "supp_mecanisme",
      "pa_meca", "pv_meca",
      "heures_prepa", "pv_prepa",
      "type_pose", "heures_pose", "pv_pose",
      "heures_confection", "pv_confection",
      "livraison", "prix_unitaire", "quantite", "prix_total"
    ],
  },

  // Minutes — vue par défaut du tableau Déplacement
  minutes_dep: {
    deplacements: [
      "type_deplacement",
      "nb_techniciens", "duree_trajet_h",
      "nb_nuits", "nb_repas",
      "transport_unitaire",
      "pose_prix", "hotel_eur", "repas_eur", "transport_eur",
      "total_eur"
    ],
  },

  // Minutes — vue par défaut du tableau Autres dépenses
  minutes_extras: {
    extras: ["categorie", "libelle", "montant_eur"],
  },

  // PRISE DE COTES
  prise: {
    rideaux: [
      "sel", "detail", "zone", "piece", "produit", "type_confection",
      "paire_ou_un_seul_pan", "largeur_mecanisme", "largeur",
      "hspf_droite", "hspf_gauche", "statut_cotes",
      "croisement", "type_croisement", "retour_gauche", "retour_droit", "type_retours",
      "type_mecanisme", "modele_mecanisme", "couleur_mecanisme",
      "meca_couvert", "type_commande",
      "piton", "embout_meca", "support", "equerre",
      "type_pose", "photos_sur_site"
    ],
    stores: [
      "detail", "zone", "piece", "produit",
      "largeur", "hauteur", "mecanisme_store",
      "statut_cotes", "quantite", "photos_sur_site"
    ],
    stores_bateaux: [
      "detail", "zone", "piece", "produit",
      "largeur", "largeur_finie",
      "ourlet_de_cote", "a_plat",
      "hauteur_finie", "statut_cotes",
      "mecanisme_store", "couleur_mecanisme", "type_commande",
      "type_moteur", "cote_manoeuvre", "methode_manoeuvre", "equerre_support",
      "valeur_intervalle", "croquis_intervalle",
      "type_pose", "photos_sur_site", "quantite"
    ],
    tenture_murale: [
      "detail", "zone", "piece", "produit",
      "largeur", "hauteur",
      "tissu_1", "laize_tissu_1", "ml_tissu_1",
      "molleton", "ml_molleton",
      "passementerie_1", "app_passementerie_1", "ml_pass_1",
      "baguette_1", "ml_baguette_1",
      "baguette_2", "ml_baguette_2",
      "schema_photo", "photos_sur_site", "quantite"
    ],
  },

  // BPF (Bon de Fabrication)
  bpf: {
    rideaux: [
      "sel", "detail", "zone", "piece", "produit", "type_confection",
      "hauteur_renfort_tete", "paire_ou_un_seul_pan", "ampleur",
      "largeur_mecanisme", "largeur", "largeur_finie", "a_plat",
      "v_ourlets_de_cotes", "hspf_droite", "hspf_gauche", "statut_cotes",
      "valeur_deduction", "finition_bas",
      "hauteur_finie_droite", "hauteur_finie_gauche",
      "hauteur_coupe", "hauteur_coupe_motif", "hauteur_coupe_doublure",
      "nombre_les", "piquage_ourlets_du_bas", "doublure_finition_bas",
      "finition_champs", "poids", "onglets", "bride",
      "type_crochets", "point_chausson",
      "tissu_deco1", "laize_tissu1", "raccord_v_tissu1", "raccord_h_tissu1",
      "tissu_deco2", "laize_tissu2", "raccord_v_tissu2", "raccord_h_tissu2",
      "doublure", "laize_doublure", "inter_doublure", "laize_inter",
      "passementerie1", "application_passementerie1",
      "passementerie2", "application_passementerie2",
      "croisement", "type_croisement", "retour_gauche", "retour_droit", "type_retours",
      "etiquette_lavage", "etiquette_lenglart", "schema",
      "type_mecanisme", "modele_mecanisme", "couleur_mecanisme", "meca_couvert",
      "nombre_glisseur",
      "heures_confection", "statut_conf",
      "schema_principe", "photos_sur_site"
    ],
    // stores classiques : absent du BPF
    stores_bateaux: [
      "detail", "zone", "piece", "produit",
      "largeur", "largeur_finie",
      "ourlet_de_cote", "a_plat",
      "hauteur_finie", "statut_cotes",
      "hauteur_coupe", "hauteur_coupe_motif", "hauteur_coupe_doublure",
      "picage_bas", "finition_chant_et_retour",
      "toile_finition_1", "raccord_v_toile_finition_1", "raccord_h_toile_finition_1", "laize_toile_finition_1",
      "doublure", "laize_doublure",
      "etiquette_lavage",
      "mecanisme_store", "couleur_mecanisme", "type_commande",
      "type_moteur", "cote_manoeuvre", "methode_manoeuvre", "equerre_support",
      "nombre_anneaux_largeur", "deportation_premier_anneau",
      "valeur_velcro", "nombre_intervalles", "valeur_intervalle",
      "croquis_intervalle",
      "barre_de_charge", "longueur_barre_de_charge",
      "longueur_tigette", "nombre_de_tigettes",
      "type_pose",
      "heures_confection", "statut_prepa", "statut_conf", "statut_pose",
      "photos_sur_site", "quantite"
    ],
    coussins: [
      "detail", "zone", "piece", "produit",
      "realise_par", "nom_sous_traitant",
      "largeur", "hauteur", "epaisseur",
      "largeur_coupe", "hauteur_coupe",
      "tissu_1", "laize_tissu_1", "ml_tissu_1",
      "tissu_2", "laize_tissu_2", "ml_tissu_2",
      "type_interieur",
      "passementerie_1", "app_passementerie_1", "ml_pass_1",
      "passementerie_2", "app_passementerie_2", "ml_pass_2",
      "heures_confection", "schema_photo", "quantite"
    ],
    cache_sommier: [
      "detail", "zone", "piece", "produit",
      "realise_par", "nom_sous_traitant", "type_confection",
      "largeur", "longueur", "longueur_coupe", "hauteur",
      "ourlet_bas", "a_plat",
      "tissu_1", "laize_tissu_1", "ml_tissu_1",
      "tissu_2", "laize_tissu_2", "ml_tissu_2",
      "passementerie_1", "app_passementerie_1", "ml_pass_1",
      "largeur_satinette", "longueur_satinette",
      "nb_plis_dior", "finition_plis_dior", "doublure",
      "heures_confection", "schema_photo", "quantite"
    ],
    plaid: [
      "detail", "zone", "piece", "produit",
      "realise_par", "nom_sous_traitant",
      "largeur", "hauteur", "largeur_coupe", "hauteur_coupe",
      "tissu_1", "laize_tissu_1", "ml_tissu_1",
      "tissu_2", "laize_tissu_2", "ml_tissu_2",
      "molleton", "laize_molleton", "ml_molleton",
      "passementerie_1", "app_passementerie_1", "ml_pass_1",
      "passementerie_2", "app_passementerie_2", "ml_pass_2",
      "heures_confection", "schema_photo", "quantite"
    ],
    mobilier: [
      "detail", "zone", "piece", "produit",
      "realise_par", "nom_sous_traitant",
      "largeur", "hauteur", "epaisseur",
      "tissu_1", "laize_tissu_1", "ml_tissu_1",
      "tissu_2", "laize_tissu_2", "ml_tissu_2",
      "passementerie_1", "app_passementerie_1", "ml_pass_1",
      "passementerie_2", "app_passementerie_2", "ml_pass_2",
      "molleton", "laize_molleton", "ml_molleton",
      "heures_confection", "schema_photo", "quantite"
    ],
    tenture_murale: [
      "detail", "zone", "piece", "produit",
      "largeur", "hauteur", "largeur_coupe", "hauteur_coupe",
      "tissu_1", "laize_tissu_1", "ml_tissu_1",
      "molleton", "ml_molleton",
      "passementerie_1", "app_passementerie_1", "ml_pass_1",
      "baguette_1", "ml_baguette_1",
      "baguette_2", "ml_baguette_2",
      "heures_confection", "schema_photo", "quantite"
    ],
  },

  // BPP (Bon de Préparation)
  bpp: {
    rideaux: [
      "sel", "detail", "zone", "piece", "produit", "type_confection",
      "paire_ou_un_seul_pan", "largeur_mecanisme", "largeur",
      "statut_cotes", "type_crochets",
      "croisement", "type_croisement", "retour_gauche", "retour_droit", "type_retours",
      "type_mecanisme", "modele_mecanisme", "couleur_mecanisme",
      "meca_couvert", "type_commande",
      "nombre_glisseur", "couleur_glisseur",
      "piton", "embout_meca", "support", "equerre",
      "type_pose", "statut_prepa"
    ],
    stores: [
      "detail", "zone", "piece", "produit",
      "largeur", "hauteur", "mecanisme_store",
      "statut_cotes", "statut_prepa", "quantite"
    ],
    stores_bateaux: null, // tout visible
    tenture_murale: [
      "detail", "zone", "piece", "produit",
      "largeur", "hauteur",
      "baguette_1", "ml_baguette_1",
      "baguette_2", "ml_baguette_2",
      "schema_photo", "quantite"
    ],
    mobilier: [
      "detail", "zone", "piece", "produit",
      "mecanisme_fourniture",
      "schema_photo", "quantite"
    ],
  },

  // SUIVI DE PROJET (grille unifiée toutes catégories)
  suivi: {
    all: [
      "sel", "detail", "zone", "piece", "produit",
      "statut_cotes", "statut_prepa", "statut_conf", "statut_pose",
      "photos_sur_site",
    ],
  },
};

// ================== ETAPES / STAGES POUR L'ECRAN PRODUCTION ==================

export const STAGES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "prise", label: "Prise de cotes" },
  { key: "bpf", label: "BPF" },
  { key: "bpp", label: "BPP" },
  { key: "etiquettes", label: "Étiquettes" },
  { key: "suivi", label: "Suivi de projet" },
];