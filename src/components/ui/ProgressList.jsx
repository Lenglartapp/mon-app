import React from "react";

// Liste « étape · barre fine · valeur · % », alignée en colonnes (look Notion).
// La couleur ne sert qu'à signaler : rouge = dépassement, vert = terminé, sinon neutre.
//
// items : [{ key, label, pct (nombre ou null), value (texte/nœud), note (texte, remplace barre+valeur) }]
// doneIsGreen : une étape à 100 % s'affiche en vert (avancement) ; sinon neutre (consommation).

const FONT = "Roboto, system-ui, sans-serif";
const TONES = { over: "#E24B4A", done: "#1D9E75", normal: "#37352F" };

function tone(pct, doneIsGreen) {
  if (pct == null) return null;
  if (pct > 100) return "over";
  if (doneIsGreen && pct >= 100) return "done";
  return "normal";
}

export default function ProgressList({ items, doneIsGreen = false }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "150px minmax(0,1fr) 130px 52px", gap: "14px 16px", alignItems: "center", fontFamily: FONT, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
      {items.map((it) => {
        const t = tone(it.pct, doneIsGreen);
        return (
          <React.Fragment key={it.key}>
            <span style={{ color: "#787774" }}>{it.label}</span>
            {it.note ? (
              <span style={{ gridColumn: "2 / 5", fontSize: 13, color: "#A8A7A3" }}>{it.note}</span>
            ) : (
              <>
                <div style={{ height: 4, borderRadius: 2, background: "#EDEDEB", overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(0, Math.min(it.pct || 0, 100))}%`, height: "100%", borderRadius: 2, background: TONES[t] || TONES.normal, transition: "width .3s ease" }} />
                </div>
                <span style={{ textAlign: "right", color: "#37352F", whiteSpace: "nowrap" }}>{it.value}</span>
                <span style={{ textAlign: "right", whiteSpace: "nowrap", color: t === "over" ? "#A32D2D" : t === "done" ? "#0F6E56" : "#A8A7A3", fontWeight: t === "over" ? 500 : 400 }}>
                  {it.pct == null ? "—" : `${Math.round(it.pct)} %`}
                </span>
              </>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// Valeur « réalisé / total » : réalisé en noir, total en gris.
export function Ratio({ done, total, unit = "" }) {
  return (
    <>
      {done}{unit} <span style={{ color: "#A8A7A3" }}>/ {total}{unit}</span>
    </>
  );
}
