import React, { useMemo } from "react";
import { calculateProjectStats } from "../lib/projectMetrics";
import { Kpi, KpiGrid } from "./ui/SoftBlock";

// Avancement du dossier : un indicateur par étape (prise de cotes, préparation, confection,
// pose) — grand chiffre fin, total, barre fine et pastille %. Vert quand l'étape est terminée.
export default function DashboardTiles({ rows, budget = {} }) {
  const stats = useMemo(() => calculateProjectStats(rows, budget), [rows, budget]);

  if (!stats) return <div style={{ color: "#8A8F98", fontSize: 14 }}>Ajoutez des lignes pour voir l'avancement.</div>;

  const r = stats.raw;
  const pct = (v) => (v == null ? null : Number(v));

  const conf = stats.confMode === "not_applicable"
    ? <Kpi key="conf" label="Confection" note="Non applicable" />
    : stats.confMode === "all_st"
      ? <Kpi key="conf" label="Confection" note="Sous-traité" sub={stats.stConfSummary} />
      : r.confHouresTotal > 0
        ? <Kpi key="conf" label="Confection" value={String(r.confHouresDone).replace('.', ',')} unit="h" total={`${r.confHouresTotal} h`} pct={pct(stats.pctConf)} doneIsGreen sub={stats.confMode === "mix_st" ? stats.stConfSummary : null} />
        : <Kpi key="conf" label="Confection" value={r.confHouresDone} total={`${stats.total} terminées`} pct={pct(stats.pctConf)} doneIsGreen sub={stats.confMode === "mix_st" ? stats.stConfSummary : null} />;

  const pose = stats.poseMode === "not_applicable"
    ? <Kpi key="pose" label="Pose" note="Installation non réalisée par nos soins" />
    : stats.poseMode === "all_st"
      ? <Kpi key="pose" label="Pose" note="Sous-traité" sub={stats.stPoseSummary} />
      : <Kpi key="pose" label="Pose" value={r.poseOk} total={`${r.poseTotal} installées`} pct={pct(stats.pctPose)} doneIsGreen sub={stats.poseMode === "mix_st" ? stats.stPoseSummary : null} />;

  // Prépa : détail par typologie dès que le projet en mélange au moins deux
  // (terminées d'abord, puis celles qui restent ; ordre des tableaux sinon).
  const prepaByType = stats.prepaByType || [];
  const prepaDetail = prepaByType.length < 2 ? null : (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {[...prepaByType.filter(t => t.ok === t.total), ...prepaByType.filter(t => t.ok !== t.total)].map(t => (
        <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 6, fontVariantNumeric: "tabular-nums" }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, flexShrink: 0, background: t.ok === t.total ? "#30A46C" : "var(--df-x-E4E4E4)" }} />
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--df-x-5B616B)" }}>{t.label}</span>
          <span>{t.ok}/{t.total}</span>
        </div>
      ))}
    </div>
  );

  return (
    <KpiGrid min={150}>
      {stats.cotesTotal > 0
        ? <Kpi label="Prise de cotes" value={r.cotesValidees} total={`${stats.cotesTotal} validées`} pct={pct(stats.pctCotes)} doneIsGreen />
        : <Kpi label="Prise de cotes" note="Non applicable" />}
      <Kpi label="Préparation" value={r.prepaOk} total={`${r.prepaTotal} terminées`} pct={pct(stats.pctPrepa)} doneIsGreen sub={prepaDetail} />
      {conf}
      {pose}
    </KpiGrid>
  );
}
