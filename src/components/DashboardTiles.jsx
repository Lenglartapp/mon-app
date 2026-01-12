import React, { useMemo } from "react";
import { Activity, Ruler, Scissors, Hammer, Clock } from "lucide-react";

const calculateStats = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const total = rows.length;
  let cotesOk = 0, prepaOk = 0, confOk = 0, poseOk = 0;

  rows.forEach(r => {
    if (r.statut_cotes === 'Définitive') cotesOk++;
    if (r.statut_prepa === 'Terminé') prepaOk++;
    if (r.statut_conf === 'Terminé') confOk++;
    if (r.statut_pose === 'Terminé') poseOk++;
  });

  return {
    total,
    pctCotes: Math.round((cotesOk / total) * 100),
    pctPrepa: Math.round((prepaOk / total) * 100),
    pctConf: Math.round((confOk / total) * 100),
    pctPose: Math.round((poseOk / total) * 100),
    raw: { cotesOk, prepaOk, confOk, poseOk }
  };
};

export default function DashboardTiles({ rows, isMobile = false }) {
  const stats = useMemo(() => calculateStats(rows), [rows]);

  const tileStyle = (bg, color) => ({
    background: bg, color: color, borderRadius: 16, padding: "20px",
    flex: isMobile ? "1 1 100%" : "1 1 180px", // Force 100% width on mobile
    display: "flex", flexDirection: "column", justifyContent: "space-between",
    boxShadow: "0 2px 5px rgba(0,0,0,0.05)", minHeight: isMobile ? 120 : 110, border: '1px solid rgba(0,0,0,0.03)'
  });
  const valStyle = { fontSize: isMobile ? 36 : 28, fontWeight: 800, letterSpacing: "-0.5px" }; // Larger font on mobile
  const subStyle = { fontSize: 11, fontWeight: 500, marginTop: 4, opacity: 0.7 };

  if (!stats) return <div style={{ padding: 20, color: '#888' }}>Ajoutez des lignes pour voir les statistiques.</div>;

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
      <div style={tileStyle("#EFF6FF", "#1E40AF")}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', gap: 6 }}><Ruler size={16} /> Prise de Cotes</div>
        <div><div style={valStyle}>{stats.pctCotes}%</div><div style={subStyle}>{stats.raw.cotesOk}/{stats.total} validées</div></div>
      </div>
      <div style={tileStyle("#F5F3FF", "#5B21B6")}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', gap: 6 }}><Activity size={16} /> Préparation</div>
        <div><div style={valStyle}>{stats.pctPrepa}%</div><div style={subStyle}>{stats.raw.prepaOk}/{stats.total} terminées</div></div>
      </div>
      <div style={tileStyle("#FDF2F8", "#9D174D")}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', gap: 6 }}><Scissors size={16} /> Confection</div>
        <div><div style={valStyle}>{stats.pctConf}%</div><div style={subStyle}>{stats.raw.confOk}/{stats.total} terminées</div></div>
      </div>
      <div style={tileStyle("#ECFDF5", "#065F46")}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', gap: 6 }}><Hammer size={16} /> Pose</div>
        <div><div style={valStyle}>{stats.pctPose}%</div><div style={subStyle}>{stats.raw.poseOk}/{stats.total} installées</div></div>
      </div>

    </div>
  );
}