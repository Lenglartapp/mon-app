import React from "react";

// Bloc « doux » du dashboard : fond gris très clair, coins arrondis, sans bordure.
// Kpi : petit libellé gris, grand chiffre fin (Roboto 300), total en gris, barre fine et pastille %.

const FONT = "Roboto, system-ui, sans-serif";
const SOFT_BG = "#F4F4F4";

export function SoftBlock({ title, subtitle, actions, children, style }) {
  return (
    <section style={{ background: SOFT_BG, borderRadius: 16, padding: "20px 24px 24px", fontFamily: FONT, ...style }}>
      {(title || actions) && (
        <header style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 20 }}>
          <div style={{ minWidth: 0 }}>
            {title && <h3 style={{ margin: 0, fontSize: 17, fontWeight: 500, color: "#1F2A37" }}>{title}</h3>}
            {subtitle && <div style={{ fontSize: 13, color: "#8A8F98", marginTop: 2 }}>{subtitle}</div>}
          </div>
          {actions && <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

const BAR = { over: "#E5484D", done: "#30A46C", normal: "#1E2447" };
const PILL = {
  over: { bg: "#FDECEC", color: "#B42318" },
  done: { bg: "#E6F4EC", color: "#1B7A4B" },
  normal: { bg: "#E9EBEE", color: "#5B616B" },
};

function toneOf(pct, doneIsGreen) {
  if (pct == null) return null;
  if (pct > 100) return "over";
  if (doneIsGreen && pct >= 100) return "done";
  return "normal";
}

/**
 * @param label  libellé
 * @param value  valeur principale (texte)
 * @param unit   suffixe discret de la valeur (ex. « h »)
 * @param total  total / budget (texte, affiché « / total »)
 * @param pct    % (null = pas de barre ni pastille)
 * @param note   remplace valeur + barre (ex. « Non applicable »)
 * @param sub    petite ligne grise sous la barre
 */
export function Kpi({ label, value, unit, total, pct, note, sub, doneIsGreen = false }) {
  const t = toneOf(pct, doneIsGreen);
  return (
    <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 22 }}>
        <span style={{ fontSize: 13, color: "#8A8F98", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
        {t && (
          <span style={{ fontSize: 11.5, fontWeight: 500, padding: "2px 8px", borderRadius: 999, background: PILL[t].bg, color: PILL[t].color, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
            {Math.round(pct)} %
          </span>
        )}
      </div>
      {note ? (
        <div style={{ fontSize: 15, fontWeight: 300, color: "#8A8F98", marginTop: 10, lineHeight: 1.35 }}>{note}</div>
      ) : (
        <>
          <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 6, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 34, fontWeight: 300, color: "#1F2A37", letterSpacing: "-0.02em", lineHeight: 1.05 }}>{value}</span>
            {unit && <span style={{ fontSize: 16, fontWeight: 300, color: "#5B616B" }}>{unit}</span>}
            {total != null && <span style={{ fontSize: 14, color: "#A0A5AD" }}>/ {total}</span>}
          </div>
          {pct != null && (
            <div style={{ height: 3, borderRadius: 2, background: "#E4E4E4", marginTop: 12, overflow: "hidden" }}>
              <div style={{ width: `${Math.max(0, Math.min(pct, 100))}%`, height: "100%", borderRadius: 2, background: BAR[t], transition: "width .4s ease" }} />
            </div>
          )}
        </>
      )}
      {sub && <div style={{ fontSize: 12, color: "#A0A5AD", marginTop: 8 }}>{sub}</div>}
    </div>
  );
}

export function KpiGrid({ children, min = 150 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: "24px 28px" }}>
      {children}
    </div>
  );
}
