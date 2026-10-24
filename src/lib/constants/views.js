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
      "paire_ou_un_seul_pan", "largeur_gorge", "profondeur_gorge", "largeur_mecanisme", "largeur",
      "hspf_droite", "hspf_milieu", "hspf_gauche", "statut_cotes",
      "croisement", "type_croisement", "patte_de_croisement", "retour_gauche", "retour_droit", "type_retours",
      "hauteur_corniere_elastique",
      "type_mecanisme", "modele_mecanisme", "couleur_mecanisme",
      "meca_couvert", "cache_moteur", "type_commande",
      "piton", "embout_meca", "support", "equerre",
      "type_pose", "photos_sur_site"
    ],
    stores: [
      "detail", "zone", "piece", "produit",
      "largeur", "hauteur", "tailles_lames", "largeur_gorge", "profondeur_gorge",
      "mecanisme_store", "cote_manoeuvre", "hauteur_manoeuvre",
      "type_pose", "guidage_coulisse",
      "statut_cotes", "quantite", "photos_sur_site"
    ],
    stores_bateaux: [
      "detail", "zone", "piece", "produit",
      "largeur", "largeur_finie",
      "ourlet_de_cote", "a_plat",
      "hauteur_finie", "statut_cotes",
      "largeur_gorge", "profondeur_gorge",
      "espace_ouverture_fenetre",
      "mecanisme_store", "couleur_mecanisme", "type_commande",
      "type_moteur", "cote_manoeuvre", "methode_manoeuvre", "equerre_support",
      "valeur_intervalle", "croquis_intervalle",
      "guidage", "cable_intermediaire",
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
    // Oct. 2026 : listes ORDONNÉES et EXHAUSTIVES (toute colonne absente est masquée).
    rideaux: [
      "sel", "detail", "zone", "photos_sur_site", "piece", "produit", "paire_ou_un_seul_pan",
      "commentaire_confection", "type_confection", "type_crochets", "hauteur_renfort_tete",
      "ampleur", "tissu_deco1", "doublure", "finition_bas", "piquage_ourlets_du_bas",
      "piquage_ourlet", "onglets", "poids", "bride", "v_ourlets_de_cotes", "finition_oc",
      "finition_champs", "finition_retour", "point_chausson", "piquage_ourlets_bas_doublure",
      "doublure_finition_bas", "deduction_doublure", "type_mecanisme", "modele_mecanisme",
      "meca_couvert", "cache_moteur", "valeur_deduction", "largeur_mecanisme", "largeur",
      "croisement", "type_croisement", "largeur_finie", "retour_gauche", "retour_droit",
      "type_retours", "hauteur_corniere_elastique", "a_plat", "laize_tissu1", "nombre_les",
      "reste_les", "piquage_raccord", "nombre_glisseur", "nb_crochets_par_pan", "hspf_gauche",
      "hspf_milieu", "hspf_droite", "statut_cotes", "hauteur_finie_gauche",
      "hauteur_finie_milieu", "hauteur_finie_droite", "hauteur_coupe", "hauteur_coupe_motif",
      "ml_tissu1", "hauteur_coupe_doublure", "ml_doublure", "embrasse", "schema_principe",
      "etiquette_lenglart", "etiquette_lavage", "emballage"
    ],
    // stores classiques : absent du BPF
    stores_bateaux: [
      "sel", "detail", "zone", "photos_sur_site", "piece", "produit", "type_store_bateau",
      "quantite", "toile_finition_1", "laize_toile_finition_1", "ml_toile_finition_1",
      "cas_coupe_toile", "doublure", "laize_doublure", "ml_doublure", "cas_coupe_doublure",
      "mecanisme_store", "largeur", "cote_manoeuvre", "largeur_finie", "ourlet_de_cote",
      "finition_oc", "a_plat", "hauteur_finie", "hauteur_coupe", "hauteur_coupe_motif",
      "hauteur_coupe_doublure", "finition_chant_et_retour", "barre_de_charge", "valeur_velcro",
      "guidage", "nombre_anneaux_largeur", "deportation_premier_anneau", "nombre_intervalles",
      "valeur_intervalle", "surplus_fourreau", "longueur_barre_de_charge",
      "nombre_de_tigettes", "longueur_tigette", "croquis_intervalle", "commentaire_confection",
      "etiquette_lavage"
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
    // Oct. 2026 : listes ORDONNÉES et EXHAUSTIVES (toute colonne absente est masquée).
    rideaux: [
      "sel", "detail", "zone", "piece", "statut_cotes", "type_mecanisme", "modele_mecanisme",
      "largeur_mecanisme", "largeur_finie", "couleur_mecanisme", "type_confection",
      "type_pose", "support", "equerre", "paire_ou_un_seul_pan", "nombre_glisseur",
      "couleur_glisseur", "type_crochets", "nb_crochets_par_pan", "croisement",
      "type_croisement", "patte_de_croisement", "retour_gauche", "retour_droit",
      "type_retours", "hauteur_corniere_elastique", "cache_moteur", "largeur_gorge",
      "profondeur_gorge", "type_commande", "piton", "embout_meca"
    ],
    stores: [
      "sel", "detail", "zone", "piece", "statut_cotes", "produit", "quantite",
      "mecanisme_store", "type_commande", "cote_manoeuvre", "largeur", "hauteur",
      "hauteur_manoeuvre", "type_pose", "guidage_coulisse", "largeur_gorge",
      "profondeur_gorge", "photos_sur_site"
    ],
    stores_bateaux: [
      "sel", "detail", "zone", "piece", "statut_cotes", "produit", "type_store_bateau",
      "quantite", "largeur", "hauteur_finie", "methode_manoeuvre", "cote_manoeuvre",
      "nombre_de_tigettes", "longueur_tigette", "barre_de_charge", "longueur_barre_de_charge",
      "nombre_anneaux_largeur", "deportation_premier_anneau", "guidage", "type_pose",
      "equerre_support", "cable_intermediaire", "couleur_mecanisme", "largeur_gorge",
      "profondeur_gorge", "espace_ouverture_fenetre"
    ],
    tenture_murale: [
      "detail", "zone", "piece", "produit",
      "largeur", "hauteur",
      "baguette_1", "ml_baguette_1",
      "baguette_2", "ml_baguette_2",
      "heures_prepa", "schema_photo", "quantite"
    ],
    mobilier: [
      "detail", "zone", "piece", "produit",
      "mecanisme_fourniture", "heures_prepa",
      "schema_photo", "quantite"
    ],
  },

  // SUIVI DE PROJET (grille unifiée toutes catégories)
  suivi: {
    all: [
      "sel", "detail", "zone", "piece", "fenetre", "produit",
      "statut_cotes", "statut_prepa", "statut_conf", "statut_pose",
      "photos_sur_site", "commentaire_client",
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