// src/lib/schemas/deplacement.js
export const CHIFFRAGE_SCHEMA_DEP = [
  { key: "produit", label: "Produit", type: "text", width: 0, hidden: true, defaultValue: "Déplacement" },
  {
    key: "type",
    label: "Type",
    type: "singleSelect",
    valueOptions: ["Pose", "Réunion", "Livraison", "SAV", "Metré"],
    width: 150
  },

  { key: "nb_techniciens", label: "Nb Tech", type: "number", width: 90 },
  { key: "duree_trajet_h", label: "Durée (h)", type: "number", width: 100 },
  { key: "nb_nuits", label: "Nuits", type: "number", width: 90 },
  { key: "nb_repas", label: "Repas", type: "number", width: 90 },

  { key: "tauxhoraire", label: "Taux H. (€)", type: "number", width: 110 },
  { key: "prixhotel", label: "Prix Nuit (€)", type: "number", width: 120 },
  { key: "prixrepas", label: "Prix Repas (€)", type: "number", width: 120 },

  { key: "transport_unitaire", label: "Transport (€)", type: "number", width: 130 },

  {
    key: "pose_prix", label: "Coût M.O.", type: "formula",
    formula: "nb_techniciens * duree_trajet_h * tauxhoraire", width: 110
  },

  {
    key: "hotel_eur", label: "Coût Hôtel", type: "formula",
    formula: "nb_techniciens * nb_nuits * prixhotel", width: 110
  },

  {
    key: "repas_eur", label: "Coût Repas", type: "formula",
    formula: "nb_techniciens * nb_repas * prixrepas", width: 110
  },

  {
    key: "transport_eur", label: "Coût Trans.", type: "formula",
    formula: "nb_techniciens * transport_unitaire", width: 110
  },

  {
    key: "prix_total", label: "Total (€)", type: "formula",
    formula: "NVL(pose_prix,0)+NVL(hotel_eur,0)+NVL(repas_eur,0)+NVL(transport_eur,0)", width: 120
  },
];

export default CHIFFRAGE_SCHEMA_DEP;