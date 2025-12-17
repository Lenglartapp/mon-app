// src/components/FilterPanel.jsx
import React, { useMemo } from "react";
import { S, COLORS } from "../lib/constants/ui.js";
import { X } from "lucide-react";

export default function FilterPanel({ filters, setFilters, schema, onClose, inline = false }) {
  const opsByType = {
    text: [
      { v: "contains", label: "contient" },
      { v: "eq", label: "==" },
      { v: "neq", label: "!=" },
      { v: "isEmpty", label: "est vide" },
      { v: "notEmpty", label: "n'est pas vide" },
    ],
    select: [
      { v: "eq", label: "==" },
      { v: "neq", label: "!=" },
      { v: "contains", label: "contient" },
      { v: "isEmpty", label: "est vide" },
      { v: "notEmpty", label: "n'est pas vide" },
    ],
    number: [
      { v: "eq", label: "==" },
      { v: "neq", label: "!=" },
      { v: "gt", label: ">" },
      { v: "gte", label: ">=" },
      { v: "lt", label: "<" },
      { v: "lte", label: "<=" },
      { v: "isEmpty", label: "est vide" },
      { v: "notEmpty", label: "n'est pas vide" },
    ],
    checkbox: [
      { v: "isTrue", label: "est vrai" },
      { v: "isFalse", label: "est faux" },
    ],
    formula: [
      { v: "eq", label: "==" },
      { v: "neq", label: "!=" },
      { v: "gt", label: ">" },
      { v: "gte", label: ">=" },
      { v: "lt", label: "<" },
      { v: "lte", label: "<=" },
      { v: "isEmpty", label: "est vide" },
      { v: "notEmpty", label: "n'est pas vide" },
    ],
  };

  const byKey = useMemo(
    () => Object.fromEntries((schema || []).map(c => [c.key, c])),
    [schema]
  );

  const addLine = () => {
    // par défaut : première colonne (hors "sel")
    const first = (schema || []).find(c => c.key !== "sel") || (schema || [])[0];
    const baseType = first?.type || "text";
    const baseOp = (opsByType[baseType] || opsByType.text)[0].v;
    setFilters(fs => [...(fs || []), { key: first.key, op: baseOp, value: "" }]);
  };

  const updateAt = (i, patch) => {
    setFilters(fs => {
      const arr = [...(fs || [])];
      arr[i] = { ...arr[i], ...patch };
      // changer de colonne → réaligner l’opérateur sur le type
      if (patch.key) {
        const t = byKey[patch.key]?.type || "text";
        const firstOp = (opsByType[t] || opsByType.text)[0].v;
        arr[i].op = firstOp;
        if (t === "checkbox") delete arr[i].value; // pas de valeur libre
      }
      return arr;
    });
  };

  const removeAt = (i) => setFilters(fs => (fs || []).filter((_, j) => j !== i));
  const clearAll = () => setFilters([]);

  const containerStyle = inline
    ? { border: `1px solid ${COLORS.border}`, borderRadius: 8, background: 'white' }
    : S.pop;

  return (
    <div style={containerStyle}>
      <div
        style={{
          padding: 10,
          borderBottom: `1px solid ${COLORS.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <strong>Filtres</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.smallBtn} onClick={addLine}>+ Ajouter</button>
          <button style={S.smallBtn} onClick={clearAll}>Tout effacer</button>
          <button style={S.smallBtn} onClick={onClose} title="Fermer"><X size={14} /></button>
        </div>
      </div>

      <div style={{ padding: 10, display: "grid", gap: 8 }}>
        {(filters || []).length === 0 && (
          <div style={{ opacity: .7 }}>Aucun filtre. Cliquez sur « Ajouter ».</div>
        )}

        {(filters || []).map((f, i) => {
          const col = byKey[f.key] || (schema || [])[0];
          const type = col?.type || "text";
          const ops = opsByType[type] || opsByType.text;

          return (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 140px 1fr auto",
                gap: 8,
                alignItems: "center",
              }}
            >
              {/* Colonne */}
              <select value={f.key} onChange={(e) => updateAt(i, { key: e.target.value })}>
                {(schema || []).map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>

              {/* Opérateur */}
              <select value={f.op} onChange={(e) => updateAt(i, { op: e.target.value })}>
                {ops.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>

              {/* Valeur (cachée pour checkbox ou ops sans valeur) */}
              {type === "checkbox" || ["isTrue", "isFalse", "isEmpty", "notEmpty"].includes(f.op) ? (
                <div style={{ opacity: .6, fontStyle: "italic" }}>—</div>
              ) : (
                <input
                  value={f.value ?? ""}
                  onChange={(e) => updateAt(i, { value: e.target.value })}
                  placeholder="Valeur…"
                />
              )}

              <button style={S.smallBtn} onClick={() => removeAt(i)} title="Supprimer">✕</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}