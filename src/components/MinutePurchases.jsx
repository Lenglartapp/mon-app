import React from "react";
import { aggregatePurchases } from "../lib/agg/aggregatePurchases";
import { S, COLORS } from "../lib/constants/ui";

export default function MinutePurchases({ rows = [] }) {
  const agg = React.useMemo(() => aggregatePurchases(rows || []), [rows]);
  const fmt = (n) => (Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100).toFixed(2);

  const Section = ({ title, items }) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontWeight: 800, marginBottom: 8, fontSize: 16 }}>{title}</div>
      {(!items || items.length === 0) ? (
        <div style={{ padding: 12, border: `1px solid ${COLORS.border}`, borderRadius: 10, background: "#fff" }}>
          Aucun élément.
        </div>
      ) : (
        <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, background: "#fff", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#fafafa", color: "#374151" }}>
                <th style={th}>Référence</th>
                <th style={th}>Total (ml)</th>
                <th style={th}>Coût achat estimé</th>
                <th style={{ ...th, width: 100 }} />
              </tr>
            </thead>
            <tbody>
              {items.map((g, idx) => (
                <React.Fragment key={g.label + idx}>
                  <tr style={{ background: idx % 2 ? "#fcfcfc" : "#fff" }}>
                    <td style={td}><b>{g.label}</b></td>
                    <td style={td}>{fmt(g.total_ml)}</td>
                    <td style={td}>{g.total_pa > 0 ? `${fmt(g.total_pa)} €` : "—"}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <details>
                        <summary style={{ cursor: "pointer", listStyle: "none" }}>Détail</summary>
                        <div style={{ paddingTop: 8 }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr style={{ color: "#6b7280" }}>
                                <th style={subTh}>Zone</th>
                                <th style={subTh}>Pièce</th>
                                <th style={subTh}>Produit</th>
                                <th style={subTh}>Type</th>
                                <th style={subTh}>L</th>
                                <th style={subTh}>H</th>
                                <th style={subTh}>Qté</th>
                                <th style={subTh}>ml</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.children.map((c, i) => (
                                <tr key={i}>
                                  <td style={subTd}>{c.zone}</td>
                                  <td style={subTd}>{c.piece}</td>
                                  <td style={subTd}>{c.produit}</td>
                                  <td style={subTd}>{c.type}</td>
                                  <td style={subTd}>{c.largeur || "—"}</td>
                                  <td style={subTd}>{c.hauteur || "—"}</td>
                                  <td style={subTd}>{c.quantite}</td>
                                  <td style={subTd}>{fmt(c.ml)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const exportCSV = () => {
    const rowsOut = [
      ["Famille", "Référence", "Total_ml", "Total_PA_EUR"],
      ...pack("Tissus", agg.tissus),
      ...pack("Doublures", agg.doublures),
      ...pack("Rails", agg.rails),
    ];
    const csv = rowsOut.map(r => r.map(safeCSV).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "liste_achats.csv";
    a.click();
    URL.revokeObjectURL(url);

    function pack(famille, items) {
      return (items || []).map(g => [famille, g.label, fmt(g.total_ml), g.total_pa > 0 ? fmt(g.total_pa) : ""]);
    }
    function safeCSV(v) {
      const s = String(v ?? "");
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button style={S.smallBtn} onClick={exportCSV}>Exporter CSV</button>
      </div>

      <Section title="Tissus" items={agg.tissus} />
      <Section title="Doublures" items={agg.doublures} />
      <Section title="Rails & Mécanismes" items={agg.rails} />
    </div>
  );
}

const th   = { padding: "10px 12px", borderBottom: "1px solid #e5e7eb", textAlign: "left" };
const td   = { padding: "10px 12px", borderBottom: "1px solid #f0f0f0" };
const subTh = { padding: "6px 8px", borderBottom: "1px solid #e5e7eb", fontSize: 12, textAlign: "left" };
const subTd = { padding: "6px 8px", borderBottom: "1px solid #f7f7f7", fontSize: 12 };