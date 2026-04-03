// src/lib/schemas/deplacement.js
// Schéma STRICT pour la logistique (Déplacements)

export const CHIFFRAGE_SCHEMA_DEP = [
  // -1. Libellé (Libre)
  {
    key: "libelle",
    label: "Libellé",
    type: "text",
    width: 200
  },

  // 0. Type de déplacement
  {
    key: "type_deplacement",
    label: "Type",
    type: "select",
    options: ["Déplacement", "Prise de cotes", "Prise de cotes avec déplacement"],
    width: 240,
    tooltip: "Détermine le mode de calcul de la ligne :\n• Déplacement : tous les champs sont calculés automatiquement (trajet, nuits, repas, billet).\n• Prise de cotes : seul le champ H. Facturées est saisissable manuellement. Tous les autres sont bloqués (nuits, repas, billet = 0).\n• Prise de cotes avec déplacement : même calcul automatique que Déplacement."
  },

  // 1. Nb Tech
  {
    key: "nb_tech",
    label: "Nb tech",
    type: "number",
    width: 130,
    readOnly: (row) => row.type_deplacement === "Prise de cotes",
    tooltip: "Nombre de techniciens participant au déplacement.\nMultiplie les H. Facturées, les nuits, les repas et les billets.\n⚠ Bloqué en mode Prise de cotes."
  },

  // 2. Nb A/R
  {
    key: "nb_allers_retours",
    label: "Nb A/R",
    type: "number",
    width: 130,
    readOnly: (row) => row.type_deplacement === "Prise de cotes",
    tooltip: "Nombre d'allers-retours effectués.\nMultiplie les H. Facturées et le coût billet.\n⚠ Bloqué en mode Prise de cotes."
  },

  // 3. Temps de Trajet A/R (Saisi, réel, ex: 6h)
  {
    key: "temps_trajet",
    label: "Temps Trajet A/R",
    type: "number",
    width: 175,
    readOnly: (row) => row.type_deplacement === "Prise de cotes",
    tooltip: "Durée totale aller-retour en heures (ex : saisir 6 pour 3h aller + 3h retour).\nSert de base au calcul des H. Facturées.\n⚠ Bloqué en mode Prise de cotes."
  },

  // 4. Heure Facturé Trajet (Calculé)
  {
    key: "heures_facturees",
    label: "H. Facturées",
    type: "number",
    width: 130,
    readOnly: (row) => row.type_deplacement !== "Prise de cotes",
    tooltip: "Heures de trajet facturées au client.\n\n📐 Déplacement / Prise de cotes avec déplacement (calculé automatiquement) :\n1. Temps aller = Temps A/R ÷ 2\n2. Arrondi au plafond pair : 1-2h→2h, 3-4h→4h, 5-6h→6h, 7-8h→8h\n3. Total = Aller arrondi × 2 (retour inclus) × Nb A/R × Nb tech\n4. Si aller > 8h : les heures au-delà de 8h sont majorées à +25% dans le Coût MO\n\n✏ Prise de cotes : saisie manuelle libre."
  },

  // 5. Durée jours intervention (Saisi)
  {
    key: "duree_intervention_jours",
    label: "Jours Inter.",
    type: "number",
    width: 130,
    readOnly: (row) => row.type_deplacement === "Prise de cotes",
    tooltip: "Durée de l'intervention sur site en jours.\nUtilisé pour calculer le nombre de nuits (Jours - 1) et de repas (Jours × 2) si Découchage = Oui.\n⚠ Bloqué en mode Prise de cotes."
  },

  // 6. Billet Avion/Train (PU)
  {
    key: "prix_billet",
    label: "Prix Billet",
    type: "number",
    width: 150,
    readOnly: (row) => row.type_deplacement === "Prise de cotes",
    valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value),
    tooltip: "Prix unitaire du billet (avion ou train) par technicien et par A/R.\nCoût Transport = Prix Billet × Nb tech × Nb A/R.\n⚠ Bloqué en mode Prise de cotes."
  },

  // 7. Découchage (Select)
  {
    key: "decouchage",
    label: "Découchage",
    type: "select",
    options: ["Oui", "Non"],
    width: 130,
    readOnly: (row) => row.type_deplacement === "Prise de cotes",
    tooltip: "Active la prise en charge des nuits et repas.\n• Oui → Nb Nuits = (Jours - 1) × Nb tech / Nb Repas = Jours × 2 × Nb tech\n• Non → Nuits et repas = 0\n⚠ Bloqué en mode Prise de cotes."
  },

  // 8. Nb de Nuit (Auto)
  {
    key: "nb_nuits",
    label: "Nb Nuits",
    type: "number",
    width: 150,
    readOnly: true,
    tooltip: "Calculé automatiquement si Découchage = Oui.\nFormule : (Jours Inter. - 1) × Nb tech\nEx : 3 jours, 2 tech → (3-1) × 2 = 4 nuits\nToujours 0 en Prise de cotes."
  },

  // 9. Nb de Repas (Auto)
  {
    key: "nb_repas",
    label: "Nb Repas",
    type: "number",
    width: 140,
    readOnly: true,
    tooltip: "Calculé automatiquement si Découchage = Oui.\nFormule : Jours Inter. × 2 × Nb tech (déjeuner + dîner chaque jour)\nEx : 3 jours, 2 tech → 3 × 2 × 2 = 12 repas\nToujours 0 en Prise de cotes."
  },

  // 10. Main D'œuvre (Coût Trajet)
  {
    key: "cout_mo",
    label: "Coût MO",
    type: "number",
    width: 150,
    readOnly: true,
    valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value),
    tooltip: "Coût main d'œuvre du trajet, basé sur le taux horaire des paramètres globaux.\n\n📐 Déplacement / Prise de cotes avec déplacement :\n• Si aller ≤ 8h : Coût = H. Facturées × Taux horaire\n• Si aller > 8h : les 16 premières heures (8h aller + retour) au tarif normal, les heures supplémentaires au tarif × 1,25\n\n✏ Prise de cotes : Coût = H. Facturées (saisie) × Taux horaire"
  },

  // 11. Coût Nuit
  {
    key: "cout_nuits",
    label: "Coût Nuit",
    type: "number",
    width: 130,
    readOnly: true,
    valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value),
    tooltip: "Calculé : Nb Nuits × Prix nuit (paramètres globaux).\nToujours 0 si Découchage = Non ou en Prise de cotes."
  },

  // 12. Coût Repas
  {
    key: "cout_repas",
    label: "Coût Repas",
    type: "number",
    width: 150,
    readOnly: true,
    valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value),
    tooltip: "Calculé : Nb Repas × Prix repas (paramètres globaux).\nToujours 0 si Découchage = Non ou en Prise de cotes."
  },

  // 13. Coût Avion/Train Total
  {
    key: "cout_billet_total",
    label: "Coût Transp.",
    type: "number",
    width: 150,
    readOnly: true,
    valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value),
    tooltip: "Calculé : Prix Billet × Nb tech × Nb A/R.\nToujours 0 en Prise de cotes."
  },

  // 14. Total
  {
    key: "total_price",
    label: "Total",
    type: "number",
    width: 125,
    readOnly: true,
    valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value),
    tooltip: "Total = Coût MO + Coût Nuits + Coût Repas + Coût Transport."
  }
];
