export const CHIFFRAGE_SCHEMA_DEP = [
  { key: "produit", label: "Produit", type: "text", width: 0, hidden: true, defaultValue: "Déplacement" },

  // 1. Logistique de base
  {
    key: "type",
    label: "Type",
    type: "singleSelect",
    valueOptions: ["Pose", "Prise de cotes", "Réunion", "Livraison", "SAV", "Déplacement"],
    width: 140
  },
  { key: "nb_tech", label: "Nb Tech", type: "number", width: 80, defaultValue: 1 },
  { key: "nb_jours", label: "Nb Jours", type: "number", width: 80, defaultValue: 1 },
  {
    key: "format_duree",
    label: "Format",
    type: "singleSelect",
    valueOptions: ["Journée", "Demi-journée"],
    width: 110,
    defaultValue: "Journée"
  },

  // 2. Calculs Temps & Nuits
  { key: "nb_heures", label: "Heures Tot.", type: "number", width: 90, readOnly: true },

  { key: "decouche", label: "Découché ?", type: "checkbox", width: 90 },
  { key: "nb_nuits", label: "Nuits", type: "number", width: 70, readOnly: true },
  { key: "nb_repas", label: "Repas", type: "number", width: 70, readOnly: true },

  // 3. Coûts Unitaires (Cachés ou affichés pour info)
  { key: "transport_unitaire", label: "Transp. Unit. (€)", type: "number", width: 120 },

  // 4. Totaux en Euros
  { key: "cout_mo", label: "Main d'Oeuvre €", type: "number", width: 120, readOnly: true },

  // Ces colonnes sont calculées par recomputeRow mais on peut les afficher pour debug ou info
  { key: "cout_nuits", label: "Coût Nuits €", type: "number", width: 110, readOnly: true },
  { key: "cout_repas", label: "Coût Repas €", type: "number", width: 110, readOnly: true },
  { key: "transport_total", label: "Total Transp. €", type: "number", width: 120, readOnly: true },

  {
    key: "prix_total",
    label: "TOTAL FINAL",
    type: "number",
    width: 130,
    readOnly: true,
    // La formule est gérée par recomputeRow, mais on peut mettre une formule indicative
    // formula: "cout_mo + cout_nuits + cout_repas + transport_total"
  },
  { key: "croquis", label: "Croquis", type: "croquis", width: 140 },
];

export default CHIFFRAGE_SCHEMA_DEP;