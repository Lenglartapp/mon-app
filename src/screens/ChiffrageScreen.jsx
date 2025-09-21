// src/screens/ChiffrageScreen.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

import MinuteEditor from "../components/MinuteEditor";
import { COLORS, S } from "../lib/constants/ui";
import { useActivity } from "../contexts/activity";
import { useAuth } from "../auth.jsx";
import { CHIFFRAGE_SCHEMA } from "../lib/schemas/chiffrage";
import { computeFormulas, preserveManualAfterCompute } from "../lib/formulas/compute";
import { CHIFFRAGE_SCHEMA_DEP } from "../lib/schemas/deplacement";
import { uid } from "../lib/utils/uid";
import DataTable from "../components/DataTable";

// === Écran d’édition d’une minute (DataTable + Drawer paramètres) ===
function ChiffrageScreen({ minuteId, minutes, setMinutes, onBack }) {
  // 1) Récupère la minute courante
  const minute = React.useMemo(
    () => (minutes || []).find((m) => m.id === minuteId),
    [minutes, minuteId]
  );

  // 2) Schéma + lignes principales
  const [schema] = React.useState(CHIFFRAGE_SCHEMA);
  const [rows, setRows] = React.useState(() =>
    computeFormulas(minute?.lines || [], CHIFFRAGE_SCHEMA)
  );

  // 3) Déplacement (schéma dédié)
  const [depRows, setDepRows] = React.useState(
    computeFormulas(minute?.deplacements || [], CHIFFRAGE_SCHEMA_DEP)
  );

  // Resync quand minute change
  React.useEffect(() => {
    setRows(computeFormulas(minute?.lines || [], CHIFFRAGE_SCHEMA));
    setDepRows(computeFormulas(minute?.deplacements || [], CHIFFRAGE_SCHEMA_DEP));
  }, [minute?.id, minute?.lines, minute?.deplacements]);

  // 4) Modules sélectionnés (fallback)
  const mods = minute?.modules || { rideau: true, store: true, decor: true };

  // 5) Helpers persistance
  const updateMinute = (patch) =>
    setMinutes((all) =>
      (all || []).map((m) =>
        m.id === minuteId ? { ...m, ...patch, updatedAt: Date.now() } : m
      )
    );

  // Sauvegarde des lignes "Déplacement"
  const handleDepRowsChange = (nr) => {
    const next = computeFormulas(nr || [], CHIFFRAGE_SCHEMA_DEP);
    setDepRows(next);
    updateMinute({ deplacements: next });
  };

  // Sauvegarde des lignes principales
  const handleRowsChange = (nr) => {
    const next = computeFormulas(nr || [], schema);
    setRows(next);
    updateMinute({ lines: next });
  };

  // 6) Drawer Paramètres — vit ici (PAS dans MinuteEditor)
  const [showParams, setShowParams] = React.useState(false);

  // Helpers locaux
  const slugParamName = (raw) =>
    String(raw || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const toNumOrNull = (v) => {
    if (v === "" || v == null) return null;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const DEFAULT_PARAMS = [
    { id: uid(), name: "taux_horaire",     type: "prix", value: 135 },
    { id: uid(), name: "prix_hotel",       type: "prix", value: 150 },
    { id: uid(), name: "prix_achat_tissu", type: "prix", value: null },
  ];

  const [paramDraft, setParamDraft] = React.useState(() => {
    const base = Array.isArray(minute?.params) ? minute.params : [];
    return (base.length ? base : DEFAULT_PARAMS);
  });

  // Resync du drawer si on change de minute
  React.useEffect(() => {
    const base = Array.isArray(minute?.params) ? minute.params : [];
    setParamDraft(base.length ? base : DEFAULT_PARAMS);
  }, [minute?.id]);

  // Persistance des paramètres à chaque modif
  React.useEffect(() => {
    // nettoyage léger
    const cleaned = (paramDraft || []).map(p => ({
      id: p.id || uid(),
      name: slugParamName(p.name || ""),
      type: p.type === "coef" ? "coef" : "prix",
      value: toNumOrNull(p.value),
    }));
    updateMinute({ params: cleaned });
  }, [paramDraft]);

  const addParam = () => {
    setParamDraft(d => ([...(d || []), { id: uid(), name: "", type: "prix", value: null }]));
  };
  const setParamField = (id, key, value) => {
    setParamDraft(d => (d || []).map(p => p.id === id ? { ...p, [key]: value } : p));
  };
  const removeParam = (id) => {
    setParamDraft(d => (d || []).filter(p => p.id !== id));
  };

  // 7) Métadonnées minute
  const [name, setName]   = React.useState(minute?.name || "Minute sans nom");
  const [notes, setNotes] = React.useState(minute?.notes || "");
  React.useEffect(() => {
    setName(minute?.name || "Minute sans nom");
    setNotes(minute?.notes || "");
  }, [minuteId, minute?.name, minute?.notes]);

  const saveHeader = () => {
    updateMinute({ name: name || "Minute sans nom", notes });
  };

  // 8) Garde si ID invalide
  if (!minute) {
    return (
      <div style={S.contentWrap}>
        <div style={{ marginBottom: 12 }}>
          <button style={S.smallBtn} onClick={onBack}>← Retour</button>
        </div>
        <div
          style={{
            padding: 24,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            background: "#fff",
          }}
        >
          Minute introuvable.
        </div>
      </div>
    );
  }

  // 9) UI
  return (
    <div style={S.contentWide}>
      {/* Barre supérieure */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <button style={S.smallBtn} onClick={onBack}>← Retour</button>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du devis / minute"
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${COLORS.border}`,
              background: "#fff",
              fontWeight: 800,
            }}
          />
          <button style={S.smallBtn} onClick={saveHeader}>Enregistrer</button>
        </div>

        <div style={{ display: "flex", gap: 8, justifySelf: "end", alignItems: "center" }}>
          <div style={{ opacity: 0.7 }}>
            {new Date(minute.updatedAt || minute.createdAt || Date.now()).toLocaleString("fr-FR")}
          </div>
          <button
            style={S.smallBtn}
            onClick={() => setShowParams(s => !s)}
            title="Paramètres minute (taux horaire, coefs, prix...)"
          >
            ⚙️ Paramètres {showParams ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* Notes minute (optionnel) */}
      <div
        style={{
          marginBottom: 12,
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 8,
        }}
      >
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optionnel)"
          rows={2}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: `1px solid ${COLORS.border}`,
            background: "#fff",
            resize: "vertical",
          }}
        />
      </div>

      {/* Drawer Paramètres */}
      {showParams && (
        <div
          style={{
            marginBottom: 12,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            background: "#fff",
            padding: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <b>Paramètres de la minute</b>
            <button style={S.smallBtn} onClick={addParam}>+ Ajouter un paramètre</button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#374151" }}>
                  <th style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>Nom (clé)</th>
                  <th style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>Type</th>
                  <th style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>Valeur</th>
                  <th style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}` }} />
                </tr>
              </thead>
              <tbody>
                {(paramDraft || []).length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: 10, color: "#6b7280" }}>
                      Aucun paramètre. Cliquez sur <b>+ Ajouter un paramètre</b>.
                    </td>
                  </tr>
                )}
                {(paramDraft || []).map((p) => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: 8, minWidth: 220 }}>
                      <input
                        value={p.name || ""}
                        onChange={(e) => setParamField(p.id, "name", e.target.value)}
                        onBlur={(e) => setParamField(p.id, "name", slugParamName(e.target.value))}
                        placeholder="ex: taux_horaire, coef_tissu_luxe…"
                        style={S.input}
                      />
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                        Accents/espaces normalisés automatiquement.
                      </div>
                    </td>
                    <td style={{ padding: 8, width: 140 }}>
                      <select
                        value={p.type || "prix"}
                        onChange={(e) => setParamField(p.id, "type", e.target.value === "coef" ? "coef" : "prix")}
                        style={{ ...S.input, height: 34 }}
                      >
                        <option value="prix">prix</option>
                        <option value="coef">coef</option>
                      </select>
                    </td>
                    <td style={{ padding: 8, width: 160 }}>
                      <input
                        value={p.value ?? ""}
                        onChange={(e) => setParamField(p.id, "value", e.target.value)}
                        placeholder={p.type === "coef" ? "ex: 1,5" : "ex: 135"}
                        style={S.input}
                      />
                    </td>
                    <td style={{ padding: 8, textAlign: "right" }}>
                      <button
                        style={{ ...S.smallBtn, color: "#b91c1c" }}
                        onClick={() => removeParam(p.id)}
                        title="Supprimer"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Déplacement (au-dessus des 3 tableaux) */}
      <DataTable
        title="Déplacement"
        tableKey="deplacements"
        rows={depRows}
        onRowsChange={handleDepRowsChange}
        schema={CHIFFRAGE_SCHEMA_DEP}
        setSchema={() => {}}
        searchQuery=""
        viewKey="minutes_dep"
      />

      {/* Lignes principales : 1/2/3 tableaux selon modules (via MinuteEditor) */}
      <MinuteEditor
        minute={{ ...minute, lines: rows }}
        onChangeMinute={(m)=> updateMinute({ lines: m.lines })}
      />
    </div>
  );
}

export default ChiffrageScreen;