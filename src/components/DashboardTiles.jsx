import React, { useMemo } from "react";
import { calculateProjectStats } from "../lib/projectMetrics";
import ProgressList, { Ratio } from "./ui/ProgressList";

// Avancement du dossier : une ligne par étape (prise de cotes, préparation, confection, pose)
// avec barre fine, réalisé / total et %. Vert quand l'étape est terminée.
export default function DashboardTiles({ rows, budget = {} }) {
  const stats = useMemo(() => calculateProjectStats(rows, budget), [rows, budget]);

  if (!stats) return <div style={{ padding: "4px 0", color: "#A8A7A3", fontSize: 14 }}>Ajoutez des lignes pour voir l'avancement.</div>;

  const r = stats.raw;
  const items = [
    stats.cotesTotal > 0
      ? { key: "cotes", label: "Prise de cotes", pct: stats.pctCotes, value: <Ratio done={r.cotesValidees} total={`${stats.cotesTotal} validées`} /> }
      : { key: "cotes", label: "Prise de cotes", note: "Non applicable" },
    { key: "prepa", label: "Préparation", pct: stats.pctPrepa, value: <Ratio done={r.prepaOk} total={r.prepaTotal} /> },
  ];

  if (stats.confMode === "not_applicable") {
    items.push({ key: "conf", label: "Confection", note: "Non applicable" });
  } else if (stats.confMode === "all_st") {
    items.push({ key: "conf", label: "Confection", note: `Sous-traité${stats.stConfSummary ? ` · ${stats.stConfSummary}` : ""}` });
  } else {
    items.push({
      key: "conf", label: "Confection", pct: stats.pctConf,
      value: r.confHouresTotal > 0 ? <Ratio done={r.confHouresDone} total={r.confHouresTotal} unit=" h" /> : <Ratio done={r.confHouresDone} total={stats.total} />,
    });
    if (stats.confMode === "mix_st" && stats.stConfSummary) items.push({ key: "conf-st", label: "", note: stats.stConfSummary });
  }

  if (stats.poseMode === "not_applicable") {
    items.push({ key: "pose", label: "Pose", note: "Installation non réalisée par nos soins" });
  } else if (stats.poseMode === "all_st") {
    items.push({ key: "pose", label: "Pose", note: `Sous-traité${stats.stPoseSummary ? ` · ${stats.stPoseSummary}` : ""}` });
  } else {
    items.push({ key: "pose", label: "Pose", pct: stats.pctPose, value: <Ratio done={r.poseOk} total={`${r.poseTotal} installées`} /> });
    if (stats.poseMode === "mix_st" && stats.stPoseSummary) items.push({ key: "pose-st", label: "", note: stats.stPoseSummary });
  }

  return <ProgressList items={items} doneIsGreen />;
}
