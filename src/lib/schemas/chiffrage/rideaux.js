// src/lib/schemas/chiffrage/rideaux.js
// Schéma commercial pour la famille "Rideaux" (Rideau / Voilage)

// Valeurs posées sur chaque NOUVELLE ligne rideau du chiffrage (cm).
// Les lignes existantes ne sont pas modifiées.
export const RIDEAUX_LINE_DEFAULTS = {
    hauteur_renfort_tete: 14, // Hauteur tête
    piquage_ourlets_du_bas: 8, // OB
    v_ourlets_de_cotes: 3,     // OC
    finition_champs: 8,        // Fin. Chant
};

export const RIDEAUX_SCHEMA = [
    // 2. Actions (Détail)
    { key: "detail", label: "Détail", type: "button", width: 130 },

    // 3
    { key: "zone", label: "Zone", type: "text", width: 120 },
    // 4
    { key: "piece", label: "Pièce", type: "text", width: 120 },
    // 4 bis — 3e niveau de localisation, masqué par défaut (activable via le sélecteur de colonnes)
    { key: "fenetre", label: "Fenêtre", type: "text", width: 140, defaultHidden: true },
    // 5
    { key: "produit", label: "Produit", type: "select", options: ["Rideau", "Voilage"], width: 125 },
    // 6
    { key: "type_confection", label: "Plis", type: "select", options: ["Pli Flamand", "Pli Creux", "Pli Plat", "Tripli", "Wave 80", "Wave 60", "Pli Couteau", "Pli Rabattu Cousu", "A Plat"], width: 150 },
    // 7
    { key: "paire_ou_un_seul_pan", label: "Paire ou un Pan", type: "select", options: ["Paire", "Un seul pan", "Un seul pan (Rapatriement Droit)", "Un seul pan (Rapatriement Gauche)"], width: 260 },
    // 8
    { key: "ampleur", label: "Ampleur", type: "number", precision: 2, width: 131, defaultValue: 0 },
    // 9
    { key: "largeur_mecanisme", label: "L. Méca", type: "number", width: 130 },
    // 10
    { key: "largeur", label: "Largeur", type: "number", width: 130 },
    // 10 bis — par pan
    { key: "largeur_finie", label: "L. Finie", type: "number", width: 120, readOnly: true, tooltip: "Un seul pan : L + 10 + 2,5 % × L. Paire : L/2 + 10 + 2,5 % × L/2 + Croisement/2. Wave 60/80 : arrondie au nombre pair de vagues (6 ou 8 cm) avant le croisement. Non calculée sur les anciens chiffrages." },
    // 11
    { key: "croisement", label: "Croisement", type: "number", width: 135 },
    // 12
    { key: "retour_gauche", label: "Ret. G", type: "number", width: 120 },
    // 13
    { key: "retour_droit", label: "Ret. D", type: "number", width: 120 },
    // 13 bis — mêmes clés qu'en production (reprises à la mise en projet)
    { key: "finition_champs", label: "Fin. Chant", type: "number", width: 125, defaultValue: 8 },
    { key: "v_ourlets_de_cotes", label: "OC", type: "number", width: 110, defaultValue: 3, tooltip: "Ourlet de côté" },
    // 14
    { key: "a_plat", label: "À Plat", type: "number", width: 130, readOnly: true, tooltip: "Par rideau (même en paire) : L. Finie × Ampleur + max(Ret. G, Ret. D), + 4 × OC si non doublé, + 2 × Fin. Chant + 3 si doublé d'un autre tissu (rien si doublé de lui-même). Anciens chiffrages : calcul historique." },
    // 15
    { key: "hauteur", label: "Hauteur", type: "number", width: 130 },

    // 17
    { key: "finition_bas", label: "Fin. Bas", type: "number", width: 130 },
    // 17 bis — mêmes clés qu'en production (reprises à la mise en projet)
    { key: "hauteur_renfort_tete", label: "Hauteur tête", type: "number", width: 140, defaultValue: 14 },
    { key: "piquage_ourlets_du_bas", label: "OB", type: "number", width: 110, defaultValue: 8, tooltip: "Ourlet du bas" },
    // 18
    { key: "hauteur_coupe", label: "H. Coupe", type: "number", width: 135, readOnly: true, tooltip: "Non doublé : Hauteur + Fin. Bas + 2 × Hauteur tête + 2 × OB. Doublé : Hauteur + Fin. Bas + Hauteur tête + 2 × OB. Anciens chiffrages : Hauteur + Fin. Bas + 50." },
    // 19
    { key: "hauteur_coupe_motif", label: "H. Motif", type: "number", width: 130, readOnly: true, tooltip: "H. Coupe arrondie au raccord vertical supérieur, + 1 raccord : arrondi sup.(H. Coupe ÷ Rac. V1) × Rac. V1 + Rac. V1. Sans raccord : = H. Coupe." },

    // 20
    { key: "tissu_deco1", label: "Tissu 1", type: "catalog_item", category: "Tissu", width: 180 },
    // 21
    { key: "laize_tissu1", label: "Laize 1", type: "number", width: 120 },
    // 22
    { key: "raccord_v_tissu1", label: "Rac. V1", type: "number", width: 125 },
    // 23
    { key: "raccord_h_tissu1", label: "Rac. H1", type: "number", width: 125 },
    // 24
    { key: "nb_les_tissu1", label: "Nb Lés 1", type: "number", width: 131, readOnly: true, tooltip: "Par rideau : arrondi sup. de À Plat ÷ Laize 1. Paire en tissu uni (sans raccord, nouveaux chiffrages) : arrondi au demi-lé (1,2 → 1,5). 0 si le tissu est couché (Laize 1 ≥ H. Motif)." },
    // 25
    { key: "ml_tissu1", label: "ML Tissu 1", type: "number", width: 142, readOnly: true, tooltip: "En lés : Nb Lés 1 × H. Motif ÷ 100. Couché (Laize 1 ≥ H. Motif) : À Plat ÷ 100. × 2 si paire (nouveaux chiffrages), arrondi au 0,5 m supérieur." },
    // 26
    { tooltip: "Calculé : ML Tissu 1 × prix d'achat catalogue (0 si pas de tissu).", key: "pa_tissu1", label: "PA T1", type: "number", width: 115 },
    // 27
    { tooltip: "Calculé : ML Tissu 1 × prix de vente catalogue (0 si pas de tissu).", key: "pv_tissu1", label: "PV T1", type: "number", width: 115 },

    // 28
    { key: "tissu_deco2", label: "Tissu 2", type: "catalog_item", category: "Tissu", width: 180 },
    // 29
    { key: "laize_tissu2", label: "Laize 2", type: "number", width: 120 },
    // 30
    { key: "raccord_v_tissu2", label: "Rac. V2", type: "number", width: 125 },
    // 31
    { key: "raccord_h_tissu2", label: "Rac. H2", type: "number", width: 125 },
    // 32
    // 31 bis — Tissu 2 en saisie libre (nouveaux chiffrages) : prises de main, bandes…
    { key: "nb_les_tissu2", label: "Nb Lés 2", type: "number", width: 131, tooltip: "Saisie libre (nouveaux chiffrages) ; calculé sur les anciens chiffrages (arrondi sup. de À Plat ÷ Laize 2)." },
    { key: "ml_tissu2", label: "ML Tissu 2", type: "number", width: 142, tooltip: "Saisie libre (nouveaux chiffrages) ; calculé sur les anciens chiffrages" },
    // 33
    { tooltip: "Calculé : ML Tissu 2 × prix d'achat catalogue (0 si pas de tissu).", key: "pa_tissu2", label: "PA T2", type: "number", width: 115 },
    // 34
    { tooltip: "Calculé : ML Tissu 2 × prix de vente catalogue (0 si pas de tissu).", key: "pv_tissu2", label: "PV T2", type: "number", width: 115 },

    // 35
    { key: "doublure", label: "Doublure", type: "catalog_item", category: "Tissu", width: 180 },
    // 36
    { key: "laize_doublure", label: "Laize D.", type: "number", width: 135 },
    // 37
    { key: "nb_les_doublure", label: "Nb Lés D.", type: "number", width: 141, readOnly: true, tooltip: "Par rideau : arrondi sup. de À Plat ÷ Laize D. Paire (nouveaux chiffrages) : arrondi au demi-lé. 0 si la doublure est couchée (Laize D. ≥ H. Coupe)." },
    // 38
    { key: "ml_doublure", label: "ML Doubl.", type: "number", width: 141, readOnly: true, tooltip: "Nb Lés D. × H. Coupe ÷ 100 (couchée : À Plat ÷ 100), × 2 si paire (nouveaux chiffrages), arrondi au 0,5 m supérieur." },
    // 39
    { tooltip: "Calculé : ML Doublure × prix d'achat catalogue (0 si pas de doublure).", key: "pa_doublure", label: "PA Doubl.", type: "number", width: 140 },
    // 40
    { tooltip: "Calculé : ML Doublure × prix de vente catalogue (0 si pas de doublure).", key: "pv_doublure", label: "PV Doubl.", type: "number", width: 140 },

    // 41
    { key: "interdoublure", label: "Interdoublure", type: "catalog_item", category: "Tissu", width: 180 },
    // 42
    { key: "laize_interdoublure", label: "Laize Inter", type: "number", width: 135 },
    // 43
    { key: "nb_les_interdoublure", label: "Nb Lés Inter", type: "number", width: 140, readOnly: true, tooltip: "Par rideau : arrondi sup. de À Plat ÷ Laize Inter (paire : au demi-lé, nouveaux chiffrages). 0 si couchée (Laize ≥ Hauteur + Fin. Bas + Hauteur tête)." },
    // 44
    { key: "ml_interdoublure", label: "ML Inter.", type: "number", width: 136, readOnly: true, tooltip: "Nb Lés Inter × (Hauteur + Fin. Bas + Hauteur tête) ÷ 100, × 2 si paire, arrondi au 0,5 m supérieur (couchée : À Plat ÷ 100). Anciens chiffrages : × H. Coupe." },
    // 45
    { tooltip: "Calculé : ML Interdoublure × prix d'achat catalogue (0 si pas d'interdoublure).", key: "pa_interdoublure", label: "PA Inter.", type: "number", width: 135 },
    // 46
    { tooltip: "Calculé : ML Interdoublure × prix de vente catalogue (0 si pas d'interdoublure).", key: "pv_interdoublure", label: "PV Inter.", type: "number", width: 135 },

    // 47
    { key: "passementerie1", label: "Passementerie 1", type: "catalog_item", category: "Passementerie", width: 170 },
    // 48
    { key: "application_passementerie1", label: "App Pass 1", type: "select", options: ["I", "U", "L", "-", "Prise de main"], width: 130 },
    // 49
    { key: "ml_pass1", label: "ML Pass 1", type: "number", width: 140, readOnly: (row) => row.application_passementerie1 !== "Prise de main", tooltip: "Par rideau, × 2 si paire, arrondi au 0,5 m supérieur : I = H. Coupe | U = 2 × H. Coupe + À Plat | L = H. Coupe + À Plat | - = À Plat seul | Prise de main = saisie manuelle." },
    // 50
    { tooltip: "Calculé : ML Pass 1 × prix d'achat catalogue (0 si pas de passementerie).", key: "pa_pass1", label: "PA Pass 1", type: "number", width: 140 },
    // 51
    { tooltip: "Calculé : ML Pass 1 × prix de vente catalogue (0 si pas de passementerie).", key: "pv_pass1", label: "PV Pass 1", type: "number", width: 140 },

    // 52
    { key: "passementerie2", label: "Passementerie 2", type: "catalog_item", category: "Passementerie", width: 170 },
    // 53
    { key: "application_passementerie2", label: "App Pass 2", type: "select", options: ["I", "U", "L", "-", "Prise de main"], width: 130 },
    // 54
    { key: "ml_pass2", label: "ML Pass 2", type: "number", width: 145, readOnly: (row) => row.application_passementerie2 !== "Prise de main", tooltip: "Par rideau, × 2 si paire, arrondi au 0,5 m supérieur : I = H. Coupe | U = 2 × H. Coupe + À Plat | L = H. Coupe + À Plat | - = À Plat seul | Prise de main = saisie manuelle." },
    // 55
    { tooltip: "Calculé : ML Pass 2 × prix d'achat catalogue (0 si pas de passementerie).", key: "pa_pass2", label: "PA Pass 2", type: "number", width: 145 },
    // 56
    { tooltip: "Calculé : ML Pass 2 × prix de vente catalogue (0 si pas de passementerie).", key: "pv_pass2", label: "PV Pass 2", type: "number", width: 145 },

    // 56b — Embrasse (passementerie vendue à la pièce)
    { key: "embrasse", label: "Embrasse", type: "catalog_item", category: "Passementerie", width: 165 },
    { tooltip: "Prix d'achat de l'embrasse (à saisir, article vendu à la pièce).", key: "pa_embrasse", label: "PA Embrasse", type: "number", width: 145 },
    { tooltip: "Article à la pièce : PA × coef. de l'article (2 par défaut).", key: "pv_embrasse", label: "PV Embrasse", type: "number", width: 145, readOnly: (row) => row.pv_embrasse_auto === true },

    // 57
    { key: "type_mecanisme", label: "Type Méca", type: "select", options: ["Rail", "Tringle", "Rail Motorisé", "Sans Méca"], width: 148 },
    // 58
    { key: "modele_mecanisme", label: "Modèle Méca", type: "catalog_item", category: "Rail", width: 165, tooltip: "Renseignable même en « Sans Méca » (rail fourni par un tiers) : sert d'information, sans prix." },
    // 59
    { tooltip: "Rail au ml : L. Méca ÷ 100 × prix d'achat catalogue. Article à la pièce : à saisir. Sans Méca : 0.", key: "pa_mecanisme", label: "PA Méca", type: "number", width: 135, readOnly: (row) => row.type_mecanisme === 'Sans Méca' },
    // 60
    { tooltip: "Rail au ml : L. Méca ÷ 100 × prix de vente catalogue. Article à la pièce : PA × coef. de l'article (2 par défaut). Sans Méca : 0.", key: "pv_mecanisme", label: "PV Méca", type: "number", width: 135, readOnly: (row) => row.type_mecanisme === 'Sans Méca' || row.pv_mecanisme_auto === true },

    // 60b
    { key: "mecanisme_bis", label: "Méca Bis", type: "catalog_item", category: "Rail", width: 135 },
    { tooltip: "Rail au ml : L. Méca ÷ 100 × prix d'achat catalogue. Article à la pièce : à saisir.", key: "pa_mecanisme_bis", label: "PA Méca Bis", type: "number", width: 155 },
    { tooltip: "Rail au ml : L. Méca ÷ 100 × prix de vente catalogue. Article à la pièce : PA × coef. de l'article (2 par défaut).", key: "pv_mecanisme_bis", label: "PV Méca Bis", type: "number", width: 155, readOnly: (row) => row.pv_mecanisme_bis_auto === true },

    // 61
    { key: "heures_prepa", label: "H. Prépa", type: "number", width: 135 },
    // 62
    { key: "pv_prepa", label: "PV Prépa", type: "number", width: 136, readOnly: true, tooltip: "PV Prépa = H. Prépa × taux horaire (paramètres, 135 €/h par défaut)." },

    // 63
    { key: "type_pose", label: "Type Pose", type: "select", options: ["Mural", "Plafond", "Grande hauteur", "Suspente"], width: 160 },
    // 64
    { key: "heures_pose", label: "H. Pose", type: "number", width: 130 },
    // 65
    { key: "pv_pose", label: "PV Pose", type: "number", width: 135, readOnly: true, tooltip: "PV Pose = H. Pose × taux horaire (paramètres, 135 €/h par défaut)." },

    // 66
    { key: "heures_confection", label: "H. Conf", type: "number", width: 130 },
    // 67
    { key: "pv_confection", label: "PV Conf", type: "number", width: 130, readOnly: true, tooltip: "PV Conf = H. Conf × taux horaire (paramètres, 135 €/h par défaut)." },

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
    { key: "unit_price", label: "P.U", type: "number", width: 115, readOnly: true, tooltip: "P.U = somme des PV (tissus, doublures, passementeries, embrasse, mécas, prépa, pose, confection, sous-traitance, livraison) ÷ Qté.", valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value) },
    // 74
    { key: "quantite", label: "Qté", type: "number", width: 115, defaultValue: 1, readOnly: true, tooltip: "Quantité de la ligne (1 par défaut)." },
    // 75
    { key: "total_price", label: "Total", type: "number", width: 125, readOnly: true, tooltip: "Total = Prix unitaire × Quantité" },
];
