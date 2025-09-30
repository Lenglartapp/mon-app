// src/components/CreateProductionProjectDialog.jsx
import React from "react";
import { importMinuteToProduction } from "../lib/import/importMinuteToProduction";
import { createBlankProject } from "../lib/import/createBlankProject";
import { S } from "../lib/constants/ui";

// Normalisation simple pour recherches accent-insensibles
const norm = (s = "") =>
  s.normalize?.("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function CreateProductionProjectDialog({
  minutes = [],           // [{id, name/nom/dossier, client, rows, ...}]
  minuteSchema,           // schéma minute
  prodSchema,             // schéma production
  onCancel,               // ferme la modale
  onCreateFromMinute,     // (projectName, rows) => void
  onCreateBlank,          // (projectName, rows) => void
}) {
  const [tab, setTab] = React.useState("minute"); // "minute" | "blank"
  const [projectName, setProjectName] = React.useState("");
  const [selectedMinuteId, setSelectedMinuteId] = React.useState(null);
  const [query, setQuery] = React.useState("");

  // Cases pour projet vierge
  const [rideaux, setRideaux] = React.useState(true);
  const [stores,  setStores]  = React.useState(false);
  const [decors,  setDecors]  = React.useState(false);

  const selectedMinute = React.useMemo(
    () => (minutes || []).find(m => m.id === selectedMinuteId) || null,
    [minutes, selectedMinuteId]
  );

// Compte les lignes où qu'elles soient
const guessRowCount = (m) => {
  if (!m) return 0;
  if (Array.isArray(m.lines)) return m.lines.length;
  if (Array.isArray(m.rows)) return m.rows.length;
  if (Array.isArray(m.data)) return m.data.length;
  if (Array.isArray(m.items)) return m.items.length;
  if (m.tables && typeof m.tables === "object") {
    return Object.values(m.tables).reduce((sum, v) => {
      if (Array.isArray(v)) return sum + v.length;
      if (v && typeof v === "object" && Array.isArray(v.rows)) return sum + v.rows.length;
      return sum;
    }, 0);
  }
  return 0;
};

// Extrait réellement les lignes (pour l'import)
const extractRowsFromMinute = (m) => {
  if (!m) return [];
  if (Array.isArray(m.lines)) return m.lines;
  if (Array.isArray(m.rows)) return m.rows;
  if (Array.isArray(m.data)) return m.data;
  if (Array.isArray(m.items)) return m.items;
  if (m.tables && typeof m.tables === "object") {
    const all = [];
    Object.values(m.tables).forEach((v) => {
      if (Array.isArray(v)) all.push(...v);
      else if (v && typeof v === "object" && Array.isArray(v.rows)) all.push(...v.rows);
    });
    return all;
  }
  return [];
};


  // Filtre Minutes (nom/nom/dossier/client/id)
  const filteredMinutes = React.useMemo(() => {
    const q = norm(query.trim());
    if (!q) return Array.isArray(minutes) ? minutes.slice(0, 20) : [];
    return (minutes || [])
      .filter((m) => {
        const hay = `${m.name || ""} ${m.nom || ""} ${m.dossier || ""} ${m.client || ""} ${m.id || ""}`;
        return norm(hay).includes(q);
      })
      .slice(0, 40);
  }, [minutes, query]);

  const handlePickMinute = (m) => {
    setSelectedMinuteId(m.id);
    // Proposer un nom par défaut si vide
    if (!projectName) {
      const suggest = m.name || m.nom || m.dossier || "";
      setProjectName(suggest);
    }
  };

  const handleImport = () => {
  if (!projectName || !selectedMinute) return;

  // 1) Récupère les lignes, où qu’elles soient dans la Minute
  const minuteRows = extractRowsFromMinute(selectedMinute);

  // 2) Petit garde-fou UX
  if (!minuteRows.length) {
    alert("Cette Minute ne contient pas de lignes reconnues pour l'import.");
    return;
  }

  // 3) On fournit une minute 'augmentée' avec .rows pour le mapper
  const minuteForMapper = { ...selectedMinute, rows: minuteRows };

  // 4) Mapping minute → production
  const nextRows = importMinuteToProduction(
    minuteForMapper,
    minuteSchema,
    prodSchema,
    []
  );

  // 5) Remonte au parent (ProjectListScreen), il créera le projet
  onCreateFromMinute?.({
   name: projectName,
   rows: nextRows,
   meta: {
     id: selectedMinute.id,
     minuteName: selectedMinute.name,
     owner: selectedMinute.owner,
     notes: selectedMinute.notes,
     version: selectedMinute.version,
   },
 });
};

  const handleCreateBlank = () => {
    if (!projectName) return;
    const nextRows = createBlankProject({ rideaux, stores, decors }, prodSchema);
    onCreateBlank?.(projectName, nextRows);
  };

// 🔍 Debug : voir la minute sélectionnée et son contenu
 if (selectedMinute) {
   console.log("DEBUG Minute sélectionnée :", selectedMinute);
 }

 // --- DEBUG : structure des minutes et de la minute sélectionnée
if (Array.isArray(minutes)) {
  console.log(
    "DEBUG minutes→dialog:",
    minutes.map(m => ({ id: m?.id, keys: Object.keys(m || {}) }))
  );
}

if (selectedMinute) {
  const safe = (obj) => {
    try { return JSON.parse(JSON.stringify(obj)); } catch { return obj; }
  };
  console.log("DEBUG selectedMinute (full):", safe(selectedMinute));
  console.log("DEBUG paths candidates:",
    {
      rows_len: Array.isArray(selectedMinute?.rows) ? selectedMinute.rows.length : 0,
      data_len: Array.isArray(selectedMinute?.data) ? selectedMinute.data.length : 0,
      items_len: Array.isArray(selectedMinute?.items) ? selectedMinute.items.length : 0,
      tables_keys: selectedMinute?.tables ? Object.keys(selectedMinute.tables) : null,
    }
  );
}

// ➜ état d'activation du bouton "Importer"
const canImport =
  Boolean(projectName?.trim()) &&
  Boolean(selectedMinute) &&
  guessRowCount(selectedMinute) > 0;


  return (
    <div style={S.modalBackdrop}>
      <div
        style={{
          ...S.modal,
          width: 720,
          borderRadius: 16,
          boxShadow: "0 14px 38px rgba(0,0,0,.18)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Nouveau projet Production</div>
          <button onClick={onCancel} style={S.smallBtn}>Fermer</button>
        </div>

        {/* Tabs */}
        <div style={{ marginTop: 12 }}>
          <div style={S.pills}>
            <button
              style={S.pill(tab === "minute")}
              onClick={() => setTab("minute")}
            >
              Depuis une Minute
            </button>
            <button
              style={S.pill(tab === "blank")}
              onClick={() => setTab("blank")}
            >
              Projet vierge
            </button>
          </div>
        </div>

        {/* Nom du projet */}
        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
            Nom du projet
          </label>
          <input
            style={S.input}
            placeholder="Ex: Chantier Dupont - RDC"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
        </div>

        {/* Contenu tab */}
        {tab === "minute" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginTop: 12,
            }}
          >
            {/* Colonne gauche : recherche + liste */}
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 10,
                background: "#fff",
              }}
            >
              <input
                style={S.input}
                placeholder="Rechercher une minute (nom, client, dossier…)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div style={{ maxHeight: 280, overflow: "auto", marginTop: 8 }}>
                {(filteredMinutes || []).map((m) => (
                  <label
                    key={m.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 4px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="minute"
                      checked={selectedMinuteId === m.id}
                      onChange={() => handlePickMinute(m)}
                    />
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {m.name || m.nom || m.dossier || `Minute ${m.id}`}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {m.client ? `Client: ${m.client} · ` : ""}
                        {guessRowCount(m)} ligne(s)
                      </div>
                    </div>
                  </label>
                ))}
                {filteredMinutes?.length === 0 && (
                  <div style={{ fontSize: 13, opacity: 0.7, padding: "6px 4px" }}>
                    Aucune minute ne correspond à « {query} ».
                  </div>
                )}
              </div>
            </div>

            {/* Colonne droite : aperçu */}
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 10,
                background: "#fff",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Aperçu</div>
              {selectedMinute ? (
                <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                  <div><b>ID&nbsp;:</b> {selectedMinute.id}</div>
                  <div><b>Nom&nbsp;:</b> {selectedMinute.name || selectedMinute.nom || selectedMinute.dossier}</div>
                  {selectedMinute.client && <div><b>Client&nbsp;:</b> {selectedMinute.client}</div>}
                  <div><b>Lignes&nbsp;:</b> {guessRowCount(selectedMinute)}</div>
                </div>
              ) : (
                <div style={{ opacity: 0.7 }}>Sélectionnez une minute à gauche…</div>
              )}
            </div>
          </div>
        ) : (
          // Tab "Projet vierge"
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <label>
                <input
                  type="checkbox"
                  checked={rideaux}
                  onChange={(e) => setRideaux(e.target.checked)}
                />{" "}
                Rideaux
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={stores}
                  onChange={(e) => setStores(e.target.checked)}
                />{" "}
                Stores
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={decors}
                  onChange={(e) => setDecors(e.target.checked)}
                />{" "}
                Décors
              </label>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={onCancel} style={S.smallBtn}>Annuler</button>

          {tab === "minute" ? (
            <button
  style={{ ...S.primaryBtn, opacity: canImport ? 1 : 0.7 }}
  disabled={!canImport}
  aria-disabled={!canImport}
  onClick={handleImport}
  title={
    !projectName?.trim()
      ? "Saisir un nom de projet"
      : !selectedMinute
        ? "Choisir une minute"
        : guessRowCount(selectedMinute) === 0
          ? "Cette Minute n'a aucune ligne importable"
          : "Importer"
  }
>
  Importer cette Minute
</button>
          ) : (
            <button
              style={{ ...S.primaryBtn, opacity: projectName ? 1 : 0.7 }}
              disabled={!projectName}
              onClick={handleCreateBlank}
              title={!projectName ? "Saisir un nom de projet" : "Créer le projet"}
            >
              Créer le projet
            </button>
          )}
        </div>
      </div>
    </div>
  );
}