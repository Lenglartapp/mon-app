// src/components/cells/FormulaAssist.jsx
import React from "react";
import { COLORS } from "../../lib/constants/ui";

/**
 * Props:
 *  - query: chaîne actuelle après "=" (ex: "a_plat + lar")
 *  - options: [{ key, label }]
 *  - onPick(token: string) -> void    (insertion "token" dans l'input)
 *  - preview: { ok: boolean, value: any } | null
 */
export default function FormulaAssist({ query, options, onPick, preview }) {
  const [filter, setFilter] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef(null);

  React.useEffect(() => {
    // Pré-remplir le filtre avec le dernier "mot" tapé (facultatif)
    const m = String(query || "").split(/[^a-zA-Z0-9_]+/).pop() || "";
    setFilter(m);
    setActive(0);
  }, [query]);

  const norm = (s) => String(s || "").toLowerCase();
  const filtered = (options || [])
    .filter(
      (o) =>
        norm(o.key).includes(norm(filter)) ||
        norm(o.label).includes(norm(filter))
    )
    .slice(0, 50);

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) onPick(filtered[active].key);
    }
    if (e.key === "Tab") {
      e.preventDefault();
      if (filtered[active]) onPick(filtered[active].key);
    }
  };

  return (
    <div
      onKeyDown={onKeyDown}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: "100%",
        marginTop: 6,
        background: "#fff",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        boxShadow: "0 10px 24px rgba(0,0,0,.12)",
        zIndex: 30,
      }}
    >
      <div
        style={{
          padding: 8,
          borderBottom: `1px solid ${COLORS.border}`,
          fontSize: 12,
        }}
      >
        <b>Champs</b> — tapez pour filtrer, ↑/↓ puis Entrée pour insérer
      </div>

      <div ref={listRef} style={{ maxHeight: 220, overflow: "auto" }}>
        {filtered.map((o, i) => (
          <div
            key={o.key}
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(o.key);
            }}
            onMouseEnter={() => setActive(i)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 10px",
              cursor: "pointer",
              background: i === active ? "#f3f4f6" : "#fff",
              borderBottom: `1px solid ${COLORS.border}`,
              fontSize: 13,
            }}
          >
            <span>{o.label}</span>
            <code style={{ opacity: 0.7 }}>{o.key}</code>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 10, fontSize: 12, opacity: 0.7 }}>
            Aucun résultat…
          </div>
        )}
      </div>

      {preview && (
        <div
          style={{
            padding: 8,
            borderTop: `1px solid ${COLORS.border}`,
            fontSize: 12,
            background: "#fafafa",
          }}
        >
          <b>Aperçu</b> :{" "}
          {preview.ok ? (
            String(preview.value)
          ) : (
            <span style={{ color: "#b91c1c" }}>—</span>
          )}
        </div>
      )}
    </div>
  );
}
