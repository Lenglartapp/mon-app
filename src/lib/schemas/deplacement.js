// src/lib/schemas/deplacement.js
// Schéma STRICT pour la logistique (Déplacements)

export const CHIFFRAGE_SCHEMA_DEP = [
  // 0. Type de déplacement (Nouveau)
  {
    key: "type_deplacement", // Mapped to 'type' in recomputeRow? Or just a label?
    label: "Type",
    type: "select",
    options: ["Déplacement", "Prise de cotes"],
    width: 140
  },

  // 1. Nb Tech
  { key: "nb_tech", label: "Nb tech", type: "number", width: 80 },

  // 2. Nb A/R
  { key: "nb_allers_retours", label: "Nb A/R", type: "number", width: 80 }, // Default 1

  // 3. Temps de Trajet A/R (Saisi, réel, ex: 6h)
  { key: "temps_trajet", label: "Temps Trajet A/R", type: "number", width: 130 },

  // 4. Heure Facturé Trajet (Calculé : Arrondi 4h par trajet simple)
  { key: "heures_facturees", label: "H. Facturées", type: "number", width: 110, readOnly: true },

  // 5. Durée jours intervention (Saisi)
  { key: "duree_intervention_jours", label: "Jours Inter.", type: "number", width: 100 },

  // 6. Billet Avion/Train (PU)
  { key: "prix_billet", label: "Prix Billet", type: "number", width: 100, valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value) },

  // 7. Découchage (Select)
  {
    key: "decouchage",
    label: "Découchage",
    type: "select",
    options: ["Oui", "Non"],
    width: 100
  },

  // 8. Nb de Nuit (Auto)
  { key: "nb_nuits", label: "Nb Nuits", type: "number", width: 90, readOnly: true },

  // 9. Nb de Repas (Auto)
  { key: "nb_repas", label: "Nb Repas", type: "number", width: 90, readOnly: true },

  // 10. Main D'œuvre (Coût Trajet)
  { key: "cout_mo", label: "Coût MO", type: "number", width: 100, readOnly: true, valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value) },

  // 11. Coût Nuit
  { key: "cout_nuits", label: "Coût Nuit", type: "number", width: 100, readOnly: true, valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value) },

  // 12. Coût Repas
  { key: "cout_repas", label: "Coût Repas", type: "number", width: 100, readOnly: true, valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value) },

  // 13. Coût Avion/Train Total
  { key: "cout_billet_total", label: "Coût Transp.", type: "number", width: 110, readOnly: true, valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value) },

  // 14. Total
  {
    key: "total_price",
    label: "Total",
    type: "number",
    width: 120,
    readOnly: true,
    valueGetter: (params) => params.row.total_price || 0,
    valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value)
  }
];