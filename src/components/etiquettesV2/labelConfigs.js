// src/components/etiquettesV2/labelConfigs.js
// Définition déclarative des étiquettes V2 par type de produit.
// Chaque champ : { key, label, w (largeur en unités de grille, défaut 1),
//                  accent (bool ou fn(row, v) → bool), value (fn(row, v) → string) }
// Le layout V2 ne fixe pas de lignes : les champs visibles sont re-packés
// en lignes de WIDTH_UNITS unités, donc masquer un champ recompacte tout.

import { RIDEAUX_GETTERS } from "../../lib/schemas/production/rideaux.js";
import { STORES_BATEAUX_GETTERS } from "../../lib/schemas/production/stores_bateaux.js";

// Capacité d'une ligne en unités de largeur (un champ standard = 1, large = 2)
export const WIDTH_UNITS = 6;

const statutAccent = (row, v) => {
  const val = v(row, "statut_cotes");
  return val !== "—" && !["Définitive", "Validé par chef de projet"].includes(val);
};

const passValue = (n) => (row, v) =>
  [v(row, `passementerie${n}`), v(row, `application_passementerie${n}`)]
    .filter((x) => x !== "—").join(" — ") || "—";

export const LABEL_CONFIGS = {
  rideaux: {
    getters: RIDEAUX_GETTERS,
    commentKey: "commentaire_confection",
    croquisTitle: "Croquis atelier",
    getCroquis: (row) => {
      const arr = Array.isArray(row?.schema) ? row.schema : [];
      return arr[0]?.url
        || (typeof row?.schema === "string" ? row.schema : null)
        || (Array.isArray(row?.schema_principe) ? row.schema_principe[0]?.url : null);
    },
    sections: [
      {
        title: "Confection",
        fields: [
          { key: "type_confection",      label: "Type conf.",      w: 2 },
          { key: "paire_ou_un_seul_pan", label: "Paire/Pan",       w: 2 },
          { key: "ampleur",              label: "Ampleur" },
          { key: "hauteur_renfort_tete", label: "H. Renfort" },
          { key: "poids",                label: "Poids" },
          { key: "onglets",              label: "Onglets" },
          { key: "bride",                label: "Bride" },
          { key: "point_chausson",       label: "Pt. chausson" },
          { key: "type_crochets",        label: "Crochets",        w: 2 },
          { key: "etiquette_lavage",     label: "Étiq. lavage",    w: 2 },
          { key: "etiquette_lenglart",   label: "Étiq. Lenglart",  w: 2 },
        ],
      },
      {
        title: "Ourlets & Bas",
        fields: [
          { key: "piquage_ourlets_du_bas",       label: "OB Tissu",         w: 2 },
          { key: "piquage_ourlet",               label: "Piquage ourlet",   w: 2 },
          { key: "finition_bas",                 label: "Cassant / Rasant", w: 2 },
          { key: "piquage_ourlets_bas_doublure", label: "OB Doublure",      w: 2 },
          { key: "deduction_doublure",           label: "Déd. Doublure",    w: 2 },
          { key: "doublure_finition_bas",        label: "Doubl. fin. bas",  w: 2 },
          { key: "v_ourlets_de_cotes",           label: "Ourlets de côté",  w: 2 },
          { key: "finition_champs",              label: "Finition chant",   w: 2 },
        ],
      },
      {
        title: "Dimensions",
        fields: [
          { key: "nombre_les",            label: "Nb lés", plusAfterIfNext: "reste_les" },
          { key: "reste_les",             label: "Appiècement cm" },
          { key: "a_plat",                label: "À Plat" },
          { key: "largeur_finie",         label: "L. Finie" },
          { key: "retour_gauche",         label: "Retour G" },
          { key: "retour_droit",          label: "Retour D" },
          { key: "hauteur_finie_gauche",  label: "H. Finie G" },
          { key: "hauteur_finie_milieu",  label: "H. Finie M" },
          { key: "hauteur_finie_droite",  label: "H. Finie D" },
          { key: "nombre_glisseur",       label: "Nb glisseurs" },
          { key: "statut_cotes",          label: "Statut côtes", w: 2, accent: statutAccent },
          { key: "hauteur_coupe",         label: "H. Coupe T1" },
          { key: "hauteur_coupe_motif",   label: "H. Coupe motif" },
          { key: "hauteur_coupe_doublure",label: "H. Coupe doubl." },
        ],
      },
      {
        title: "Mécanisme",
        fields: [
          { key: "type_mecanisme",   label: "Type Méca",       w: 2 },
          { key: "modele_mecanisme", label: "Modèle Méca",     w: 2 },
          { key: "meca_couvert",     label: "Méca Couvert",    w: 2 },
          { key: "type_croisement",  label: "Type Croisement", w: 2 },
        ],
      },
      {
        title: "Matériaux",
        fields: [
          { key: "tissu_deco1",    label: "Tissu 1",       w: 2, accent: true },
          { key: "laize_tissu1",   label: "Laize T1" },
          { key: "tissu_deco2",    label: "Tissu 2",       w: 2, accent: true },
          { key: "laize_tissu2",   label: "Laize T2" },
          { key: "doublure",       label: "Doublure",      w: 2, accent: true },
          { key: "laize_doublure", label: "Laize Doubl." },
          { key: "inter_doublure", label: "Interdoublure", w: 2 },
          { key: "laize_inter",    label: "Laize Inter." },
          { key: "passementerie1", label: "Pass. 1",       w: 3, value: passValue(1) },
          { key: "passementerie2", label: "Pass. 2",       w: 3, value: passValue(2) },
        ],
      },
    ],
  },

  stores_bateaux: {
    getters: STORES_BATEAUX_GETTERS,
    commentKey: "commentaire_confection",
    croquisTitle: "Croquis intervalles",
    getCroquis: (row) =>
      Array.isArray(row?.croquis_intervalle) ? row.croquis_intervalle[0]?.url || null : null,
    sections: [
      {
        title: "Dimensions",
        fields: [
          { key: "largeur",        label: "Largeur" },
          { key: "largeur_finie",  label: "L. Finie" },
          { key: "ourlet_de_cote", label: "Ourlet côté" },
          { key: "hauteur_finie",  label: "H. Finie" },
          { key: "statut_cotes",   label: "Statut côtes", w: 2, accent: statutAccent },
        ],
      },
      {
        title: "Coupes & Finitions",
        fields: [
          { key: "hauteur_coupe",            label: "H. Coupe" },
          { key: "hauteur_coupe_motif",      label: "H. Coupe motif" },
          { key: "hauteur_coupe_doublure",   label: "H. Coupe doubl." },
          { key: "picage_bas",               label: "Picage bas" },
          { key: "finition_chant_et_retour", label: "Fin. chant & ret.", w: 2 },
        ],
      },
      {
        title: "Matériaux",
        fields: [
          { key: "toile_finition_1", label: "Tissu 1",      w: 2, accent: true },
          { key: "doublure",         label: "Doublure",     w: 2, accent: true },
          { key: "etiquette_lavage", label: "Étiq. lavage", w: 2 },
        ],
      },
      {
        title: "Mécanisme",
        fields: [
          { key: "mecanisme_store",            label: "Mécanisme",  w: 2, accent: true },
          { key: "type_commande",              label: "Type cmd.",  w: 2 },
          { key: "cote_manoeuvre",             label: "Côté man." },
          { key: "methode_manoeuvre",          label: "Méthode" },
          { key: "nombre_anneaux_largeur",     label: "Nb anneaux" },
          { key: "deportation_premier_anneau", label: "Déport 1er" },
          { key: "valeur_velcro",              label: "Velcro" },
          { key: "type_pose",                  label: "Pose", w: 3 },
        ],
      },
      {
        title: "Intervalles & Barre",
        fields: [
          { key: "nombre_intervalles",       label: "Nb intervalles" },
          { key: "valeur_intervalle",        label: "Val. intervalle" },
          { key: "longueur_barre_de_charge", label: "Long. barre ch.", w: 2 },
          { key: "longueur_tigette",         label: "Long. tigette",   w: 2 },
        ],
      },
    ],
  },
};

// Valeur d'un champ : getter de schéma si présent, sinon valeur brute de la ligne
export const makeValueGetter = (getters) => (row, key, fallback = "—") => {
  let val;
  if (getters[key]) val = getters[key](row || {});
  else val = row?.[key];
  if (val == null || val === "") return fallback;
  return String(val);
};

// Liste plate {key, label, section} pour les panneaux de choix de champs
export const configToFieldList = (config) =>
  config.sections.flatMap((s) =>
    s.fields.map((f) => ({ key: f.key, label: f.label, section: s.title }))
  );

/**
 * Packe les champs visibles d'une section en lignes de WIDTH_UNITS unités.
 * Retourne [[field, ...], ...] — chaque ligne est ensuite rendue en grille
 * dont les colonnes sont les `w` des champs de LA ligne : aucun trou possible.
 */
export function packRows(fields, hiddenSet) {
  const visible = fields.filter((f) => !hiddenSet.has(f.key));
  const rows = [];
  let current = [];
  let used = 0;
  for (const f of visible) {
    const w = Math.min(f.w || 1, WIDTH_UNITS);
    if (used + w > WIDTH_UNITS && current.length > 0) {
      rows.push(current);
      current = [];
      used = 0;
    }
    current.push(f);
    used += w;
  }
  if (current.length > 0) rows.push(current);
  return rows;
}

/**
 * Taille de police "valeur" (en pt) pour que le contenu tienne dans la hauteur
 * disponible. Modèle : une ligne ≈ 2.7×s pt, un titre de section ≈ 1.5×s pt.
 * availPt = hauteur dispo du corps en points (1 mm ≈ 2.835 pt).
 */
export function computeFontSize({ sections, hiddenSet, availPt }) {
  let nRows = 0;
  let nTitles = 0;
  for (const s of sections) {
    const rows = packRows(s.fields, hiddenSet);
    if (rows.length === 0) continue;
    nTitles += 1;
    nRows += rows.length;
  }
  if (nRows === 0) return { size: 10, nRows, nTitles };
  const size = availPt / (nRows * 2.7 + nTitles * 1.5);
  return { size: Math.max(5, Math.min(14, size)), nRows, nTitles };
}
