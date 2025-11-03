// Tableau libre pour lignes "Autres dépenses" (locations, intérim, commissions, etc.)
export const EXTRA_DEPENSES_SCHEMA = [
  { key: "categorie",   label: "Catégorie",   type: "select",
    options: ["Location", "Intérim", "Commission partenaire", "Commission commerciale", "Divers"],
    width: 180
  },
  { key: "libelle",     label: "Libellé",     type: "text",   width: 220 },
  { key: "montant_eur", label: "Montant (€)", type: "number", width: 140 },
];

export default EXTRA_DEPENSES_SCHEMA;