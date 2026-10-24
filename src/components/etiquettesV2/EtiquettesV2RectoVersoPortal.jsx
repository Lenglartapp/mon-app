// src/components/etiquettesV2/EtiquettesV2RectoVersoPortal.jsx
// Impression étiquettes rideaux — format atelier (design validé, v3).
// 2 étiquettes par page A4 ; RECTO = données (grille 4 colonnes, sections par
// étape d'atelier COUPE / OURLETS / PRÉPARATION / FINITION TÊTE), VERSO = croquis.
// Pages alternées recto/verso par paire → duplex reliure bord long ; chaque
// étiquette occupe un demi-cadre fixe pour aligner la découpe des deux côtés.
//
// Lisibilité : la valeur est plus grosse que le libellé ; l'échelle s'ajuste par
// étiquette pour remplir le demi-cadre sans jamais déborder (rien coupé).
import React, { useLayoutEffect, useState } from "react";
import ReactDOM from "react-dom";
import { RIDEAUX_GETTERS, RIDEAUX_PROD_SCHEMA } from "../../lib/schemas/production/rideaux.js";
import { DEFAULT_HEADER_COLOR, getHeaderStyles, getContrastColor } from "../../lib/etiquetteColors.js";

// ── Géométrie page (A4 @ 96 dpi ≈ 794 × 1123 px) ────────────────────────────
const PAGE_W = 794, PAGE_PAD = 24, CUT_H = 16;
const SLOT_H = 505; // demi-cadre par étiquette (2×505 + 16 + 48 = 1074 < 1123)
const SCALE_MIN = 0.8, SCALE_BASE = 1.4; // valeur-plus-grosse, échelle de base du design
const PAN_COLOR = "#7ec850";
const PAN_COLOR_ON_LIGHT = "#2f6b10"; // même vert, foncé : lisible sur les bandeaux clairs

// ── Disposition de l'étiquette : sections → groupes → lignes → cellules ─────
// Cellule = [clé, libellé]. Une ligne = 1 à 4 cellules (grille 4 colonnes, complétée
// par des cases blanches). Un groupe peut porter un cadre matière (`frame`).
// RÈGLES : une case ne change jamais de ligne ; case masquée ou vide = case blanche à sa
// place ; on ne retire que des blocs entiers (ligne toute masquée, cadre vide, section vide).
// Clés croisées (cf. production/rideaux.js) : etiquette_lavage = Oui/Non « Étiq. Lenglart »,
// etiquette_lenglart = consigne d'entretien.
export const RIDEAUX_V2_SECTIONS = [
  { name: "COUPE", groups: [
    { frame: "Tissu 1", rows: [
      [["tissu_deco1", "Tissu"], ["laize_tissu1", "Laize"], ["hauteur_coupe", "H. coupe"], ["hauteur_coupe_motif", "H. motif"]],
      [["nombre_les", "Lés"], ["reste_les", "Appièc."], ["ht_t1", "Coupe"], ["cote", "Côté appièc."]],
    ]},
    { frame: "Tissu 2", rows: [
      [["tissu_deco2", "Tissu"], ["laize_tissu2", "Laize"], ["hauteur_coupe_t2", "H. coupe"], ["hauteur_coupe_motif_t2", "H. motif"]],
      [["nombre_les_t2", "Lés"], ["reste_les_t2", "Appièc."], ["ht_t2", "Coupe"]],
    ]},
    { frame: "Doublure", rows: [
      [["doublure", "Tissu"], ["laize_doublure", "Laize"], ["hauteur_coupe_doublure", "H. coupe"], ["deduction_doublure", "Doublure −"]],
      [["nombre_les_doublure", "Lés"], ["reste_les_doublure", "Appièc."], ["ht_doubl", "Coupe"]],
    ]},
    { frame: "Interdoublure", rows: [
      [["inter_doublure", "Tissu"], ["laize_inter", "Laize"], ["hauteur_coupe_inter", "H. coupe"]],
      [["nombre_les_inter", "Lés"], ["reste_les_inter", "Appièc."], ["ht_inter", "Coupe"]],
    ]},
    { rows: [
      [["passementerie1", "Pass. 1"], ["ml_pass1", "ML"], ["passementerie2", "Pass. 2"], ["ml_pass2", "ML"]],
      [["ampleur", "Ampleur"], ["a_plat", "À plat"]],
    ]},
  ]},
  { name: "OURLETS", groups: [
    { rows: [
      [["piquage_ourlets_du_bas", "OB"], ["piquage_ourlet", "Fin. OB"], ["onglets", "Onglets"]],
      [["v_ourlets_de_cotes", "OC"], ["finition_oc", "Fin. OC"], ["finition_champs", "Chant"], ["finition_retour", "Fin. retour"]],
      [["piquage_ourlets_bas_doublure", "OB doubl."], ["doublure_finition_bas", "Fin. OB doubl."]],
      [["poids", "Poids"], ["etiquette_lavage", "Étiq. Lenglart"], ["etiquette_lenglart", "Entretien"]],
    ]},
  ]},
  { name: "PRÉPARATION", groups: [
    { rows: [
      [["type_confection", "Plis"], ["hauteur_renfort_tete", "Renfort tête"], ["finition_bas_txt", "Bas"]],
      [["type_mecanisme", "Méca"], ["modele_mecanisme", "Modèle"], ["meca_couvert", "Montage"], ["type_croisement", "Croisement"]],
      [["hauteur_finie_gauche", "HF G"], ["hauteur_finie_milieu", "HF M"], ["hauteur_finie_droite", "HF D"]],
    ]},
  ]},
  { name: "FINITION TÊTE", groups: [
    { rows: [
      [["largeur_finie", "LF"], ["retour_gauche", "Retour G"], ["retour_droit", "Retour D"]],
      [["crochets_txt", "Crochets"], ["nombre_glisseur", "Glisseurs"], ["ruflette", "Ruflette"]],
      [["point_chausson", "Pt chausson"], ["bride", "Bride"], ["emballage", "Emballage"]],
    ]},
  ]},
];

// Liste plate des cellules pour le menu « Champs » (toggles, mêmes clés).
export const RIDEAUX_V2_FIELDS = RIDEAUX_V2_SECTIONS.flatMap((s) =>
  s.groups.flatMap((g) => g.rows.flatMap((r) => r.map(([key, label]) => ({
    key, label: g.frame ? `${label} (${g.frame})` : label, section: s.name,
  }))))
);

// Cellules calculées et anciennes clés : masquer l'ancien champ (menu « Champs » d'avant)
// masque aussi sa nouvelle case.
const HIDDEN_ALIASES = {
  crochets_txt: ["type_crochets", "nb_crochets_par_pan"],
  finition_bas_txt: ["finition_bas"],
};

// Mise en avant : gros chiffres sur fond gris-bleu ; ligne tête sur fond violet clair.
const BIG_KEYS = new Set([
  "hauteur_coupe", "nombre_les", "reste_les", "ht_t1", "ht_t2", "ht_doubl", "ht_inter", "cote",
  "a_plat", "largeur_finie", "hauteur_finie_gauche", "hauteur_finie_milieu", "hauteur_finie_droite",
]);
const HEAD_KEYS = new Set(["crochets_txt", "nombre_glisseur", "retour_gauche", "retour_droit"]);
const BIG_BG = "#eef1f6", HEAD_BG = "#ece8f6";

// Unités (champs NOMBRE seulement).
const CM_KEYS = new Set([
  "laize_tissu1", "laize_tissu2", "laize_doublure", "laize_inter",
  "hauteur_coupe", "hauteur_coupe_motif", "hauteur_coupe_t2", "hauteur_coupe_motif_t2",
  "hauteur_coupe_doublure", "hauteur_coupe_inter",
  "reste_les", "reste_les_t2", "reste_les_doublure", "reste_les_inter",
  "a_plat", "piquage_ourlets_du_bas", "piquage_ourlets_bas_doublure", "v_ourlets_de_cotes",
  "doublure_finition_bas", "finition_champs", "finition_retour", "deduction_doublure",
  "retour_gauche", "retour_droit", "largeur_finie",
  "hauteur_finie_gauche", "hauteur_finie_milieu", "hauteur_finie_droite",
]);
const M_KEYS = new Set(["ml_pass1", "ml_pass2"]);

// Cadre matière : n'apparaît que si la matière est renseignée (tissu ou laize). Sinon ses
// valeurs calculées (ex. H. coupe doublure, calculée même sans doublure) restent blanches.
const FRAME_MATIERE = {
  "Tissu 1": ["tissu_deco1", "laize_tissu1"],
  "Tissu 2": ["tissu_deco2", "laize_tissu2"],
  "Doublure": ["doublure", "laize_doublure"],
  "Interdoublure": ["inter_doublure", "laize_inter"],
};

// ── Valeur d'un champ (getter de schéma, sinon calcul de la colonne, sinon brut) ──
const SCHEMA_BY_KEY = new Map(RIDEAUX_PROD_SCHEMA.map((c) => [c.key, c]));
const raw = (row, key) => {
  const r = row || {};
  if (RIDEAUX_GETTERS[key]) return RIDEAUX_GETTERS[key](r);
  const col = SCHEMA_BY_KEY.get(key);
  if (col?.valueGetter) { try { return col.valueGetter(null, r); } catch { return r[key]; } }
  return r[key];
};
const v = (row, key, fallback = "—") => {
  const val = raw(row, key);
  if (val == null || val === "") return fallback;
  return String(val);
};
const num = (x) => {
  if (x === null || x === undefined || x === "") return null;
  const n = typeof x === "number" ? x : parseFloat(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const fmtNum = (n) => String(Math.round(n * 100) / 100).replace(".", ",");
const isNumberCol = (key) => {
  const t = SCHEMA_BY_KEY.get(key)?.type;
  return t === "number" || t === "formula" || CM_KEYS.has(key) || M_KEYS.has(key) || key.startsWith("nombre_les");
};

// « n HT hauteur » : hauteur motif si > 0, sinon hauteur de coupe.
const HT = {
  ht_t1: ["nb_hauteur_a_couper", "hauteur_coupe", "hauteur_coupe_motif"],
  ht_t2: ["nb_hauteur_a_couper_t2", "hauteur_coupe_t2", "hauteur_coupe_motif_t2"],
  ht_doubl: ["nb_hauteur_a_couper_doublure", "hauteur_coupe_doublure", null],
  ht_inter: ["nb_hauteur_a_couper_inter", "hauteur_coupe_inter", null],
};

// Texte affiché d'une cellule ("" = case blanche).
function cellText(row, key) {
  if (HT[key]) {
    const [nKey, hKey, mKey] = HT[key];
    const n = num(raw(row, nKey));
    const motif = mKey ? num(raw(row, mKey)) : null;
    const h = motif && motif > 0 ? motif : num(raw(row, hKey));
    return n && n > 0 && h && h > 0 ? `${fmtNum(n)} HT ${fmtNum(h)}` : "";
  }
  if (key === "cote") {
    // On coud toujours l'appiècement côté rapatriement.
    const reste = num(raw(row, "reste_les"));
    if (!reste) return "";
    const pan = String(row?.paire_ou_un_seul_pan || "");
    if (/droit/i.test(pan)) return "DROIT";
    if (/gauche/i.test(pan)) return "GAUCHE";
    if (pan.trim() === "Paire") return "EXT.";
    return "";
  }
  if (key === "crochets_txt") {
    const n = num(raw(row, "nb_crochets_par_pan"));
    const t = String(row?.type_crochets || "").trim();
    if (n && t) return `${fmtNum(n)} × ${t}`;
    return t || (n ? fmtNum(n) : "");
  }
  if (key === "finition_bas_txt") {
    const x = num(row?.finition_bas);
    if (x === null) return "";
    if (x > 0) return `cassant ${fmtNum(x)} cm`;
    if (x < 0) return `rasant ${fmtNum(Math.abs(x))} cm`;
    return "rasant";
  }
  const val = raw(row, key);
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  if (!str || str === "—" || str === "Non") return "";
  if (isNumberCol(key)) {
    const n = num(val);
    if (n === null) return str;
    if (n === 0) return ""; // zéro = case blanche (sauf « Bas », traité plus haut)
    // Cote négative = ligne incomplète (ex. hauteur finie sans HSPF) : case blanche.
    if (n < 0 && CM_KEYS.has(key) && key !== "deduction_doublure") return "";
    return fmtNum(n) + (CM_KEYS.has(key) ? " cm" : M_KEYS.has(key) ? " m" : "");
  }
  return str;
}

const getCroquis = (row) => {
  const arr = Array.isArray(row?.schema) ? row.schema : [];
  return arr[0]?.url
    || (typeof row?.schema === "string" ? row.schema : null)
    || (Array.isArray(row?.schema_principe) ? row.schema_principe[0]?.url : null);
};
const isHidden = (row, key) =>
  Array.isArray(row?.etiquette_hidden_fields)
  && [key, ...(HIDDEN_ALIASES[key] || [])].some((k) => row.etiquette_hidden_fields.includes(k));
const showComment = (row) =>
  !isHidden(row, "commentaire") && v(row, "commentaire_confection", "") !== "—" && !!v(row, "commentaire_confection", "").trim();
const wantsVerso = (row) => !isHidden(row, "croquis") && !!getCroquis(row);
// 3e niveau de localisation : n'occupe une ligne de l'en-tête que s'il est
// renseigné sur la ligne (et non masqué via le menu « Champs »).
const showWindow = (row) => !isHidden(row, "fenetre") && !!String(row?.fenetre || "").trim();

// Disposition affichée : chaque cellule reçoit son texte ("" = case blanche à sa place).
// Une ligne dont toutes les cases sont blanches est retirée, puis les cadres et les
// sections vides. Les cases ne bougent jamais d'une ligne à l'autre.
function layoutFor(row) {
  const hfKeys = ["hauteur_finie_gauche", "hauteur_finie_milieu", "hauteur_finie_droite"];
  const hf = hfKeys.map((k) => (isHidden(row, k) ? "" : cellText(row, k)));
  const hfUnique = hf.every((t) => t) && hf[0] === hf[1] && hf[1] === hf[2];
  return RIDEAUX_V2_SECTIONS.map((sec) => ({
    name: sec.name,
    groups: sec.groups.map((g) => {
      const matiere = FRAME_MATIERE[g.frame];
      const hasMatiere = !matiere || matiere.some((k) => String(row?.[k] ?? "").trim() && num(row?.[k]) !== 0);
      return {
      frame: g.frame,
      rows: g.rows.map((r) => r.map(([key, label]) => {
        let text = !hasMatiere || isHidden(row, key) ? "" : cellText(row, key);
        let lbl = label;
        // HF identiques : une seule case « HF », M et D blanches à leur place.
        if (hfUnique && key === "hauteur_finie_gauche") lbl = "HF";
        if (hfUnique && (key === "hauteur_finie_milieu" || key === "hauteur_finie_droite")) text = "";
        return { key, label: lbl, text };
      })).filter((cells) => cells.some((c) => c.text)),
      };
    }).filter((g) => g.rows.length > 0),
  })).filter((s) => s.groups.length > 0);
}

// ── Bandeau d'en-tête (commun recto/verso) ──────────────────────────────────
function Header({ row, projectName, index, total }) {
  const hdr = getHeaderStyles(row?.etiquette_header_color || DEFAULT_HEADER_COLOR);
  const isDark = getContrastColor(hdr.bg) === "#FFFFFF";
  const boxBorder = isDark ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.22)";
  const lbl = { fontSize: 7, fontWeight: 700, letterSpacing: ".08em", opacity: .6, whiteSpace: "nowrap" };
  const val = { fontSize: 11, fontWeight: 600, lineHeight: 1.1 };
  const comment = v(row, "commentaire_confection", "");
  const hasComment = showComment(row);
  const fenetre = v(row, "fenetre", "");
  const showFenetre = showWindow(row);
  const verso = wantsVerso(row);
  const pan = v(row, "paire_ou_un_seul_pan", "");
  const hasPan = pan && pan !== "—";

  return (
    <div data-hid style={{ background: hdr.bg, color: hdr.textMain, padding: "8px 14px" }}>
      <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1, marginBottom: 6 }}>
        {projectName || "Projet"}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto auto", columnGap: 10, rowGap: 3, alignContent: "start", flex: "0 0 auto" }}>
          <span style={{ ...lbl, alignSelf: "center" }}>ZONE :</span>
          <span style={val}>{v(row, "zone", "—")}</span>
          <span style={{ ...lbl, alignSelf: "center" }}>PIÈCE :</span>
          <span style={val}>{v(row, "piece", "—")}</span>
          {showFenetre && (
            <>
              <span style={{ ...lbl, alignSelf: "center" }}>FENÊTRE :</span>
              <span style={val}>{fenetre}</span>
            </>
          )}
          {hasPan && (
            <span style={{ gridColumn: "1 / -1", fontSize: 14, fontWeight: 700, lineHeight: 1.15, color: PAN_COLOR, marginTop: 3, textTransform: "uppercase" }}>
              {pan}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flex: "0 0 auto" }}>
          <span style={lbl}>PRODUIT :</span>
          <span style={val}>{v(row, "produit", "—")}</span>
        </div>
        {hasComment && (
          <>
            <div style={{ alignSelf: "stretch", width: 1, background: boxBorder, flex: "0 0 auto" }} />
            <div style={{ flex: 1, minWidth: 60, fontSize: 11, fontWeight: 500, lineHeight: 1.25, whiteSpace: "pre-wrap" }}>
              <span style={{ ...lbl, marginRight: 4 }}>COMMENTAIRE :</span>{comment}
            </div>
          </>
        )}
        <div style={{ alignSelf: "stretch", width: 1, background: boxBorder, flex: "0 0 auto" }} />
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <span style={lbl}>CROQUIS</span>
          <span style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.25, whiteSpace: "nowrap" }}>
            {verso ? "Voir au verso" : "Aucun croquis"}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", marginTop: 5 }}>
            n°{(index ?? 0) + 1}/{total}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── En-tête du RECTO : bandeau compact sur 2 lignes ─────────────────────────
function RectoHeader({ row, projectName, index, total }) {
  const hdr = getHeaderStyles(row?.etiquette_header_color || DEFAULT_HEADER_COLOR);
  const isDark = getContrastColor(hdr.bg) === "#FFFFFF";
  const fenetre = v(row, "fenetre", "");
  const where = [
    `ZONE ${v(row, "zone", "—")}`,
    `PIÈCE ${v(row, "piece", "—")}`,
    ...(showWindow(row) ? [`FENÊTRE ${fenetre}`] : []),
  ].join(" · ");
  const pan = v(row, "paire_ou_un_seul_pan", "");
  const hasPan = pan && pan !== "—";
  const produit = v(row, "produit", "");
  return (
    <div data-hid style={{ background: hdr.bg, color: hdr.textMain, padding: "6px 12px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, lineHeight: 1.15 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{projectName || "Projet"}</span>
          {produit && produit !== "—" && <span style={{ fontSize: 11, color: hdr.textMuted, fontWeight: 600 }}>{produit}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
          <span style={{
            background: hdr.badgeBg, color: hdr.badgeText, borderRadius: 4, padding: "1px 7px",
            border: `1.5px solid ${isDark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.45)"}`,
            fontSize: 11, fontWeight: 700, letterSpacing: ".02em", whiteSpace: "nowrap",
          }}>{where}</span>
          {hasPan && <span style={{ fontSize: 12, fontWeight: 800, color: isDark ? PAN_COLOR : PAN_COLOR_ON_LIGHT, textTransform: "uppercase", whiteSpace: "nowrap" }}>{pan}</span>}
        </div>
      </div>
      <div style={{ flex: "0 0 auto", textAlign: "right", lineHeight: 1.25 }}>
        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>n°{(index ?? 0) + 1}/{total}</div>
        <div style={{ fontSize: 10, whiteSpace: "nowrap", color: hdr.textMuted }}>
          Croquis : <b style={{ color: hdr.textMain }}>{wantsVerso(row) ? "Voir au verso" : "Aucun"}</b>
        </div>
      </div>
    </div>
  );
}

// Commentaire atelier : encadré tout en bas du recto (non mis à l'échelle).
function CommentBox({ row }) {
  if (!showComment(row)) return null;
  return (
    <div data-cid style={{ marginTop: 6, border: "1.5px solid #111", borderRadius: 6, background: "#fffbea", padding: "4px 8px" }}>
      <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: ".1em", color: "#5e5e5e" }}>COMMENTAIRE ATELIER</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#111", whiteSpace: "pre-wrap", lineHeight: 1.25 }}>
        {v(row, "commentaire_confection", "")}
      </div>
    </div>
  );
}

// ── RECTO : données en grille 4 colonnes fixes ──────────────────────────────
export function RectoLabel({ row, projectName, index, total, scale }) {
  const sections = layoutFor(row);
  const fs = 10.5 * scale;   // libellé ET valeur, même corps
  const bigFs = 17 * scale;  // gros chiffres
  const lineBorder = "1px solid #ededed";

  const renderCell = (cell, i, cells) => {
    if (!cell || !cell.text) {
      return <div key={`b${i}`} style={{ borderRight: lineBorder, borderBottom: lineBorder, minHeight: 14 }} />;
    }
    const big = BIG_KEYS.has(cell.key);
    const bg = HEAD_KEYS.has(cell.key) ? HEAD_BG : big ? BIG_BG : "transparent";
    const next = cells[i + 1];
    const plus = cell.key.startsWith("nombre_les") && next?.key?.startsWith("reste_les") && next.text;
    return (
      <div key={cell.key} style={{ position: "relative", background: bg, borderRight: lineBorder, borderBottom: lineBorder, padding: "1px 6px", minHeight: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <span style={{ fontSize: fs, fontWeight: 600, color: "#5e5e5e", whiteSpace: "nowrap", lineHeight: 1.1 }}>{cell.label}</span>
        <span style={{ fontSize: big ? bigFs : fs, fontWeight: big ? 800 : 700, color: "#111", textAlign: "right", lineHeight: 1.05, whiteSpace: big ? "nowrap" : "normal", overflowWrap: "anywhere", minWidth: 0 }}>{cell.text}</span>
        {plus && (
          <div style={{ position: "absolute", right: 0, top: "50%", transform: "translate(50%, -50%)", width: 15, height: 15, borderRadius: "50%", background: "#fff", border: "1px solid #c4c4c4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#444", lineHeight: 1, zIndex: 2 }}>+</div>
        )}
      </div>
    );
  };

  const renderRows = (rows) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderTop: lineBorder, borderLeft: lineBorder }}>
      {rows.map((cells, ri) => {
        const filled = [...cells, ...Array(Math.max(0, 4 - cells.length)).fill(null)];
        return <React.Fragment key={ri}>{filled.map((c, i) => renderCell(c, i, filled))}</React.Fragment>;
      })}
    </div>
  );

  return (
    <div style={{ height: SLOT_H, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <RectoHeader row={row} projectName={projectName} index={index} total={total} />
      <div data-fid style={{ marginTop: 4 }}>
        {sections.map((sec) => (
          <div key={sec.name}>
            <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: ".1em", color: "#6a6a6a", marginTop: 3, marginBottom: 1 }}>
              {sec.name}
            </div>
            {sec.groups.map((g, gi) => g.frame ? (
              <div key={gi} style={{ position: "relative", border: "1px solid #d6dbe4", borderRadius: 6, background: "#fafbfd", padding: "7px 4px 4px", marginTop: 6, marginBottom: 2 }}>
                <span style={{ position: "absolute", top: -6, left: 8, background: "#fff", padding: "0 4px", fontSize: 7, fontWeight: 700, letterSpacing: ".1em", color: "#6a6a6a", textTransform: "uppercase", lineHeight: 1 }}>{g.frame}</span>
                {renderRows(g.rows)}
              </div>
            ) : (
              <div key={gi} style={{ marginTop: 2 }}>{renderRows(g.rows)}</div>
            ))}
          </div>
        ))}
      </div>
      <CommentBox row={row} />
    </div>
  );
}

// ── VERSO : croquis plein cadre ─────────────────────────────────────────────
export function VersoLabel({ row, projectName, index, total }) {
  const croquis = getCroquis(row);
  return (
    <div style={{ height: SLOT_H, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <Header row={row} projectName={projectName} index={index} total={total} />
      <div style={{ flex: 1, minHeight: 0, border: "1px solid #e2e2e2", borderTop: "none", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 4,
        background: croquis ? "#fff" : "repeating-linear-gradient(45deg,#fafafa 0 10px,#fff 10px 20px)" }}>
        {croquis
          ? <img src={croquis} alt="Croquis atelier" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", padding: 8 }} />
          : <span style={{ color: "#c4c4c4", fontStyle: "italic", fontSize: 12 }}>— croquis atelier —</span>}
      </div>
    </div>
  );
}

const Cut = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#c0c0c0", margin: "7px 0" }}>
    <span style={{ flex: 1, borderTop: "1px dashed #bdbdbd" }} />
    <span style={{ fontSize: 6.5, fontWeight: 700, letterSpacing: ".2em" }}>DÉCOUPE</span>
    <span style={{ flex: 1, borderTop: "1px dashed #bdbdbd" }} />
  </div>
);

function A4Page({ children, last }) {
  return (
    <div style={{ width: PAGE_W, height: "297mm", overflow: "hidden", background: "#fff", padding: PAGE_PAD, display: "flex", flexDirection: "column", pageBreakAfter: last ? "auto" : "always" }}>
      {children}
    </div>
  );
}

export default function EtiquettesV2RectoVersoPortal({ rows, projectName, onClose }) {
  const list = rows || [];
  const [scales, setScales] = useState(null); // rowId → échelle ; null tant que non mesuré

  // 1) mesurer (rendu de base, échelle 1) puis calculer l'échelle qui remplit le cadre
  useLayoutEffect(() => {
    if (scales) return;
    const next = {};
    list.forEach((row, i) => {
      const headerEl = document.querySelector(`[data-row-idx="${i}"] [data-hid]`);
      const fieldsEl = document.querySelector(`[data-row-idx="${i}"] [data-fid]`);
      const commentEl = document.querySelector(`[data-row-idx="${i}"] [data-cid]`);
      const headerH = headerEl ? headerEl.offsetHeight : 90;
      const fieldsH = fieldsEl ? fieldsEl.scrollHeight : 1;
      // L'encadré commentaire (taille fixe) est pris sur l'espace disponible : rien n'est coupé.
      const commentH = commentEl ? commentEl.offsetHeight + 6 : 0;
      const avail = SLOT_H - headerH - commentH - 10;
      let s = SCALE_BASE;
      if (fieldsH > 0) s = (avail / fieldsH) * 0.97;
      // plafonné à l'échelle de base : on ne fait que rétrécir si une étiquette
      // est trop dense, jamais grossir au-delà du rendu validé.
      next[i] = Math.max(SCALE_MIN, Math.min(SCALE_BASE, s));
    });
    setScales(next);
  }, [scales, list]);

  // 2) une fois les échelles posées → impression
  useLayoutEffect(() => {
    if (!scales) return;
    const t = setTimeout(() => { window.print(); onClose?.(); }, 350);
    return () => clearTimeout(t);
  }, [scales, onClose]);

  const portal = document.getElementById("etq-rideaux-print-root");
  if (!portal) return null;

  const pairs = [];
  for (let i = 0; i < list.length; i += 2) pairs.push([i, i + 1]);
  const anyVerso = list.some(wantsVerso); // aucun croquis → aucune page verso

  const labelWrap = (i, node) => <div key={i} data-row-idx={i}>{node}</div>;

  return ReactDOM.createPortal(
    <>
      <style>{`
        #etq-rideaux-print-root {
          position: absolute; left: -100000px; top: 0;
          width: ${PAGE_W}px; background: #fff;
        }
        @media print {
          #etq-rideaux-print-root { left: 0; z-index: 99999; }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>
      {pairs.map(([a, b], pi) => {
        const ra = list[a], rb = list[b];
        return (
          <React.Fragment key={pi}>
            {/* RECTO : données */}
            <A4Page last={!anyVerso && pi === pairs.length - 1}>
              {labelWrap(a, <RectoLabel row={ra} projectName={projectName} index={a} total={list.length} scale={scales?.[a] ?? 1} />)}
              {rb && <Cut />}
              {rb && labelWrap(b, <RectoLabel row={rb} projectName={projectName} index={b} total={list.length} scale={scales?.[b] ?? 1} />)}
            </A4Page>
            {/* VERSO : croquis (même ordre → aligné au recto en duplex bord long).
                Étiquette sans croquis = dos blanc, pour garder l'alignement. */}
            {anyVerso && (
              <A4Page last={pi === pairs.length - 1}>
                {wantsVerso(ra)
                  ? <VersoLabel row={ra} projectName={projectName} index={a} total={list.length} />
                  : <div style={{ height: SLOT_H }} />}
                {rb && <Cut />}
                {rb && (wantsVerso(rb)
                  ? <VersoLabel row={rb} projectName={projectName} index={b} total={list.length} />
                  : <div style={{ height: SLOT_H }} />)}
              </A4Page>
            )}
          </React.Fragment>
        );
      })}
    </>,
    portal
  );
}
