export const CHIFFRAGE_SCHEMA_DEP = [
  { key: "produit", label: "Produit", type: "text", width: 0, hidden: true, defaultValue: "Déplacement" },

  // 1. Saisie Logistique
  {
    key: "type",
    label: "Type",
    type: "singleSelect",
    valueOptions: ["Déplacement", "Prise de côtes"],
    width: 140
  },
  { key: "nb_tech", label: "Nb Tech", type: "number", width: 80, defaultValue: 1 },

  // Nouveaux Champs Inputs
  { key: "nb_trajets", label: "Nb A/R", type: "number", width: 80, defaultValue: 1 },
  { key: "temps_trajet", label: "Temps Trajet A/R (h)", type: "number", width: 130, defaultValue: 0 },
  { key: "heures_sur_place", label: "Heures Intervention", type: "number", width: 130, defaultValue: 0 },

  // 2. Calculs Auto (Infos)
  { key: "nb_heures", label: "Heures Fact.", type: "number", width: 100, readOnly: true }, // Was 'Heures Tot.', now reflects Billed Hours

  { key: "decouche", label: "Découché ?", type: "checkbox", width: 90 },
  { key: "nb_nuits", label: "Nuits", type: "number", width: 70, readOnly: true },
  { key: "nb_repas", label: "Repas", type: "number", width: 70, readOnly: true },

  // 3. Totaux en Euros
  { key: "cout_mo", label: "Main d'Oeuvre €", type: "number", width: 120, readOnly: true },

  // Note: Transport Unitaire removed. Vehicle cost included in hourly rate/package.

  { key: "cout_nuits", label: "Coût Nuits €", type: "number", width: 110, readOnly: true },
  { key: "cout_repas", label: "Coût Repas €", type: "number", width: 110, readOnly: true },

  {
    key: "prix_total",
    label: "TOTAL FINAL",
    type: "number",
    width: 130,
    readOnly: true,
  },
  // Croquis has been removed from MinuteGrid view via hideCroquis prop, but keeping it in schema doesn't hurt if we want it for other views. 
  // However, user said "Colonnes à SUPPRIMER" explicitly. 
  // Let's keep it defined but relying on hideCroquis for the MinuteGrid. 
  // Wait, user said "1. SUPPRESSION COLONNE CROQUIS" in previous request for Minutes, and "Dans le DataGrid Logistique ... Colonnes à SUPPRIMER". 
  // Let's assume the previous hideCroquis task covered the visual suppression in Minutes.
  { key: "croquis", label: "Croquis", type: "croquis", width: 140 },
];

export default CHIFFRAGE_SCHEMA_DEP;