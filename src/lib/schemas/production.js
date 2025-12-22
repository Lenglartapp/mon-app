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

    // User Formula Update:
    // Paire: (L/2)*1.07 + Croisement
    // Single: L*1.07

    let val = 0;
    if (row.paire_ou_un_seul_pan === 'Paire' || row.pair_un === 'Paire') {
      const halfL = L / 2;
      val = (halfL * 1.07) + croisement;
    } else {
      // Un seul pan
      val = L * 1.07;
    }
    return round1(val);
  },

  a_plat: (row) => {
    const lFinie = getters.largeur_finie(row);
    const ampleur = toNum(row.ampleur) || 1;
    const vOurlets = toNum(row.v_ourlets_de_cotes || row.val_ourlet_cote); // mapped

    let val = 0;
    if (row.paire_ou_un_seul_pan === 'Paire' || row.pair_un === 'Paire') {
      val = (lFinie * ampleur) + (vOurlets * 4);
    } else {
      val = (lFinie * ampleur) + (vOurlets * 2);
    }
    return round1(val);
  },

  hauteur_finie: (row) => {
    const H = toNum(row.hauteur);
    const ded = toNum(row.valeur_deduction || row.val_ded_rail);
    const fBas = toNum(row.finition_bas || row.f_bas);
    return round1(H - ded + fBas);
  },

  hauteur_coupe: (row) => {
    const hFinie = getters.hauteur_finie(row);
    const laize = toNum(row.laize_tissu1 || row.laize_tissu_deco1);
    const aPlat = getters.a_plat(row);

    // Railroaded Logic: If Laize > (H_Finie + 50) -> Use A_Plat
    if (laize > (hFinie + 50)) {
      return round1(aPlat);
    }
    return round1(hFinie + 50);
  },

  nb_glisseurs: (row) => {
    const lMeca = toNum(row.largeur_mecanisme || row.l_mecanisme);
    const base = Math.round(lMeca / 10);
    if (row.paire_ou_un_seul_pan === 'Paire' || row.pair_un === 'Paire') {
      return base + 4;
    }
    return base + 2;
  }
};


export const SCHEMA_64 = [
  // A. Saisies Générales & Identité
  { key: "sel", label: "Sel.", type: "checkbox", width: 50 },
  { key: "detail", label: "Détail", type: "button", width: 90 }, // Keep existing UI trigger
  { key: "zone", label: "Zone", type: "text", width: 100, editable: true },
  { key: "piece", label: "Pièce", type: "text", width: 100, editable: true },
  { key: "produit", label: "Produit", type: "select", options: ["Rideau", "Voilage", "Store Bateau", "Autres"], width: 120, editable: true },
  { key: "type_confection", label: "Type Conf.", type: "select", options: ["Wave 80", "Wave 60", "Couteau", "Flamand", "Triplis", "Creux", "Taylor", "Tuyaux d'orgue", "Plat", "A plat"], width: 140, editable: true },
  { key: "hauteur_tetes", label: "H. Têtes (cm)", type: "number", width: 100, editable: true },
  { key: "paire_ou_un_seul_pan", label: "Paire/Unic", type: "select", options: ["Paire", "Un seul pan"], width: 120, editable: true },
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
  { key: "renfort_tetes", label: "Renfort Têtes", type: "number", width: 110, editable: true },

  // C. Hauteurs & Coupe
  { key: "hauteur", label: "Hauteur (cm)", type: "number", width: 110, editable: true },
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
    key: "hauteur_finie",
    label: "H. Finie",
    type: "number",
    width: 100,
    readOnly: true,
    valueGetter: (v, r) => getters.hauteur_finie(getRow(v, r))
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
      const hFinie = getters.hauteur_finie(row);
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
  { key: "onglets", label: "Onglets", type: "select", options: ["Oui", "Non"], width: 80, editable: true },
  { key: "bride", label: "Bride", type: "select", options: ["Oui", "Non"], width: 80, editable: true },
  { key: "type_crochets", label: "Crochets", type: "select", options: ['Américain', 'Escargot', 'Microflex'], width: 120, editable: true },

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
  { key: "retour_gauche", label: "Retour G", type: "number", width: 90, editable: true },
  { key: "retour_droit", label: "Retour D", type: "number", width: 90, editable: true },
  { key: "type_retours", label: "Type Retours", type: "select", options: ['Élastique', 'Velcro'], width: 120, editable: true },
  { key: "etiquette_lavage", label: "Etiq. Lavage", type: "select", options: ["Oui", "Non"], width: 100, editable: true },
  { key: "etiquette_lenglart", label: "Etiq. Lenglart", type: "select", options: ["Oui", "Non"], width: 100, editable: true },
  { key: "schema", label: "Modèle", type: "croquis", width: 100 }, // PRESERVED COMPONENT
  { key: "type_mecanisme", label: "Type Méca", type: "text", width: 120, editable: true },
  { key: "modele_mecanisme", label: "Modèle Méca", type: "text", width: 140, editable: true },
  { key: "couleur_mecanisme", label: "Couleur Méca", type: "text", width: 120, editable: true },
  {
    key: "nombre_glisseur",
    label: "Nb Glisseurs",
    type: "number",
    width: 100,
    readOnly: true,
    valueGetter: (v, row) => getters.nb_glisseurs(row)
  },
  { key: "supports_embouts_meca", label: "Supp./Embouts", type: "text", width: 140, editable: true },

  // G. Suivi & Statuts
  { key: "type_pose", label: "Type Pose", type: "text", width: 120, editable: true },
  { key: "heures_confection", label: "H. Conf.", type: "number", width: 80, editable: true },
  { key: "statut_pose", label: "Statut Pose", type: "select", options: ['Non démarré', 'Méca posé', 'Accroché', 'Terminé', 'Reprise'], width: 140, editable: true },
  { key: "statut_prepa", label: "Statut Prépa", type: "select", options: ['Non démarré', 'En cours', 'Terminé'], width: 140, editable: true },
  { key: "statut_conf", label: "Statut Conf", type: "select", options: ['Non démarré', 'En cours', 'Terminé'], width: 140, editable: true },
  // PRESERVED COMPONENTS
  { key: "photos_sur_site", label: "Photos Site", type: "photo", width: 150 },
  { key: "croquis", label: "Croquis Atelier", type: "croquis", width: 150 },
];