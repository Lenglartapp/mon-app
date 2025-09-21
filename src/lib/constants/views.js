// src/lib/constants/views.js
// ================== VUES PAR DÉFAUT ==================

export const DEFAULT_VIEWS = {
  // 1) BPF : on garde TOUT (pas de présélection → on retombe sur tout le schéma)
  //    Astuce : on met null pour forcer le fallback "toutes les colonnes du schema".
  bpf: {
    rideaux: null,
    decors:  null,
    stores:  null,
  },

  // 2) ÉTIQUETTES : on garde TOUT également (la sélection des champs reste libre),
  //    mais on va piloter la mise en page via ETIQUETTES_DEFAULTS ci-dessous.
  etiquettes: {
    rideaux: null,
    stores:  null,
  },

  // Minutes
  chiffrage: {
    minute: null, // null → “toutes les colonnes du schéma chiffrage”
  },

  // Minutes (vue par défaut utilisée par ChiffrageScreen → viewKey="minutes")
  minutes: {
    rideaux: [
      "sel","detail","zone","piece","produit","type_confection",
      "l_mecanisme","largeur","hauteur","hauteur_coupe_minutes",
      "pair_un","ampleur","a_plat","croisement","retour_g","retour_d",
      "envers_visible","double",
      "tissu_deco1","laize_tissu_deco1","motif_deco1","raccord_v1","raccord_h1",
      "ml_tissu_deco1","pa_tissu_deco1","pv_tissu_deco1",
      "doublure","laize_doublure","ml_doublure","pa_doublure","pv_doublure",
      "type_rail","nom_tringle","diametre_tringle","supp_mecanisme",
      "pa_meca","pv_meca",
      "heures_prepa","pv_prepa",
      "type_pose","heures_pose","pv_pose",
      "heures_confection","pv_confection",
      "livraison","prix_unitaire","quantite","prix_total"
    ],
    decors: [
      "sel","detail","zone","piece","produit","type_confection",
      "l_mecanisme","largeur","hauteur","hauteur_coupe_minutes",
      "pair_un","ampleur","a_plat","croisement","retour_g","retour_d",
      "envers_visible","double",
      "tissu_deco1","laize_tissu_deco1","motif_deco1","raccord_v1","raccord_h1",
      "ml_tissu_deco1","pa_tissu_deco1","pv_tissu_deco1",
      "doublure","laize_doublure","ml_doublure","pa_doublure","pv_doublure",
      "type_rail","nom_tringle","diametre_tringle","supp_mecanisme",
      "pa_meca","pv_meca",
      "heures_prepa","pv_prepa",
      "type_pose","heures_pose","pv_pose",
      "heures_confection","pv_confection",
      "livraison","prix_unitaire","quantite","prix_total"
    ],
    stores: [
      "sel","detail","zone","piece","produit","type_confection",
      "l_mecanisme","largeur","hauteur","hauteur_coupe_minutes",
      "pair_un","ampleur","a_plat","croisement","retour_g","retour_d",
      "envers_visible","double",
      "tissu_deco1","laize_tissu_deco1","motif_deco1","raccord_v1","raccord_h1",
      "ml_tissu_deco1","pa_tissu_deco1","pv_tissu_deco1",
      "doublure","laize_doublure","ml_doublure","pa_doublure","pv_doublure",
      "type_rail","nom_tringle","diametre_tringle","supp_mecanisme",
      "pa_meca","pv_meca",
      "heures_prepa","pv_prepa",
      "type_pose","heures_pose","pv_pose",
      "heures_confection","pv_confection",
      "livraison","prix_unitaire","quantite","prix_total"
    ],
  },

  // 3) PRISE DE COTES : 2 tableaux (rideaux / stores) avec la présélection demandée
  prise: {
    rideaux: [
      "sel","detail","zone","piece","produit","type_confection","pair_un","ampleur",
      "l_mecanisme","largeur","hauteur","statut_cotes",
      "f_bas","croisement","retour_g","retour_d",
      "envers_visible","type_rail","couleur_rail",
      "nom_tringle","diametre_tringle",
      "couv_mecanisme","supp_mecanisme","type_pose",
      "photo"
    ],
    stores: [
      "sel","detail","zone","piece","produit","type_confection","pair_un","ampleur",
      "l_mecanisme","largeur","hauteur","statut_cotes",
      "f_bas","croisement","retour_g","retour_d",
      "envers_visible","type_rail","couleur_rail",
      "nom_tringle","diametre_tringle",
      "couv_mecanisme","supp_mecanisme","type_pose",
      "photo"
    ],
  },

  // Minutes — vue par défaut du tableau Déplacement
  minutes_dep: {
    deplacements: [
      "type_deplacement",
      "nb_techniciens", "duree_trajet_h",
      "nb_nuits", "nb_repas",
      // paramètres masqués par défaut → on NE LES MET PAS dans la liste
      // "tauxhoraire", "prixhotel", "prixrepas",
      "transport_unitaire",
      "pose_prix", "hotel_eur", "repas_eur", "transport_eur",
      "total_eur"
    ],
  },

  // 4) INSTALLATION : tableau unique “all/suivi” avec ta présélection
  installation: {
    all: [
      "sel","detail","zone","piece","produit",
      "statut_cotes","statut_preparation","statut_confection","statut_pose",
      "commentaire_confection",
      "photo"
    ],
  },
};