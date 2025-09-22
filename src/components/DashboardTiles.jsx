import React from "react";
import { S, COLORS } from "../lib/constants/ui.js";
import { dashCompute } from "../lib/utils/dashCompute.js";

export default function DashboardTiles({ rows, projectHours }) {
  const d = React.useMemo(() => dashCompute(rows), [rows]);

  const ph = projectHours || { confectionReport: 0, poseReport: 0 };

  const Tile = ({ title, val, sub }) => (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        minWidth: 220,
        boxShadow: "0 1px 2px rgba(0,0,0,.04)",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{val}</div>
      {sub && <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Ligne 1 : Avancement par étape */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Tile
          title="Préparation — terminé"
          val={`${d.steps.preparation.done} / ${d.total}`}
          sub={`${d.steps.preparation.pct}%`}
        />
        <Tile
          title="Confection — terminé"
          val={`${d.steps.confection.done} / ${d.total}`}
          sub={`${d.steps.confection.pct}%`}
        />
        <Tile
          title="Pose — terminé"
          val={`${d.steps.pose.done} / ${d.total}`}
          sub={`${d.steps.pose.pct}%`}
        />
        <Tile
          title="Cumulé (prépa + conf + pose)"
          val={`${d.full.done} / ${d.total}`}
          sub={`${d.full.pct}%`}
        />
      </div>

      {/* Ligne 2 : Heures */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Tile
          title="Heures confection (somme lignes)"
          val={`${d.hours.sumConfection.toLocaleString("fr-FR")} h`}
        />
        <Tile
          title="Heures pose (somme lignes)"
          val={`${d.hours.sumPose.toLocaleString("fr-FR")} h`}
        />
        <Tile
          title="Déclaré (projet) — confection"
          val={`${Number(ph.confectionReport || 0).toLocaleString("fr-FR")} h`}
        />
        <Tile
          title="Déclaré (projet) — pose"
          val={`${Number(ph.poseReport || 0).toLocaleString("fr-FR")} h`}
        />
      </div>
    </div>
  );
}