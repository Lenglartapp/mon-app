// src/components/etiquettesStoresBateaux/StoresBateauxLabel.jsx
// Étiquette STORES BATEAUX / VELUM, 200 × 90 mm — même grille et même rendu de cellule que
// l'étiquette rideau (etiquettesV2/EtiquettesV2RectoVersoPortal.jsx). Utilisée telle quelle
// pour l'aperçu à l'écran et pour l'impression (3 par A4).
//
// Le texte s'ajuste à l'étiquette : on part de l'échelle de base et on réduit tant que la
// grille déborde de sa zone (rien n'est coupé).
import React, { useLayoutEffect, useRef, useState } from "react";
import { DEFAULT_HEADER_COLOR, getHeaderStyles, getContrastColor } from "../../lib/etiquetteColors.js";
import {
  layoutFor, sideLines, getCroquis, showWindow, commentText, isHidden, raw,
  BIG_KEYS, HEAD_KEYS,
} from "../../lib/etiquettes/storesBateauxLabel.js";

const SCALE_MAX = 1.3, SCALE_MIN = 0.55;
const PAN_COLOR = "#7ec850";
const PAN_COLOR_ON_LIGHT = "#2f6b10"; // même vert, foncé : lisible sur les bandeaux clairs
const BIG_BG = "#eef1f6", HEAD_BG = "#ece8f6";
const SIDE_W = 150;
// Matières et mécanisme : toujours libellé au-dessus, valeur dessous.
const STACK_KEYS = new Set(["toile_finition_1", "doublure", "mecanisme_store"]);
const rowCount = (groups) => groups.reduce((n, g) => n + g.rows.length, 0);

const txt = (row, key) => {
  const s = String(raw(row, key) ?? "").trim();
  return s === "—" ? "" : s;
};

// ── En-tête compact sur 2 lignes (identique au recto rideau) ────────────────
function Header({ row, projectName, index, total }) {
  const hdr = getHeaderStyles(row?.etiquette_header_color || DEFAULT_HEADER_COLOR);
  const isDark = getContrastColor(hdr.bg) === "#FFFFFF";
  const where = [
    `ZONE ${txt(row, "zone") || "—"}`,
    `PIÈCE ${txt(row, "piece") || "—"}`,
    ...(showWindow(row) ? [`FENÊTRE ${txt(row, "fenetre")}`] : []),
  ].join(" · ");
  const type = txt(row, "type_store_bateau");
  const produit = txt(row, "produit");
  const qte = txt(row, "quantite");
  return (
    <div data-hid style={{ background: hdr.bg, color: hdr.textMain, padding: "4px 10px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, lineHeight: 1.15 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{projectName || "Projet"}</span>
          {produit && <span style={{ fontSize: 10, color: hdr.textMuted, fontWeight: 600 }}>{produit}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 3, flexWrap: "wrap" }}>
          <span style={{
            background: hdr.badgeBg, color: hdr.badgeText, borderRadius: 4, padding: "0 6px",
            border: `1.5px solid ${isDark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.45)"}`,
            fontSize: 10, fontWeight: 700, letterSpacing: ".02em", whiteSpace: "nowrap",
          }}>{where}</span>
          {type && <span style={{ fontSize: 11, fontWeight: 800, color: isDark ? PAN_COLOR : PAN_COLOR_ON_LIGHT, textTransform: "uppercase", whiteSpace: "nowrap" }}>{type}</span>}
        </div>
      </div>
      <div style={{ flex: "0 0 auto", textAlign: "right", lineHeight: 1.25 }}>
        <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>n°{(index ?? 0) + 1}/{total}</div>
        {qte && <div style={{ fontSize: 10, whiteSpace: "nowrap", color: hdr.textMuted }}>Qté <b style={{ color: hdr.textMain }}>{qte}</b></div>}
      </div>
    </div>
  );
}

// ── Colonne de droite : intervalles & barre, puis croquis ───────────────────
function SidePanel({ row, fs }) {
  const lines = sideLines(row);
  const croquis = getCroquis(row);
  const comment = commentText(row);
  const showComment = !isHidden(row, "commentaire_confection");
  const title = { fontSize: 7, fontWeight: 700, letterSpacing: ".1em", color: "#6a6a6a", marginBottom: 2 };
  return (
    <div style={{ width: SIDE_W, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0, borderLeft: "1px solid #ededed", paddingLeft: 6 }}>
      {lines.length > 0 && (
        <>
          <div style={{ ...title, marginTop: 3 }}>INTERVALLES & BARRE</div>
          <div style={{ background: HEAD_BG, borderRadius: 4, padding: "4px 6px", display: "flex", flexDirection: "column", gap: 2 }}>
            {lines.map((l) => (
              <div key={l.key} style={{ fontSize: Math.min(fs, 12), fontWeight: 700, color: "#111", lineHeight: 1.25 }}>{l.text}</div>
            ))}
          </div>
        </>
      )}
      <div style={{ ...title, marginTop: 4 }}>CROQUIS</div>
      <div style={{ flex: 1, minHeight: 30, border: "1px solid #e2e2e2", borderRadius: 4, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {croquis && <img src={croquis} alt="Croquis intervalles" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />}
      </div>
      {/* Commentaire atelier : toujours affiché sous le croquis (vide = zone à remplir à la main),
          sauf s'il est masqué via « Personnaliser ». */}
      {showComment && (
        <>
          <div style={{ ...title, marginTop: 4 }}>COMMENTAIRE ATELIER</div>
          <div style={{ flex: comment ? "0 1 auto" : "0 0 45px", minHeight: 45, overflow: "hidden", border: `1.5px solid ${comment ? "#111" : "#e2e2e2"}`, borderRadius: 4, background: comment ? "#fffbea" : "#fff", padding: "2px 5px", fontSize: Math.min(fs, 11), fontWeight: 700, color: "#111", whiteSpace: "pre-wrap", lineHeight: 1.2, overflowWrap: "anywhere" }}>
            {comment}
          </div>
        </>
      )}
    </div>
  );
}

// ── Étiquette complète ──────────────────────────────────────────────────────
export default function StoresBateauxLabel({ row, projectName, index, total }) {
  const sections = layoutFor(row);
  const boxRef = useRef(null);
  const gridRef = useRef(null);
  const [fit, setFit] = useState({ row, scale: SCALE_MAX });
  const scale = fit.row === row ? fit.scale : SCALE_MAX;

  // Réduit l'échelle tant que la grille déborde de sa zone (quelques passes au plus).
  useLayoutEffect(() => {
    const box = boxRef.current, grid = gridRef.current;
    if (!box || !grid) return;
    const avail = box.clientHeight, h = Math.max(box.scrollHeight, grid.scrollHeight);
    if (avail > 0 && h > avail + 1 && scale > SCALE_MIN) {
      // Pas progressif (racine du rapport) : un retour à la ligne peut faire sauter la hauteur.
      setFit({ row, scale: Math.max(SCALE_MIN, Math.min(scale - 0.02, scale * Math.sqrt(avail / h))) });
    }
  }, [row, scale]);

  const fs = 10.5 * scale;     // libellé ET valeur, même corps
  const bigFs = fs * 1.5;      // gros chiffres
  const lineBorder = "1px solid #ededed";

  const renderCell = (cell, i) => {
    if (!cell || !cell.text) {
      return <div key={`b${i}`} style={{ borderRight: lineBorder, borderBottom: lineBorder, minHeight: 12 }} />;
    }
    const big = BIG_KEYS.has(cell.key);
    const bg = HEAD_KEYS.has(cell.key) ? HEAD_BG : big ? BIG_BG : "transparent";
    // Texte long (tissu, méca…) : libellé au-dessus, valeur dessous alignée à gauche, au lieu
    // d'une valeur coupée en escalier à côté du libellé.
    if (!big && (STACK_KEYS.has(cell.key) || cell.label.length + cell.text.length > 22)) {
      return (
        <div key={cell.key} style={{ background: bg, borderRight: lineBorder, borderBottom: lineBorder, padding: "1px 5px", minHeight: 12, display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
          <span style={{ fontSize: fs * 0.8, fontWeight: 600, color: "#5e5e5e", whiteSpace: "nowrap", lineHeight: 1.1 }}>{cell.label}</span>
          <span style={{ fontSize: fs, fontWeight: 700, color: "#111", lineHeight: 1.1, overflowWrap: "anywhere" }}>{cell.text}</span>
        </div>
      );
    }
    return (
      <div key={cell.key} style={{ background: bg, borderRight: lineBorder, borderBottom: lineBorder, padding: "0 5px", minHeight: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 5, minWidth: 0 }}>
        <span style={{ fontSize: fs, fontWeight: 600, color: "#5e5e5e", whiteSpace: "nowrap", lineHeight: 1.1 }}>{cell.label}</span>
        <span style={{ fontSize: big ? bigFs : fs, fontWeight: big ? 800 : 700, color: "#111", textAlign: "right", lineHeight: 1.05, whiteSpace: big ? "nowrap" : "normal", overflowWrap: "anywhere", minWidth: 0 }}>{cell.text}</span>
      </div>
    );
  };

  // Les lignes se partagent la hauteur libre (en plus de leur hauteur naturelle) : l'étiquette est
  // remplie comme un tableau, sans vide sous la grille. Si ça déborde, l'échelle réduit.
  const renderRows = (rows) => (
    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", borderTop: lineBorder, borderLeft: lineBorder }}>
      {rows.map((cells, ri) => {
        const full = [...cells, ...Array(Math.max(0, 4 - cells.length)).fill(null)];
        return <React.Fragment key={ri}>{full.map((c, i) => renderCell(c, i))}</React.Fragment>;
      })}
    </div>
  );

  return (
    <div style={{
      width: "200mm", height: "90mm", flexShrink: 0, boxSizing: "border-box", overflow: "hidden",
      border: "0.5pt solid #9CA3AF", background: "#fff", color: "#111",
      fontFamily: "Roboto, system-ui, -apple-system, Arial, sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      <Header row={row} projectName={projectName} index={index} total={total} />
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 6, padding: "0 6px 4px" }}>
        <div ref={boxRef} style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          <div ref={gridRef} style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            {sections.map((sec) => (
              <div key={sec.name} style={{ flex: rowCount(sec.groups), display: "flex", flexDirection: "column" }}>
                <div style={{ flex: "none", fontSize: 7, fontWeight: 700, letterSpacing: ".1em", color: "#6a6a6a", marginTop: 3, marginBottom: 1 }}>
                  {sec.name}
                </div>
                {sec.groups.map((g, gi) => g.frame ? (
                  <div key={gi} style={{ flex: g.rows.length, display: "flex", flexDirection: "column", position: "relative", border: "1px solid #d6dbe4", borderRadius: 6, background: "#fafbfd", padding: "6px 4px 3px", marginTop: 5, marginBottom: 1 }}>
                    <span style={{ position: "absolute", top: -5, left: 8, background: "#fff", padding: "0 4px", fontSize: 7, fontWeight: 700, letterSpacing: ".1em", color: "#6a6a6a", textTransform: "uppercase", lineHeight: 1 }}>{g.frame}</span>
                    {renderRows(g.rows)}
                  </div>
                ) : (
                  <div key={gi} style={{ flex: g.rows.length, display: "flex", flexDirection: "column", marginTop: 2 }}>{renderRows(g.rows)}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <SidePanel row={row} fs={fs} />
      </div>
    </div>
  );
}
