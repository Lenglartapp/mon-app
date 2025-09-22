// src/screens/ChiffrageRoot.jsx
import React, { useState } from "react";
import { Search, Plus, Copy, Trash2 } from "lucide-react";
import { useAuth } from "../auth";
import { uid } from "../lib/utils/uid";
import { COLORS, S } from "../lib/constants/ui";

export default function ChiffrageRoot({ minutes = [], setMinutes, onOpenMinute, onBack }) {
  const { currentUser } = useAuth?.() || { currentUser: { name: "—" } };
  const [q, setQ] = React.useState("");

// --- Popup "Nouvelle minute"
  const [newMinOpen, setNewMinOpen] = useState(false);
  const [newMin, setNewMin] = useState({
    charge: (currentUser?.name || "").trim(),
    projet: "",
    note: "",
    status: "Non commencé", // valeurs: Non commencé | En cours d’étude | À valider | Validé
    modules: { rideau: true, store: true, decor: true }, // par défaut les 3
  });
  
  // normalise (au cas où d'anciennes minutes n'ont pas encore ces champs)
  const norm = (m) => ({
    id: m.id,
    name: m.name || "Minute sans nom",
    client: m.client || "",
    notes: m.notes || "",
    version: m.version ?? 1,
    lines: m.lines || [],
    createdAt: m.createdAt || Date.now(),
    updatedAt: m.updatedAt || Date.now(),
    owner: m.owner || currentUser?.name || "—",
    status: m.status || "Non commencé"
  });

  const list = (minutes || []).map(norm).filter(m => {
    const s = (q || "").toLowerCase();
    if (!s) return true;
    return (
      String(m.name).toLowerCase().includes(s) ||
      String(m.client).toLowerCase().includes(s) ||
      String(m.owner).toLowerCase().includes(s)
    );
  }).sort((a,b)=> b.updatedAt - a.updatedAt);

  const addMinute = () => {
    setNewMinOpen(true); // on ouvre la popup au lieu de créer directement
  };

  const handleCreateMinute = () => {
    const { charge, projet, note, status, modules } = newMin;
    if (!projet.trim() || !charge.trim()) return;
    if (!modules.rideau && !modules.store && !modules.decor) return;

    const now = Date.now();
    const id = uid();
    const m = {
      id,
      name: projet.trim(),             // nom du chiffrage
      client: "—",
      notes: (note || "").trim(),      // note/commentaire
      version: 1,
      lines: [],                       // si tu sépares plus tard par module, on adaptera ici
      // ▼▼ paramètres par défaut (drawer latéral)
   params: [
     { id: uid(), name: "taux_horaire",     type: "prix", value: 135 },
     { id: uid(), name: "prix_achat_tissu", type: "prix", value: null },
     { id: uid(), name: "nuit_hotel",       type: "prix", value: 150 },
   ],
   // ▼▼ (optionnel mais recommandé) tableau déplacements vide prêt à l’emploi
   deplacements: [],
      createdAt: now,
      updatedAt: now,
      owner: charge.trim(),            // chargé d’affaires
      status,                          // statut lisible (fr)
      modules: { ...modules },         // flags R/S/D
    };
    setMinutes((xs) => [m, ...(xs || [])]);  // ajout en tête de liste
    setNewMinOpen(false);
    onOpenMinute?.(id);                       // ouvre directement la minute
  };

  const duplicate = (id) => {
    setMinutes((xs) => {
      const src = xs.find(x => x.id === id);
      if (!src) return xs;
      const copy = norm({
        ...src,
        id: uid(),
        name: `${src.name} (copie)`,
        version: (src.version ?? 1) + 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: "Non commencé",
      });
      return [copy, ...xs];
    });
  };

  const removeOne = (id) => {
    if (!confirm("Supprimer cette minute ?")) return;
    setMinutes((xs) => xs.filter(x => x.id !== id));
  };

  // petit style local pour éviter de toucher S.*
  const T = {
    wrap: { padding: 16 },
    headerRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 },
    back: S.smallBtn,
    title: { fontSize: 28, fontWeight: 900, margin: 0, flex: 1 },
    newBtn: { ...S.smallBtn, padding: "10px 14px", fontWeight: 800 },
    search: { position: "relative", width: 420, maxWidth: "100%" },
    searchInput: {
      width: "100%", padding: "10px 14px 10px 38px",
      borderRadius: 10, border: `1px solid ${COLORS.border}`, background: "#fff"
    },
    table: { width: "100%", borderCollapse: "separate", borderSpacing: 0, background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 0 rgba(0,0,0,.05)" },
    th: { textAlign: "left", fontSize: 12, letterSpacing: .3, textTransform: "uppercase", color: "#6b7280", padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, background: "#fafafa" },
    td: { padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}` },
    tr: { cursor: "pointer" },
    trHover: { background: "#fbfbfb" },
    badge: (kind) => ({
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      background: kind === "Terminé" ? "#dcfce7"
               : kind === "En cours" ? "#fde68a"
               : "#e5e7eb",
      color: "#111827"
    }),
    actions: { display: "flex", gap: 8, justifyContent: "flex-end" },
    iconBtn: { ...S.smallBtn, padding: "6px 8px" }
  };

  return (
    <div style={T.wrap}>
      {/* Barre top */}
      <div style={T.headerRow}>
        <button style={T.back} onClick={onBack}>← Retour</button>
        <h1 style={T.title}>Chiffrage</h1>

        <div style={T.search}>
          <Search size={16} style={{ position: "absolute", left: 10, top: 11, opacity: .6 }} />
          <input
            placeholder="Rechercher une minute (nom, client, chargé)"
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            style={T.searchInput}
          />
        </div>

        <button style={T.newBtn} onClick={addMinute}>
          <Plus size={16}/> Nouvelle minute
        </button>
      </div>

{newMinOpen && (
  <div
    style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.25)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
    }}
    onClick={() => setNewMinOpen(false)}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: 460, background: "#fff", borderRadius: 12, padding: 16,
        boxShadow: "0 12px 32px rgba(0,0,0,.2)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Nouvelle minute</h3>
        <button style={T.newBtn} onClick={() => setNewMinOpen(false)}>Fermer</button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <label>
          <div style={{ fontSize: 12, opacity: .7 }}>Chargé·e d’affaires</div>
          <input
            style={{ width: "100%" }}
            value={newMin.charge}
            onChange={(e)=> setNewMin(m => ({ ...m, charge: e.target.value }))}
          />
        </label>

        <label>
          <div style={{ fontSize: 12, opacity: .7 }}>Nom du chiffrage</div>
          <input
            style={{ width: "100%" }}
            value={newMin.projet}
            onChange={(e)=> setNewMin(m => ({ ...m, projet: e.target.value }))}
            placeholder={`Minute ${new Date().toLocaleDateString("fr-FR")}`}
          />
        </label>

        <label>
          <div style={{ fontSize: 12, opacity: .7 }}>Statut</div>
          <select
            style={{ width: "100%" }}
            value={newMin.status}
            onChange={(e)=> setNewMin(m => ({ ...m, status: e.target.value }))}
          >
            <option>Non commencé</option>
            <option>En cours d’étude</option>
            <option>À valider</option>
            <option>Validé</option>
          </select>
        </label>

        <div>
          <div style={{ fontSize: 12, opacity: .7, marginBottom: 4 }}>Modules à inclure</div>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={newMin.modules.rideau}
              onChange={(e)=> setNewMin(m => ({ ...m, modules: { ...m.modules, rideau: e.target.checked } }))}
            />
            Rideaux
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={newMin.modules.store}
              onChange={(e)=> setNewMin(m => ({ ...m, modules: { ...m.modules, store: e.target.checked } }))}
            />
            Stores
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={newMin.modules.decor}
              onChange={(e)=> setNewMin(m => ({ ...m, modules: { ...m.modules, decor: e.target.checked } }))}
            />
            Décors de lit
          </label>
          <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
            (Coche au moins un module)
          </div>
        </div>

        <label>
          <div style={{ fontSize: 12, opacity: .7 }}>Note</div>
          <textarea
            rows={3}
            style={{ width: "100%" }}
            value={newMin.note}
            onChange={(e)=> setNewMin(m => ({ ...m, note: e.target.value }))}
            placeholder="Commentaire interne…"
          />
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
          <button style={S.smallBtn} onClick={()=> setNewMinOpen(false)}>Annuler</button>
          <button
            style={S.smallBtn}
            onClick={handleCreateMinute}
            disabled={
              !newMin.charge.trim() ||
              !newMin.projet.trim() ||
              !(newMin.modules.rideau || newMin.modules.store || newMin.modules.decor)
            }
          >
            Créer
          </button>
        </div>
      </div>
    </div>
  </div>
)}


      {/* Tableau */}
      <table style={T.table}>
        <thead>
          <tr>
            <th style={T.th}>Nom du devis</th>
            <th style={T.th}>Date de la minute</th>
            <th style={T.th}>Chargé du devis</th>
            <th style={T.th}>Statut</th>
            <th style={T.th}>Modules</th>
            <th style={T.th}>Notes</th>
            <th style={{ ...T.th, width: 140, textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((m, i) => (
            <tr
              key={m.id}
              style={{ ...T.tr, ...(i % 2 ? { background: "#fcfcfc" } : null) }}
              onMouseEnter={(e)=> e.currentTarget.style.background = "#f9fafb"}
              onMouseLeave={(e)=> e.currentTarget.style.background = i % 2 ? "#fcfcfc" : "#fff"}
              onClick={(e)=> {
                // éviter que les boutons à droite déclenchent l'ouverture
                if ((e.target.closest && e.target.closest(".row-actions"))) return;
                onOpenMinute(m.id);
              }}
            >
              <td style={T.td}><b>{m.name}</b><div style={{ opacity: .6, fontSize: 12 }}>{m.client || "—"}</div></td>
              <td style={T.td}>{new Date(m.updatedAt || m.createdAt).toLocaleString("fr-FR")}</td>
              <td style={T.td}>{m.owner || "—"}</td>
              <td style={T.td}><span style={T.badge(m.status)}>{m.status}</span></td>
              <td style={T.td}>
  { (m.modules?.rideau || m.modules?.store || m.modules?.decor)
    ? [ m.modules?.rideau && "Rideaux",
        m.modules?.store  && "Stores",
        m.modules?.decor  && "Décors de lit" ].filter(Boolean).join(" · ")
    : "—"
  }
</td>
              <td style={T.td}>{m.notes || "—"}</td>
              <td style={{ ...T.td }}>
                <div className="row-actions" style={T.actions}>
                  <button
  title="Dupliquer"
  style={T.iconBtn}
  onClick={(e)=>{ e.stopPropagation(); duplicate(m.id); }}
>
  <Copy size={16} />
</button>

<button
  title="Supprimer"
  style={T.iconBtn}
  onClick={(e)=>{ e.stopPropagation(); removeOne(m.id); }}
>
  <Trash2 size={16} />
</button>
                </div>
              </td>
            </tr>
          ))}

          {!list.length && (
            <tr>
              <td colSpan={6} style={{ ...T.td, textAlign: "center", color: "#6b7280" }}>
                Aucune minute pour le moment. Crée la première avec « Nouvelle minute ».
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}