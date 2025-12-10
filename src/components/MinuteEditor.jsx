// src/components/MinuteEditor.jsx
import React from "react";
import { Grid, Box, Typography } from "@mui/material";

// composants internes
import MinuteGrid from "./MinuteGrid";
import CatalogManager from "./CatalogManager";

// constantes / helpers
import { computeFormulas } from "../lib/formulas/compute";
import { recomputeRow } from "../lib/formulas/recomputeRow";
import { COLORS, S } from "../lib/constants/ui";
import { uid } from "../lib/utils/uid";

// hooks app (si MinuteEditor les utilise ; sinon tu peux supprimer ces lignes)
import { useActivity } from "../contexts/activity";
import { useAuth } from "../auth.jsx";
import { Library } from 'lucide-react';

import { CHIFFRAGE_SCHEMA_DEP } from "../lib/schemas/deplacement";
import { EXTRA_DEPENSES_SCHEMA } from "../lib/schemas/extraDepenses";

const EMPTY_CTX = {};

// ================ MinuteEditor (tableau des lignes d'une minute) =================
function MinuteEditor({ minute, onChangeMinute, enableCellFormulas = true, formulaCtx = EMPTY_CTX, schema = [], setSchema }) {
  // STATELESS REFACTOR: Computed directly from props
  // STATELESS REFACTOR: Computed directly from props & Sanitized



  // Catalog State
  const [catalog, setCatalog] = React.useState(minute?.catalog || [
    { id: 1, name: 'Velours Royal', category: 'Tissu', buyPrice: 50, sellPrice: 120, width: 280, unit: 'ml' },
    { id: 2, name: 'Lin Naturel', category: 'Tissu', buyPrice: 30, sellPrice: 80, width: 140, unit: 'ml' },
    { id: 3, name: 'Rail DS', category: 'Tringle', buyPrice: 15, sellPrice: 45, width: 0, unit: 'ml' },
  ]);
  const [isCatalogOpen, setIsCatalogOpen] = React.useState(false);

  // Sync catalog to minute
  React.useEffect(() => {
    if (minute?.catalog && minute.catalog !== catalog) {
      // If minute has a catalog and it's different (e.g. loaded from DB), use it.
      // CAUTION: This might overwrite local changes if not handled carefully.
      // For now, we initialize from minute.catalog or default, and update minute on change.
    }
  }, [minute?.id]); // Only on load

  // Create shared context with settings
  // NOW DEPENDS on 'catalog' state to ensure recomputeRow sees the active items
  const extendedCtx = React.useMemo(() => {
    const settings = minute?.settings || { taux_horaire: 35, prix_nuit: 180, prix_repas: 25 };
    return { ...formulaCtx, settings, catalog };
  }, [minute?.settings, catalog, formulaCtx]);

  const rows = React.useMemo(() => {
    // 1. Gather all rows (already aggregating in parent, but safe to check)
    // Actually ChiffrageScreen already sends aggregated 'lines' in minute.lines
    const rawSource = minute?.lines || [];

    // 2. Identify potential schema targets AND deduplicate IDs
    const seenIds = new Set();

    return rawSource.map(row => {
      // Determine schema for recompute
      let targetSchema = schema;
      const p = row.produit;
      if (p === 'Autre Dépense') targetSchema = EXTRA_DEPENSES_SCHEMA;
      else if (p === 'Déplacement') targetSchema = CHIFFRAGE_SCHEMA_DEP;

      // Ensure valid ID & Deduplicate
      let safeId = row.id;
      if (!safeId || seenIds.has(safeId)) {
        safeId = uid(); // Regenerate if missing or duplicate
      }
      seenIds.add(safeId);

      const uniqueRow = { ...row, id: safeId };
      return recomputeRow(uniqueRow, targetSchema, extendedCtx);
    });
  }, [minute?.lines, schema, extendedCtx]);



  const handleCatalogChange = (newCatalog) => {
    setCatalog(newCatalog);
    onChangeMinute?.({ ...minute, catalog: newCatalog, updatedAt: Date.now() });
  };

  const handleSettingsChange = (newSettings) => {
    onChangeMinute?.({ ...minute, settings: newSettings, updatedAt: Date.now() });
  };

  // Note: Resync useEffect removed (Stateless)


  // Modules actifs (fallback = tous cochés pour anciennes minutes)
  const mods = minute?.modules || { rideau: true, store: true, decor: true };

  // Sous-ensembles par module
  const rowsRideaux = rows.filter((r) => /rideau|voilage/i.test(String(r.produit || "")));
  const rowsDecors = rows.filter((r) => /d[ée]cor/i.test(String(r.produit || "")));
  const rowsStores = rows.filter((r) => /store/i.test(String(r.produit || "")));

  // Nouveaux sous-ensembles
  const rowsDeplacement = rows.filter((r) => String(r.produit || "") === "Déplacement");
  const rowsAutre = rows.filter((r) => String(r.produit || "") === "Autre Dépense");

  // Id unique via l'utilitaire importé
  const genId = () => uid();

  // Produit par défaut cohérent selon le tableau courant
  const ensureProduitFor = (key, r) => {
    if (r?.produit) return r;
    if (key === "rideaux") return { ...r, produit: "Rideau" };
    if (key === "decors") return { ...r, produit: "Décor de lit" };
    if (key === "stores") return { ...r, produit: "Store Enrouleur" };
    if (key === "deplacement") return { ...r, produit: "Déplacement" };
    if (key === "autre") return { ...r, produit: "Autre Dépense" };
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
      if (key === "decors") return /d[ée]cor/i.test(p);
      if (key === "stores") return /store/i.test(p);
      if (key === "deplacement") return p === "Déplacement";
      if (key === "autre") return p === "Autre Dépense";
      return false;
    };
    const others = (rows || []).filter((r) => !isInSubset(r));

    // Determine strict schema for this subset to avoid cross-pollution of formulas
    // (e.g. preventing 'prix_total' formula from main schema applying to extraDepenses)
    let targetSchema = schema;
    if (key === 'autre') targetSchema = EXTRA_DEPENSES_SCHEMA;
    else if (key === 'deplacement') targetSchema = CHIFFRAGE_SCHEMA_DEP;

    // Fusion + recalcul des formules
    const next = [...others, ...normalizedChild];
    const withFx = next.map((row) => recomputeRow(row, targetSchema, extendedCtx));

    // Stateless Update
    onChangeMinute?.({ ...minute, lines: withFx, updatedAt: Date.now() });
  };

  // Ajout d'une nouvelle ligne
  const handleAddRow = React.useCallback((key) => {
    const newRow = {
      id: genId(),
      produit: key === "rideaux" ? "Rideau" :
        key === "decors" ? "Décor de lit" :
          key === "stores" ? "Store Enrouleur" :
            key === "deplacement" ? "Déplacement" : "Autre Dépense",
      // Valeurs par défaut pour éviter les vides
      quantite: 1,
      largeur: 0,
      hauteur: 0,
    };

    // Calculate new state
    // 1. Determine target schema
    let targetSchema = schema;
    if (key === 'autre') targetSchema = EXTRA_DEPENSES_SCHEMA;
    else if (key === 'deplacement') targetSchema = CHIFFRAGE_SCHEMA_DEP;

    // 2. Recompute the new row immediately
    const computedRow = recomputeRow(newRow, targetSchema, extendedCtx);
    const nextRows = [...rows, computedRow];

    // Stateless Update
    onChangeMinute?.({ ...minute, lines: nextRows, updatedAt: Date.now() });
  }, [rows, schema, extendedCtx, minute, onChangeMinute]);

  // États de sélection pour chaque grille
  const [selRideaux, setSelRideaux] = React.useState([]);
  const [selDecors, setSelDecors] = React.useState([]);
  const [selStores, setSelStores] = React.useState([]);
  const [selDeplacement, setSelDeplacement] = React.useState([]);
  const [selAutre, setSelAutre] = React.useState([]);

  // Suppression de lignes
  const handleDeleteRows = (idsToDelete) => {
    if (!idsToDelete || idsToDelete.length === 0) return;
    if (!confirm(`Supprimer ${idsToDelete.length} ligne(s) ?`)) return;

    const nextRows = rows.filter(r => !idsToDelete.includes(r.id));

    // Stateless Update
    onChangeMinute?.({ ...minute, lines: nextRows, updatedAt: Date.now() });

    // Clear selections
    setSelRideaux([]);
    setSelDecors([]);
    setSelStores([]);
    setSelDeplacement([]);
    setSelAutre([]);
  };

  // Remonte au parent à chaque modif
  // React.useEffect(() => {
  //   onChangeMinute?.({ ...minute, lines: rows, updatedAt: Date.now() });
  // }, [rows]);

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

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => setIsCatalogOpen(true)}
            style={{ cursor: 'pointer', padding: '6px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Library size={16} /> Bibliothèque
          </button>

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
      </div>

      {/* 1/2/3 tableaux selon modules */}
      <>
        {/* --- NOUVEAUX TABLEAUX : Autres Dépenses & Déplacement (EN HAUT) --- */}
        <div style={{ display: 'flex', flexDirection: 'row', gap: 20, width: '100%', marginBottom: 20, overflow: 'hidden' }}>
          {/* Tableau Autres Dépenses */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ width: '100%', overflowX: 'auto', paddingBottom: 1, border: `1px solid ${COLORS.border}`, borderRadius: 2 }}>
              <div style={{ minWidth: 600 }}> {/* Force scroll if < 600px */}
                <MinuteGrid
                  title="Autres Dépenses"
                  rows={rowsAutre}
                  onRowsChange={mergeChildRowsFor("autre")}
                  schema={EXTRA_DEPENSES_SCHEMA}
                  enableCellFormulas={enableCellFormulas}
                  formulaCtx={extendedCtx}
                  onAdd={React.useCallback(() => handleAddRow("autre"), [handleAddRow])}
                  onDelete={() => handleDeleteRows(selAutre)}
                  rowSelectionModel={selAutre}
                  onRowSelectionModelChange={setSelAutre}
                  catalog={catalog}
                />
              </div>
            </Box>
          </div>

          {/* Tableau Déplacement */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ width: '100%', overflowX: 'auto', paddingBottom: 1, border: `1px solid ${COLORS.border}`, borderRadius: 2 }}>
              <div style={{ minWidth: 600 }}> {/* Force scroll if < 600px */}
                <MinuteGrid
                  title="Déplacements & Logistique"
                  rows={rowsDeplacement}
                  onRowsChange={mergeChildRowsFor("deplacement")}
                  schema={CHIFFRAGE_SCHEMA_DEP}
                  enableCellFormulas={enableCellFormulas}
                  formulaCtx={extendedCtx}
                  onAdd={React.useCallback(() => handleAddRow("deplacement"), [handleAddRow])}
                  onDelete={() => handleDeleteRows(selDeplacement)}
                  rowSelectionModel={selDeplacement}
                  onRowSelectionModelChange={setSelDeplacement}
                  catalog={catalog}
                />
              </div>
            </Box>
          </div>
        </div>

        {mods.rideau && (
          <Box sx={{ mb: 4 }}>
            <Box sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', pb: 1 }}>
              <Typography variant="h5" component="h2" color="primary" sx={{ fontWeight: 600 }}>
                Rideaux
              </Typography>
            </Box>
            <MinuteGrid
              title="" // Title moved to header
              rows={rowsRideaux}
              onRowsChange={mergeChildRowsFor("rideaux")}
              schema={schema}
              enableCellFormulas={enableCellFormulas}
              formulaCtx={extendedCtx}
              onAdd={React.useCallback(() => handleAddRow("rideaux"), [handleAddRow])}
              onDelete={() => handleDeleteRows(selRideaux)}
              rowSelectionModel={selRideaux}
              onRowSelectionModelChange={setSelRideaux}
              catalog={catalog}
            />
          </Box>
        )}

        {mods.decor && (
          <Box sx={{ mb: 4 }}>
            <Box sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', pb: 1 }}>
              <Typography variant="h5" component="h2" color="primary" sx={{ fontWeight: 600 }}>
                Décors de lit
              </Typography>
            </Box>
            <MinuteGrid
              title=""
              rows={rowsDecors}
              onRowsChange={mergeChildRowsFor("decors")}
              schema={schema}
              enableCellFormulas={enableCellFormulas}
              formulaCtx={extendedCtx}
              onAdd={React.useCallback(() => handleAddRow("decors"), [handleAddRow])}
              onDelete={() => handleDeleteRows(selDecors)}
              rowSelectionModel={selDecors}
              onRowSelectionModelChange={setSelDecors}
              catalog={catalog}
            />
          </Box>
        )}

        {mods.store && (
          <Box sx={{ mb: 4 }}>
            <Box sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', pb: 1 }}>
              <Typography variant="h5" component="h2" color="primary" sx={{ fontWeight: 600 }}>
                Stores
              </Typography>
            </Box>
            <MinuteGrid
              title=""
              rows={rowsStores}
              onRowsChange={mergeChildRowsFor("stores")}
              schema={schema}
              enableCellFormulas={enableCellFormulas}
              formulaCtx={extendedCtx}
              onAdd={React.useCallback(() => handleAddRow("stores"), [handleAddRow])}
              onDelete={() => handleDeleteRows(selStores)}
              rowSelectionModel={selStores}
              onRowSelectionModelChange={setSelStores}
              catalog={catalog}
            />
          </Box>
        )}


      </>

      <CatalogManager
        open={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        catalog={catalog}
        onCatalogChange={handleCatalogChange}
        settings={minute?.settings || { taux_horaire: 35, prix_nuit: 180, prix_repas: 25 }}
        onSettingsChange={handleSettingsChange}
      />
    </div>
  );
}

export default MinuteEditor;
