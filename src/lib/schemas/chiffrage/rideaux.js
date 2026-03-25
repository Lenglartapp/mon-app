// src/lib/schemas/chiffrage/rideaux.js
// Schéma commercial pour la famille "Rideaux" (Rideau / Voilage)

export const RIDEAUX_SCHEMA = [
    // 2. Actions (Détail)
    { key: "detail", label: "Détail", type: "button", width: 130 },

    // 3
    { key: "zone", label: "Zone", type: "text", width: 120 },
    // 4
    { key: "piece", label: "Pièce", type: "text", width: 120 },
    // 5
    { key: "produit", label: "Produit", type: "select", options: ["Rideau", "Voilage"], width: 125 },
    // 6
    { key: "type_confection", label: "Confection", type: "select", options: ["Pli Flamand", "Plis Creux", "Pli Plat", "Tripli", "Wave 80", "Wave 60", "Pli Couteau", "A Plat"], width: 150 },
    // 7
    { key: "paire_ou_un_seul_pan", label: "Paire ou un Pan", type: "select", options: ["Paire", "Un seul pan", "Un seul pan (Rapatriement Droit)", "Un seul pan (Rapatriement Gauche)"], width: 260 },
    // 8
    { key: "ampleur", label: "Ampleur", type: "number", precision: 2, width: 131, defaultValue: 0 },
    // 9
    { key: "largeur_mecanisme", label: "L. Méca", type: "number", width: 130 },
    // 10
    { key: "largeur", label: "Largeur", type: "number", width: 130 },
    // 11
    { key: "croisement", label: "Croisement", type: "number", width: 135 },
    // 12
    { key: "retour_gauche", label: "Ret. G", type: "number", width: 120 },
    // 13
    { key: "retour_droit", label: "Ret. D", type: "number", width: 120 },
    // 14
    { key: "a_plat", label: "À Plat", type: "number", width: 130, readOnly: true, tooltip: "Paire : (L_finie × ampleur) + 4 × ourlets. Pan unique : (L_finie × ampleur) + 2 × ourlets" },
    // 15
    { key: "hauteur", label: "Hauteur", type: "number", width: 130 },

    // 17
    { key: "finition_bas", label: "Fin. Bas", type: "number", width: 130 },
    // 18
    { key: "hauteur_coupe", label: "H. Coupe", type: "number", width: 135, readOnly: true, tooltip: "Si laize > H_finie + 50 cm → À Plat. Sinon → H_finie + 50 cm" },
    // 19
    { key: "hauteur_coupe_motif", label: "H. Motif", type: "number", width: 130, readOnly: true, tooltip: "H. Coupe arrondie au raccord motif vertical supérieur : ceil(H_coupe ÷ raccord_V) × raccord_V" },

    // 20
    { key: "tissu_deco1", label: "Tissu 1", type: "catalog_item", category: "Tissu", width: 180 },
    // 21
    { key: "laize_tissu1", label: "Laize 1", type: "number", width: 120 },
    // 22
    { key: "raccord_v_tissu1", label: "Rac. V1", type: "number", width: 125 },
    // 23
    { key: "raccord_h_tissu1", label: "Rac. H1", type: "number", width: 125 },
    // 24
    { key: "nb_les_tissu1", label: "Nb Lés 1", type: "number", width: 131, readOnly: true, tooltip: "Nombre de lés tissu 1 : ceil(À Plat ÷ laize 1)" },
    // 25
    { key: "ml_tissu1", label: "ML Tissu 1", type: "number", width: 142, readOnly: true, tooltip: "Métrage linéaire tissu 1 : Nb lés × H. Coupe Motif (÷ 100 pour convertir en mètres)" },
    // 26
    { key: "pa_tissu1", label: "PA T1", type: "number", width: 115 },
    // 27
    { key: "pv_tissu1", label: "PV T1", type: "number", width: 115 },

    // 28
    { key: "tissu_deco2", label: "Tissu 2", type: "catalog_item", category: "Tissu", width: 180 },
    // 29
    { key: "laize_tissu2", label: "Laize 2", type: "number", width: 120 },
    // 30
    { key: "raccord_v_tissu2", label: "Rac. V2", type: "number", width: 125 },
    // 31
    { key: "raccord_h_tissu2", label: "Rac. H2", type: "number", width: 125 },
    // 32
    { key: "ml_tissu2", label: "ML Tissu 2", type: "number", width: 142 },
    // 33
    { key: "pa_tissu2", label: "PA T2", type: "number", width: 115 },
    // 34
    { key: "pv_tissu2", label: "PV T2", type: "number", width: 115 },

    // 35
    { key: "doublure", label: "Doublure", type: "catalog_item", category: "Tissu", width: 180 },
    // 36
    { key: "laize_doublure", label: "Laize D.", type: "number", width: 135 },
    // 37
    { key: "nb_les_doublure", label: "Nb Lés D.", type: "number", width: 141, readOnly: true, tooltip: "Nombre de lés doublure : ceil(À Plat ÷ laize doublure)" },
    // 38
    { key: "ml_doublure", label: "ML Doubl.", type: "number", width: 141, readOnly: true, tooltip: "Métrage linéaire doublure : Nb lés × H. Coupe Doublure (÷ 100)" },
    // 39
    { key: "pa_doublure", label: "PA Doubl.", type: "number", width: 140 },
    // 40
    { key: "pv_doublure", label: "PV Doubl.", type: "number", width: 140 },

    // 41
    { key: "interdoublure", label: "Interdoublure", type: "catalog_item", category: "Tissu", width: 180 },
    // 42
    { key: "laize_interdoublure", label: "Laize Inter", type: "number", width: 135 },
    // 43
    { key: "nb_les_interdoublure", label: "Nb Lés Inter", type: "number", width: 140, readOnly: true, tooltip: "Nombre de lés interdoublure : ceil(À Plat ÷ laize interdoublure)" },
    // 44
    { key: "ml_interdoublure", label: "ML Inter.", type: "number", width: 136, readOnly: true, tooltip: "Métrage linéaire interdoublure : Nb lés × H. Coupe (÷ 100)" },
    // 45
    { key: "pa_interdoublure", label: "PA Inter.", type: "number", width: 135 },
    // 46
    { key: "pv_interdoublure", label: "PV Inter.", type: "number", width: 135 },

    // 47
    { key: "passementerie1", label: "Passementerie 1", type: "catalog_item", category: "Passementerie", width: 170 },
    // 48
    { key: "application_passementerie1", label: "App. P1", type: "select", options: ["I", "U", "L", "-"], width: 130 },
    // 49
    { key: "ml_pass1", label: "ML Pass 1", type: "number", width: 140, readOnly: true, tooltip: "ML passementerie 1 selon application : I = À Plat × 2 | U = périmètre | L = 3 côtés" },
    // 50
    { key: "pa_pass1", label: "PA Pass 1", type: "number", width: 140 },
    // 51
    { key: "pv_pass1", label: "PV Pass 1", type: "number", width: 140 },

    // 52
    { key: "passementerie2", label: "Passementerie 2", type: "catalog_item", category: "Passementerie", width: 170 },
    // 53
    { key: "application_passementerie2", label: "App. P2", type: "select", options: ["I", "U", "L", "-"], width: 130 },
    // 54
    { key: "ml_pass2", label: "ML Pass 2", type: "number", width: 145, readOnly: true, tooltip: "ML passementerie 2 selon application : I = À Plat × 2 | U = périmètre | L = 3 côtés" },
    // 55
    { key: "pa_pass2", label: "PA Pass 2", type: "number", width: 145 },
    // 56
    { key: "pv_pass2", label: "PV Pass 2", type: "number", width: 145 },

    // 57
    { key: "type_mecanisme", label: "Type Méca", type: "select", options: ["Rail", "Tringle", "Rail Motorisé"], width: 148 },
    // 58
    { key: "modele_mecanisme", label: "Modèle Méca", type: "catalog_item", category: "Rail", width: 165 },
    // 59
    { key: "pa_mecanisme", label: "PA Méca", type: "number", width: 135 },
    // 60
    { key: "pv_mecanisme", label: "PV Méca", type: "number", width: 135 },

    // 60b
    { key: "mecanisme_bis", label: "Méca Bis", type: "catalog_item", category: "Rail", width: 135 },
    { key: "pa_mecanisme_bis", label: "PA Méca Bis", type: "number", width: 155 },
    { key: "pv_mecanisme_bis", label: "PV Méca Bis", type: "number", width: 155 },

    // 61
    { key: "heures_prepa", label: "H. Prépa", type: "number", width: 135 },
    // 62
    { key: "pv_prepa", label: "PV Prépa", type: "number", width: 136, readOnly: true, tooltip: "PV préparation = H. Prépa × taux horaire préparation" },

    // 63
    { key: "type_pose", label: "Type Pose", type: "select", options: ["Mural", "Plafond", "Grande hauteur", "Suspente"], width: 160 },
    // 64
    { key: "heures_pose", label: "H. Pose", type: "number", width: 130 },
    // 65
    { key: "pv_pose", label: "PV Pose", type: "number", width: 135, readOnly: true, tooltip: "PV pose = H. Pose × taux horaire pose" },

    // 66
    { key: "heures_confection", label: "H. Conf", type: "number", width: 130 },
    // 67
    { key: "pv_confection", label: "PV Conf", type: "number", width: 130, readOnly: true, tooltip: "PV confection = H. Conf × taux horaire confection" },

    // 68
    { key: "st_pose_pa", label: "ST Pose PA", type: "number", width: 150 },
    // 69
    { key: "st_pose_pv", label: "ST Pose PV", type: "number", width: 150, readOnly: true, tooltip: "PV sous-traitance pose = ST Pose PA × coefficient de marge" },
    // 70
    { key: "st_conf_pa", label: "ST Conf PA", type: "number", width: 150 },
    // 71
    { key: "st_conf_pv", label: "ST Conf PV", type: "number", width: 150, readOnly: true, tooltip: "PV sous-traitance confection = ST Conf PA × coefficient de marge" },

    // 72
    { key: "livraison", label: "Livraison", type: "number", width: 140 },
    // 73
    { key: "unit_price", label: "P.U", type: "number", width: 115, readOnly: true, tooltip: "Prix unitaire = somme de tous les coûts matières + prestations + mécanisme + livraison", valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value) },
    // 74
    { key: "quantite", label: "Qté", type: "number", width: 115, defaultValue: 1, readOnly: true, tooltip: "Quantité (généralement 1 par ligne, gérer plusieurs unités via Qté)" },
    // 75
    { key: "total_price", label: "Total", type: "number", width: 125, readOnly: true, tooltip: "Total = Prix unitaire × Quantité" },
];
