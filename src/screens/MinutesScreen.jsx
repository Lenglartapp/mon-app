import React, { useState, useEffect } from "react";
import { COLORS, S } from "../lib/constants/ui";
import MinuteEditor from "../components/MinuteEditor";
import { uid } from "../lib/utils/uid";
import { useAuth } from "../auth";
import { useNotifications } from "../contexts/NotificationContext";
import { useLocalStorage } from "../lib/hooks/useLocalStorage";
import { mapMinuteLinesToProductionRows } from "../lib/data/demo";
import { Plus, Trash2, Copy, AlertCircle, Check, FileText } from "lucide-react";

/** STYLES & CONSTANTS */
const STATUS_OPTIONS = {
  DRAFT: { label: "À faire", color: "#9CA3AF" }, // Gray
  IN_PROGRESS: { label: "En cours", color: "#3B82F6" }, // Blue
  PENDING_APPROVAL: { label: "À valider", color: "#F59E0B" }, // Orange
  REVISE: { label: "À reprendre", color: "#EF4444" }, // Red
  VALIDATED: { label: "Validée", color: "#10B981" }, // Green
};

const CreateModal = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState("Nouvelle minute");
  const [client, setClient] = useState("");

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div style={{ background: 'white', padding: 24, borderRadius: 12, width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginTop: 0 }}>Créer une nouvelle minute</h3>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Nom de la minute</label>
          <input
            autoFocus
            style={{ ...S.input, width: '100%' }}
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Client <span style={{ color: 'red' }}>*</span></label>
          <input
            style={{ ...S.input, width: '100%' }}
            value={client}
            onChange={e => setClient(e.target.value)}
            placeholder="Nom du client"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button onClick={onClose} style={{ ...S.smallBtn, background: '#f3f4f6', color: '#374151' }}>Annuler</button>
          <button
            disabled={!client.trim()}
            onClick={() => onCreate(name, client)}
            style={{
              ...S.smallBtn,
              background: client.trim() ? '#2563eb' : '#9ca3af',
              color: 'white',
              cursor: client.trim() ? 'pointer' : 'not-allowed'
            }}
          >
            Créer
          </button>
        </div>
      </div>
    </div>
  );
};

export default function MinutesScreen({ onExportToProduction }) {
  const [minutes, setMinutes] = useLocalStorage("minutes.v1", []);
  const [selId, setSelId] = useState(null);
  const selected = minutes.find(m => m.id === selId) || null;

  const { currentUser, ROLES } = useAuth();
  const { addNotification } = useNotifications();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Auto-select
  useEffect(() => {
    if (!selId && minutes.length > 0) {
      setSelId(minutes[0].id);
    }
  }, [minutes, selId]);

  const handleCreate = (name, client) => {
    const m = {
      id: uid(),
      name: name || "Nouvelle minute",
      client: client || "Client inconnu",
      version: 1,
      status: "DRAFT", // Default
      notes: "",
      lines: [],
      params: [
        { id: uid(), name: "taux_horaire", type: "prix", value: 135 },
        { id: uid(), name: "prix_achat_tissu", type: "prix", value: null },
        { id: uid(), name: "nuit_hotel", type: "prix", value: 150 },
      ],
      deplacements: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setMinutes(prev => [m, ...(prev || [])]);
    setSelId(m.id);
    setIsModalOpen(false);
  };

  const duplicateMinute = (id) => {
    const src = minutes.find(m => m.id === id);
    if (!src) return;
    const copy = {
      ...src,
      id: uid(),
      name: src.name + " (copie)",
      version: (src.version || 1) + 1,
      status: "DRAFT",
      lines: (src.lines || []).map(l => ({ ...l, id: uid() })),
      params: (src.params || []).map(p => ({ ...p, id: uid() })),
      deplacements: (src.deplacements || []).map(d => ({ ...d, id: uid() })),
      updatedAt: Date.now(),
    };
    setMinutes([copy, ...minutes]);
    setSelId(copy.id);
  };

  const deleteMinute = (id) => {
    if (!confirm("Supprimer cette minute ?")) return;
    const next = (minutes || []).filter(m => m.id !== id);
    setMinutes(next);
    if (selId === id) setSelId(next?.[0]?.id || null);
  };

  const saveMinute = (patch) => {
    // If saving lines, we might want to check readonly, but here we update metadata mainly
    setMinutes((arr) => arr.map(m => (m.id === patch.id ? { ...m, ...patch } : m)));
  };

  const handleStatusChange = (newStatus) => {
    if (!selected) return;

    // Logic: If status -> PENDING_APPROVAL
    if (newStatus === "PENDING_APPROVAL" && selected.status !== "PENDING_APPROVAL") {
      addNotification("Validation requise", `Le devis "${selected.name}" requiert validation.`, "warning");
    }

    // Logic: If status -> VALIDATED
    if (newStatus === "VALIDATED" && selected.status !== "VALIDATED") {
      if (!confirm("Confirmer la validation ? Cela verrouillera l'édition.")) {
        return; // User Cancelled
      }
      addNotification("Devis Validé", `Le devis "${selected.name}" est validé.`, "success");
    }

    saveMinute({ ...selected, status: newStatus });
  };

  const isReadOnly = selected?.status === 'VALIDATED';

  // --- RENDERING ---

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, height: 'calc(100vh - 80px)' }}>
      {/* LEFT COLUMN: LIST */}
      <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden", display: 'flex', flexDirection: 'column', background: 'white' }}>
        <div style={{ padding: 16, borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: '#F9FAFB' }}>
          <span style={{ fontWeight: 600, color: '#1F2937' }}>Minutes ({minutes.length})</span>
          <button
            style={{ ...S.smallBtn, background: '#111827', color: 'white', border: 'none', display: 'flex', gap: 6, padding: '6px 12px' }}
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={14} /> Nouvelle
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {(minutes || []).map((m) => {
            const st = STATUS_OPTIONS[m.status] || STATUS_OPTIONS.DRAFT;
            const isSel = selId === m.id;
            return (
              <div
                key={m.id}
                onClick={() => setSelId(m.id)}
                style={{
                  padding: "12px 16px",
                  borderBottom: `1px solid ${COLORS.border}`,
                  cursor: "pointer",
                  background: isSel ? "#EFF6FF" : "#fff",
                  borderLeft: isSel ? `4px solid ${st.color}` : '4px solid transparent',
                  transition: 'background 0.2s'
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 4 }}>
                  <div style={{ fontWeight: isSel ? 700 : 500, color: '#111827' }}>{m.name}</div>
                  <div style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 10,
                    background: st.color + '15', color: st.color, fontWeight: 700,
                    textTransform: 'uppercase', whiteSpace: 'nowrap'
                  }}>
                    {st.label}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 4 }}>Client: {m.client || "-"}</div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>v{m.version} • {new Date(m.updatedAt || m.createdAt).toLocaleDateString()}</div>
                  <div style={{ display: "flex", gap: 6, opacity: isSel ? 1 : 0.4 }}>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }} title="Dupliquer" onClick={(e) => { e.stopPropagation(); duplicateMinute(m.id); }}>
                      <Copy size={12} color="#4B5563" />
                    </button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }} title="Supprimer" onClick={(e) => { e.stopPropagation(); deleteMinute(m.id); }}>
                      <Trash2 size={12} color="#EF4444" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          {!minutes?.length && (
            <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
              Aucune minute.<br />Cliquez sur "Nouvelle" pour commencer.
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: EDITOR */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {selected ? (
          <>
            {/* --- HEADER --- */}
            <div style={{ background: 'white', borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: "20px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                {/* Title & Client */}
                <div>
                  <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 12 }}>
                    {selected.name}
                    {/* Small edit trigger for title could be here, but we allow editing inside MinuteEditor? No, name is here. */}
                    {/* We can make it Editable if we really want, but let's keep it simple for now as requested "Affiche le titre... en grand" */}
                  </h1>
                  <div style={{ fontSize: 16, color: '#6B7280', marginTop: 4, fontWeight: 500 }}>
                    Client : <span style={{ color: '#374151' }}>{selected.client}</span>
                  </div>
                </div>

                {/* Status Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#9CA3AF' }}>Statut</label>
                  <select
                    value={selected.status || "DRAFT"}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: `1px solid ${STATUS_OPTIONS[selected.status || "DRAFT"].color}`,
                      background: 'white',
                      fontWeight: 600,
                      color: STATUS_OPTIONS[selected.status || "DRAFT"].color,
                      cursor: 'pointer',
                      outline: 'none',
                      fontSize: 14
                    }}
                  >
                    {Object.entries(STATUS_OPTIONS).map(([key, opt]) => (
                      <option key={key} value={key}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Comments Area */}
              <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 16, marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#4B5563', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={14} /> Commentaires / Contexte
                </div>
                <textarea
                  value={selected.notes || ""}
                  onChange={(e) => saveMinute({ ...selected, notes: e.target.value })}
                  placeholder="Ajouter des notes, contexte du chantier, détails importants..."
                  style={{
                    width: '100%',
                    minHeight: 60,
                    border: '1px solid #E5E7EB',
                    borderRadius: 6,
                    padding: 8,
                    fontSize: 13,
                    fontFamily: "inherit",
                    resize: 'vertical',
                    background: isReadOnly ? '#f9fafb' : 'white',
                    color: isReadOnly ? '#6b7280' : 'inherit'
                  }}
                  readOnly={isReadOnly}
                />
              </div>

              {/* Read Only warning */}
              {isReadOnly && (
                <div style={{ marginTop: 12, padding: "8px 12px", background: "#ECFDF5", borderRadius: 6, color: "#065F46", fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Check size={16} />
                  Ce devis est validé. Les calculs sont verrouillés. Passez en statut "À reprendre" pour modifier.
                </div>
              )}
            </div>

            {/* --- EDITOR CONTENT --- */}
            <MinuteEditor
              minute={selected}
              onChangeMinute={(m) => saveMinute(m)}
              readOnly={isReadOnly}
            />
          </>
        ) : (
          <div style={{ padding: 40, border: `2px dashed ${COLORS.border}`, borderRadius: 12, textAlign: "center", color: '#9CA3AF', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
            <div style={{ fontSize: 16, fontWeight: 500 }}>Aucune minute sélectionnée</div>
            <p>Sélectionnez une minute dans la liste ou créez-en une nouvelle.</p>
          </div>
        )}
      </div>

      <CreateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}