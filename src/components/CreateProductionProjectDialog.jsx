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
  onCreateFromMinute,     // ({name, rows, meta}) => void
  onCreateBlank,          // (projectName, rows) => void
}) {
  // s'il n'y a pas de minutes disponibles, on force l'onglet "blank"
  const hasMinutes = Array.isArray(minutes) && minutes.length > 0;

  const [tab, _setTab] = React.useState(hasMinutes ? "minute" : "blank"); // "minute" | "blank"
  const setTab = (t) => _setTab(hasMinutes ? t : "blank");

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
    if (!hasMinutes) return [];
    const q = norm(query.trim());
    if (!q) return minutes.slice(0, 20);
    return minutes
      .filter((m) => {
        const hay = `${m.name || ""} ${m.nom || ""} ${m.dossier || ""} ${m.client || ""} ${m.id || ""}`;
        return norm(hay).includes(q);
      })
      .slice(0, 40);
  }, [minutes, query, hasMinutes]);

  const handlePickMinute = (m) => {
    setSelectedMinuteId(m.id);
    if (!projectName) {
      const suggest = m.name || m.nom || m.dossier || "";
      setProjectName(suggest);
    }
  };

  const handleImport = () => {
    if (!projectName || !selectedMinute) return;

    const minuteRows = extractRowsFromMinute(selectedMinute);
    if (!minuteRows.length) {
      alert("Cette Minute ne contient pas de lignes reconnues pour l'import.");
      return;
    }

    const minuteForMapper = { ...selectedMinute, rows: minuteRows };
    const nextRows = importMinuteToProduction(minuteForMapper, minuteSchema, prodSchema, []);

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

  const canImport =
    hasMinutes &&
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
            {hasMinutes && (
              <button
                style={S.pill(tab === "minute")}
                onClick={() => setTab("minute")}
              >
                Depuis une Minute
              </button>
            )}
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
        {tab === "minute" && hasMinutes ? (
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
          // Tab "Projet vierge" (ou fallback si pas de minutes)
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

          {tab === "minute" && hasMinutes ? (
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