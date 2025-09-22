// src/screens/MinutesScreen.jsx
import React from "react";
import { COLORS, S } from "../lib/constants/ui";
import MinuteEditor from "../components/MinuteEditor";
import { uid } from "../lib/utils/uid";

export default function MinutesScreen({ onExportToProduction }) {
  const [minutes, setMinutes] = useLocalStorage("minutes.v1", DEMO_MINUTES);
  const [selId, setSelId] = React.useState(minutes?.[0]?.id || null);
  const selected = minutes.find(m => m.id === selId) || null;

  const createMinute = () => {
        const now = Date.now();
    const m = {
      id: uid(),
      name: "Nouvelle minute",
      client: "",
      version: 1,
      notes: "",
      lines: [],
      // ▼ paramètres par défaut (drawer)
      params: [
        { id: uid(), name: "taux_horaire",     type: "prix", value: 135 },
        { id: uid(), name: "prix_achat_tissu", type: "prix", value: null },
        { id: uid(), name: "nuit_hotel",       type: "prix", value: 150 },
      ],
      // ▼ tableau “déplacements” prêt (même si vide au départ)
      deplacements: [],
      createdAt: now,
      updatedAt: now,
    };
    setMinutes((a)=> [m, ...(a||[])]);
    setSelId(m.id);
  };

    const duplicateMinute = (id) => {
    const src = minutes.find(m => m.id === id);
    if (!src) return;
    const copy = {
      ...src,
      id: uid(),
      name: src.name + " (copie)",
      version: (src.version || 1) + 1,
     // lignes recopiées avec nouveaux ids
     lines: (src.lines || []).map(l => ({ ...l, id: uid() })),
     // params recopiés avec nouveaux ids (si présents)
     params: (src.params || []).map(p => ({ ...p, id: uid() })),
     // déplacements recopiés avec nouveaux ids (si tu stockes un id par ligne)
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
    setMinutes((arr) => arr.map(m => (m.id === patch.id ? { ...m, ...patch } : m)));
  };

  const exportSelected = () => {
    if (!selected) return;
    const mapped = mapMinuteLinesToProductionRows(selected.lines || []);
    onExportToProduction(mapped, selected);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
      {/* Colonne gauche : liste */}
      <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b>Minutes</b>
          <button style={S.smallBtn} onClick={createMinute}>+ Nouvelle</button>
        </div>
        <div style={{ maxHeight: 520, overflow: "auto" }}>
          {(minutes || []).map((m) => (
            <div
              key={m.id}
              onClick={() => setSelId(m.id)}
              style={{
                padding: 10,
                borderBottom: `1px solid ${COLORS.border}`,
                cursor: "pointer",
                background: selId === m.id ? "#eef2ff" : "#fff"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{m.name}</div>
                  <div style={{ fontSize: 12, opacity: .7 }}>v{m.version} — {(m.lines||[]).length} ligne(s)</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={S.smallBtn} title="Dupliquer" onClick={(e)=>{ e.stopPropagation(); duplicateMinute(m.id); }}>🧬</button>
                  <button style={{ ...S.smallBtn, color: "#b91c1c" }} title="Supprimer" onClick={(e)=>{ e.stopPropagation(); deleteMinute(m.id); }}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
          {!minutes?.length && (
            <div style={{ padding: 12, opacity: .7 }}>Aucune minute. Crée la première.</div>
          )}
        </div>
      </div>

      {/* Colonne droite : éditeur + export */}
      <div style={{ display: "grid", gap: 12 }}>
        {/* Métadonnées minute */}
        {selected ? (
          <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, opacity: .7 }}>Nom</div>
                <input
                  value={selected.name || ""}
                  onChange={(e)=> saveMinute({ ...selected, name: e.target.value })}
                  style={S.input}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: .7 }}>Client</div>
                <input
                  value={selected.client || ""}
                  onChange={(e)=> saveMinute({ ...selected, client: e.target.value })}
                  style={S.input}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 12, opacity: .7 }}>Notes</div>
                <textarea
                  value={selected.notes || ""}
                  onChange={(e)=> saveMinute({ ...selected, notes: e.target.value })}
                  style={{ ...S.input, height: 70 }}
                />
              </div>
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={S.smallBtn} onClick={exportSelected}>⇪ Exporter vers Production</button>
            </div>
          </div>
        ) : null}

        {/* Table des lignes */}
        {selected ? (
          <MinuteEditor
            minute={selected}
            onChangeMinute={(m)=> saveMinute(m)}
          />
        ) : (
          <div style={{ padding: 20, border: `1px dashed ${COLORS.border}`, borderRadius: 12, textAlign: "center" }}>
            Sélectionne ou crée une minute pour commencer.
          </div>
        )}
      </div>
    </div>
  );
}