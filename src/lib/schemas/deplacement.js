// src/lib/schemas/deplacement.js

// src/lib/schemas/deplacement.js
export const CHIFFRAGE_SCHEMA_DEP = [
  { key: "type_deplacement", label: "Type de Déplacement", type: "text", width: 180 },

  { key: "nb_techniciens", label: "Nombre de technicien", type: "number", width: 160 },
  { key: "duree_trajet_h", label: "Durée trajet (h)", type: "number", width: 150 },
  { key: "nb_nuits", label: "Nombre de nuit", type: "number", width: 140 },
  { key: "nb_repas", label: "Nombre de Repas", type: "number", width: 150 },

  { key: "tauxhoraire", label: "Taux horaire", type: "number", width: 130 },
  { key: "prixhotel", label: "Prix hôtel (€/nuit)", type: "number", width: 160 },
  { key: "prixrepas", label: "Prix repas (€/repas)", type: "number", width: 160 },

  { key: "transport_unitaire", label: "Transport € (unitaire)", type: "number", width: 180 },

  { key: "pose_prix", label: "Pose €", type: "formula",
    formula: "nb_techniciens * duree_trajet_h * tauxhoraire", width: 120 },

  { key: "hotel_eur", label: "Hôtel €", type: "formula",
    formula: "nb_techniciens * nb_nuits * prixhotel", width: 120 },

  { key: "repas_eur", label: "Repas €", type: "formula",
    formula: "nb_techniciens * nb_repas * prixrepas", width: 120 },

  { key: "transport_eur", label: "Transport € (avion, train)", type: "formula",
    formula: "nb_techniciens * transport_unitaire", width: 190 },

  { key: "total_eur", label: "Total €", type: "formula",
    formula: "NVL(pose_prix,0)+NVL(hotel_eur,0)+NVL(repas_eur,0)+NVL(transport_eur,0)", width: 140 },
];

export default CHIFFRAGE_SCHEMA_DEP;