// src/components/etiquettesV2/EtiquetteLabelV2.jsx
// Composant d'étiquette unifié écran / impression (V2).
// Rendu en millimètres réels (200mm × 96mm, 3 par page A4) : ce qui s'affiche
// à l'écran est exactement ce qui s'imprime.
// - Les champs masqués sont retirés du flux : le reste se recompacte (packRows).
// - La taille de police s'adapte au nombre de champs visibles (computeFontSize).
import React, { useLayoutEffect, useRef } from "react";
import { DEFAULT_HEADER_COLOR, getHeaderStyles } from "../../lib/etiquetteColors.js";
import { makeValueGetter, packRows, computeFontSize } from "./labelConfigs.js";

export const LABEL_W_MM = 200;
export const LABEL_H_MM = 96;
const HEADER_H_MM = 10;
const RIGHT_COL_MM = 46;
const MM_TO_PT = 2.835;
// marge de sécurité sur la hauteur estimée (bordures, arrondis de rendu)
const BODY_AVAIL_PT = (LABEL_H_MM - HEADER_H_MM) * MM_TO_PT * 0.96;

function Cell({ field, row, v, fs, plusAfter }) {
  const value = field.value ? field.value(row, v) : v(row, field.key);
  const accent = typeof field.accent === "function" ? field.accent(row, v) : !!field.accent;
  return (
    <div style={{
      borderRight: "0.4pt solid #CBD5E1",
      borderBottom: "0.4pt solid #CBD5E1",
      padding: `${fs.padV}pt ${fs.padH}pt`,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: 0,
      minWidth: 0,
      overflow: plusAfter ? "visible" : "hidden",
      position: "relative",
    }}>
      {plusAfter && (
        <span style={{
          position: "absolute", right: `${-fs.label * 0.4}pt`, top: "50%",
          transform: "translateY(-50%)",
          fontSize: `${fs.value}pt`, fontWeight: 300, color: "#94A3B8",
          lineHeight: 1, zIndex: 2, pointerEvents: "none",
          background: "white", borderRadius: "50%",
        }}>+</span>
      )}
      <span style={{
        fontSize: `${fs.label}pt`, fontWeight: 600, letterSpacing: "0.04em",
        textTransform: "uppercase", color: "#9CA3AF", lineHeight: 1.05,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {field.label}
      </span>
      <span style={{
        fontSize: `${fs.value}pt`, fontWeight: 700,
        color: accent ? "#92742A" : "#111827",
        lineHeight: 1.18,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {value}
      </span>
    </div>
  );
}

function SectionBlock({ section, row, v, hiddenSet, fs }) {
  const rows = packRows(section.fields, hiddenSet);
  if (rows.length === 0) return null;
  return (
    <>
      <div style={{
        fontSize: `${fs.title}pt`, fontWeight: 700, letterSpacing: "0.12em",
        textTransform: "uppercase", color: "#6B7280",
        background: "#F3F4F6",
        padding: `${fs.padV * 0.8}pt ${fs.padH}pt`,
        borderBottom: "0.4pt solid #CBD5E1",
        flexShrink: 0,
      }}>
        {section.title}
      </div>
      {rows.map((rowFields, ri) => (
        <div
          key={ri}
          style={{
            display: "grid",
            gridTemplateColumns: rowFields.map((f) => `${f.w || 1}fr`).join(" "),
            background: ri % 2 === 1 ? "#F9FAFB" : "white",
            // les lignes se partagent la hauteur restante : pas de blanc en bas
            flex: "1 0 auto",
          }}
        >
          {rowFields.map((f, fi) => {
            const next = rowFields[fi + 1];
            const plusAfter = !!(f.plusAfterIfNext && next && next.key === f.plusAfterIfNext);
            return <Cell key={f.key} field={f} row={row} v={v} fs={fs} plusAfter={plusAfter} />;
          })}
        </div>
      ))}
    </>
  );
}

function EtiquetteLabelV2({ row, config, projectName, index, total, fontAdjust = 1, onOverflowChange, imgLoading = "lazy" }) {
  const hiddenSet = new Set(Array.isArray(row?.etiquette_hidden_fields) ? row.etiquette_hidden_fields : []);
  const v = makeValueGetter(config.getters);

  const zone = v(row, "zone", "Zone ?");
  const piece = v(row, "piece", "Pièce ?");
  const croquis = config.getCroquis(row);
  const commentaire = v(row, config.commentKey, "");
  const hasRightCol = !!croquis || (commentaire && commentaire !== "—");

  const hdr = getHeaderStyles(row?.etiquette_header_color || DEFAULT_HEADER_COLOR);

  // Taille auto selon densité, puis ajustement manuel
  const { size: autoSize } = computeFontSize({
    sections: config.sections,
    hiddenSet,
    availPt: BODY_AVAIL_PT,
  });
  const s = Math.max(4.5, Math.min(16, autoSize * fontAdjust));
  const fs = {
    value: s,
    label: Math.max(3.8, s * 0.6),
    title: Math.max(3.8, s * 0.62),
    padV: s * 0.32,
    padH: s * 0.5,
  };

  // Détection de débordement (écran uniquement, via onOverflowChange)
  const bodyRef = useRef(null);
  useLayoutEffect(() => {
    if (!onOverflowChange || !bodyRef.current) return;
    const el = bodyRef.current;
    onOverflowChange(el.scrollHeight > el.clientHeight + 2);
  });

  return (
    <div style={{
      width: `${LABEL_W_MM}mm`,
      height: `${LABEL_H_MM}mm`,
      border: "0.5pt solid #9CA3AF",
      fontFamily: "system-ui, -apple-system, Arial, sans-serif",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      background: "white",
      boxSizing: "border-box",
    }}>
      {/* BANDEAU */}
      <div style={{
        background: hdr.bg,
        height: `${HEADER_H_MM}mm`,
        boxSizing: "border-box",
        padding: "0 8pt",
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto",
        alignItems: "center",
        gap: "8pt",
        flexShrink: 0,
      }}>
        <div style={{ fontSize: "6.5pt", fontWeight: 800, color: hdr.textMuted, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
          {projectName || "Projet"}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "10pt", fontWeight: 800, color: hdr.textMain, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {zone} — {piece}
          </div>
          <div style={{ fontSize: "6.5pt", fontWeight: 600, color: hdr.textMuted, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {v(row, "produit")}
          </div>
        </div>
        <div style={{
          fontSize: "7pt", fontWeight: 600, color: hdr.badgeText,
          background: hdr.badgeBg, borderRadius: "2pt",
          padding: "2pt 5pt", whiteSpace: "nowrap",
        }}>
          {(index ?? 0) + 1}/{total}
        </div>
      </div>

      {/* CORPS */}
      <div style={{
        display: "grid",
        gridTemplateColumns: hasRightCol ? `1fr ${RIGHT_COL_MM}mm` : "1fr",
        flex: 1,
        overflow: "hidden",
        minHeight: 0,
      }}>
        {/* Champs (gauche) */}
        <div ref={bodyRef} style={{ display: "flex", flexDirection: "column", overflow: "hidden", borderLeft: "0.4pt solid #CBD5E1" }}>
          {config.sections.map((section) => (
            <SectionBlock
              key={section.title}
              section={section}
              row={row}
              v={v}
              hiddenSet={hiddenSet}
              fs={fs}
            />
          ))}
        </div>

        {/* Croquis + commentaire (droite) */}
        {hasRightCol && (
          <div style={{ borderLeft: "0.5pt solid #9CA3AF", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ flex: 2, borderBottom: "0.4pt solid #CBD5E1", display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{
                fontSize: `${fs.title}pt`, fontWeight: 700, letterSpacing: "0.1em",
                textTransform: "uppercase", color: "#6B7280",
                background: "#F3F4F6", padding: `${fs.padV * 0.8}pt ${fs.padH}pt`,
                borderBottom: "0.4pt solid #CBD5E1",
              }}>
                {config.croquisTitle}
              </div>
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "3pt", minHeight: 0 }}>
                {croquis ? (
                  <img src={croquis} alt="Croquis" loading={imgLoading} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                ) : (
                  <div style={{ fontSize: "5pt", color: "#D1D5DB", fontStyle: "italic" }}>—</div>
                )}
              </div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{
                fontSize: `${fs.title}pt`, fontWeight: 700, letterSpacing: "0.1em",
                textTransform: "uppercase", color: "#6B7280",
                background: "#F3F4F6", padding: `${fs.padV * 0.8}pt ${fs.padH}pt`,
                borderBottom: "0.4pt solid #CBD5E1",
              }}>
                Commentaires atelier
              </div>
              <div style={{
                flex: 1, padding: `${fs.padV}pt ${fs.padH}pt`,
                fontSize: `${Math.max(5.5, s * 0.85)}pt`, color: "#374151",
                lineHeight: 1.35, wordBreak: "break-word", overflow: "hidden",
              }}>
                {commentaire === "—" ? "" : commentaire}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(EtiquetteLabelV2);
