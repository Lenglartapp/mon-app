// src/lib/schemas/production.js
import React from 'react';
// We might need to import UI components if we were defining renderCell here, 
// but usually the Grid component handles the mapping based on 'type'.
// However, the user said "Preserve existing UI interactions".
// The existing code likely maps 'photo' and 'croquis' types to components in the Grid.
// We just need to ensure the keys and types match what the Grid expects.

// Helper to safely extract row from valueGetter args (MUI V5 vs V6 compat)
const getRow = (a, b) => {
  // V6: (value, row) -> b is row
  if (b) return b;
  // V5: (params) -> a.row is row
  if (a && a.row) return a.row;
  return a || {}; // Fallback
};

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Round to 1 decimal place
const round1 = (v) => Math.round(v * 10) / 10;

// Helper for complex calculations
const getters = {
  largeur_finie: (row) => {
    const L = toNum(row.largeur);
    const croisement = toNum(row.croisement);

    // User Formula Update (10% Allowance):
    // Paire: (L/2)*1.10 + Croisement
    // Single: L*1.10

    let val = 0;
    // Check if it's "Un seul pan" (or similar variations)
    const isOnePanel = (row.paire_ou_un_seul_pan || "").startsWith("Un seul pan") || (row.pair_un || "").startsWith("Un seul pan");

    if (!isOnePanel) {
      // Paire (Default)
      const halfL = L / 2;
      val = (halfL * 1.10) + croisement;
    } else {
      // Un seul pan (All variants)
      val = L * 1.10;
    }
    return round1(val);
  },

  a_plat: (row) => {
    // Only depends on Largeur Finie, not Height.
    // L_Finie depends on Width.
    // So this is safe.
    const lFinie = getters.largeur_finie(row);
    const ampleur = toNum(row.ampleur) || 1;
    const vOurlets = toNum(row.v_ourlets_de_cotes || row.val_ourlet_cote); // mapped

    let val = 0;
    // Check if it's "Un seul pan" (or similar variations)
    const isOnePanel = (row.paire_ou_un_seul_pan || "").startsWith("Un seul pan") || (row.pair_un || "").startsWith("Un seul pan");

    if (!isOnePanel) {
      val = (lFinie * ampleur) + (vOurlets * 4);
    } else {
      val = (lFinie * ampleur) + (vOurlets * 2);
    }
    return round1(val);
  },

  hauteur_finie_droite: (row) => {
    const H = toNum(row.hspf_droite);
    const ded = toNum(row.valeur_deduction || row.val_ded_rail);
    const fBas = toNum(row.finition_bas || row.f_bas);
    return round1(H - ded + fBas);
  },

  hauteur_finie_gauche: (row) => {
    const H = toNum(row.hspf_gauche);
    const ded = toNum(row.valeur_deduction || row.val_ded_rail);
    const fBas = toNum(row.finition_bas || row.f_bas);
    return round1(H - ded + fBas);
  },

  hauteur_coupe: (row) => {
    // Need a unified Hauteur Finie to calculate Cut Height?
    // User didn't ask for Hauteur Coupe Droit/Gauche. Just Finie.
    // So Hauteur Coupe likely uses the MAX of Finie? Or ONE of them?
    // Let's assume MAX for now to cover material needs.
    const hFinieD = getters.hauteur_finie_droite(row);
    const hFinieG = getters.hauteur_finie_gauche(row);
    const hFinie = Math.max(hFinieD, hFinieG);

    const laize = toNum(row.laize_tissu1 || row.laize_tissu_deco1);
    const aPlat = getters.a_plat(row);

    if (laize > (hFinie + 50)) {
      return round1(aPlat);
    }
    return round1(hFinie + 50);
  },

  nb_glisseurs: (row) => {
    // Formula Update:
    // Wave 60 -> Divider 6
    // Wave 80 -> Divider 8
    // Default -> Divider 10
    // Logic:
    // Paire: 2 * RoundToEven( (L_Finie / Div) + 2 )
    // Single: RoundToEven( (L_Finie / Div) + 2 )

    const lFinie = getters.largeur_finie(row);
    if (!lFinie) return 0;

    let divider = 10;
    const typeConf = (row.type_confection || "").toLowerCase();

    if (typeConf.includes("wave 60")) {
      divider = 6;
    } else if (typeConf.includes("wave 80")) {
      divider = 8;
    }

    // Helper: Round to nearest even number (usually Ceiling for safety?)
    // Prompt says "Arrondir au nombre pair le plus proche".
    // Math.round to nearest even.
    const roundToEven = (num) => {
      const rounded = Math.round(num);
      return (rounded % 2 === 0) ? rounded : rounded + 1; // Round UP to next even if odd? Or just closest?
      // "plus proche" usually means closest. 
      // If 13 -> 14? or 12? Context: Gliders usually need to be even or matched.
      // Let's assume Ceil to next Even to be safe for hardware abundance.
      // Actually standard wave logic often requires even number of gliders per panel.
      // Let's use Ceil to Even.
      const ceil = Math.ceil(num);
      return (ceil % 2 === 0) ? ceil : ceil + 1;
    };

    // Calculate base gliders per panel (or total for single)
    const rawVal = (lFinie / divider) + 2;
    const glidersPerPanel = roundToEven(rawVal);

    // Check Paire vs Single
    const isOnePanel = (row.paire_ou_un_seul_pan || "").startsWith("Un seul pan") || (row.pair_un || "").startsWith("Un seul pan");

    if (isOnePanel) {
      return glidersPerPanel;
    } else {
      // Paire: 2 * Gliders per panel
      return glidersPerPanel * 2;
    }
  }
};


export const SCHEMA_64 = [
  // A. Saisies Générales & Identité
  { key: "sel", label: "Sel.", type: "checkbox", width: 50 },
  { key: "detail", label: "Détail", type: "button", width: 90 }, // Keep existing UI trigger
  { key: "zone", label: "Zone", type: "text", width: 100, editable: true },
  { key: "piece", label: "Pièce", type: "text", width: 100, editable: true },
  { key: "produit", label: "Produit", type: "select", options: ["Rideau", "Voilage", "Store Bateau", "Autres"], width: 120, editable: true },
  { key: "type_confection", label: "Type Conf.", type: "select", options: ["Pli Flamand", "Plis Creux", "Pli Plat", "Tripli", "Wave 80", "Wave 60", "Pli Couteau", "A Plat"], width: 140, editable: true },
  { key: "hauteur_renfort_tete", label: "H/Renfort Têtes", type: "text", width: 140, editable: true },
  { key: "paire_ou_un_seul_pan", label: "Paire ou un Pan", type: "select", options: ["Paire", "Un seul pan", "Un seul pan (Rapatriement Droit)", "Un seul pan (Rapatriement Gauche)"], width: 180, editable: true },
  { key: "ampleur", label: "Ampleur", type: "number", width: 80, editable: true },
  { key: "largeur_mecanisme", label: "L. Méca (cm)", type: "number", width: 110, editable: true },
  { key: "largeur", label: "Largeur (cm)", type: "number", width: 110, editable: true },

  // B. Calculs de Largeur
  {
    key: "largeur_finie",
    label: "L. Finie",
    type: "number",
    width: 100,
    readOnly: true,
    valueGetter: (v, r) => getters.largeur_finie(getRow(v, r))
  },
  {
    key: "a_plat",
    label: "A Plat",
    type: "number",
    width: 100,
    readOnly: true,
    valueGetter: (v, r) => getters.a_plat(getRow(v, r))
  },
  { key: "v_ourlets_de_cotes", label: "Ourlets Côtés", type: "number", width: 110, editable: true },


  // C. Hauteurs & Coupe
  { key: "hspf_droite", label: "HSPF Droit", type: "number", width: 110, editable: true },
  { key: "hspf_gauche", label: "HSPF Gauche", type: "number", width: 110, editable: true },
  {
    key: "statut_cotes",
    label: "Statut Côtes",
    type: "select",
    options: ['Définitive', 'Déduction restante à faire', 'Non exploitable'],
    width: 160,
    editable: true
  },
  { key: "valeur_deduction", label: "Val. Déduc.", type: "number", width: 100, editable: true },
  { key: "finition_bas", label: "Finition Bas", type: "number", width: 100, editable: true },
  {
    key: "hauteur_finie_droite",
    label: "H. Finie Droite",
    type: "number",
    width: 110,
    readOnly: true,
    valueGetter: (v, r) => getters.hauteur_finie_droite(getRow(v, r))
  },
  {
    key: "hauteur_finie_gauche",
    label: "H. Finie Gauche",
    type: "number",
    width: 110,
    readOnly: true,
    valueGetter: (v, r) => getters.hauteur_finie_gauche(getRow(v, r))
  },
  {
    key: "hauteur_coupe",
    label: "H. Coupe",
    type: "number",
    width: 100,
    readOnly: true,
    valueGetter: (v, r) => getters.hauteur_coupe(getRow(v, r))
  },
  {
    key: "hauteur_coupe_motif",
    label: "H. Coupe Motif",
    type: "number",
    width: 120,
    readOnly: true,
    valueGetter: (v, r) => {
      const row = getRow(v, r);
      const hCoupe = getters.hauteur_coupe(row);
      const rV = toNum(row.raccord_v_tissu1);
      if (rV > 0) return Math.ceil(hCoupe / rV) * rV;
      return hCoupe;
    }
  },
  {
    key: "hauteur_coupe_doublure",
    label: "H. Coupe Doubl.",
    type: "number",
    width: 120,
    readOnly: true,
    valueGetter: (v, r) => {
      const row = getRow(v, r);
      // Use Max Height for Lining Cut Logic?
      const hFinieD = getters.hauteur_finie_droite(row);
      const hFinieG = getters.hauteur_finie_gauche(row);
      const hFinie = Math.max(hFinieD, hFinieG);

      const laizeD = toNum(row.laize_doublure);
      const aPlat = getters.a_plat(row);
      // Rule: Same as H_Coupe but with Lining Laize logic
      if (laizeD > (hFinie + 50)) return aPlat;
      return hFinie + 50;
    }
  },

  // D. Détails Confection
  {
    key: "nombre_les",
    label: "Nb Lés",
    type: "number",
    width: 80,
    readOnly: true,
    valueGetter: (v, r) => {
      const row = getRow(v, r);
      const aPlat = getters.a_plat(row);
      const laize = toNum(row.laize_tissu1);
      if (laize <= 0) return 0;
      return Math.max(1, Math.ceil(aPlat / laize));
    }
  },
  { key: "piquage_ourlets_du_bas", label: "Piq. Bas", type: "number", width: 100, editable: true },
  { key: "doublure_finition_bas", label: "Doubl. Fin. Bas", type: "number", width: 120, editable: true },
  { key: "finition_champs", label: "Fin. Champs", type: "number", width: 100, editable: true },
  { key: "poids", label: "Poids", type: "select", options: ["Oui", "Non"], width: 80, editable: true },

  // Onglets: Non / Régulier / Irrégulier
  { key: "onglets", label: "Onglets", type: "select", options: ["Non", "Régulier", "Irrégulier"], width: 120, editable: true },

  { key: "bride", label: "Bride", type: "select", options: ["Oui", "Non"], width: 80, editable: true },

  // Crochets: Américain / Escargot
  { key: "type_crochets", label: "Crochets", type: "select", options: ['Crochet Américain', 'Crochet Escargot'], width: 140, editable: true },

  // Point Chausson: Oui / Non
  { key: "point_chausson", label: "Point Chausson", type: "select", options: ["Oui", "Non"], width: 120, editable: true },

  // E. Matériaux
  { key: "tissu_deco1", label: "Tissu 1", type: "text", width: 140, editable: true },
  { key: "laize_tissu1", label: "Laize T1", type: "number", width: 90, editable: true },
  { key: "raccord_v_tissu1", label: "Raccord V T1", type: "number", width: 100, editable: true },
  { key: "raccord_h_tissu1", label: "Raccord H T1", type: "number", width: 100, editable: true },
  { key: "tissu_deco2", label: "Tissu 2", type: "text", width: 140, editable: true },
  { key: "laize_tissu2", label: "Laize T2", type: "number", width: 90, editable: true },
  { key: "raccord_v_tissu2", label: "Raccord V T2", type: "number", width: 100, editable: true },
  { key: "raccord_h_tissu2", label: "Raccord H T2", type: "number", width: 100, editable: true },
  { key: "doublure", label: "Doublure", type: "text", width: 140, editable: true },
  { key: "laize_doublure", label: "Laize D.", type: "number", width: 90, editable: true },
  { key: "inter_doublure", label: "Interdoublure", type: "text", width: 140 },
  { key: "laize_inter", label: "Laize Interdoublure", type: "number", width: 160 },
  { key: "passementerie1", label: "Pass. 1", type: "text", width: 140, editable: true },
  { key: "application_passementerie1", label: "Appli Pass. 1", type: "text", width: 120, editable: true },
  { key: "passementerie2", label: "Pass. 2", type: "text", width: 140, editable: true },
  { key: "application_passementerie2", label: "Appli Pass. 2", type: "text", width: 120, editable: true },

  // F. Finitions & Logistique Atelier
  { key: "croisement", label: "Croisement", type: "number", width: 90, editable: true },

  // Type de Croisement (NEW)
  {
    key: "type_croisement",
    label: "Type Croisement",
    type: "select",
    options: [
      "Croisement par chevauchement rail",
      "Patte de croisement devant derrière",
      "Patte de croisement double devant",
      "Croisement simple arrière gauche",
      "Croisement simple arrière droit"
    ],
    width: 200,
    editable: true
  },

  { key: "retour_gauche", label: "Retour G", type: "number", width: 90, editable: true },
  { key: "retour_droit", label: "Retour D", type: "number", width: 90, editable: true },
  { key: "type_retours", label: "Type Retours", type: "select", options: ['Élastique', 'Velcro'], width: 120, editable: true },
  { key: "etiquette_lavage", label: "Etiq. Lavage", type: "select", options: ["Oui", "Non"], width: 100, editable: true },
  { key: "etiquette_lenglart", label: "Etiq. Lenglart", type: "select", options: ["Oui", "Non"], width: 100, editable: true, defaultValue: "Oui" },
  { key: "schema", label: "Modèle", type: "croquis", width: 100 }, // PRESERVED COMPONENT
  { key: "type_mecanisme", label: "Type Méca", type: "text", width: 120, editable: true },
  { key: "modele_mecanisme", label: "Modèle Méca", type: "text", width: 140, editable: true },
  { key: "couleur_mecanisme", label: "Couleur Méca", type: "text", width: 120, editable: true },
  { key: "meca_couvert", label: "Méca Couvert", type: "select", options: ["Couvert", "Mi-Couvert", "Découvert"], width: 120, editable: true },

  // Type de Commande (NEW)
  {
    key: "type_commande",
    label: "Type Commande",
    type: "select",
    options: [
      "Manuelle",
      "Télécommande/Radio",
      "Commande murale Radio",
      "Commande murale Sec",
      "Fourni par le client"
    ],
    width: 150,
    editable: true
  },

  {
    key: "nombre_glisseur",
    label: "Nb Glisseurs",
    type: "number",
    width: 100,
    readOnly: true,
    valueGetter: (v, row) => getters.nb_glisseurs(row)
  },

  { key: "couleur_glisseur", label: "Couleur Glisseur", type: "text", width: 120, editable: true },
  { key: "piton", label: "Piton", type: "text", width: 100, editable: true },
  { key: "embout_meca", label: "Embout Méca", type: "text", width: 120, editable: true },
  { key: "support", label: "Support", type: "text", width: 120, editable: true },
  {
    key: "equerre",
    label: "Equerre",
    type: "select",
    options: ["5", "8", "12", "18", "F7,5", "F10"],
    width: 100,
    editable: true
  },

  // G. Suivi & Statuts
  { key: "type_pose", label: "Type Pose", type: "text", width: 120, editable: true },
  { key: "heures_confection", label: "H. Conf.", type: "number", width: 80, editable: true },
  { key: "statut_pose", label: "Statut Pose", type: "select", options: ['Non démarré', 'Méca posé', 'Accroché', 'Terminé', 'Reprise'], width: 140, editable: true },
  { key: "statut_prepa", label: "Statut Prépa", type: "select", options: ['Non démarré', 'En cours', 'Terminé'], width: 140, editable: true },
  { key: "statut_conf", label: "Statut Conf", type: "select", options: ['Non démarré', 'En cours', 'Terminé'], width: 140, editable: true },
  // PRESERVED COMPONENTS
  { key: "schema_principe", label: "Schéma Principe", type: "photo", width: 150 }, // NEW
  { key: "photos_sur_site", label: "Photos Site", type: "photo", width: 150 },
  { key: "croquis", label: "Croquis Atelier", type: "croquis", width: 150 },
];