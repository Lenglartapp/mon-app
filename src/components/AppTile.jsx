// src/components/AppTile.jsx
import { S, COLORS } from "../lib/constants/ui.js";

export default function AppTile({ label, Icon, size = 160, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: 16,
        border: `1px solid ${COLORS.border}`,
        background: "#fff",
        boxShadow: "0 2px 12px rgba(0,0,0,.06)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        cursor: "pointer",
      }}
    >
      {Icon ? <Icon size={Math.round(size * 0.35)} /> : null}
      <div style={{ fontWeight: 700 }}>{label}</div>
    </button>
  );
}