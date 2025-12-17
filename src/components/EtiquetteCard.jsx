import React, { useMemo } from "react";
import { Card } from "@mui/material";

// Pure Display Component
export default function EtiquetteCard({
  row,
  schema,
  fields, // Only used for 'screen' mode usually
  projectName,
  mode = 'screen' // 'screen' | 'print'
}) {
  const byKey = useMemo(
    () => Object.fromEntries((schema || []).map((c) => [c.key, c])),
    [schema]
  );

  // Header Data
  const zone = row.zone || "Zone ?";
  const piece = row.piece || "Pièce ?";
  const title = `${projectName || "Projet"} - ${zone} - ${piece}`;

  // --- PRINT MODE (DENSE GRID - ALL FIELDS) ---
  if (mode === 'print') {
    // 1. Get ALL relevant fields from schema
    // Exclude technical fields
    const printCols = (schema || []).filter(c =>
      !['sel', 'detail', 'photo', 'button', 'id', 'zone', 'piece'].includes(c.key)
    );

    return (
      <div className="etq-card-print">
        {/* Header */}
        <div className="etq-header-print">
          {title}
        </div>

        {/* 4-Columns Grid */}
        <div className="etq-print-grid">
          {printCols.map((col) => {
            const k = col.key;
            let displayVal = row[k];
            const isBoolean = col.type === "checkbox" || col.type === "boolean";

            if (isBoolean) displayVal = displayVal ? "OUI" : "NON";
            // If empty, show space to allow layout to maintain height or just show empty
            // User said: "Si row.valeur est vide, affiche quand même la case"
            if (displayVal == null || displayVal === "") displayVal = "\u00A0"; // nbsp

            // SPANNING LOGIC
            // Heuristic: comments, confection, notes, large text fields -> span 4
            // Others -> span 1
            let spanClass = "";
            const lowerKey = k.toLowerCase();
            if (['comments', 'notes', 'description', 'obs'].some(x => lowerKey.includes(x)) || col.type === 'textarea') {
              spanClass = "col-span-4";
            }
            else if (['tissu_deco1', 'tissu_deco2', 'type_confection', 'produit'].includes(k)) {
              // Intermediate span
              spanClass = "col-span-2";
            }

            return (
              <div key={k} className={`etq-print-cell ${spanClass}`}>
                <div className="etq-cell-label">
                  {col.label || k}
                </div>
                <div className="etq-cell-value">
                  {displayVal}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // --- SCREEN MODE (Nice Card) ---
  return (
    <Card
      elevation={2}
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: "white",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      <div
        style={{
          backgroundColor: "#f3f4f6",
          padding: "8px",
          borderRadius: "6px",
          borderBottom: "1px solid #e5e7eb",
          fontWeight: 700,
          fontSize: "14px",
          color: "#111827",
          textTransform: "uppercase",
          textAlign: "center"
        }}
      >
        {title}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px", flex: 1, alignContent: "start" }}>
        {(fields || []).map((k) => {
          const col = byKey[k];
          if (!col) return null;
          if (["zone", "piece"].includes(k)) return null;

          const label = col.label || k;
          let val = row[k];
          const isBoolean = col.type === "checkbox" || col.type === "boolean";

          if (isBoolean) val = val ? "Oui" : "Non";
          if (val == null || val === "") val = "—";

          return (
            <div key={k} style={{ gridColumn: isBoolean ? 'span 2' : 'auto' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                {label}
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#111827' }}>
                {val}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}