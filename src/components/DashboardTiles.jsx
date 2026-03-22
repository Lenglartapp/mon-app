import React, { useMemo } from "react";
import { Activity, Ruler, Scissors, Hammer, Clock } from "lucide-react";

// Poids d'avancement par statut de confection selon le type d'ouvrage
const CONF_WEIGHTS_RIDEAUX = {
  'Non démarré': 0,
  'Coupé':       0.10,
  'Assemblé':    0.70,
  'Plis terminés': 0.95,
  'Emballé':     1.0,
  // Rétrocompat anciens statuts
  'En cours': 0.35,
  'Terminé':  1.0,
};

const CONF_WEIGHTS_STORES_BATEAUX = {
  'Non démarré':      0,
  'Ourlet fait':      0.30,
  'Fourreau terminé': 0.70,
  'Ficelle terminée': 0.95,
  'Emballé':          1.0,
  // Rétrocompat anciens statuts
  'En cours': 0.35,
  'Terminé':  1.0,
};

const getConfWeight = (row) => {
  const produit = String(row.produit || '').toLowerCase();
  const status  = row.statut_conf || 'Non démarré';
  if (/rideau|voilage/i.test(produit))          return CONF_WEIGHTS_RIDEAUX[status]       ?? 0;
  if (/store.*(bateau|velum)/i.test(produit))   return CONF_WEIGHTS_STORES_BATEAUX[status] ?? 0;
  // Autres types : binaire (Terminé = 100%)
  return status === 'Terminé' ? 1.0 : 0;
};

const COTES_WEIGHTS = {
  'Cote non prenable':        0,
  'Déduction restante à faire': 0.70,
  'Définitive':               0.80,
  'Validé par chef de projet': 1.0,
  // rétrocompat anciens statuts
  'Non exploitable':          0,
};

const getCotesWeight = (statut) => COTES_WEIGHTS[statut] ?? 0;
const isSubjectToCotes = (row) => /rideau|voilage|store/i.test(String(row?.produit || ''));

const calculateStats = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const total = rows.length;
  let cotesWeightSum = 0, cotesTotal = 0, prepaOk = 0, poseOk = 0;
  let weightedConfSum = 0, totalConfHours = 0, confBinaryOk = 0;

  rows.forEach(r => {
    if (isSubjectToCotes(r)) {
      cotesWeightSum += getCotesWeight(r.statut_cotes);
      cotesTotal++;
    }
    if (r.statut_prepa === 'Terminé')    prepaOk++;
    if (r.statut_pose  === 'Terminé')    poseOk++;

    // Sous-traitant explicite → exclure de la confection
    if (r.realise_par === 'Sous-Traitant') return;

    const hours = parseFloat(r.heures_confection) || 0;
    if (hours > 0) {
      weightedConfSum += hours * getConfWeight(r);
      totalConfHours  += hours;
    } else {
      // Pas d'heures renseignées : comptage binaire en fallback
      if (r.statut_conf === 'Terminé') confBinaryOk++;
    }
  });

  // Avancement confection pondéré par les heures
  let pctConf;
  if (totalConfHours > 0) {
    pctConf = Math.round((weightedConfSum / totalConfHours) * 100);
  } else {
    // Fallback : items sans heures → comptage binaire
    const itemsWithoutHours = rows.filter(r => r.realise_par !== 'Sous-Traitant' && !(parseFloat(r.heures_confection) > 0)).length;
    pctConf = itemsWithoutHours > 0 ? Math.round((confBinaryOk / itemsWithoutHours) * 100) : 0;
  }

  return {
    total,
    cotesTotal,
    pctCotes: cotesTotal > 0 ? Math.round((cotesWeightSum / cotesTotal) * 100) : null,
    pctPrepa: Math.round((prepaOk / total) * 100),
    pctConf,
    pctPose:  Math.round((poseOk  / total) * 100),
    raw: {
      cotesValidees: rows.filter(r => r.statut_cotes === 'Validé par chef de projet').length,
      prepaOk, poseOk,
      confHouresDone:  Math.round(weightedConfSum),
      confHouresTotal: Math.round(totalConfHours),
    }
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
        <div>
          <div style={valStyle}>{stats.pctCotes !== null ? `${stats.pctCotes}%` : '—'}</div>
          <div style={subStyle}>
            {stats.cotesTotal > 0
              ? `${stats.raw.cotesValidees}/${stats.cotesTotal} validées chef de projet`
              : 'Non applicable'}
          </div>
        </div>
      </div>
      <div style={tileStyle("#F5F3FF", "#5B21B6")}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', gap: 6 }}><Activity size={16} /> Préparation</div>
        <div><div style={valStyle}>{stats.pctPrepa}%</div><div style={subStyle}>{stats.raw.prepaOk}/{stats.total} terminées</div></div>
      </div>
      <div style={tileStyle("#FDF2F8", "#9D174D")}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', gap: 6 }}><Scissors size={16} /> Confection</div>
        <div>
          <div style={valStyle}>{stats.pctConf}%</div>
          <div style={subStyle}>
            {stats.raw.confHouresTotal > 0
              ? `${stats.raw.confHouresDone}h / ${stats.raw.confHouresTotal}h`
              : `${stats.raw.confHouresDone}/${stats.total} terminées`}
          </div>
        </div>
      </div>
      <div style={tileStyle("#ECFDF5", "#065F46")}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', gap: 6 }}><Hammer size={16} /> Pose</div>
        <div><div style={valStyle}>{stats.pctPose}%</div><div style={subStyle}>{stats.raw.poseOk}/{stats.total} installées</div></div>
      </div>

    </div>
  );
}