// src/components/Forbidden.jsx
export default function Forbidden({ msg="Accès refusé" }) {
  return (
    <div style={{ padding: 24, border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}>
      <b>{msg}</b>
      <div style={{ opacity:.7, marginTop:6 }}>Vous n’avez pas les autorisations nécessaires.</div>
    </div>
  );
}