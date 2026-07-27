import React, { useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, ExternalLink, Info, AlertTriangle, Upload, CheckCircle } from "lucide-react";
import { COLORS, S } from "../lib/constants/ui";
import { useLocalStorage } from "../lib/hooks/useLocalStorage";
import { aggregateConsumed } from "../lib/odoo/aggregateConsumed";
import { fetchOdooPreview, syncOdoo, odooProjectUrl } from "../lib/odoo/odooPreviewClient";
import { getOdooId, setOdooId } from "../lib/odoo/odooMapping";

const todayStr = () => new Date().toISOString().slice(0, 10);

const STATUS = {
  linked:        { label: "Relié",        dot: "#10B981", bg: "#ECFDF5", text: "#065F46" },
  ambiguous:     { label: "À confirmer",  dot: "#F59E0B", bg: "#FFFBEB", text: "#92400E" },
  pending_tasks: { label: "En attente",   dot: "#9CA3AF", bg: "#F9FAFB", text: "#374151" },
  not_found:     { label: "Introuvable",  dot: "#9CA3AF", bg: "#F9FAFB", text: "#374151" },
};

const fmtH = (n) => `${Math.round((n || 0) * 10) / 10}`.replace(".", ",") + " h";

export default function OdooSyncScreen({ events = [], projects = [], onBack }) {
  const [cutoffDate, setCutoffDate] = useLocalStorage("odoo_cutoff_date", todayStr());
  const [preview, setPreview] = useState(null); // Map id -> statut Odoo
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  // Agrégat du consommé validé (100% local, sans Odoo)
  const rows = useMemo(
    () => aggregateConsumed(events, projects, { cutoffDate }),
    [events, projects, cutoffDate]
  );

  const runPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = rows.map((r) => ({ id: r.id, name: r.name, hours: r.hours, odooProjectId: getOdooId(r.id) }));
      const res = await fetchOdooPreview(cutoffDate, payload);
      const map = new Map();
      for (const line of res.rows) map.set(line.droitfil.id, line);
      setPreview(map);
    } catch (e) {
      setError(e.message);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const runSync = async () => {
    const linkedCount = rows.filter((r) => preview?.get(r.id)?.status === "linked").length;
    if (linkedCount === 0) {
      setSyncMsg("Aucun projet relié à synchroniser pour l'instant.");
      return;
    }
    if (!window.confirm(`Écrire les temps dans Odoo pour ${linkedCount} projet(s) relié(s) ? Les autres seront ignorés.`)) return;
    setSyncing(true);
    setSyncMsg(null);
    setError(null);
    try {
      const payload = rows.map((r) => ({ id: r.id, name: r.name, hours: r.hours, odooProjectId: getOdooId(r.id) }));
      const res = await syncOdoo(payload, cutoffDate);
      setSyncMsg(`Synchronisé : ${res.summary.created} ligne(s) créée(s), ${res.summary.updated} mise(s) à jour, ${res.summary.skipped} projet(s) ignoré(s) (non reliés).`);
      await runPreview();
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const chooseMapping = (droitfilId, odooId) => {
    setOdooId(droitfilId, odooId);
    setSyncMsg(null);
    runPreview();
  };
  const resetMapping = (droitfilId) => {
    setOdooId(droitfilId, null);
    setSyncMsg(null);
    runPreview();
  };

  // Résumé des statuts (après aperçu)
  const summary = useMemo(() => {
    const s = { total: rows.length, linked: 0, ambiguous: 0, waiting: 0 };
    if (preview) {
      for (const r of rows) {
        const st = preview.get(r.id)?.status;
        if (st === "linked") s.linked++;
        else if (st === "ambiguous") s.ambiguous++;
        else s.waiting++;
      }
    }
    return s;
  }, [rows, preview]);

  const totalHours = useMemo(
    () => rows.reduce((acc, r) => acc + r.total, 0),
    [rows]
  );

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ ...S.header, paddingBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {onBack && (
            <button onClick={onBack} style={{ ...S.smallBtn, display: "flex", alignItems: "center", gap: 6 }}>
              <ArrowLeft size={16} /> Retour
            </button>
          )}
          <div>
            <div style={{ fontWeight: 900, fontSize: 20, color: COLORS.text }}>Aperçu Odoo — remontée des temps</div>
            <div style={{ fontSize: 13, color: "#6B7280" }}>
              Consommé validé, agrégé par projet et par catégorie. Mode aperçu : rien n'est écrit dans Odoo.
            </div>
          </div>
        </div>
      </div>

      <div style={S.contentWrap}>
        {/* Bandeau info */}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1E3A8A", borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
          <Info size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13 }}>
            Les temps remontés partent <b>à partir de la date de bascule</b> (modifiable). Seuls les créneaux <b>validés</b> comptent ;
            le planning prévisionnel et les absences restent dans Droitfil. « Comparer à Odoo » affiche ce qui <i>serait</i> envoyé, sans rien modifier.
          </div>
        </div>

        {/* Contrôles */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: COLORS.text }}>
            <span style={{ fontWeight: 700 }}>Date de bascule</span>
            <input
              type="date"
              value={cutoffDate}
              onChange={(e) => { setCutoffDate(e.target.value); setPreview(null); }}
              style={{ ...S.smallBtn, cursor: "text" }}
            />
          </label>
          <button
            onClick={runPreview}
            disabled={loading || rows.length === 0}
            style={{ ...S.smallBtn, background: COLORS.tile, color: "#fff", display: "flex", alignItems: "center", gap: 8, opacity: loading || rows.length === 0 ? 0.6 : 1 }}
          >
            <RefreshCw size={16} className={loading ? "spin" : undefined} />
            {loading ? "Comparaison…" : "Comparer à Odoo"}
          </button>
          <button
            onClick={runSync}
            disabled={!preview || syncing || loading}
            title={!preview ? "Lance d'abord « Comparer à Odoo »" : "Écrit les temps des projets reliés dans Odoo"}
            style={{ ...S.smallBtn, display: "flex", alignItems: "center", gap: 8, opacity: !preview || syncing || loading ? 0.5 : 1 }}
          >
            <Upload size={16} className={syncing ? "spin" : undefined} />
            {syncing ? "Synchronisation…" : "Synchroniser vers Odoo"}
          </button>
          <div style={{ fontSize: 13, color: "#6B7280" }}>
            {rows.length} projet{rows.length > 1 ? "s" : ""} avec du temps · {fmtH(totalHours)} au total
          </div>
        </div>

        {/* Résumé statuts (après aperçu) */}
        {preview && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <Tile label="Reliés" value={summary.linked} dot={STATUS.linked.dot} />
            <Tile label="À confirmer" value={summary.ambiguous} dot={STATUS.ambiguous.dot} />
            <Tile label="En attente / introuvables" value={summary.waiting} dot={STATUS.pending_tasks.dot} />
          </div>
        )}

        {/* Message de synchro */}
        {syncMsg && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#ECFDF5", border: "1px solid #A7F3D0", color: "#065F46", borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
            <CheckCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13 }}>{syncMsg}</div>
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13 }}>{error}</div>
          </div>
        )}

        {/* Tableau */}
        <div style={S.tableBlock}>
          <div style={S.tableWrap}>
            <table style={S.table}>
              <colgroup>
                <col style={{ width: "auto" }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 220 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={S.th}>Projet</th>
                  <th style={{ ...S.th, textAlign: "right" }}>Conf</th>
                  <th style={{ ...S.th, textAlign: "right" }}>Prépa</th>
                  <th style={{ ...S.th, textAlign: "right" }}>Pose</th>
                  <th style={{ ...S.th, textAlign: "right" }}>Total</th>
                  <th style={S.th}>Statut Odoo</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td style={{ ...S.td, color: "#6B7280" }} colSpan={6}>
                      Aucun temps validé à partir de cette date de bascule.
                    </td>
                  </tr>
                )}
                {rows.map((r, i) => {
                  const line = preview?.get(r.id);
                  return (
                    <tr key={r.id} style={i % 2 ? S.trAlt : undefined}>
                      <td style={{ ...S.td, fontWeight: 600 }}>{r.name || <em style={{ color: "#9CA3AF" }}>#{r.id}</em>}</td>
                      <td style={{ ...S.td, textAlign: "right" }}>{r.hours.conf ? fmtH(r.hours.conf) : "—"}</td>
                      <td style={{ ...S.td, textAlign: "right" }}>{r.hours.prepa ? fmtH(r.hours.prepa) : "—"}</td>
                      <td style={{ ...S.td, textAlign: "right" }}>{r.hours.pose ? fmtH(r.hours.pose) : "—"}</td>
                      <td style={{ ...S.td, textAlign: "right", fontWeight: 700 }}>{fmtH(r.total)}</td>
                      <td style={S.td}><StatusCell line={line} hasPreview={!!preview} droitfilId={r.id} mapped={!!getOdooId(r.id)} onChoose={chooseMapping} onReset={resetMapping} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`.spin{animation:odoospin 1s linear infinite}@keyframes odoospin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function Tile({ label, value, dot }) {
  return (
    <div style={{ ...S.modernCard, padding: "10px 16px", minWidth: 150, display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: dot }} />
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>{label}</div>
      </div>
    </div>
  );
}

function StatusCell({ line, hasPreview, droitfilId, mapped, onChoose, onReset }) {
  if (!hasPreview) return <span style={{ color: "#9CA3AF", fontSize: 13 }}>— cliquer « Comparer »</span>;
  if (!line) return <span style={{ color: "#9CA3AF" }}>—</span>;
  const st = STATUS[line.status] || { label: line.status, dot: "#9CA3AF", bg: "#F9FAFB", text: "#374151" };

  const chip = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.text, fontSize: 12, fontWeight: 600 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: st.dot }} />
      {st.label}
    </span>
  );

  const resetLink = mapped ? (
    <button onClick={() => onReset(droitfilId)} style={{ border: "none", background: "none", color: "#9CA3AF", fontSize: 11, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
      modifier le lien
    </button>
  ) : null;

  if (line.status === "ambiguous") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {chip}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {(line.candidates || []).map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <button onClick={() => onChoose(droitfilId, c.id)} style={{ ...S.smallBtn, padding: "2px 8px", fontSize: 12 }}>Choisir</button>
              <a href={odooProjectUrl(c.id)} target="_blank" rel="noreferrer" style={{ color: "#2563EB", display: "inline-flex", alignItems: "center", gap: 3 }}>
                #{c.id} <ExternalLink size={11} />
              </a>
              <span style={{ color: c.hasTasks ? "#059669" : "#9CA3AF" }}>{c.hasTasks ? "✓ tâches prêtes" : "pas de tâches"}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (line.status === "linked" && line.odooProject) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {chip}
        <a href={odooProjectUrl(line.odooProject.id)} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#2563EB", fontSize: 12 }}>
          #{line.odooProject.id} <ExternalLink size={12} />
        </a>
        {resetLink}
      </span>
    );
  }

  if (line.status === "pending_tasks") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {chip}
        <span style={{ fontSize: 12, color: "#6B7280" }}>
          {line.odooProject ? `#${line.odooProject.id} — ` : ""}tâches non créées (devis ?)
        </span>
        {resetLink}
      </span>
    );
  }

  // not_found
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {chip}
      {resetLink}
    </span>
  );
}
