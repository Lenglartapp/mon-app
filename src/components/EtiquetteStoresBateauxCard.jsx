// src/components/EtiquetteStoresBateauxCard.jsx
import React, { useLayoutEffect, useRef, useState } from "react";
import StoresBateauxLabel from "./etiquettesStoresBateaux/StoresBateauxLabel.jsx";
import { ETIQUETTE_STORES_BATEAUX_FIELDS } from "../lib/etiquettes/storesBateauxLabel.js";

// Champs du menu « Personnaliser » : mêmes clés et sections que l'étiquette imprimée.
const SECTIONS = [...new Set(ETIQUETTE_STORES_BATEAUX_FIELDS.map((f) => f.section))];

// Étiquette imprimée : 200 × 90 mm (px CSS à 96 dpi).
const LABEL_W = 200 * 96 / 25.4, LABEL_H = 90 * 96 / 25.4;

// Aperçu à l'écran : l'étiquette imprimée, agrandie à la largeur de la carte (mêmes
// proportions, même mise en page). Mise à l'échelle par transform : l'ajustement du texte
// de l'étiquette mesure toujours sa taille réelle 200 × 90 mm.
function ScaledLabel(props) {
  const ref = useRef(null);
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setZoom(el.clientWidth / LABEL_W || 1);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ width: "100%", height: LABEL_H * zoom, overflow: "hidden" }}>
      <div style={{ width: LABEL_W, transform: `scale(${zoom})`, transformOrigin: "top left" }}>
        <StoresBateauxLabel {...props} />
      </div>
    </div>
  );
}

// ─── Panneau de personnalisation ─────────────────────────────────────────────
function CustomizePanel({ hiddenFields, onChange, onClose }) {
  const [draft, setDraft] = useState([...hiddenFields]);

  const toggle = (key) => {
    setDraft(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleSection = (section) => {
    const keys = ETIQUETTE_STORES_BATEAUX_FIELDS
      .filter(f => f.section === section)
      .map(f => f.key);
    const allHidden = keys.every(k => draft.includes(k));
    if (allHidden) {
      setDraft(prev => prev.filter(k => !keys.includes(k)));
    } else {
      setDraft(prev => [...new Set([...prev, ...keys])]);
    }
  };

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 20,
      background: "rgba(255,255,255,0.97)",
      borderRadius: 10, overflowY: "auto",
      padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#111827", letterSpacing: "0.02em" }}>
          Personnaliser l'étiquette
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setDraft([])}
            style={{
              fontSize: 11, color: "#6B7280", background: "none",
              border: "1px solid #E0DED9", borderRadius: 5,
              padding: "4px 10px", cursor: "pointer",
            }}
          >
            Tout afficher
          </button>
          <button
            onClick={() => { onChange(draft); onClose(); }}
            style={{
              fontSize: 11, fontWeight: 700, color: "white",
              background: "#1F2937", border: "none",
              borderRadius: 5, padding: "4px 12px", cursor: "pointer",
            }}
          >
            Valider
          </button>
        </div>
      </div>

      {SECTIONS.map(section => {
        const fields = ETIQUETTE_STORES_BATEAUX_FIELDS.filter(f => f.section === section);
        const hiddenCount = fields.filter(f => draft.includes(f.key)).length;
        return (
          <div key={section}>
            <div
              onClick={() => toggleSection(section)}
              style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                textTransform: "uppercase", color: "#6B7280",
                marginBottom: 6, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {section}
              {hiddenCount > 0 && (
                <span style={{
                  fontSize: 9, fontWeight: 600, color: "#EF4444",
                  background: "#FEF2F2", borderRadius: 3, padding: "1px 5px",
                }}>
                  {hiddenCount} masqué{hiddenCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 5,
            }}>
              {fields.map(f => {
                const hidden = draft.includes(f.key);
                return (
                  <button
                    key={f.key}
                    onClick={() => toggle(f.key)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "5px 9px",
                      border: `1px solid ${hidden ? "#FECACA" : "#D1FAE5"}`,
                      borderRadius: 6,
                      background: hidden ? "#FEF2F2" : "#F0FDF4",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: 13 }}>{hidden ? "🚫" : "👁"}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: hidden ? "#9CA3AF" : "#111827",
                      textDecoration: hidden ? "line-through" : "none",
                    }}>
                      {f.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function EtiquetteStoresBateauxCard({ row, projectName, index, total, onEdit, onRowChange }) {
  const [customizing, setCustomizing] = useState(false);

  const hiddenFields = Array.isArray(row?.etiquette_hidden_fields) ? row.etiquette_hidden_fields : [];

  const hiddenCount = hiddenFields.length;

  const handleSaveHidden = (newHidden) => {
    if (onRowChange) onRowChange({ ...row, etiquette_hidden_fields: newHidden });
  };

  return (
    <div style={{
      border: "1px solid #D1D5DB", borderRadius: 10,
      overflow: "hidden", position: "relative",
      fontFamily: "system-ui, -apple-system, sans-serif",
      boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
      background: "white",
    }}>

      {/* MODE PERSONNALISATION */}
      {customizing && (
        <CustomizePanel
          hiddenFields={hiddenFields}
          onChange={handleSaveHidden}
          onClose={() => setCustomizing(false)}
        />
      )}

      {/* ÉTIQUETTE : rendu identique à l'impression, à la largeur de la carte */}
      <ScaledLabel row={row} projectName={projectName} index={index} total={total} />

      {/* FOOTER */}
      <div style={{
        background: "#F4F4F4", borderTop: "1px solid #E5E7EB",
        padding: "6px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <button
          onClick={() => setCustomizing(true)}
          style={{
            fontSize: 11, fontWeight: 600,
            color: hiddenCount > 0 ? "#92742A" : "#6B7280",
            background: hiddenCount > 0 ? "#FEF3C7" : "white",
            border: `1px solid ${hiddenCount > 0 ? "#FCD34D" : "#E0DED9"}`,
            borderRadius: 6, padding: "4px 12px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
          }}
        >
          ✏️ Personnaliser
          {hiddenCount > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              background: "#92742A", color: "white",
              borderRadius: 10, padding: "1px 6px",
            }}>
              {hiddenCount} masqué{hiddenCount > 1 ? "s" : ""}
            </span>
          )}
        </button>
        {onEdit && (
          <button
            onClick={() => onEdit(row)}
            style={{
              fontSize: 12, fontWeight: 600, color: "#374151",
              background: "white", border: "1px solid #D1D5DB",
              borderRadius: 6, padding: "5px 14px", cursor: "pointer",
            }}
          >
            Modifier
          </button>
        )}
      </div>
    </div>
  );
}
