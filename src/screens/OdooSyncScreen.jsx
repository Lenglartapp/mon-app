import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, ExternalLink, Info, AlertTriangle, Upload, CheckCircle } from "lucide-react";
import { COLORS, S } from "../lib/constants/ui";
import { useLocalStorage } from "../lib/hooks/useLocalStorage";
import { aggregateConsumed } from "../lib/odoo/aggregateConsumed";
import { fetchOdooPreview, syncOdoo, odooProjectUrl } from "../lib/odoo/odooPreviewClient";
import { setConfig } from "../lib/appConfig";

const todayStr = () => new Date().toISOString().slice(0, 10);

const STATUS = {
  linked:        { label: "Relié",      dot: "#10B981", bg: "#ECFDF5", text: "#065F46" },
  pending_tasks: { label: "En attente", dot: "#F59E0B", bg: "#FFFBEB", text: "#92400E" },
  not_found:     { label: "ID introuvable", dot: "#EF4444", bg: "#FEF2F2", text: "#991B1B" },
};

const fmtH = (n) => `${Math.round((n || 0) * 10) / 10}`.replace(".", ",") + " h";

export default function OdooSyncScreen({ events = [], projects = [], onBack }) {
  const [cutoffDate, setCutoffDate] = useLocalStorage("odoo_cutoff_date", todayStr());
  // Partage la date de bascule côté serveur (app_config) : le job de nuit lit cette même valeur.
  useEffect(() => { if (cutoffDate) setConfig("odoo_cutoff_date", cutoffDate); }, [cutoffDate]);
  const [preview, setPreview] = useState(null); // Map id -> statut Odoo
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  // id Odoo relié d'un projet Droitfil (saisi dans le dossier)
  const odooIdOf = useMemo(() => {
    const m = new Map((projects || []).map((p) => [p.id, p.id_projet_odoo || null]));
    return (droitfilId) => m.get(droitfilId) || null;
  }, [projects]);

  // Agrégat du consommé validé (100% local)
  const rows = useMemo(
    () => aggregateConsumed(events, projects, { cutoffDate }),
    [events, projects, cutoffDate]
  );

  const linkedRows = useMemo(() => rows.filter((r) => odooIdOf(r.id)), [rows, odooIdOf]);

  const runPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = linkedRows.map((r) => ({ id: r.id, name: r.name, hours: r.hours, odooProjectId: odooIdOf(r.id) }));
      const res = payload.length ? await fetchOdooPreview(cutoffDate, payload) : { rows: [] };
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
    const ready = linkedRows.filter((r) => preview?.get(r.id)?.status === "linked");
    if (ready.length === 0) { setSyncMsg("Aucun projet prêt (relié + tâches présentes) à synchroniser."); return; }
    if (!window.confirm(`Écrire les temps dans Odoo pour ${ready.length} projet(s) prêt(s) ?`)) return;
    setSyncing(true);
    setSyncMsg(null);
    setError(null);
    try {
      const payload = ready.map((r) => ({ id: r.id, name: r.name, hours: r.hours, odooProjectId: odooIdOf(r.id) }));
      const res = await syncOdoo(payload, cutoffDate);
      setSyncMsg(`Synchronisé : ${res.summary.created} ligne(s) créée(s), ${res.summary.updated} mise(s) à jour, ${res.summary.skipped} ignoré(s).`);
      await runPreview();
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const summary = useMemo(() => {
    const s = { total: rows.length, linked: 0, pending: 0, unlinked: 0 };
    for (const r of rows) {
      if (!odooIdOf(r.id)) { s.unlinked++; continue; }
      const st = preview?.get(r.id)?.status;
      if (st === "linked") s.linked++;
      else s.pending++;
    }
    return s;
  }, [rows, preview, odooIdOf]);

  const totalHours = useMemo(() => rows.reduce((acc, r) => acc + r.total, 0), [rows]);

  return (
    <div style={S.page}>
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
              Consommé validé, agrégé par projet et catégorie. Mode aperçu : rien n'est écrit dans Odoo.
            </div>
          </div>
        </div>
      </div>

      <div style={S.contentWrap}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1E3A8A", borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
          <Info size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13 }}>
            Un projet remonte ses temps une fois <b>relié</b> : ouvre le dossier et colle son <b>ID projet Odoo</b> (encart « Consommation Temps »).
            Seuls les créneaux <b>validés</b> à partir de la date de bascule comptent.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: COLORS.text }}>
            <span style={{ fontWeight: 700 }}>Date de bascule</span>
            <input type="date" value={cutoffDate} onChange={(e) => { setCutoffDate(e.target.value); setPreview(null); }} style={{ ...S.smallBtn, cursor: "text" }} />
          </label>
          <button onClick={runPreview} disabled={loading || rows.length === 0} style={{ ...S.smallBtn, background: COLORS.tile, color: "#fff", display: "flex", alignItems: "center", gap: 8, opacity: loading || rows.length === 0 ? 0.6 : 1 }}>
            <RefreshCw size={16} className={loading ? "spin" : undefined} />
            {loading ? "Comparaison…" : "Comparer à Odoo"}
          </button>
          <button onClick={runSync} disabled={!preview || syncing || loading} title={!preview ? "Lance d'abord « Comparer à Odoo »" : "Écrit les temps des projets prêts dans Odoo"} style={{ ...S.smallBtn, display: "flex", alignItems: "center", gap: 8, opacity: !preview || syncing || loading ? 0.5 : 1 }}>
            <Upload size={16} className={syncing ? "spin" : undefined} />
            {syncing ? "Synchronisation…" : "Synchroniser vers Odoo"}
          </button>
          <div style={{ fontSize: 13, color: "#6B7280" }}>
            {rows.length} projet{rows.length > 1 ? "s" : ""} avec du temps · {fmtH(totalHours)} · {linkedRows.length} relié{linkedRows.length > 1 ? "s" : ""}
          </div>
        </div>

        {preview && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <Tile label="Reliés & prêts" value={summary.linked} dot={STATUS.linked.dot} />
            <Tile label="Reliés, en attente" value={summary.pending} dot={STATUS.pending_tasks.dot} />
            <Tile label="Non reliés (ID à saisir)" value={summary.unlinked} dot="#9CA3AF" />
          </div>
        )}

        {syncMsg && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#ECFDF5", border: "1px solid #A7F3D0", color: "#065F46", borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
            <CheckCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13 }}>{syncMsg}</div>
          </div>
        )}

        {error && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13 }}>{error}</div>
          </div>
        )}

        <div style={S.tableBlock}>
          <div style={S.tableWrap}>
            <table style={S.table}>
              <colgroup>
                <col style={{ width: "auto" }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 240 }} />
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
                  <tr><td style={{ ...S.td, color: "#6B7280" }} colSpan={6}>Aucun temps validé à partir de cette date de bascule.</td></tr>
                )}
                {rows.map((r, i) => (
                  <tr key={r.id} style={i % 2 ? S.trAlt : undefined}>
                    <td style={{ ...S.td, fontWeight: 600 }}>{r.name || <em style={{ color: "#9CA3AF" }}>#{r.id}</em>}</td>
                    <td style={{ ...S.td, textAlign: "right" }}>{r.hours.conf ? fmtH(r.hours.conf) : "—"}</td>
                    <td style={{ ...S.td, textAlign: "right" }}>{r.hours.prepa ? fmtH(r.hours.prepa) : "—"}</td>
                    <td style={{ ...S.td, textAlign: "right" }}>{r.hours.pose ? fmtH(r.hours.pose) : "—"}</td>
                    <td style={{ ...S.td, textAlign: "right", fontWeight: 700 }}>{fmtH(r.total)}</td>
                    <td style={S.td}><StatusCell line={preview?.get(r.id)} hasPreview={!!preview} hasOdooId={!!odooIdOf(r.id)} /></td>
                  </tr>
                ))}
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

function StatusCell({ line, hasPreview, hasOdooId }) {
  if (!hasOdooId) return <span style={{ color: "#9CA3AF", fontSize: 13 }}>Non relié — ID à saisir dans le dossier</span>;
  if (!hasPreview) return <span style={{ color: "#9CA3AF", fontSize: 13 }}>— cliquer « Comparer »</span>;
  if (!line) return <span style={{ color: "#9CA3AF" }}>—</span>;
  const st = STATUS[line.status] || { label: line.status, dot: "#9CA3AF", bg: "#F9FAFB", text: "#374151" };

  const chip = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.text, fontSize: 12, fontWeight: 600 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: st.dot }} />
      {st.label}
    </span>
  );

  if (line.status === "linked" || line.status === "pending_tasks") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {chip}
        <a href={odooProjectUrl(line.odooProject.id)} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#2563EB", fontSize: 12 }}>
          #{line.odooProject.id} <ExternalLink size={12} />
        </a>
        {line.status === "pending_tasks" && <span style={{ fontSize: 12, color: "#6B7280" }}>tâches non créées</span>}
      </span>
    );
  }
  return chip;
}
