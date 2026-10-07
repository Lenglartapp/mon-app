import React, { useEffect, useState } from "react";
import { RefreshCw, ShoppingCart, AlertTriangle, Link2Off } from "lucide-react";
import { readCourseLines, refreshCourseLines } from "../../lib/odoo/courseLinesClient";
import { TonePill, ToolbarButton } from "../ui/ToolbarControls";

// Liste de courses Odoo affichée dans le dossier (module Stock). Odoo maître, lecture.
// Pré-affichage pour les équipes (qui n'ont pas Odoo) : commandé + statut de réception.

// Statut de la ligne de courses : pastille du nuancier bleu, de « à commander » (bleu ciel)
// à « réceptionné » (bleu nuit) ; « problème » reste signalé en rouge.
const STATUT = {
  a_commander:     { label: "À commander",    tone: 5 },
  verifier_stock:  { label: "Vérifier stock", tone: 4 },
  en_stock:        { label: "En stock",       tone: 3 },
  achete_client:   { label: "Acheté client",  tone: null },
  commande_passee: { label: "Commandée",      tone: 2 },
  receptionne:     { label: "Réceptionné",    tone: 0 },
  probleme:        { label: "Problème",       alert: true },
};

const TYPE = { tissu: "Tissu", rail: "Rail", mecanisme: "Mécanisme", store: "Store", consommable: "Consommable", autre: "Autre" };

const COLS = ["Fournisseur", "Référence", "Type", "Coloris", "Laize", "Qté", "Unité", "Date de livraison estimée", "Statut", "Date de réception"];
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

function StatutBadge({ statut }) {
  const s = STATUT[statut];
  if (!s) return <TonePill tone={null}>{statut || "—"}</TonePill>;
  if (s.alert) return <span style={{ display: "inline-flex", alignItems: "center", height: 22, padding: "0 10px", borderRadius: 99, background: "#FEE2E2", color: "#B91C1C", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{s.label}</span>;
  return <TonePill tone={s.tone}>{s.label}</TonePill>;
}

// Type en texte simple (comme l'état du stock)
function TypeBadge({ type }) {
  if (!type) return <span style={{ color: "#9CA3AF" }}>—</span>;
  return <span style={{ color: "#374151" }}>{TYPE[type] || type}</span>;
}

const td = { padding: "10px 12px", verticalAlign: "middle" };

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

  // Option B : on n'affiche QUE le tissu (les autres types sont ignorés à l'affichage aussi).
  const tissuLines = lines.filter((l) => l.type_produit === "tissu");
  const active = tissuLines.filter((l) => !l.removed_from_odoo);
  const removed = tissuLines.filter((l) => l.removed_from_odoo);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontFamily: "Roboto, system-ui, sans-serif", fontSize: 20, fontWeight: 500, color: "#111827" }}>
          Liste de courses <span style={{ fontWeight: 400, color: "#9B9A97", fontSize: 13 }}>{active.length} {active.length > 1 ? "lignes" : "ligne"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: refreshing ? 0.6 : 1 }}>
          {lastSync && <span style={{ fontSize: 12, color: "#9CA3AF" }}>synchro {new Date(lastSync).toLocaleString("fr-FR")}</span>}
          <ToolbarButton icon={<RefreshCw size={14} className={refreshing ? "spin" : undefined} />} onClick={refreshing ? undefined : refresh}>
            Rafraîchir depuis Odoo
          </ToolbarButton>
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

      <div style={{ overflowX: "auto", border: "1px solid #E0DED9", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F4F4F4" }}>
              {COLS.map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #E0DED9", fontWeight: 600, color: "#374151", whiteSpace: "nowrap" }}>{h}</th>
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
              <tr key={l.odoo_id} style={{ borderBottom: "1px solid #E8E6E2" }}>
                <td style={td}>{l.fournisseur || "—"}</td>
                <td style={{ ...td, fontWeight: 500 }}>{l.reference || "—"}</td>
                <td style={td}><TypeBadge type={l.type_produit} /></td>
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
              <tr key={l.odoo_id} style={{ borderBottom: "1px solid #E8E6E2", opacity: 0.55, color: "#9CA3AF" }} title="Cette ligne n'existe plus dans Odoo (gardée ici).">
                <td style={td}>{l.fournisseur || "—"}</td>
                <td style={{ ...td, textDecoration: "line-through" }}>{l.reference || "—"}</td>
                <td style={td}><TypeBadge type={l.type_produit} /></td>
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
