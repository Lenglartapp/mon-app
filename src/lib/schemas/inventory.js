// Schéma de colonnes pour l'inventaire tissus
export const INVENTORY_SCHEMA = [
  { key: "sel",     label: "Sel.",     type: "checkbox", width: 60 },
  { key: "detail",  label: "Détail",   type: "button",   width: 90 },

  // Liaison projet/ligne
  { key: "tissu_key",    label: "Tissu (clé)",   type: "select", width: 220, options: [] }, // alimenté dynamiquement
  { key: "source_type",  label: "Source",        type: "select", width: 110, options: ["minute","production"] },
  { key: "source_id",    label: "ID Source",     type: "text",   width: 140, readOnly: true },
  { key: "projet_nom",   label: "Projet",        type: "text",   width: 200, readOnly: true },

  // Infos tissu
  { key: "reference",    label: "Référence",     type: "text",   width: 160 },
  { key: "coloris",      label: "Coloris",       type: "text",   width: 140 },
  { key: "laize",        label: "Laize (cm)",    type: "number", width: 120 },

  // Stock
  { key: "stock_ml",     label: "Stock (ml)",    type: "number", width: 120 },
  { key: "reserve_ml",   label: "Réservé (ml)",  type: "number", width: 120 },
  { key: "dispo_ml",     label: "Dispo (ml)",    type: "formula", width: 120, formula: "NVL(stock_ml,0)-NVL(reserve_ml,0)" },

  // Suivi
  { key: "emplacement",  label: "Emplacement",   type: "text",   width: 160 },
  { key: "statut",       label: "Statut",        type: "select", width: 130, options: ["en stock","en atelier","épuisé"] },
  { key: "commentaire",  label: "Commentaire",   type: "text",   width: 240 },
];