// src/components/MinuteEditor.jsx
import React from "react";

// composants internes
import DataTable from "./DataTable";

// constantes / helpers
import { computeFormulas } from "../lib/formulas/compute";
import { recomputeRow } from "../lib/formulas/recomputeRow";
import { COLORS, S } from "../lib/constants/ui";
import { uid } from "../lib/utils/uid";

// hooks app (si MinuteEditor les utilise ; sinon tu peux supprimer ces lignes)
import { useActivity } from "../contexts/activity";
import { useAuth } from "../auth.jsx";

const EMPTY_CTX = {};

// ================ MinuteEditor (tableau des lignes d'une minute) =================
function MinuteEditor({ minute, onChangeMinute, enableCellFormulas = true, formulaCtx = EMPTY_CTX, schema = [], setSchema }) {
  const [rows, setRows] = React.useState(() =>
    computeFormulas(minute?.lines || [], schema, formulaCtx)
  );

  // Ignorer une resync quand la modif vient d'ici
  const skipNextSyncRef = React.useRef(false);

  // Resync UNIQUEMENT quand on change de minute (id).
  React.useEffect(() => {
    setRows(computeFormulas(minute?.lines || [], schema, formulaCtx));
  }, [minute?.id, schema, formulaCtx]);

  // Modules actifs (fallback = tous cochés pour anciennes minutes)
  const mods = minute?.modules || { rideau: true, store: true, decor: true };

  // Sous-ensembles par module
  const rowsRideaux = rows.filter((r) => /rideau|voilage/i.test(String(r.produit || "")));
  const rowsDecors  = rows.filter((r) => /d[ée]cor/i.test(String(r.produit || "")));
  const rowsStores  = rows.filter((r) => /store/i.test(String(r.produit || "")));

  // Id unique via l'utilitaire importé
  const genId = () => uid();

  // Produit par défaut cohérent selon le tableau courant
  const ensureProduitFor = (key, r) => {
    if (r?.produit) return r;
    if (key === "rideaux") return { ...r, produit: "Rideau" };
    if (key === "decors")  return { ...r, produit: "Décor de lit" };
    if (key === "stores")  return { ...r, produit: "Store Enrouleur" };
    return r;
  };

  // S'assure que chaque ligne a un id
  const withIds = (arr) =>
    (Array.isArray(arr) ? arr : []).map((r) => (r?.id ? r : { ...r, id: genId() }));

  // Réinjecte TOUT le sous-tableau (ajouts + edits) dans rows
  const mergeChildRowsFor = (key) => (childRows) => {
    // Normalise la sous-liste reçue du DataTable :
    const normalizedChild = withIds((childRows || []).map((r) => ensureProduitFor(key, r)));

    // Garder uniquement les lignes des AUTRES sous-ensembles
    const isInSubset = (r) => {
      const p = String(r.produit || "");
      if (key === "rideaux") return /rideau|voilage/i.test(p);
      if (key === "decors")  return /d[ée]cor/i.test(p);
      if (key === "stores")  return /store/i.test(p);
      return false;
    };
    const others = (rows || []).filter((r) => !isInSubset(r));

    // Fusion + recalcul des formules
    const next = [...others, ...normalizedChild];
    const withFx = next.map((row) => recomputeRow(row, schema, formulaCtx));

    // Commit local (remontée au parent se fait via l'useEffect plus bas)
    skipNextSyncRef.current = true;
    setRows(withFx);
  };

  // Remonte au parent à chaque modif
  React.useEffect(() => {
    onChangeMinute?.({ ...minute, lines: rows, updatedAt: Date.now() });
  }, [rows]);

  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden" }}>
      {/* En-tête de l’éditeur (nom, version, statut, infos) */}
      <div
        style={{
          padding: 10,
          borderBottom: `1px solid ${COLORS.border}`,
          background: "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <b>{minute?.name || "Minute sans nom"}</b>
            <span style={{ opacity: 0.6 }}>v{minute?.version ?? 1}</span>
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
            Chargé·e : <b>{minute?.owner || "—"}</b>
            {" · "}Créé le {new Date(minute?.createdAt || Date.now()).toLocaleDateString("fr-FR")}
            {" · "}Modules :
            {minute?.modules?.rideau && " Rideaux"}
            {minute?.modules?.store && " · Stores"}
            {minute?.modules?.decor && " · Décors de lit"}
          </div>
          {minute?.notes && (
            <div style={{ fontSize: 12, color: "#334155", marginTop: 6, whiteSpace: "pre-wrap" }}>
              {minute.notes}
            </div>
          )}
        </div>

        <select
          value={minute?.status || "Non commencé"}
          onChange={(e) =>
            onChangeMinute?.({ ...minute, status: e.target.value, updatedAt: Date.now() })
          }
          style={{
            fontSize: 12,
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            background: "white",
          }}
        >
          <option>Non commencé</option>
          <option>En cours d’étude</option>
          <option>À valider</option>
          <option>Validé</option>
        </select>
      </div>

      {/* 1/2/3 tableaux selon modules */}
      <>
        {mods.rideau && (
          <DataTable
            title="Rideaux"
            tableKey="rideaux"
            rows={rowsRideaux}
            onRowsChange={mergeChildRowsFor("rideaux")}
            schema={schema}
            setSchema={setSchema}
            searchQuery=""
            viewKey="minutes"
            enableCellFormulas={enableCellFormulas}
            formulaCtx={formulaCtx}
          />
      )}

        {mods.decor && (
          <DataTable
            title="Décors de lit"
            tableKey="decors"
            rows={rowsDecors}
            onRowsChange={mergeChildRowsFor("decors")}
            schema={schema}
            setSchema={setSchema}
            searchQuery=""
            viewKey="minutes"
            enableCellFormulas={enableCellFormulas}
            formulaCtx={formulaCtx}
          />
      )}

        {mods.store && (
          <DataTable
            title="Stores"
            tableKey="stores"
            rows={rowsStores}
            onRowsChange={mergeChildRowsFor("stores")}
            schema={schema}
            setSchema={setSchema}
            searchQuery=""
            viewKey="minutes"
            enableCellFormulas={enableCellFormulas}
            formulaCtx={formulaCtx}
          />
      )}
      </>
    </div>
  );
}

export default MinuteEditor;
