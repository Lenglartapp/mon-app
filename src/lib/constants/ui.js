// src/lib/constants/ui.js
export const COLORS = { page: "#FAF5EE", tile: "#1E2447", text: "#111827", border: "#E5E7EB", rowAlt: "#F9FAFB" };

export const S = {
  page: { minHeight: "100vh", width: "100%", background: COLORS.page, display: "flex", flexDirection: "column" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 40px" },
  brandBtn: { display: "flex", alignItems: "center", gap: 14, cursor: "pointer", background: "transparent", border: "none" },
  logoText: { fontWeight: 900, letterSpacing: 3, background: "#000", color: "#fff", padding: "8px 14px", borderRadius: 6 },
  userBtn: { display: "flex", alignItems: "center", gap: 12, cursor: "pointer", background: "transparent", border: "none" },
  avatarBox: { width: 40, height: 40, borderRadius: "50%", overflow: "hidden", background: "#000", display: "grid", placeItems: "center", color: "#fff", fontWeight: 700 },

  contentWrap: { width: "min(1200px, 96vw)", margin: "0 auto", padding: "8px 24px 24px" },
  contentWide: { width: "100%", margin: "0 auto", padding: "8px 24px 24px" }, // marges 24px à gauche/droite

  etqToolbar: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  cardsWrap: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 16, padding: "10px 12px 18px" },
  card: { border: "2px solid #1F2937", borderRadius: 16, background: "#fff", padding: "14px 14px 10px" },
  modernCard: { background: 'white', borderRadius: 12, border: `1px solid ${COLORS.border}`, boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', overflow: 'hidden' },
  cardRow: { display: "grid", gridTemplateColumns: "110px 1fr", gap: 8, alignItems: "baseline", margin: "4px 0" },
  cardLabel: { fontWeight: 700 },

  mainCenter: { flex: 1, display: "grid", placeItems: "center" },
  appsWrap: { width: "min(1200px, 96vw)" },
  appsBase: { display: "grid", justifyItems: "center" },
  appBtn: { display: "flex", flexDirection: "column", alignItems: "center", gap: 14, cursor: "pointer", background: "transparent", border: "none" },
  tileBase: { borderRadius: 16, background: COLORS.tile, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 4px rgba(0,0,0,.15)" },
  label: { fontWeight: 800, fontSize: 16.5, letterSpacing: 0.2, color: COLORS.text },

  pills: { display: "flex", gap: 12, flexWrap: "wrap", padding: "8px 0 16px" },
  pill: (active) => ({ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 999, border: `1px solid ${COLORS.border}`, background: active ? COLORS.tile : "#fff", color: active ? "#fff" : COLORS.text, cursor: "pointer" }),

  searchRow: { display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center", marginBottom: 10 },
  searchBox: { position: "relative" },
  searchInput: { padding: "12px 12px 10px 38px", border: "none", borderBottom: `2px solid ${COLORS.text}20`, outline: "none", background: "transparent", fontSize: 16 },
  toolsRow: { display: "flex", gap: 14, alignItems: "center", color: COLORS.text, flexWrap: "wrap" },
  toolBtn: { display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" },

  tableBlock: { background: "#fff", borderRadius: 16, border: `1px solid ${COLORS.border}`, marginTop: 18, overflow: "visible" }, tableHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, gap: 10, flexWrap: "wrap" },
  tableTitle: { fontWeight: 900 },
  tableRight: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  tableWrap: { overflowX: "auto", maxWidth: "100%" },
  table: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" },
  th: { textAlign: "left", padding: "10px 12px", borderBottom: `1px solid ${COLORS.border}`, background: "#F3F4F6", position: "sticky", top: 0, zIndex: 1 },
  thHead: { display: "flex", alignItems: "center", gap: 8 },
  td: { padding: 8, borderBottom: `1px solid ${COLORS.border}` },
  trAlt: { background: COLORS.rowAlt },
  smallBtn: { padding: "6px 10px", borderRadius: 10, border: `1px solid ${COLORS.border}`, background: "#fff", cursor: "pointer" },

  pop: { position: "absolute", top: "100%", right: 0, width: 320, maxHeight: "70vh", overflow: "auto", background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, boxShadow: "0 12px 28px rgba(0,0,0,.18)", zIndex: 60 }, modalBg: { position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "grid", placeItems: "center", zIndex: 80 },
  modal: { width: "min(880px, 96vw)", maxHeight: "86vh", overflow: "hidden", background: "#fff", borderRadius: 16, boxShadow: "0 22px 48px rgba(0,0,0,.22)" },
  modalHead: { padding: 14, borderBottom: `1px solid ${COLORS.border}`, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between" },
  modalBody: { padding: 14, maxHeight: "70vh", overflow: "auto" },
  modalRow: { display: "grid", gridTemplateColumns: "220px 1fr", gap: 10, alignItems: "center", padding: "8px 0" },
  listSidebar: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    background: "#fff",
    padding: 10,
    maxHeight: "75vh",
    overflow: "auto",
  },

  listItem: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: 10,
    background: "#fff",
    padding: 10,
    cursor: "pointer",
  },

  smallIconBtn: {
    border: `1px solid ${COLORS.border}`,
    background: "#fff",
    borderRadius: 8,
    padding: "2px 6px",
    fontSize: 12,
    cursor: "pointer",
  },
};

// --- overrides/table compact ---
export const TABLE_DENSITY = {
  compact: {
    table: { fontSize: 13 },
    th: { padding: "6px 8px" },
    td: { padding: "6px 8px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  },
};

// --- petits styles communs (boutons, cartes, etc.) ---
export const EXTRA = {
  btn: { padding: "10px 14px", borderRadius: 12, border: `1px solid ${COLORS.border}`, background: "#fff", cursor: "pointer" },
  etqToolbar: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  cardsWrap: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 16, padding: "10px 12px 18px" },
  card: { border: "2px solid #1F2937", borderRadius: 16, background: "#fff", padding: "14px 14px 10px" },
  cardRow: { display: "grid", gridTemplateColumns: "110px 1fr", gap: 8, alignItems: "baseline", margin: "4px 0" },
  cardLabel: { fontWeight: 700 },
};