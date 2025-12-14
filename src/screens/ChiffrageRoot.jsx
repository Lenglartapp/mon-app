// src/screens/ChiffrageRoot.jsx
import React, { useState, useMemo, useEffect } from "react";
import { Search, Plus, Copy, Trash2, Edit2, FileText } from "lucide-react";
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import { useAuth } from "../auth";
import { uid } from "../lib/utils/uid";
import { COLORS, S } from "../lib/constants/ui";
import { SmartFilterBar } from "../components/ui/SmartFilterBar.jsx";

// Helper for Status Chip Color
const getStatusColor = (status) => {
  const s = (status || "").toLowerCase();
  if (s.includes("valid") || s.includes("sign")) return { bg: "#DEF7EC", text: "#03543F" };
  if (s.includes("attente") || s.includes("cours")) return { bg: "#FEF3C7", text: "#92400E" };
  return { bg: "#F3F4F6", text: "#374151" };
};

// Helper unique color for Avatar
function stringToColor(string) {
  let hash = 0;
  for (let i = 0; i < string.length; i++) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).substr(-2);
  }
  return color;
}

export default function ChiffrageRoot({ minutes = [], setMinutes, onOpenMinute, onBack }) {
  const { currentUser } = useAuth?.() || { currentUser: { name: "—" } };

  // --- Popup "Nouvelle minute" State
  const [newMinOpen, setNewMinOpen] = useState(false);
  const [newMin, setNewMin] = useState({
    charge: (currentUser?.name || "").trim(),
    projet: "",
    note: "",
    status: "Non commencé", // valeurs: Non commencé | En cours d’étude | À valider | Validé
    modules: { rideau: true, store: true, decor: true }, // par défaut les 3
  });

  // --- Filtering State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState([]);

  // Set default filter on mount
  useEffect(() => {
    setActiveFilters([{ id: 'my_minutes', label: '👤 Mes Devis', field: 'owner' }]);
  }, []);

  // Normalisation
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
    status: m.status || "Non commencé",
    modules: m.modules
  });

  const list = useMemo(() => (minutes || []).map(norm).sort((a, b) => b.updatedAt - a.updatedAt), [minutes]);

  const removeFilter = (id) => setActiveFilters(prev => prev.filter(f => f.id !== id));

  const filteredList = useMemo(() => {
    let res = list;

    // 1. Filter: My Minutes
    if (activeFilters.some(f => f.id === 'my_minutes')) {
      const userName = currentUser?.name || currentUser?.displayName || currentUser?.email || "";
      if (userName) {
        res = res.filter(m => {
          const owner = (m.owner || "").toLowerCase();
          const user = userName.toLowerCase();
          return owner.includes(user) || user.includes(owner) || !m.owner;
        });
      }
    }

    // 2. Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      res = res.filter(m =>
        [m.name, m.client, m.owner, m.notes].some(x => String(x || "").toLowerCase().includes(q))
      );
    }
    return res;
  }, [list, searchQuery, activeFilters, currentUser]);


  // Actions
  const handleCreateMinute = () => {
    const { charge, projet, note, status, modules } = newMin;
    if (!projet.trim() || !charge.trim()) return;
    if (!modules.rideau && !modules.store && !modules.decor) return;

    const now = Date.now();
    const id = uid();
    const m = {
      id,
      name: projet.trim(),
      client: "—",
      notes: (note || "").trim(),
      version: 1,
      lines: [],
      params: [
        { id: uid(), name: "taux_horaire", type: "prix", value: 135 },
        { id: uid(), name: "prix_achat_tissu", type: "prix", value: null },
        { id: uid(), name: "nuit_hotel", type: "prix", value: 150 },
      ],
      deplacements: [],
      createdAt: now,
      updatedAt: now,
      owner: charge.trim(),
      status,
      modules: { ...modules },
    };
    setMinutes((xs) => [m, ...(xs || [])]);
    setNewMinOpen(false);
    onOpenMinute?.(id);
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


  return (
    <div style={{
      minHeight: '100vh',
      background: '#F9F7F2', // Beige Moulinette
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* Header & Tools */}
      <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto 24px auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontWeight: 600 }}>← Retour</button>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1F2937', margin: 0, letterSpacing: '-0.5px' }}>
              Chiffrages & Devis
            </h1>
          </div>

          <button
            onClick={() => setNewMinOpen(true)}
            style={{
              background: '#1F2937',
              color: 'white',
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontWeight: 600,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            <Plus size={18} /> Nouvelle minute
          </button>
        </div>

        <SmartFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeFilters={activeFilters}
          onRemoveFilter={removeFilter}
        />
      </div>

      {/* Main Card */}
      <div style={{
        maxWidth: 1200,
        width: '100%',
        margin: '0 auto',
        background: 'white',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 6px rgba(0,0,0,0.02)',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#F3F4F6', borderBottom: '1px solid #E5E7EB' }}>
              <tr>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Devis / Client</th>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Mise à jour</th>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Chargé d'Affaires</th>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Statut</th>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Modules</th>
                <th style={{ padding: '12px 16px', width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((m, idx) => {
                const statusStyle = getStatusColor(m.status);
                return (
                  <tr
                    key={m.id}
                    className="minute-row"
                    style={{
                      borderBottom: '1px solid #F3F4F6',
                      cursor: 'pointer',
                      transition: 'background 0.1s'
                    }}
                    onClick={() => onOpenMinute?.(m.id)}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#111827', fontSize: 15 }}>{m.name || "Minute sans nom"}</div>
                      <div style={{ fontSize: 12, color: '#9CA3AF' }}>{m.client || "—"}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#6B7280', fontSize: 14 }}>
                      {new Date(m.updatedAt || m.createdAt).toLocaleDateString("fr-FR")} <small>{new Date(m.updatedAt || m.createdAt).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}</small>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: stringToColor(m.owner || "?") }}>
                          {(m.owner?.[0] || "?").toUpperCase()}
                        </Avatar>
                        <span style={{ fontSize: 14, color: '#374151' }}>{m.owner || "—"}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Chip
                        label={m.status || "Non commencé"}
                        size="small"
                        sx={{
                          bgcolor: statusStyle.bg,
                          color: statusStyle.text,
                          fontWeight: 600,
                          fontSize: 12,
                          height: 24
                        }}
                      />
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#4B5563' }}>
                      {(m.modules?.rideau || m.modules?.store || m.modules?.decor)
                        ? [m.modules?.rideau && "Rideaux",
                        m.modules?.store && "Stores",
                        m.modules?.decor && "Décors"].filter(Boolean).join(" · ")
                        : "—"
                      }
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', opacity: 0.6 }}>
                        <Tooltip title="Dupliquer">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); duplicate(m.id); }}>
                            <Copy size={16} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Supprimer">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); removeOne(m.id); }}>
                            <Trash2 size={16} />
                          </IconButton>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredList.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
                    <FileText size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
                    <div>Aucun chiffrage trouvé.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* Modal Création (Legacy styled wrap but functional) - Keeping simple for now but could be styled better */}
      {newMinOpen && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
          }}
          onClick={() => setNewMinOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 480, background: "#fff", borderRadius: 12, padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Nouvelle minute</h3>
              <IconButton onClick={() => setNewMinOpen(false)} size="small"><Trash2 size={18} style={{ transform: 'rotate(45deg)' }} /></IconButton> {/* Using trash as close X or just button */}
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              <label>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>Chargé·e d’affaires</div>
                <input
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #D1D5DB" }}
                  value={newMin.charge}
                  onChange={(e) => setNewMin(m => ({ ...m, charge: e.target.value }))}
                />
              </label>

              <label>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>Nom du chiffrage</div>
                <input
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #D1D5DB" }}
                  value={newMin.projet}
                  onChange={(e) => setNewMin(m => ({ ...m, projet: e.target.value }))}
                  placeholder={`Minute ${new Date().toLocaleDateString("fr-FR")}`}
                />
              </label>

              <label>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>Statut</div>
                <select
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #D1D5DB" }}
                  value={newMin.status}
                  onChange={(e) => setNewMin(m => ({ ...m, status: e.target.value }))}
                >
                  <option>Non commencé</option>
                  <option>En cours d’étude</option>
                  <option>À valider</option>
                  <option>Validé</option>
                </select>
              </label>

              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 8 }}>Modules à inclure</div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={newMin.modules.rideau}
                      onChange={(e) => setNewMin(m => ({ ...m, modules: { ...m.modules, rideau: e.target.checked } }))}
                    />
                    Rideaux
                  </label>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={newMin.modules.store}
                      onChange={(e) => setNewMin(m => ({ ...m, modules: { ...m.modules, store: e.target.checked } }))}
                    />
                    Stores
                  </label>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={newMin.modules.decor}
                      onChange={(e) => setNewMin(m => ({ ...m, modules: { ...m.modules, decor: e.target.checked } }))}
                    />
                    Décors
                  </label>
                </div>
              </div>

              <label>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>Note</div>
                <textarea
                  rows={3}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #D1D5DB" }}
                  value={newMin.note}
                  onChange={(e) => setNewMin(m => ({ ...m, note: e.target.value }))}
                  placeholder="Commentaire interne…"
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
                <button onClick={() => setNewMinOpen(false)} style={{ background: 'white', border: '1px solid #D1D5DB', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>Annuler</button>
                <button
                  onClick={handleCreateMinute}
                  disabled={!newMin.charge.trim() || !newMin.projet.trim() || !(newMin.modules.rideau || newMin.modules.store || newMin.modules.decor)}
                  style={{ background: '#1F2937', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', opacity: (!newMin.charge.trim() || !newMin.projet.trim()) ? 0.5 : 1 }}
                >
                  Créer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}