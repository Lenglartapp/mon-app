import React from "react";
import { X } from "lucide-react";
import { COLORS, S } from "../lib/constants/ui";

export default function ColumnPicker({ visibleCols, setVisibleCols, schema, onClose }) {
  // Colonnes protégées (toujours visibles)
  const MIN_COLS = ["sel", "detail"];

  // Bascule d’une colonne, en empêchant de décocher une colonne protégée
  const toggle = (k) => {
    setVisibleCols((arr) => {
      // on interdit la décoché de ces colonnes
      if (MIN_COLS.includes(k)) return arr;

      return arr.includes(k)
        ? arr.filter((x) => x !== k)
        : [...arr, k];
    });
  };

  return (
    <div style={S.pop}>
      {/* Entête */}
      <div
        style={{
          padding: 10,
          borderBottom: `1px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <strong>Colonnes</strong>
        <button onClick={onClose} style={S.smallBtn}>
          <X size={14} />
        </button>
      </div>

      {/* Boutons rapides */}
      <div style={{ padding: 10 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button
            style={S.smallBtn}
            onClick={() => setVisibleCols(schema.map((c) => c.key))}
          >
            Tout
          </button>

          <button
            style={S.smallBtn}
            onClick={() => setVisibleCols(["sel", "detail"])}
          >
            Rien
          </button>
        </div>

        {/* Liste des colonnes */}
        <div style={{ display: "grid", gap: 6 }}>
          {schema.map((c) => {
            const checked = visibleCols.includes(c.key);
            const locked = MIN_COLS.includes(c.key);
            return (
              <label
                key={c.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "4px 2px",
                  borderBottom: `1px dashed ${COLORS.border}`,
                  opacity: locked ? 0.65 : 1,
                }}
                title={locked ? "Toujours visible" : ""}
              >
                <span>{c.label}</span>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={locked}
                  onChange={() => toggle(c.key)}
                />
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}