// src/components/CreateProductionProjectDialog.jsx
import React from "react";
import { importMinuteToProduction } from "../lib/import/importMinuteToProduction";
import { createBlankProject } from "../lib/import/createBlankProject";
import { S } from "../lib/constants/ui";

export default function CreateProductionProjectDialog({
  minutes,              // [{id, name, rows, ...}]
  minuteSchema,         // schéma minute
  prodSchema,           // schéma production
  onCancel,
  onCreateFromMinute,   // (projectName, rows) => void
  onCreateBlank,        // (projectName, rows) => void
}) {
  const [tab, setTab] = React.useState("minute");
  const [projectName, setProjectName] = React.useState("");
  const [selectedMinuteId, setSelectedMinuteId] = React.useState(null);

  const [rideaux, setRideaux] = React.useState(true);
  const [stores,  setStores]  = React.useState(false);
  const [decors,  setDecors]  = React.useState(false);

  const selectedMinute = React.useMemo(
    () => minutes?.find(m => m.id === selectedMinuteId) || null,
    [minutes, selectedMinuteId]
  );

  return (
    <div style={S.modalBackdrop}>
      <div style={{ ...S.modal, width: 720 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Nouveau projet Production</div>
          <button onClick={onCancel} style={S.smallBtn}>Fermer</button>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={S.pills}>
            <button style={S.pill(tab === "minute")} onClick={() => setTab("minute")}>Depuis une Minute</button>
            <button style={S.pill(tab === "blank")} onClick={() => setTab("blank")}>Projet vierge</button>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ display:"block", marginBottom: 6, fontWeight: 600 }}>Nom du projet</label>
          <input
            style={S.input}
            placeholder="Ex: Chantier Dupont - RDC"
            value={projectName}
            onChange={(e)=> setProjectName(e.target.value)}
          />
        </div>

        {tab === "minute" ? (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap: 12, marginTop: 12 }}>
            <div style={{ border:"1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
              <input
                style={S.input}
                placeholder="Rechercher une minute"
                onChange={(e)=>{/* à ta guise */}}
              />
              <div style={{ maxHeight: 280, overflow: "auto", marginTop: 8 }}>
                {(minutes || []).map(m => (
                  <label key={m.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 4px", cursor:"pointer" }}>
                    <input
                      type="radio"
                      name="minute"
                      checked={selectedMinuteId === m.id}
                      onChange={()=> setSelectedMinuteId(m.id)}
                    />
                    <div>
                      <div style={{ fontWeight: 600 }}>{m.name || `Minute ${m.id}`}</div>
                      <div style={{ fontSize: 12, opacity:.7 }}>{Array.isArray(m.rows) ? m.rows.length : 0} ligne(s)</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ border:"1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Aperçu</div>
              {selectedMinute ? (
                <div style={{ fontSize: 14 }}>
                  <div><b>ID:</b> {selectedMinute.id}</div>
                  <div><b>Nom:</b> {selectedMinute.name}</div>
                  <div><b>Lignes:</b> {selectedMinute.rows?.length ?? 0}</div>
                </div>
              ) : (
                <div style={{ opacity:.7 }}>Sélectionnez une minute à gauche…</div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <div style={{ display:"flex", gap:12, alignItems:"center" }}>
              <label><input type="checkbox" checked={rideaux} onChange={e=>setRideaux(e.target.checked)} /> Rideaux</label>
              <label><input type="checkbox" checked={stores}  onChange={e=>setStores(e.target.checked)}  /> Stores</label>
              <label><input type="checkbox" checked={decors}  onChange={e=>setDecors(e.target.checked)}  /> Décors</label>
            </div>
          </div>
        )}

        <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop: 16 }}>
          <button onClick={onCancel} style={S.smallBtn}>Annuler</button>
          {tab === "minute" ? (
            <button
              style={S.primaryBtn}
              disabled={!projectName || !selectedMinute}
              onClick={()=>{
                const nextRows = importMinuteToProduction(selectedMinute, minuteSchema, prodSchema, []);
                onCreateFromMinute?.(projectName, nextRows);
              }}
            >
              Importer cette Minute
            </button>
          ) : (
            <button
              style={S.primaryBtn}
              disabled={!projectName}
              onClick={()=>{
                const nextRows = createBlankProject({ rideaux, stores, decors }, prodSchema);
                onCreateBlank?.(projectName, nextRows);
              }}
            >
              Créer le projet
            </button>
          )}
        </div>
      </div>
    </div>
  );
}