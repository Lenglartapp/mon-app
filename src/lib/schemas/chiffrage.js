// src/lib/schemas/chiffrage.js
// Schéma STRICT pour l'éditeur de minutes (Rideaux)
// Basé sur la "Matrice de Champs" utilisateur (Ordre 1 à 75)

export const CHIFFRAGE_SCHEMA = [
  // 1 = Checkbox (Native DataGrid)
  // 2 = Actions (Détail)
  { key: "detail", label: "Détail", type: "button", width: 90 },

  // 3
  { key: "zone", label: "Zone", type: "text", width: 100 },
  // 4
  { key: "piece", label: "Pièce", type: "text", width: 100 },
  // 5
  { key: "produit", label: "Produit", type: "select", options: ["Rideau", "Voilage"], width: 140 },
  // 6
  { key: "type_confection", label: "Confection", type: "select", options: ["Pli Flamand", "Plis Creux", "Pli Plat", "Tripli", "Wave 80", "Wave 60", "Pli Couteau", "A Plat"], width: 140 },
  // 7
  { key: "paire_ou_un_seul_pan", label: "Format", type: "select", options: ["Paire", "Un seul pan"], width: 120 },
  // 8
  { key: "ampleur", label: "Ampleur", type: "number", precision: 2, width: 80 },
  // 9
  { key: "largeur_mecanisme", label: "L. Méca", type: "number", width: 100 },
  // 10
  { key: "largeur", label: "Largeur", type: "number", width: 90 },
  // 11
  { key: "croisement", label: "Croise.", type: "number", width: 90 },
  // 12
  { key: "retour_gauche", label: "Ret. G", type: "number", width: 90 },
  // 13
  { key: "retour_droit", label: "Ret. D", type: "number", width: 90 },
  // 14
  { key: "a_plat", label: "À Plat", type: "number", width: 100, readOnly: true },
  // 15
  { key: "hauteur", label: "Hauteur", type: "number", width: 90 },
  // 16
  { key: "hauteur_finie_type", label: "Type H.", type: "select", options: ["Sol Fini", "Sol Brut"], width: 110 },
  // 17
  { key: "finition_bas", label: "Fin. Bas", type: "number", width: 90 },
  // 18
  { key: "hauteur_coupe", label: "H. Coupe", type: "number", width: 100, readOnly: true },
  // 19
  { key: "hauteur_coupe_motif", label: "H. Motif", type: "number", width: 100, readOnly: true },

  // 20
  { key: "tissu_deco1", label: "Tissu 1", type: "catalog_item", category: "Tissu", width: 150 },
  // 21
  { key: "laize_tissu1", label: "Laize 1", type: "number", width: 90 },
  // 22
  { key: "raccord_v_tissu1", label: "Rac. V1", type: "number", width: 90 },
  // 23
  { key: "raccord_h_tissu1", label: "Rac. H1", type: "number", width: 90 },
  // 24
  { key: "nb_les_tissu1", label: "Nb Lés 1", type: "number", width: 90, readOnly: true },
  // 25
  { key: "ml_tissu1", label: "ML Tissu 1", type: "number", width: 110, readOnly: true },
  // 26
  { key: "pa_tissu1", label: "PA T1", type: "number", width: 90 },
  // 27
  { key: "pv_tissu1", label: "PV T1", type: "number", width: 90 },

  // 28
  { key: "tissu_deco2", label: "Tissu 2", type: "catalog_item", category: "Tissu", width: 150 },
  // 29 (NEW)
  { key: "laize_tissu2", label: "Laize 2", type: "number", width: 90 },
  // 30
  { key: "raccord_v_tissu2", label: "Rac. V2", type: "number", width: 90 },
  // 31
  { key: "raccord_h_tissu2", label: "Rac. H2", type: "number", width: 90 },
  // 32
  { key: "ml_tissu2", label: "ML Tissu 2", type: "number", width: 110 },
  // 33
  { key: "pa_tissu2", label: "PA T2", type: "number", width: 90 },
  // 34
  { key: "pv_tissu2", label: "PV T2", type: "number", width: 90 },

  // 35
  { key: "doublure", label: "Doublure", type: "catalog_item", category: "Doublure", width: 140 },
  // 36
  { key: "laize_doublure", label: "Laize D.", type: "number", width: 90 },
  // 37
  { key: "nb_les_doublure", label: "Nb Lés D.", type: "number", width: 90, readOnly: true },
  // 38
  { key: "ml_doublure", label: "ML Doubl.", type: "number", width: 110, readOnly: true },
  // 39
  { key: "pa_doublure", label: "PA Doubl.", type: "number", width: 90 },
  // 40
  { key: "pv_doublure", label: "PV Doubl.", type: "number", width: 90 },

  // 41
  { key: "interdoublure", label: "Inter-D.", type: "catalog_item", category: "Interdoublure", width: 140 },
  // 42
  { key: "laize_interdoublure", label: "Laize I.", type: "number", width: 90 },
  // 43
  { key: "nb_les_interdoublure", label: "Nb Lés I.", type: "number", width: 90, readOnly: true },
  // 44
  { key: "ml_interdoublure", label: "ML Inter.", type: "number", width: 110, readOnly: true },
  // 45
  { key: "pa_interdoublure", label: "PA Inter.", type: "number", width: 90 },
  // 46
  { key: "pv_interdoublure", label: "PV Inter.", type: "number", width: 90 },

  // 47
  { key: "passementerie1", label: "Passement. 1", type: "catalog_item", category: "Passementerie", width: 140 },
  // 48
  { key: "application_passementerie1", label: "App. P1", type: "select", options: ["I", "U", "L", "-"], width: 100 },
  // 49
  { key: "ml_pass1", label: "ML Pass 1", type: "number", width: 110, readOnly: true },
  // 50
  { key: "pa_pass1", label: "PA Pass 1", type: "number", width: 90 },
  // 51
  { key: "pv_pass1", label: "PV Pass 1", type: "number", width: 90 },

  // 52
  { key: "passementerie2", label: "Passement. 2", type: "catalog_item", category: "Passementerie", width: 140 },
  // 53
  { key: "application_passementerie2", label: "App. P2", type: "select", options: ["I", "U", "L", "-"], width: 100 },
  // 54
  { key: "ml_pass2", label: "ML Pass 2", type: "number", width: 110, readOnly: true },
  // 55
  { key: "pa_pass2", label: "PA Pass 2", type: "number", width: 90 },
  // 56
  { key: "pv_pass2", label: "PV Pass 2", type: "number", width: 90 },

  // 57
  { key: "type_mecanisme", label: "Type Méca", type: "select", options: ["Rail", "Tringle"], width: 120 },
  // 58
  { key: "modele_mecanisme", label: "Modèle Méca", type: "catalog_item", category: "Rail,Rails,Tringle,Tringles,Mecanisme,Mécanisme,Mecanismes,Mécanismes", width: 140 },
  // 59
  { key: "pa_mecanisme", label: "PA Méca", type: "number", width: 90 },
  // 60
  { key: "pv_mecanisme", label: "PV Méca", type: "number", width: 90 },

  // 61
  { key: "heures_prepa", label: "H. Prépa", type: "number", width: 80 },
  // 62
  { key: "pv_prepa", label: "PV Prépa", type: "number", width: 90, readOnly: true },

  // 63
  { key: "type_pose", label: "Pose", type: "select", options: ["Mural", "Plafond", "Tableau", "Grande hauteur"], width: 120 },
  // 64
  { key: "heures_pose", label: "H. Pose", type: "number", width: 80 },
  // 65
  { key: "pv_pose", label: "PV Pose", type: "number", width: 90, readOnly: true },

  // 66
  { key: "heures_confection", label: "H. Conf", type: "number", width: 80 },
  // 67
  { key: "pv_confection", label: "PV Conf", type: "number", width: 90, readOnly: true },

  // 68
  { key: "st_pose_pa", label: "ST Pose PA", type: "number", width: 90 },
  // 69
  { key: "st_pose_pv", label: "ST Pose PV", type: "number", width: 90, readOnly: true },
  // 70
  { key: "st_conf_pa", label: "ST Conf PA", type: "number", width: 90 },
  // 71
  { key: "st_conf_pv", label: "ST Conf PV", type: "number", width: 90, readOnly: true },

  // 72
  { key: "livraison", label: "Livraison", type: "number", width: 90 },
  // 73
  { key: "unit_price", label: "P.U", type: "number", width: 110, readOnly: true, valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value) },
  // 74
  { key: "quantite", label: "Qté", type: "number", width: 70 },
  // 75
  { key: "total_price", label: "Total", type: "number", width: 120, readOnly: true },
];