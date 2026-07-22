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
import { RIDEAUX_GETTERS } from "../../lib/schemas/production/rideaux.js";
import { DEFAULT_HEADER_COLOR, getHeaderStyles, getContrastColor } from "../../lib/etiquetteColors.js";

// ── Géométrie page (A4 @ 96 dpi ≈ 794 × 1123 px) ────────────────────────────
const PAGE_W = 794, PAGE_PAD = 24, CUT_H = 16;
const SLOT_H = 505; // demi-cadre par étiquette (2×505 + 16 + 48 = 1074 < 1123)
const SCALE_MIN = 0.8, SCALE_BASE = 1.4; // valeur-plus-grosse, échelle de base du design
const PAN_COLOR = "#7ec850";

// ── Disposition de l'étiquette : sections par étape d'atelier ────────────────
// Chaque champ : [clé, libellé]. Ordre = disposition imprimée (grille 4 colonnes).
// Pour COUPE, Pass. 1 / Pass. 2 occupent les 2 cellules libres (lignes doublure & inter).
export const RIDEAUX_V2_SECTIONS = [
  { name: "COUPE", fields: [
    ["tissu_deco1", "Tissu 1"], ["laize_tissu1", "Laize T1"], ["hauteur_coupe", "H. Coupe T1"], ["hauteur_coupe_motif", "H. Coupe Motif T1"],
    ["tissu_deco2", "Tissu 2"], ["laize_tissu2", "Laize T2"], ["hauteur_coupe_t2", "H. Coupe T2"], ["hauteur_coupe_motif_t2", "H. Coupe Motif T2"],
    ["doublure", "Doublure"], ["laize_doublure", "Laize Doubl."], ["hauteur_coupe_doublure", "H. Coupe Doubl."], ["passementerie1", "Pass. 1"],
    ["inter_doublure", "Interdoublure"], ["laize_inter", "Laize Inter."], ["hauteur_coupe_inter", "H. Coupe Inter."], ["passementerie2", "Pass. 2"],
    ["nombre_les", "Nb Lés"], ["reste_les", "Appiècement cm"], ["ampleur", "Ampleur"], ["a_plat", "À plat"],
  ]},
  { name: "OURLETS", fields: [
    ["piquage_ourlets_du_bas", "OB Tissu"], ["v_ourlets_de_cotes", "Ourlets de côté"], ["piquage_ourlet", "Piquage ourlet"], ["onglets", "Onglets"],
    ["piquage_ourlets_bas_doublure", "OB Doublure"], ["deduction_doublure", "Déd. Doublure"], ["doublure_finition_bas", "Doubl. fin. bas"],
    ["etiquette_lenglart", "Étiq. Lenglart"], ["poids", "Poids"],
  ]},
  { name: "PRÉPARATION", fields: [
    ["type_confection", "Type Confection"], ["hauteur_renfort_tete", "H. Renfort Tête"], ["finition_bas", "Cassant / Rasant"], ["finition_champs", "Finition Chant"],
    ["type_mecanisme", "Type Méca"], ["modele_mecanisme", "Modèle Méca"], ["meca_couvert", "Méca Couvert"], ["type_croisement", "Type Croisement"],
    ["hauteur_finie_gauche", "H. Finie G"], ["hauteur_finie_milieu", "H. Finie M"], ["hauteur_finie_droite", "H. Finie D"],
  ]},
  { name: "FINITION TÊTE", fields: [
    ["retour_gauche", "Retour G"], ["largeur_finie", "L. Finie"], ["retour_droit", "Retour D"], ["etiquette_lavage", "Étiq. Lavage"],
    ["type_crochets", "Crochets"], ["ruflette", "Ruflette"], ["nombre_glisseur", "Nb Glisseurs"], ["bride", "Bride"],
    ["point_chausson", "Pt. Chausson"],
  ]},
];

// Liste plate des champs pour le menu « Champs » (toggles, mêmes clés).
export const RIDEAUX_V2_FIELDS = RIDEAUX_V2_SECTIONS.flatMap(
  (s) => s.fields.map(([key, label]) => ({ key, label, section: s.name }))
);

// ── Valeur d'un champ (getter de schéma sinon brut) ─────────────────────────
const v = (row, key, fallback = "—") => {
  let val = RIDEAUX_GETTERS[key] ? RIDEAUX_GETTERS[key](row || {}) : row?.[key];
  if (val == null || val === "") return fallback;
  return String(val);
};
const getCroquis = (row) => {
  const arr = Array.isArray(row?.schema) ? row.schema : [];
  return arr[0]?.url
    || (typeof row?.schema === "string" ? row.schema : null)
    || (Array.isArray(row?.schema_principe) ? row.schema_principe[0]?.url : null);
};
const isHidden = (row, key) =>
  Array.isArray(row?.etiquette_hidden_fields) && row.etiquette_hidden_fields.includes(key);
const showComment = (row) =>
  !isHidden(row, "commentaire") && v(row, "commentaire_confection", "") !== "—" && !!v(row, "commentaire_confection", "").trim();
const wantsVerso = (row) => !isHidden(row, "croquis") && !!getCroquis(row);

// Sections visibles (hors champs masqués)
function visibleSections(row) {
  return RIDEAUX_V2_SECTIONS
    .map((s) => ({ name: s.name, fields: s.fields.filter(([key]) => !isHidden(row, key)) }))
    .filter((s) => s.fields.length > 0);
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
            <div style={{ flex: 1, minWidth: 60, fontSize: 11, fontWeight: 500, lineHeight: 1.25 }}>
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

// ── RECTO : données en grille 4 colonnes fixes ──────────────────────────────
export function RectoLabel({ row, projectName, index, total, scale }) {
  const sections = visibleSections(row);
  const labelPx = Math.round(8 * scale);    // libellé (gris) — plus petit
  const valuePx = Math.round(10.5 * scale); // valeur (noir) — plus grosse

  return (
    <div style={{ height: SLOT_H, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <Header row={row} projectName={projectName} index={index} total={total} />
      <div data-fid style={{ marginTop: 4 }}>
        {sections.map((sec) => (
          <div key={sec.name}>
            <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: ".1em", color: "#6a6a6a", padding: 0, marginTop: 2, borderBottom: "1px solid #cfcfcf" }}>
              {sec.name}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderTop: "1px solid #ededed", borderLeft: "1px solid #ededed" }}>
              {sec.fields.map(([key, label]) => {
                const value = v(row, key);
                const isBool = value === "Oui" || value === "Non";
                const plusAfter = key === "nombre_les";
                const cellBase = { position: "relative", borderRight: "1px solid #ededed", borderBottom: "1px solid #ededed", padding: "0 8px", minHeight: 14, display: "flex", flexDirection: "column", justifyContent: "center" };
                const kStyle = { fontSize: labelPx, fontWeight: 600, letterSpacing: ".01em", color: "#8a8a8a", lineHeight: 1.0 };
                const vStyle = { fontSize: valuePx, fontWeight: 700, color: "#111", lineHeight: 1.0 };
                return (
                  <div key={key} style={cellBase}>
                    {plusAfter && (
                      <div style={{ position: "absolute", right: 0, top: "50%", transform: "translate(50%, -50%)", width: 15, height: 15, borderRadius: "50%", background: "#fff", border: "1px solid #c4c4c4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#444", lineHeight: 1, zIndex: 2 }}>+</div>
                    )}
                    {isBool ? (
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
                        <span style={kStyle}>{label}</span>
                        <span style={vStyle}>{value}</span>
                      </div>
                    ) : (
                      <>
                        <div style={kStyle}>{label}</div>
                        <div style={vStyle}>{value}</div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
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
      const headerH = headerEl ? headerEl.offsetHeight : 90;
      const fieldsH = fieldsEl ? fieldsEl.scrollHeight : 1;
      const avail = SLOT_H - headerH - 6;
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
