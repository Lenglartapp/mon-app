// src/lib/schemas/chiffrage.js
// Schéma de colonnes pour l'éditeur de minutes (chiffrage)

export const CHIFFRAGE_SCHEMA = [
  // Sélection / navigation
  { key: "sel", label: "Sel.", type: "checkbox", width: 60 },
  { key: "detail", label: "Détail", type: "button", width: 100 },

  // Identité / localisation
  { key: "zone", label: "Zone", type: "text", width: 120 },
  { key: "piece", label: "Pièce", type: "text", width: 120 },

  // Produit & confection
  {
    key: "produit",
    label: "Produit",
    type: "select",
    options: [
      "Rideau", "Voilage", "Store Bateau", "Store Enrouleur", "Store Vénitien",
      "Cache Sommier", "Coussin", "Décor de lit", "Autres"
    ],
    width: 160
  },
  {
    key: "type_confection",
    label: "Type de confection",
    type: "select",
    options: ["Wave 80", "Wave 60", "Couteau", "Flamand", "Triplis", "Creux", "Taylor", "Tuyaux d'orgue", "Plat", "A plat"],
    width: 180
  },
  {
    key: "pair_un",
    label: "Paire / Un seul pan",
    type: "select",
    options: ["Paire", "Un seul pan"],
    width: 150
  },
  { key: "ampleur", label: "Ampleur", type: "number", precision: 2, width: 90 },

  // Cotes & géométrie
  { key: "l_mecanisme", label: "Largeur mécanisme", type: "number", width: 150 },
  { key: "largeur", label: "Largeur", type: "number", width: 110 },
  { key: "hauteur", label: "Hauteur", type: "number", width: 110 },

  // Hauteur de coupe (minutes) — utilisée par les ML
  {
    key: "hauteur_coupe_minutes",
    label: "H. coupe (min.)",
    type: "formula",
    formula: "hauteur + 50",
    width: 140
  },

  { key: "a_plat", label: "À plat", type: "formula", formula: "largeur * ampleur", width: 140 },
  { key: "croisement", label: "Croisement", type: "number", width: 120 },
  { key: "retour_g", label: "Retour Gauche", type: "number", width: 130 },
  { key: "retour_d", label: "Retour Droit", type: "number", width: 130 },

  // Options pièce / rendu
  { key: "envers_visible", label: "Envers visible", type: "checkbox", width: 120 },
  { key: "double", label: "Double", type: "checkbox", width: 100 },

  // Tissus & raccords — Déco 1
  { key: "tissu_deco1", label: "Tissu Déco 1", type: "text", width: 160 },
  { key: "laize_tissu_deco1", label: "Laize Déco 1", type: "number", width: 140 },
  { key: "motif_deco1", label: "Motif Déco 1", type: "text", width: 140 },
  { key: "raccord_v1", label: "Raccord V1", type: "number", width: 130 },
  { key: "raccord_h1", label: "Raccord H1", type: "number", width: 130 },

  // ML Déco 1 : garde-fous NVL et opérateur || (pas "OR")
  {
    key: "ml_tissu_deco1",
    label: "ML Déco 1",
    type: "formula",
    formula:
      "IF({laize_tissu_deco1}<=0 || {hauteur_coupe_minutes}<=0, 0, " +
      "IF({laize_tissu_deco1} > {hauteur_coupe_minutes}, " +
      "({a_plat}+{croisement}+{retour_g}+{retour_d})/100, " +
      "CEIL(({a_plat}+{croisement}+{retour_g}+{retour_d})/{laize_tissu_deco1}) * ({hauteur_coupe_minutes}/100)" +
      "))",
    width: 200
  },
  { key: "pa_tissu_deco1", label: "PA Déco 1", type: "number", width: 120 },
  { key: "pv_tissu_deco1", label: "PV Déco 1", type: "number", width: 120 },

  // Tissus & raccords — Déco 2
  { key: "tissu_deco2", label: "Tissu Déco 2", type: "text", width: 160 },
  { key: "laize_tissu_deco2", label: "Laize Déco 2", type: "number", width: 140 },
  { key: "motif_deco2", label: "Motif Déco 2", type: "text", width: 140 },
  { key: "raccord_v2", label: "Raccord V2", type: "number", width: 130 },
  { key: "raccord_h2", label: "Raccord H2", type: "number", width: 130 },
  {
    key: "ml_tissu_deco2",
    label: "ML Déco 2",
    type: "formula",
    formula:
      "IF({laize_tissu_deco2}<=0 || {hauteur_coupe_minutes}<=0, 0, " +
      "IF({laize_tissu_deco2} > {hauteur_coupe_minutes}, " +
      "({a_plat}+{croisement}+{retour_g}+{retour_d})/100, " +
      "CEIL(({a_plat}+{croisement}+{retour_g}+{retour_d})/{laize_tissu_deco2}) * ({hauteur_coupe_minutes}/100)" +
      "))",
    width: 200
  },
  { key: "pa_tissu_deco2", label: "PA Déco 2", type: "number", width: 120 },
  { key: "pv_tissu_deco2", label: "PV Déco 2", type: "number", width: 120 },

  // Passementeries
  { key: "passementerie1", label: "Passementerie 1", type: "text", width: 160 },
  { key: "app_passementerie1", label: "Application Passementerie 1", type: "text", width: 200 },
  { key: "ml_passementerie1", label: "ML Passementerie 1", type: "number", width: 160 },
  { key: "pa_passementerie1", label: "PA Passementerie 1", type: "number", width: 160 },
  { key: "pv_passementerie1", label: "PV Passementerie 1", type: "number", width: 160 },

  { key: "passementerie2", label: "Passementerie 2", type: "text", width: 160 },
  { key: "app_passementerie2", label: "Application Passementerie 2", type: "text", width: 200 },
  { key: "ml_passementerie2", label: "ML Passementerie 2", type: "number", width: 160 },
  { key: "pa_passementerie2", label: "PA Passementerie 2", type: "number", width: 160 },

  // Doublure
  { key: "doublure", label: "Doublure", type: "text", width: 150 },
  { key: "laize_doublure", label: "Laize Doublure", type: "number", width: 150 },
  {
    key: "ml_doublure",
    label: "ML Doublure",
    type: "formula",
    formula:
      "IF({laize_doublure}<=0 || {hauteur_coupe_minutes}<=0, 0, " +
      "IF({laize_doublure} > {hauteur_coupe_minutes}, " +
      "({a_plat}+{croisement}+{retour_g}+{retour_d})/100, " +
      "CEIL(({a_plat}+{croisement}+{retour_g}+{retour_d})/{laize_doublure}) * ({hauteur_coupe_minutes}/100)" +
      "))",
    width: 200
  },
  { key: "pa_doublure", label: "PA Doublure", type: "number", width: 140 },
  { key: "pv_doublure", label: "PV Doublure", type: "number", width: 140 },

  // Inter-doublure
  { key: "inter_doublure", label: "Inter Doublure", type: "text", width: 150 },
  { key: "laize_inter", label: "Laize Inter", type: "number", width: 150 },
  {
    key: "ml_inter",
    label: "ML Inter",
    type: "formula",
    formula:
      "IF({laize_inter}<=0 || {hauteur_coupe_minutes}<=0, 0, " +
      "IF({laize_inter} > {hauteur_coupe_minutes}, " +
      "({a_plat}+{croisement}+{retour_g}+{retour_d})/100, " +
      "CEIL(({a_plat}+{croisement}+{retour_g}+{retour_d})/{laize_inter}) * ({hauteur_coupe_minutes}/100)" +
      "))",
    width: 200
  },
  { key: "pa_inter", label: "PA Inter", type: "number", width: 140 },
  { key: "pv_inter", label: "PV Inter", type: "number", width: 140 },

  // Mécanisme (Rail / Tringle / Store)
  {
    key: "type_mecanisme",
    label: "Type Mécanisme",
    type: "select",
    options: ['Rail', 'Tringle'],
    width: 140
  },
  { key: "modele_mecanisme", label: "Modèle Mécanisme", type: "text", width: 140 },
  { key: "dim_mecanisme", label: "Dim. Mécanisme", type: "text", width: 120 },
  { key: "pa_mecanisme", label: "PA Mécanisme", type: "number", width: 120 },
  { key: "pv_mecanisme", label: "PV Mécanisme", type: "number", width: 120 },

  // Prépa / pose / confection (valorisations)
  { key: "heures_prepa", label: "Heures Prépa", type: "number", width: 140 },
  { key: "pv_prepa", label: "PV Prépa", type: "number", width: 130 },
  { key: "type_pose", label: "Type de pose", type: "select", options: ["Murale", "Plafond", "Encastré"], width: 140 },

  // Sous-traitance POSE (cachée par défaut)
  { key: "stpausepa", label: "ST Pose PA", type: "number", width: 140 },
  {
    key: "stpausepv",
    label: "ST Pose PV",
    type: "formula",
    width: 140,
    formula: "{stpausepa} * 2",
    readOnly: true,
  },

  { key: "heures_pose", label: "Heures Pose", type: "number", width: 140 },
  { key: "pv_pose", label: "PV Pose", type: "number", width: 120 },
  // Sous-traitance CONFECTION (cachée par défaut)
  { key: "stconfpa", label: "ST Conf PA", type: "number", width: 140 },
  {
    key: "stconfpv",
    label: "ST Conf PV",
    type: "formula",
    width: 140,
    formula: "{stconfpa} * 2",
    readOnly: true,
  },

  { key: "heures_confection", label: "Heures Confection", type: "number", width: 160 },
  { key: "pv_confection", label: "PV Confection", type: "number", width: 140 },

  // Frais / prix
  { key: "livraison", label: "Livraison", type: "number", width: 120 },
  {
    key: "prix_unitaire",
    label: "Prix Unitaire",
    type: "formula",
    // somme des PV composants + livraison, en ignorant les champs vides
    formula:
      "{pv_tissu_deco1} + {pv_tissu_deco2} + {pv_doublure} + {pv_inter} + " +
      "{pv_mecanisme} + {pv_prepa} + {pv_pose} + {pv_confection} + {livraison}",
    width: 160
  },
  { key: "quantite", label: "Quantité", type: "number", width: 100 },
  { key: "prix_total", label: "Prix Total", type: "formula", formula: "{prix_unitaire} * {quantite}", width: 140 },

  // Croquis
  { key: "croquis", label: "Croquis", type: "croquis", width: 140 },

  // Commentaires chiffrage
  { key: "commentaire_minute", label: "Commentaire", type: "text", width: 220 },
];