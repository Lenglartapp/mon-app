import React, { useState } from "react";
import { Link2, Check, X, ExternalLink } from "lucide-react";
import { fetchProjectStatus, odooProjectUrl } from "../../lib/odoo/odooPreviewClient";

// Cellule « Odoo » de la LISTE des projets (module Production).
// Version LÉGÈRE : statut Relié / Non relié basé uniquement sur `id_projet_odoo`
// déjà chargé avec le projet → AUCUN appel réseau au rendu de la liste.
// La vérification du nom Odoo ne se fait qu'à la demande, quand on relie une ligne.
// `onLink(id|null)` persiste la valeur (via handleUpdate côté parent).

export default function OdooLinkCell({ idProjetOdoo = null, internal = false, onLink, compact = false }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState(null); // { ok, id, name } | { error }

  if (internal) return <span style={{ color: "#D1D5DB", fontSize: 13 }}>—</span>;

  const openEditor = () => { setInput(idProjetOdoo ? String(idProjetOdoo) : ""); setCheck(null); setEditing(true); };
  const cancel = () => { setEditing(false); setCheck(null); };
  const confirmLink = () => { if (check?.ok) { onLink?.(check.id); setEditing(false); setCheck(null); } };
  const unlink = () => { onLink?.(null); setEditing(false); setCheck(null); };

  const verify = async () => {
    const id = parseInt(String(input).trim(), 10);
    if (!id) { setCheck({ error: "Entre le numéro du projet Odoo." }); return; }
    setChecking(true); setCheck(null);
    try {
      const r = await fetchProjectStatus(null, id);
      if (r.status === "not_found") setCheck({ error: `Aucun projet Odoo #${id}.` });
      else setCheck({ ok: true, id, name: r.project?.name });
    } catch {
      setCheck({ error: "Odoo indisponible ici (nécessite la version déployée)." });
    } finally {
      setChecking(false);
    }
  };

  // ---- Mode édition : coller l'id + vérifier + relier ----
  if (editing) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            autoFocus
            value={input}
            onChange={(e) => { setInput(e.target.value.replace(/[^0-9]/g, "")); setCheck(null); }}
            onKeyDown={(e) => e.key === "Enter" && verify()}
            placeholder="ID Odoo"
            style={{ width: 90, padding: "4px 8px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13 }}
          />
          <button onClick={verify} disabled={checking} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer", fontSize: 12 }}>
            {checking ? "…" : "Vérifier"}
          </button>
          <button onClick={cancel} title="Annuler" style={{ border: "none", background: "none", cursor: "pointer", color: "#9CA3AF", display: "inline-flex" }}><X size={16} /></button>
        </div>
        {check?.error && <span style={{ fontSize: 12, color: "#B91C1C" }}>{check.error}</span>}
        {check?.ok && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, flexWrap: "wrap" }}>
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

  // ---- Relié : pastille verte (aucun appel réseau) ----
  if (idProjetOdoo) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <a
          href={odooProjectUrl(idProjetOdoo)}
          target="_blank"
          rel="noreferrer"
          title={`Ouvrir le projet #${idProjetOdoo} dans Odoo`}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, background: "#ECFDF5", color: "#047857", fontSize: 12, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981" }} />
          Connecté <span style={{ color: "#059669", fontWeight: 500 }}>#{idProjetOdoo}</span>
          <ExternalLink size={11} />
        </a>
        {!compact && (
          <button onClick={openEditor} style={{ border: "none", background: "none", color: "#9CA3AF", fontSize: 11, cursor: "pointer", textDecoration: "underline", padding: 0 }}>modifier</button>
        )}
      </span>
    );
  }

  // ---- Non relié ----
  return (
    <button onClick={openEditor} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, border: "1px dashed #D1D5DB", background: "#fff", cursor: "pointer", fontSize: 12, color: "#6B7280", fontWeight: 600, whiteSpace: "nowrap" }}>
      <Link2 size={13} /> Relier
    </button>
  );
}
