// src/lib/etiquettes/storesBateauxLabel.js
// Contenu de l'étiquette STORES BATEAUX / VELUM — même grille que l'étiquette rideau
// (EtiquettesV2RectoVersoPortal) : une information commune aux deux produits est au même
// endroit (section, ligne, colonne). Logique pure (sans React), partagée par l'aperçu
// écran et l'impression, et testée (tests/storesBateauxEtiquette.test.mjs).
import { STORES_BATEAUX_GETTERS, STORES_BATEAUX_PROD_SCHEMA, storeMetrage } from "../schemas/production/stores_bateaux.js";
import { isStoresMetrageRow, surplusParDefaut } from "../formulas/storesBateauxMetrage.js";

// ── Disposition : sections → groupes → lignes → cellules [clé, libellé] ─────
// Grille 4 colonnes ; `null` = case blanche réservée (garde la colonne du rideau).
// RÈGLES : une case ne change jamais de ligne ni de colonne ; case masquée ou vide = case
// blanche à sa place ; on ne retire que des blocs entiers (ligne, cadre, section vides).
export const STORES_BATEAUX_SECTIONS = [
  { name: "COUPE", groups: [
    { frame: "Tissu", rows: [
      [["toile_finition_1", "Tissu"], ["laize_toile_finition_1", "Laize"], ["hauteur_coupe", "H. coupe"], ["hauteur_coupe_motif", "H. motif"]],
      [["ml_toile_finition_1", "ML"], ["cas_coupe_txt", "Façon"], ["ht_t1", "Coupe"]],
    ]},
    { frame: "Doublure", rows: [
      [["doublure", "Tissu"], ["laize_doublure", "Laize"], ["hauteur_coupe_doublure", "H. coupe"], ["ml_doublure", "ML"]],
      [null, null, ["ht_doubl", "Coupe"]],
    ]},
    { rows: [
      [null, ["a_plat", "À plat"]],
    ]},
  ]},
  { name: "OURLETS", groups: [
    { rows: [
      [["ourlet_de_cote", "OC"], ["finition_oc", "Fin. OC"], ["finition_chant_et_retour", "Chant/Retour"]],
      [null, null, ["etiquette_lavage", "Entretien"]],
    ]},
  ]},
  { name: "PRÉPARATION", groups: [
    { rows: [
      [["mecanisme_store", "Méca"], ["type_commande", "Commande"], ["methode_manoeuvre", "Manœuvre"], ["cote_manoeuvre", "Côté man."]],
      [["hauteur_finie", "HF"]],
    ]},
  ]},
  { name: "FINITION TÊTE", groups: [
    { rows: [
      [["largeur_finie", "LF"]],
      [["valeur_velcro", "Velcro tête"], ["nombre_anneaux_largeur", "Anneaux"], ["deportation_premier_anneau", "1er anneau"]],
      [["type_pose", "Pose"], ["guidage", "Guidage"], ["cable_intermediaire", "Câble inter."]],
    ]},
  ]},
];

// Bloc « Intervalles & barre » (colonne de droite) et autres éléments masquables.
const SIDE_FIELDS = [
  { key: "intervalles_txt", label: "Intervalles", section: "INTERVALLES & BARRE" },
  { key: "tigettes_txt", label: "Tigettes", section: "INTERVALLES & BARRE" },
  { key: "barre_txt", label: "Barre de charge", section: "INTERVALLES & BARRE" },
  { key: "surplus_txt", label: "Surplus fourreau", section: "INTERVALLES & BARRE" },
  { key: "croquis_intervalle", label: "Croquis", section: "INTERVALLES & BARRE" },
  { key: "fenetre", label: "Fenêtre (en-tête)", section: "AUTRES" },
  { key: "commentaire_confection", label: "Commentaire atelier", section: "AUTRES" },
];

// Liste plate pour le menu « Personnaliser » (une entrée par clé, mêmes sections).
export const ETIQUETTE_STORES_BATEAUX_FIELDS = [
  ...STORES_BATEAUX_SECTIONS.flatMap((s) =>
    s.groups.flatMap((g) => g.rows.flatMap((r) => r.filter(Boolean).map(([key, label]) => ({
      key, label: g.frame ? `${label} (${g.frame})` : label, section: s.name,
    }))))
  ),
  ...SIDE_FIELDS,
];

// Anciennes clés du menu « Personnaliser » : les masquer masque aussi la nouvelle case.
const HIDDEN_ALIASES = {
  cas_coupe_txt: ["cas_coupe_toile"],
  intervalles_txt: ["nombre_intervalles", "valeur_intervalle"],
  tigettes_txt: ["longueur_tigette"],
  barre_txt: ["longueur_barre_de_charge"],
};

// Mise en avant : gros chiffres sur fond gris-bleu ; ligne tête sur fond violet clair.
export const BIG_KEYS = new Set([
  "hauteur_coupe", "hauteur_coupe_motif", "hauteur_coupe_doublure", "ht_t1", "ht_doubl",
  "a_plat", "largeur_finie", "hauteur_finie", "cote_manoeuvre",
]);
export const HEAD_KEYS = new Set(["valeur_velcro", "nombre_anneaux_largeur", "deportation_premier_anneau"]);

// Unités des champs NOMBRE.
const CM_KEYS = new Set([
  "largeur_finie", "a_plat", "hauteur_finie", "hauteur_coupe", "hauteur_coupe_motif", "hauteur_coupe_doublure",
  "laize_toile_finition_1", "laize_doublure", "ourlet_de_cote", "valeur_velcro", "deportation_premier_anneau",
]);
const M_KEYS = new Set(["ml_toile_finition_1", "ml_doublure"]);
const NUM_KEYS = new Set(["nombre_anneaux_largeur"]);

// Cadre matière : n'apparaît que si la matière est renseignée (tissu ou laize). Sinon ses
// valeurs calculées (ex. H. coupe doublure, calculée même sans doublure) restent blanches.
const FRAME_MATIERE = {
  "Tissu": ["toile_finition_1", "laize_toile_finition_1"],
  "Doublure": ["doublure", "laize_doublure"],
};

// ── Valeurs ─────────────────────────────────────────────────────────────────
const SCHEMA_BY_KEY = new Map(STORES_BATEAUX_PROD_SCHEMA.map((c) => [c.key, c]));
export const raw = (row, key) => {
  const r = row || {};
  if (STORES_BATEAUX_GETTERS[key]) return STORES_BATEAUX_GETTERS[key](r);
  const col = SCHEMA_BY_KEY.get(key);
  if (col?.valueGetter) { try { return col.valueGetter(null, r); } catch { return r[key]; } }
  return r[key];
};
export const num = (x) => {
  if (x === null || x === undefined || x === "") return null;
  const n = typeof x === "number" ? x : parseFloat(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
export const fmtNum = (n) => String(Math.round(n * 100) / 100).replace(".", ",");
const r1 = (n) => Math.round(n * 10) / 10;
const filled = (x) => String(x ?? "").trim() !== "";

// Quantité de la ligne (vide → 1).
const qte = (row) => { const n = num(row?.quantite); return n && n > 0 ? n : 1; };

// « n HT … » : notation de l'atelier selon la façon de couper.
export function htText(row, tissu = "toile") {
  const r = row || {};
  const n = qte(r);
  const laize = num(tissu === "doublure" ? r.laize_doublure : r.laize_toile_finition_1);
  if (isStoresMetrageRow(r)) {
    const m = storeMetrage(r, tissu);
    const aPlat = fmtNum(r1(m.aPlat));
    switch (m.cas) {
      case "couche": return `${fmtNum(n)} HT ${aPlat} × ${fmtNum(laize)}`;
      case "bandes": return `${fmtNum(n * m.nbBandes)} HT ${aPlat} × ${fmtNum(laize)}`;
      case "debout": return `${fmtNum(n)} HT ${fmtNum(r1(m.hauteurCoupe))}`;
      case "motif": return `${fmtNum(n * m.nbBandes)} HT ${fmtNum(r1(m.hauteurCoupeMotif))}`;
      default: return "";
    }
  }
  // Anciennes formules : H. coupe = à plat quand la hauteur tient dans la laize (couché).
  const hKey = tissu === "doublure" ? "hauteur_coupe_doublure" : "hauteur_coupe";
  const h = num(raw(r, hKey));
  if (!h || h <= 0 || !laize || laize <= 0) return "";
  const hf = num(r.hauteur_finie) || 0;
  const couche = laize > hf + (hf < 400 ? 50 : 80);
  if (couche) return `${fmtNum(n)} HT ${fmtNum(h)} × ${fmtNum(laize)}`;
  const motif = tissu === "toile" ? num(raw(r, "hauteur_coupe_motif")) : null;
  return `${fmtNum(n)} HT ${fmtNum(motif && motif > 0 ? motif : h)}`;
}

// Texte affiché d'une cellule ("" = case blanche).
export function cellText(row, key) {
  if (key === "ht_t1") return htText(row, "toile");
  if (key === "ht_doubl") return htText(row, "doublure");
  if (key === "cas_coupe_txt") return String(raw(row, "cas_coupe_toile") || "").trim();
  const val = raw(row, key);
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  if (!str || str === "—" || str === "Non") return "";
  if (CM_KEYS.has(key) || M_KEYS.has(key) || NUM_KEYS.has(key)) {
    const n = num(val);
    if (n === null || !/^-?[\d.,]+$/.test(str)) return str; // texte libre (ex. déport « 10 cm du bord »)
    if (n <= 0) return ""; // zéro / cote négative = case blanche
    return fmtNum(n) + (CM_KEYS.has(key) ? " cm" : M_KEYS.has(key) ? " m" : "");
  }
  return str;
}

export const isHidden = (row, key) =>
  Array.isArray(row?.etiquette_hidden_fields)
  && [key, ...(HIDDEN_ALIASES[key] || [])].some((k) => row.etiquette_hidden_fields.includes(k));

// Disposition affichée : chaque cellule reçoit son texte ("" = case blanche à sa place).
// Ligne toute blanche → retirée ; puis cadres et sections vides.
export function layoutFor(row) {
  return STORES_BATEAUX_SECTIONS.map((sec) => ({
    name: sec.name,
    groups: sec.groups.map((g) => {
      const matiere = FRAME_MATIERE[g.frame];
      const hasMatiere = !matiere || matiere.some((k) => filled(row?.[k]) && num(row?.[k]) !== 0);
      return {
        frame: g.frame,
        rows: g.rows.map((r) => r.map((cell) => {
          if (!cell) return null;
          const [key, label] = cell;
          return { key, label, text: !hasMatiere || isHidden(row, key) ? "" : cellText(row, key) };
        })).filter((cells) => cells.some((c) => c?.text)),
      };
    }).filter((g) => g.rows.length > 0),
  })).filter((s) => s.groups.length > 0);
}

// ── Colonne de droite : « Intervalles & barre » (lignes calculées, vides retirées) ──
const withDiam = (txt, d) => {
  const s = String(d ?? "").trim();
  if (!s) return txt;
  return `${txt} · Ø ${s}${/^[\d.,]+$/.test(s) ? " mm" : ""}`;
};
export function sideLines(row) {
  const r = row || {};
  const lines = [];
  const nbInt = num(raw(r, "nombre_intervalles"));
  const hf = num(r.hauteur_finie);
  if (!isHidden(r, "intervalles_txt") && nbInt > 0 && hf > 0) {
    lines.push({ key: "intervalles_txt", text: `${fmtNum(nbInt)} intervalles de ${fmtNum(r1(hf / nbInt))} cm` });
  }
  const nbTig = num(raw(r, "nombre_de_tigettes"));
  const lTig = num(r.longueur_tigette);
  if (!isHidden(r, "tigettes_txt") && (nbTig > 0 || lTig > 0)) {
    const parts = [nbTig > 0 ? `${fmtNum(nbTig)} tigette${nbTig > 1 ? "s" : ""}` : "Tigettes"];
    if (lTig > 0) parts.push(`${fmtNum(lTig)} cm`);
    lines.push({ key: "tigettes_txt", text: withDiam(parts.join(" · "), r.diametre_tigettes) });
  }
  const barre = String(r.barre_de_charge ?? "").trim();
  const lBarre = num(r.longueur_barre_de_charge);
  if (!isHidden(r, "barre_txt") && (barre || lBarre > 0)) {
    const parts = [barre || "Barre"];
    if (lBarre > 0) parts.push(`${fmtNum(lBarre)} cm`);
    lines.push({ key: "barre_txt", text: withDiam(parts.join(" · "), r.diametre_barre_de_charge) });
  }
  if (!isHidden(r, "surplus_txt") && nbInt > 0) {
    const s = filled(r.surplus_fourreau) ? num(r.surplus_fourreau) : surplusParDefaut(r.produit);
    if (s !== null) lines.push({ key: "surplus_txt", text: `Surplus fourreau ${fmtNum(s)} cm` });
  }
  return lines;
}

// En-tête et pied.
export const getCroquis = (row) =>
  isHidden(row, "croquis_intervalle") ? null
    : Array.isArray(row?.croquis_intervalle) ? row.croquis_intervalle[0]?.url || null : null;
export const showWindow = (row) => !isHidden(row, "fenetre") && filled(row?.fenetre);
export const commentText = (row) =>
  isHidden(row, "commentaire_confection") ? "" : String(row?.commentaire_confection ?? "").trim();
