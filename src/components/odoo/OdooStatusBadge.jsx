import React, { useEffect, useState } from "react";
import { ExternalLink, Link2, Check, X } from "lucide-react";
import { fetchProjectStatus, odooProjectUrl } from "../../lib/odoo/odooPreviewClient";

// Encart « Statut Odoo » à droite du titre « Consommation Temps » du dossier.
// - Non relié  : bouton « Relier à Odoo » → on colle l'id Odoo, on vérifie le nom, on relie.
// - Relié      : statut (connecté / tâches à venir / id introuvable) + lien vers la fiche + « modifier ».
// La valeur reliée est l'`id_projet_odoo` stocké sur le projet Droitfil (persisté via onLink).

const MAP = {
  linked:        { label: "Connecté à Odoo",        dot: "#10B981", color: "#047857" },
  pending_tasks: { label: "Connecté (tâches à venir)", dot: "#F59E0B", color: "#B45309" },
  not_found:     { label: "ID Odoo introuvable",    dot: "#EF4444", color: "#B91C1C" },
};

function Chip({ dot, color, label, icon = false, title }) {
  return (
    <span title={title} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color, whiteSpace: "nowrap" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
      {label}
      {icon && <ExternalLink size={12} />}
    </span>
  );
}

export default function OdooStatusBadge({ projectName, projectId, idProjetOdoo = null, onLink }) {
  const [state, setState] = useState({ loading: !!idProjetOdoo });
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState(null); // { ok, id, name, status } | { error }

  // Statut du projet relié
  useEffect(() => {
    let alive = true;
    if (!idProjetOdoo) { setState({ loading: false, unlinked: true }); return; }
    setState({ loading: true });
    fetchProjectStatus(null, idProjetOdoo)
      .then((r) => alive && setState({ loading: false, ...r }))
      .catch(() => alive && setState({ loading: false, unavailable: true }));
    return () => { alive = false; };
  }, [idProjetOdoo]);

  const verify = async () => {
    const id = parseInt(String(input).trim(), 10);
    if (!id) { setCheck({ error: "Entre le numéro du projet Odoo." }); return; }
    setChecking(true); setCheck(null);
    try {
      const r = await fetchProjectStatus(null, id);
      if (r.status === "not_found") setCheck({ error: `Aucun projet Odoo #${id}.` });
      else setCheck({ ok: true, id, name: r.project?.name, status: r.status });
    } catch {
      setCheck({ error: "Odoo indisponible ici (nécessite la version déployée)." });
    } finally {
      setChecking(false);
    }
  };

  const openEditor = () => { setInput(idProjetOdoo ? String(idProjetOdoo) : ""); setCheck(null); setEditing(true); };
  const cancel = () => { setEditing(false); setCheck(null); };
  const confirmLink = () => { if (check?.ok) { onLink?.(check.id); setEditing(false); setCheck(null); } };
  const unlink = () => { onLink?.(null); setEditing(false); setCheck(null); };

  // ---- Mode édition : coller l'id + vérifier + relier ----
  if (editing) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            autoFocus
            value={input}
            onChange={(e) => { setInput(e.target.value.replace(/[^0-9]/g, "")); setCheck(null); }}
            onKeyDown={(e) => e.key === "Enter" && verify()}
            placeholder="ID projet Odoo"
            style={{ width: 120, padding: "4px 8px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13 }}
          />
          <button onClick={verify} disabled={checking} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer", fontSize: 12 }}>
            {checking ? "…" : "Vérifier"}
          </button>
          <button onClick={cancel} title="Annuler" style={{ border: "none", background: "none", cursor: "pointer", color: "#9CA3AF" }}><X size={16} /></button>
        </div>
        {check?.error && <span style={{ fontSize: 12, color: "#B91C1C" }}>{check.error}</span>}
        {check?.ok && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ color: "#374151" }}>#{check.id} → <b>{check.name}</b></span>
            <button onClick={confirmLink} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 8, border: "none", background: "#047857", color: "#fff", cursor: "pointer", fontSize: 12 }}>
              <Check size={13} /> Relier
            </button>
          </div>
        )}
        {idProjetOdoo && (
          <button onClick={unlink} style={{ border: "none", background: "none", color: "#9CA3AF", fontSize: 11, cursor: "pointer", textDecoration: "underline", padding: 0 }}>délier</button>
        )}
      </div>
    );
  }

  // ---- Non relié ----
  if (!idProjetOdoo || state.unlinked) {
    return (
      <button onClick={openEditor} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer", fontSize: 12, color: "#374151", fontWeight: 600 }}>
        <Link2 size={13} /> Relier à Odoo
      </button>
    );
  }

  // ---- Relié : statut ----
  if (state.loading) return <Chip dot="#D1D5DB" color="#9CA3AF" label="Odoo…" />;
  if (state.unavailable) return <Chip dot="#D1D5DB" color="#9CA3AF" label="Statut Odoo —" title="Statut indisponible ici (nécessite la version déployée)." />;

  const m = MAP[state.status] || MAP.not_found;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
      {state.status === "linked" || state.status === "pending_tasks" ? (
        <a href={odooProjectUrl(idProjetOdoo)} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }} title={`Ouvrir le projet #${idProjetOdoo} dans Odoo`}>
          <Chip dot={m.dot} color={m.color} label={m.label} icon />
        </a>
      ) : (
        <Chip dot={m.dot} color={m.color} label={m.label} title={`#${idProjetOdoo} introuvable dans Odoo.`} />
      )}
      <button onClick={openEditor} style={{ border: "none", background: "none", color: "#9CA3AF", fontSize: 11, cursor: "pointer", textDecoration: "underline", padding: 0 }}>modifier</button>
    </span>
  );
}
