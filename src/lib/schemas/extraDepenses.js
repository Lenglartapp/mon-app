// Tableau libre pour lignes "Autres dépenses"
export const EXTRA_DEPENSES_SCHEMA = [
  { key: "produit", label: "Produit", type: "text", width: 0, hidden: true, defaultValue: "Autre Dépense" },
  {
    key: "categorie", label: "Catégorie", type: "singleSelect",
    valueOptions: [
      'Transport Vente',
      'Transport Sous-Traitance',
      'Commission Partenaire',
      'Commission Commerciale Interne',
      'Intérim',
      'Aide ST Pose',
      'Aide ST Conf'
    ],
    width: 220
  },
  { key: "libelle", label: "Libellé", type: "text", width: 220 },
  {
    key: "pourcentage",
    label: "%",
    type: "number",
    width: 80,
    editable: (params) => {
      // Editable only if category contains "Commission"
      const cat = params.row.categorie || "";
      return cat.includes("Commission");
    }
  },
  { key: "prix_total", label: "Montant (€)", type: "number", width: 140 },
  { key: "croquis", label: "Croquis", type: "croquis", width: 140 },
  { key: "commentaire", label: "Commentaire", type: "text", width: 200 }
];

export default EXTRA_DEPENSES_SCHEMA;