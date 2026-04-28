// src/components/AppTile.jsx
import React from "react";

const NAVY = "#1E2447";
const NAVY_HOVER = "#26306B";

export default function AppTile({ label, Icon, size = 160, onClick }) {
  const [hov, setHov] = React.useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: size,
        height: size,
        borderRadius: 16,
        border: "none",
        background: hov ? NAVY_HOVER : NAVY,
        boxShadow: hov
          ? "0 12px 28px rgba(30,36,71,0.32), 0 4px 10px rgba(30,36,71,0.18)"
          : "0 2px 8px rgba(30,36,71,0.18)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        cursor: "pointer",
        transition: "background 0.18s ease-out, box-shadow 0.18s ease-out, transform 0.18s ease-out",
        transform: hov ? "translateY(-6px)" : "translateY(0)",
        color: "#fff",
        fontFamily: "Roboto, system-ui, sans-serif",
      }}
    >
      {Icon ? <Icon size={Math.round(size * 0.35)} color="#fff" strokeWidth={1.6} /> : null}
      <div style={{ fontWeight: 500, fontSize: Math.round(size * 0.13), letterSpacing: 0.2 }}>
        {label}
      </div>
    </button>
  );
}