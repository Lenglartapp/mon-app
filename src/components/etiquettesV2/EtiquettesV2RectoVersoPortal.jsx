// src/components/etiquettesV2/EtiquettesV2RectoVersoPortal.jsx
// Impression étiquettes rideaux — format atelier validé (Claude Design).
// 2 étiquettes par page A4 ; RECTO = données (5 colonnes fixes), VERSO = croquis.
// Pages générées en alternance recto/verso par paire → impression recto-verso
// (reliure bord long). Chaque étiquette occupe un demi-cadre fixe : le trait de
// découpe tombe au même endroit recto et verso, donc le croquis se retrouve pile
// derrière sa fiche après découpe.
//
// Lisibilité d'abord : l'échelle du texte de la grille s'ajuste par étiquette
// pour remplir le demi-cadre SANS jamais déborder (rien n'est coupé).
import React, { useLayoutEffect, useState } from "react";
import ReactDOM from "react-dom";
import { ETIQUETTE_RIDEAUX_FIELDS } from "../EtiquetteRideauxCard.jsx";
import { RIDEAUX_GETTERS } from "../../lib/schemas/production/rideaux.js";
import { DEFAULT_HEADER_COLOR, getHeaderStyles, getContrastColor } from "../../lib/etiquetteColors.js";

// ── Géométrie page (A4 @ 96 dpi ≈ 794 × 1123 px) ────────────────────────────
// Hauteur de page FIXE en mm (= @page A4) + marge de sécurité : garantit que
// 2 étiquettes tiennent sur UNE feuille (sinon la 2ᵉ déborde au px près).
const PAGE_W = 794, PAGE_PAD = 24, CUT_H = 16;
const SLOT_H = 505; // demi-cadre par étiquette (2×505 + 16 + 48 = 1074 < 1123)
const SCALE_MIN = 0.8, SCALE_BASE = 1.25;

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
// Commentaire affiché : bascule active ET valeur présente
const showComment = (row) => !isHidden(row, "commentaire") && !!(v(row, "commentaire_confection", "")).trim() && v(row, "commentaire_confection", "") !== "—";
// Verso voulu : bascule croquis active ET croquis présent
const wantsVerso = (row) => !isHidden(row, "croquis") && !!getCroquis(row);

// Sections visibles (hors champs masqués), ordre du référentiel
function visibleSections(row) {
  const hidden = new Set(Array.isArray(row?.etiquette_hidden_fields) ? row.etiquette_hidden_fields : []);
  const bySection = [];
  for (const f of ETIQUETTE_RIDEAUX_FIELDS) {
    if (hidden.has(f.key)) continue;
    let grp = bySection.find(g => g.name === f.section);
    if (!grp) { grp = { name: f.section, fields: [] }; bySection.push(grp); }
    grp.fields.push(f);
  }
  return bySection;
}

// ── Bandeau d'en-tête (commun recto/verso) ──────────────────────────────────
function Header({ row, projectName, index, total }) {
  const hdr = getHeaderStyles(row?.etiquette_header_color || DEFAULT_HEADER_COLOR);
  const isDark = getContrastColor(hdr.bg) === "#FFFFFF";
  const boxBorder = isDark ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.2)";
  const lbl = { fontSize: 7, fontWeight: 700, letterSpacing: ".08em", opacity: .6, whiteSpace: "nowrap" };
  const val = { fontSize: 11, fontWeight: 600, lineHeight: 1.1 };
  const comment = v(row, "commentaire_confection", "");
  const hasComment = showComment(row);
  const verso = wantsVerso(row);

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

// ── RECTO : données en grille 5 colonnes fixes ──────────────────────────────
export function RectoLabel({ row, projectName, index, total, scale }) {
  const sections = visibleSections(row);
  const labelPx = 10 * scale, valuePx = 8 * scale;

  return (
    <div style={{ height: SLOT_H, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <Header row={row} projectName={projectName} index={index} total={total} />
      <div data-fid style={{ marginTop: 4 }}>
        {sections.map((sec) => (
          <div key={sec.name}>
            <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: ".1em", color: "#6a6a6a", padding: "1px 0", marginTop: 3, borderBottom: "1px solid #cfcfcf" }}>
              {sec.name.toUpperCase()}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", borderTop: "1px solid #ededed", borderLeft: "1px solid #ededed" }}>
              {sec.fields.map((f) => {
                const value = v(row, f.key);
                const isBool = value === "Oui" || value === "Non";
                const cellBase = { borderRight: "1px solid #ededed", borderBottom: "1px solid #ededed", padding: "1px 8px", minHeight: 17, display: "flex", flexDirection: "column", justifyContent: "center" };
                const kStyle = { fontSize: labelPx, fontWeight: 600, letterSpacing: ".01em", color: "#8a8a8a", lineHeight: 1.05, textTransform: "uppercase" };
                const vStyle = { fontSize: valuePx, fontWeight: 700, color: "#111", lineHeight: 1.05 };
                if (isBool) {
                  return (
                    <div key={f.key} style={cellBase}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
                        <span style={{ ...kStyle, lineHeight: 1.1 }}>{f.label}</span>
                        <span style={vStyle}>{value}</span>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={f.key} style={cellBase}>
                    <div style={kStyle}>{f.label}</div>
                    <div style={vStyle}>{value}</div>
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
          : <span style={{ color: "#c4c4c4", fontStyle: "italic", fontSize: 12 }}>— aucun croquis —</span>}
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

  // 1) mesurer (au rendu de base, échelle 1) puis calculer l'échelle qui remplit le cadre
  useLayoutEffect(() => {
    if (scales) return;
    const next = {};
    list.forEach((row, i) => {
      const headerEl = document.querySelector(`[data-row-idx="${i}"] [data-hid]`);
      const fieldsEl = document.querySelector(`[data-row-idx="${i}"] [data-fid]`);
      const headerH = headerEl ? headerEl.offsetHeight : 90;
      const fieldsH = fieldsEl ? fieldsEl.scrollHeight : 1;
      const avail = SLOT_H - headerH - 6;
      // fieldsH est mesuré au rendu de base (échelle 1, cf. `scale ?? 1`).
      // On vise à remplir `avail` sans déborder → marge de sécurité 0.97.
      let s = SCALE_BASE;
      if (fieldsH > 0) s = (avail / fieldsH) * 0.97;
      // plafonné à l'échelle validée (1.25) : on ne fait que rétrécir si besoin,
      // jamais grossir au-delà du rendu approuvé par l'atelier.
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

  // paires → pages alternées recto / verso
  const pairs = [];
  for (let i = 0; i < list.length; i += 2) pairs.push([i, i + 1]);
  // Aucune étiquette n'a de croquis → on ne génère aucune page verso (cas fréquent)
  const anyVerso = list.some(wantsVerso);

  const labelWrap = (i, node) => (
    <div key={i} data-row-idx={i}>{node}</div>
  );

  return ReactDOM.createPortal(
    <>
      <style>{`
        /* Hors écran mais avec layout réel : permet la mesure d'ajustement
           sans afficher le portail à l'utilisateur (display:none donnerait
           des hauteurs nulles). */
        #etq-rideaux-print-root {
          position: absolute; left: -100000px; top: 0;
          width: ${PAGE_W}px; background: #fff;
        }
        @media print {
          #etq-rideaux-print-root {
            left: 0; z-index: 99999;
          }
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
