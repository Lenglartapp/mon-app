import React, { useEffect, useState } from "react";
import { RefreshCw, ShoppingCart, AlertTriangle, Link2Off } from "lucide-react";
import { readCourseLines, refreshCourseLines } from "../../lib/odoo/courseLinesClient";

// Liste de courses Odoo affichée dans le dossier (module Stock). Odoo maître, lecture.
// Pré-affichage pour les équipes (qui n'ont pas Odoo) : commandé + statut de réception.

const STATUT = {
  a_commander:     { label: "À commander",    bg: "#F3F4F6", color: "#374151" },
  verifier_stock:  { label: "Vérifier stock", bg: "#F3F4F6", color: "#374151" },
  en_stock:        { label: "En stock",       bg: "#EFF6FF", color: "#1D4ED8" },
  achete_client:   { label: "Acheté client",  bg: "#F5F3FF", color: "#6D28D9" },
  commande_passee: { label: "Commandée",      bg: "#FFFBEB", color: "#B45309" },
  receptionne:     { label: "Réceptionné",    bg: "#ECFDF5", color: "#047857" },
  probleme:        { label: "Problème",       bg: "#FEF2F2", color: "#B91C1C" },
};

const COLS = ["Fournisseur", "Référence", "Coloris", "Laize", "Qté", "Unité", "Date de livraison estimée", "Statut", "Date de réception"];
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

function StatutBadge({ statut }) {
  const s = STATUT[statut] || { label: statut || "—", bg: "#F3F4F6", color: "#374151" };
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, background: s.bg, color: s.color, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

const td = { padding: "8px 10px", verticalAlign: "top" };

export default function ProjectCourseListPanel({ droitfilProjectId, odooProjectId, projectName }) {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!droitfilProjectId) return;
    setLoading(true);
    readCourseLines(droitfilProjectId)
      .then((rows) => { if (alive) { setLines(rows); setLastSync(rows[0]?.synced_at || null); } })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [droitfilProjectId]);

  const refresh = async () => {
    if (!odooProjectId) return;
    setRefreshing(true);
    setError(null);
    setNotice(null);
    try {
      const { lines: rows, receptionsCreated, receptionErrors } = await refreshCourseLines(droitfilProjectId, odooProjectId, projectName);
      setLines(rows);
      setLastSync(new Date().toISOString());
      if (receptionsCreated > 0) setNotice(`${receptionsCreated} réception(s) ajoutée(s) au stock du projet.`);
      if (receptionErrors && receptionErrors.length) setError("Réception non basculée en stock — " + receptionErrors.join(" · "));
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  };

  if (!odooProjectId) {
    return (
      <div style={{ padding: 16, display: "flex", alignItems: "center", gap: 10, color: "#6B7280", fontSize: 14 }}>
        <ShoppingCart size={18} />
        <span>Relie ce dossier à Odoo (encart « Consommation Temps ») pour afficher sa liste de courses.</span>
      </div>
    );
  }

  const active = lines.filter((l) => !l.removed_from_odoo);
  const removed = lines.filter((l) => l.removed_from_odoo);

  return (
    <div style={{ padding: "8px 4px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "#111827" }}>
          <ShoppingCart size={16} /> Liste de courses <span style={{ fontWeight: 400, color: "#9CA3AF", fontSize: 13 }}>({active.length})</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastSync && <span style={{ fontSize: 12, color: "#9CA3AF" }}>synchro {new Date(lastSync).toLocaleString("fr-FR")}</span>}
          <button onClick={refresh} disabled={refreshing} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 8, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer", fontSize: 13, opacity: refreshing ? 0.6 : 1 }}>
            <RefreshCw size={14} className={refreshing ? "spin" : undefined} /> Rafraîchir depuis Odoo
          </button>
        </div>
      </div>

      {error && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", borderRadius: 10, padding: "8px 12px", marginBottom: 10, fontSize: 13 }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {notice && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#ECFDF5", border: "1px solid #A7F3D0", color: "#065F46", borderRadius: 10, padding: "8px 12px", marginBottom: 10, fontSize: 13 }}>
          <ShoppingCart size={16} /> {notice}
        </div>
      )}

      <div style={{ overflowX: "auto", border: "1px solid #E5E7EB", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F9FAFB" }}>
              {COLS.map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #E5E7EB", fontWeight: 700, color: "#374151", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={COLS.length} style={{ padding: 14, color: "#9CA3AF" }}>Chargement…</td></tr>
            )}
            {!loading && active.length === 0 && removed.length === 0 && (
              <tr><td colSpan={COLS.length} style={{ padding: 14, color: "#9CA3AF" }}>Aucune ligne. Clique « Rafraîchir depuis Odoo ».</td></tr>
            )}
            {active.map((l) => (
              <tr key={l.odoo_id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                <td style={td}>{l.fournisseur || "—"}</td>
                <td style={{ ...td, fontWeight: 600 }}>{l.reference || "—"}</td>
                <td style={td}>{l.coloris || "—"}</td>
                <td style={td}>{l.laize || "—"}</td>
                <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{l.quantite ?? "—"}</td>
                <td style={td}>{l.unite || "—"}</td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(l.date_livraison_estimee)}</td>
                <td style={td}><StatutBadge statut={l.statut} /></td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(l.date_reception)}</td>
              </tr>
            ))}
            {removed.map((l) => (
              <tr key={l.odoo_id} style={{ borderBottom: "1px solid #F3F4F6", opacity: 0.55, color: "#9CA3AF" }} title="Cette ligne n'existe plus dans Odoo (gardée ici).">
                <td style={td}>{l.fournisseur || "—"}</td>
                <td style={{ ...td, textDecoration: "line-through" }}>{l.reference || "—"}</td>
                <td style={{ ...td, textDecoration: "line-through" }}>{l.coloris || "—"}</td>
                <td style={td}>{l.laize || "—"}</td>
                <td style={{ ...td, textAlign: "right" }}>{l.quantite ?? "—"}</td>
                <td style={td}>{l.unite || "—"}</td>
                <td style={td}>{fmtDate(l.date_livraison_estimee)}</td>
                <td style={{ ...td, display: "flex", alignItems: "center", gap: 4 }}><Link2Off size={12} /> retirée d'Odoo</td>
                <td style={td}>{fmtDate(l.date_reception)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`.spin{animation:odoospin 1s linear infinite}@keyframes odoospin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
