// src/components/EtiquetteCard.jsx
import React, { useMemo } from "react";
import { S } from "../lib/constants/ui.js";

export default function EtiquetteCard({ row, schema, fields }) {
  const byKey = useMemo(
    () => Object.fromEntries((schema || []).map(c => [c.key, c])),
    [schema]
  );

  return (
    <div className="etq-card" style={S.card}>
      {(fields || []).map(k => {
        const col = byKey[k];
        if (!col) return null;

        const label = col.label || k;
        const val = row?.[k];
        const text =
          val == null
            ? ""
            : (col.type === "checkbox" ? (val ? "Oui" : "Non") : String(val));

        return (
          <div key={k} style={S.cardRow}>
            <div style={S.cardLabel}>{label} :</div>
            <div>{text}</div>
          </div>
        );
      })}
    </div>
  );
}