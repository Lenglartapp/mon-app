import React from "react";
import { useActivity } from "../contexts/activity";
import { useAuth } from "../auth";
import { COLORS, S } from "../lib/constants/ui";
import ActivitySidebar from "./ActivitySidebar.jsx";
import { normValue } from "../lib/utils/norm";

export default function RowFormModal({ row, schema, onClose, onSave, visibleKeys }) {
  const [draft, setDraft] = React.useState(row);

  // ---- hooks pour le journal d'activité ----
  const { addChange } = useActivity() || {};
  const safeAddChange = typeof addChange === "function" ? addChange : () => {};
  const { currentUser } = useAuth();

  // petite map clé->col pour accès direct
  const colsByKey = React.useMemo(
    () => Object.fromEntries(schema.map((c) => [c.key, c])),
    [schema]
  );

  const handleChange = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  // ===== Utils de comparaison / filtrage des champs loggables =====
  
  // --- Paramètres minutes (helpers) ---
const PARAM_TYPES = ["prix", "coef"];


// Parse une saisie numérique (accepte virgule)
function toNumOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
  
  const isEqual = (a, b) => normValue(a) === normValue(b);

  const isLoggableField = (col) => {
    if (!col) return false;
    if (col.readOnly) return false;
    if (col.type === "formula") return false;
    if (col.key === "id" || col.key === "detail" || col.key === "sel") return false;
    return true;
  };

  // ---- Enregistrer + logger les deltas ----
  const handleSave = () => {
    try {
      const before = row || {};
      const after = draft;
      for (const col of schema) {
        if (!isLoggableField(col)) continue;
        const k = col.key;
        const from = before[k];
        const to = after[k];
        if (!isEqual(from, to)) {
          safeAddChange(
            before.id, k, from, to,
            currentUser?.name || "Utilisateur"
          );
        }
      }
      onSave?.(after);
      onClose?.();
    } catch (e) {
      console.error("RowFormModal save error:", e);
      // on sauvegarde quand même pour ne pas bloquer l’utilisateur
      onSave?.(draft);
      onClose?.();
    }
  };

  // Rendu d’un champ (simple, sans dépendre d’InputCell)
  const renderFieldEditor = (col) => {
    const v = draft[col.key];

    if (col.type === "checkbox") {
      return (
        <input
          type="checkbox"
          checked={!!v}
          onChange={(e) => handleChange(col.key, e.target.checked)}
        />
      );
    }

    if (col.type === "number") {
      return (
        <input
          type="number"
          value={v ?? ""}
          onChange={(e) =>
            handleChange(col.key, e.target.value === "" ? "" : Number(e.target.value))
          }
          style={{ width: "100%" }}
        />
      );
    }

    if (col.type === "select") {
      const opts = (col.options || []).filter((o) =>
        o && typeof o === "object" ? o.value : o
      );
      return (
        <select
          value={v ?? ""}
          onChange={(e) => handleChange(col.key, e.target.value)}
          style={{ width: "100%" }}
        >
          <option value="">—</option>
          {opts.map((opt, i) => {
            const val = typeof opt === "object" ? opt.value : opt;
            const lab = typeof opt === "object" ? opt.label ?? opt.value : opt;
            return (
              <option key={i} value={String(val)}>
                {lab}
              </option>
            );
          })}
        </select>
      );
    }

    if (col.type === "photo") {
      const arr = Array.isArray(v) ? v : v ? [v] : [];
      const addFiles = (files) => {
        const next = [...arr];
        for (const f of files) {
          const url = URL.createObjectURL(f);
          next.push(url);
        }
        handleChange(col.key, next);
      };
      const removeAt = (i) => {
        const next = arr.filter((_, idx) => idx !== i);
        handleChange(col.key, next);
      };

      return (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {arr.map((src, i) => (
              <div
                key={i}
                style={{
                  position: "relative",
                  width: 80,
                  height: 80,
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "#eee",
                }}
              >
                <img
                  src={src}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <button
                  onClick={() => removeAt(i)}
                  title="Supprimer"
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    background: "#111827",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "2px 6px",
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <label style={{ display: "inline-block" }}>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => addFiles(e.target.files || [])}
              style={{ display: "none" }}
            />
            <span
              style={{
                padding: "6px 10px",
                border: "1px dashed #cbd5e1",
                borderRadius: 8,
                cursor: "pointer",
                background: "#f8fafc",
              }}
            >
              + Ajouter des photos
            </span>
          </label>
        </div>
      );
    }

    // default: texte
    return (
      <input
        value={v ?? ""}
        onChange={(e) => handleChange(col.key, e.target.value)}
        style={{ width: "100%" }}
      />
    );
  };

  const keys =
    visibleKeys && visibleKeys.length ? visibleKeys : schema.map((c) => c.key);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1100px, 96vw)",
          height: "min(82vh, 900px)",
          background: "#fff",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 20px 50px rgba(0,0,0,.2)",
          display: "grid",
          gridTemplateColumns: "1fr 360px",
        }}
      >
        {/* Header commun */}
        <div
          style={{
            gridColumn: "1 / -1",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid #e5e7eb",
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 900 }}>Détail de la ligne</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "#fff",
              }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #111827",
                background: "#111827",
                color: "#fff",
                fontWeight: 800,
              }}
            >
              Enregistrer
            </button>
          </div>
        </div>

        {/* Colonne gauche : formulaire éditable */}
        <div style={{ padding: 16, overflow: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "220px 1fr",
              gap: "12px 18px",
            }}
          >
            {keys.map((k) => {
              const col = colsByKey[k];
              if (!col) return null;
              return (
                <React.Fragment key={k}>
                  <div style={{ alignSelf: "center", fontWeight: 600 }}>
                    {col.label}
                  </div>
                  <div>{renderFieldEditor(col)}</div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Colonne droite : activité */}
        <ActivitySidebar row={draft} colsByKey={colsByKey} />
      </div>
    </div>
  );
}