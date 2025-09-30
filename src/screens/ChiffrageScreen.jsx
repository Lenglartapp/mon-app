// src/screens/ChiffrageScreen.jsx
import React from "react";

import MinuteEditor from "../components/MinuteEditor";
import { COLORS, S } from "../lib/constants/ui";
import { CHIFFRAGE_SCHEMA } from "../lib/schemas/chiffrage";
import { computeFormulas, preserveManualAfterCompute } from "../lib/formulas/compute";
import { CHIFFRAGE_SCHEMA_DEP } from "../lib/schemas/deplacement";
import { uid } from "../lib/utils/uid";
import DataTable from "../components/DataTable";

// 🔐 AJOUTS
import { useAuth } from "../auth";
import { can } from "../lib/authz";

function ChiffrageScreen({ minuteId, minutes, setMinutes, onBack }) {
  // 🔐 droits
  const { currentUser } = useAuth();
  const canView = can(currentUser, "chiffrage.view");
  const canEdit = can(currentUser, "chiffrage.edit");

  if (!canView) {
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
          Accès refusé.
        </div>
      </div>
    );
  }

  const minute = React.useMemo(
    () => (minutes || []).find((m) => m.id === minuteId),
    [minutes, minuteId]
  );

  const [schema] = React.useState(CHIFFRAGE_SCHEMA);
  const [rows, setRows] = React.useState(() =>
    computeFormulas(minute?.lines || [], CHIFFRAGE_SCHEMA)
  );

  const [depRows, setDepRows] = React.useState(
    computeFormulas(minute?.deplacements || [], CHIFFRAGE_SCHEMA_DEP)
  );

  React.useEffect(() => {
    const computedMain = computeFormulas(minute?.lines || [], CHIFFRAGE_SCHEMA);
    setRows((prev) => preserveManualAfterCompute(computedMain, prev || []));

    const computedDep = computeFormulas(minute?.deplacements || [], CHIFFRAGE_SCHEMA_DEP);
    setDepRows(computedDep);
  }, [minute?.id, minute?.lines, minute?.deplacements]);

  const mods = minute?.modules || { rideau: true, store: true, decor: true };

  const updateMinute = (patch) => {
    if (!canEdit) return; // lecture seule éventuelle
    setMinutes((all) =>
      (all || []).map((m) =>
        m.id === minuteId ? { ...m, ...patch, updatedAt: Date.now() } : m
      )
    );
  };

  const handleDepRowsChange = (nr) => {
    if (!canEdit) return;
    const next = Array.isArray(nr) ? nr : [];
    setDepRows(next);
    updateMinute({ deplacements: next });
  };

  const handleRowsChange = (nr) => {
    if (!canEdit) return;
    const next = Array.isArray(nr) ? nr : [];
    setRows(next);
    updateMinute({ lines: next });
  };

  const [showParams, setShowParams] = React.useState(false);

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

  React.useEffect(() => {
    const base = Array.isArray(minute?.params) ? minute.params : [];
    setParamDraft(base.length ? base : DEFAULT_PARAMS);
  }, [minute?.id]);

  React.useEffect(() => {
    if (!canEdit) return;
    const cleaned = (paramDraft || []).map(p => ({
      id: p.id || uid(),
      name: slugParamName(p.name || ""),
      type: p.type === "coef" ? "coef" : "prix",
      value: toNumOrNull(p.value),
    }));
    updateMinute({ params: cleaned });
  }, [paramDraft]);

  const addParam = () => { if (canEdit) setParamDraft(d => ([...(d || []), { id: uid(), name: "", type: "prix", value: null }])); };
  const setParamField = (id, key, value) => { if (canEdit) setParamDraft(d => (d || []).map(p => p.id === id ? { ...p, [key]: value } : p)); };
  const removeParam = (id) => { if (canEdit) setParamDraft(d => (d || []).filter(p => p.id !== id)); };

  const [name, setName]   = React.useState(minute?.name || "Minute sans nom");
  const [notes, setNotes] = React.useState(minute?.notes || "");
  React.useEffect(() => {
    setName(minute?.name || "Minute sans nom");
    setNotes(minute?.notes || "");
  }, [minuteId, minute?.name, minute?.notes]);

  const saveHeader = () => {
    if (!canEdit) return;
    updateMinute({ name: name || "Minute sans nom", notes });
  };

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

  return (
    <div style={S.contentWide}>
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
            disabled={!canEdit}
          />
          <button style={S.smallBtn} onClick={saveHeader} disabled={!canEdit}>Enregistrer</button>
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
          disabled={!canEdit}
        />
      </div>

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
            <button style={S.smallBtn} onClick={addParam} disabled={!canEdit}>+ Ajouter un paramètre</button>
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
                        disabled={!canEdit}
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
                        disabled={!canEdit}
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
                        disabled={!canEdit}
                      />
                    </td>
                    <td style={{ padding: 8, textAlign: "right" }}>
                      <button
                        style={{ ...S.smallBtn, color: "#b91c1c" }}
                        onClick={() => removeParam(p.id)}
                        title="Supprimer"
                        disabled={!canEdit}
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

      <DataTable
        title="Déplacement"
        tableKey="deplacements"
        rows={depRows}
        onRowsChange={handleDepRowsChange}
        schema={CHIFFRAGE_SCHEMA_DEP}
        setSchema={() => {}}
        searchQuery=""
        viewKey="minutes_dep"
        enableCellFormulas={false}
      />

      <MinuteEditor
        minute={{ ...minute, lines: rows, modules: mods }}
        onChangeMinute={(m)=> canEdit && updateMinute({ lines: m.lines })}
        enableCellFormulas={true}
      />
    </div>
  );
}

export default ChiffrageScreen;