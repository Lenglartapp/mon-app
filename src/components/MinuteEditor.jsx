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
import { RIDEAUX_DEFAULT_VISIBILITY, DECORS_DEFAULT_VISIBILITY, STORES_DEFAULT_VISIBILITY } from "../lib/constants/gridDefaults";
import { DECORS_SCHEMA } from "../lib/schemas/decors";
import { STORES_SCHEMA } from "../lib/schemas/stores";
import { parseRideauxImport } from '../utils/importRideaux';


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
      // Handle Decors specific schema
      else if (/d[ée]cor|coussin|plaid|t[êe]te|tenture|cache/i.test(p)) targetSchema = DECORS_SCHEMA;
      // Handle Stores specific schema
      else if (/store|canishade/i.test(p)) targetSchema = STORES_SCHEMA;

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
  // Updated Decors filter to include new types
  const rowsDecors = rows.filter((r) => /d[ée]cor|coussin|plaid|t[êe]te|tenture|cache/i.test(String(r.produit || "")));
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
    if (key === "decors") return { ...r, produit: "Coussins" }; // Default to Coussins
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
      if (key === "decors") return /d[ée]cor|coussin|plaid|t[êe]te|tenture|cache/i.test(p);
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
    else if (key === 'decors') targetSchema = DECORS_SCHEMA;
    else if (key === 'stores') targetSchema = STORES_SCHEMA;

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
        key === "decors" ? "Coussins" : // Default to Coussins
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
    else if (key === 'decors') targetSchema = DECORS_SCHEMA;
    else if (key === 'stores') targetSchema = STORES_SCHEMA;

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

  // Extract Rail Options from Catalog for Dropdown
  const railOptions = React.useMemo(() => {
    return catalog.filter(item => item.category === 'Rail').map(item => item.name);
  }, [catalog]);

  // Import Excel Handler
  const handleImportExcel = async (file) => {
    try {
      const importedRows = await parseRideauxImport(file, schema, extendedCtx, catalog);
      if (!importedRows || importedRows.length === 0) {
        alert("Aucune donnée valide trouvée dans le fichier.");
        return;
      }

      const newRideauxRows = [...rowsRideaux, ...importedRows];
      mergeChildRowsFor("rideaux")(newRideauxRows);

      alert(`${importedRows.length} ligne(s) importée(s) avec succès !`);

    } catch (e) {
      console.error("Erreur import Excel", e);
      alert("Erreur lors de l'import Excel: " + e.message);
    }
  };

  const handleDuplicateRow = (id) => {
    const index = rows.findIndex(r => r.id === id);
    if (index === -1) return;

    const source = rows[index];
    const newRow = {
      ...source,
      id: genId(),
      piece: source.piece ? `${source.piece} (Copie)` : source.piece,
      // Shallow copy arrays if they exist to avoid ref sharing
      comments: source.comments ? [...source.comments] : []
    };

    const newRows = [...rows];
    newRows.splice(index + 1, 0, newRow);

    onChangeMinute?.({ ...minute, lines: newRows, updatedAt: Date.now() });
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* En-tête de l’éditeur (nom, version, statut, infos) */}
      <div
        style={{
          ...S.modernCard,
          padding: '16px 20px',
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 24
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <b style={{ fontSize: 18 }}>{minute?.name || "Minute sans nom"}</b>
            <span style={{ opacity: 0.6, fontSize: 13, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>v{minute?.version ?? 1}</span>
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            Chargé·e : <b>{minute?.owner || "—"}</b>
            {" · "}Créé le {new Date(minute?.createdAt || Date.now()).toLocaleDateString("fr-FR")}
          </div>
          {minute?.notes && (
            <div style={{ fontSize: 13, color: "#374151", marginTop: 8, whiteSpace: "pre-wrap", background: '#f9fafb', padding: 8, borderRadius: 6 }}>
              {minute.notes}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={() => setIsCatalogOpen(true)}
            style={{ cursor: 'pointer', padding: '8px 14px', background: '#10b981', color: 'white', border: 'none', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}
          >
            <Library size={16} /> Bibliothèque
          </button>

          <select
            value={minute?.status || "Non commencé"}
            onChange={(e) =>
              onChangeMinute?.({ ...minute, status: e.target.value, updatedAt: Date.now() })
            }
            style={{
              fontSize: 13,
              padding: "8px 12px",
              borderRadius: 8,
              border: `1px solid ${COLORS.border}`,
              background: "white",
              fontWeight: 500
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          {/* Tableau Autres Dépenses */}
          <div style={{ ...S.modernCard, padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${COLORS.border}` }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', textTransform: 'uppercase' }}>Autres Dépenses</div>
            </div>
            <div style={{ padding: 0 }}>
              <MinuteGrid
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
                onDuplicateRow={handleDuplicateRow}
                hideCroquis={true}
              />
            </div>
          </div>

          {/* Tableau Déplacement */}
          <div style={{ ...S.modernCard, padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${COLORS.border}` }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', textTransform: 'uppercase' }}>Déplacements & Logistique</div>
            </div>
            <div style={{ padding: 0 }}>
              <MinuteGrid
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
                onDuplicateRow={handleDuplicateRow}
                hideCroquis={true}
              />
            </div>
          </div>
        </div>



        {mods.rideau && (
          <div style={{ ...S.modernCard, padding: 0, marginBottom: 24 }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${COLORS.border}` }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#374151', textTransform: 'uppercase' }}>Rideaux</div>
            </div>
            <MinuteGrid
              title="" // Title in custom header
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
              railOptions={railOptions}
              initialVisibilityModel={RIDEAUX_DEFAULT_VISIBILITY}
              onImportExcel={handleImportExcel}
              onDuplicateRow={handleDuplicateRow}
              hideCroquis={true}
            />
          </div>
        )}

        {mods.decor && (
          <div style={{ ...S.modernCard, padding: 0, marginBottom: 24 }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${COLORS.border}` }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#374151', textTransform: 'uppercase' }}>Décors de lit</div>
            </div>
            <MinuteGrid
              title=""
              rows={rowsDecors}
              onRowsChange={mergeChildRowsFor("decors")}
              schema={DECORS_SCHEMA}
              enableCellFormulas={enableCellFormulas}
              formulaCtx={extendedCtx}
              onAdd={React.useCallback(() => handleAddRow("decors"), [handleAddRow])}
              onDelete={() => handleDeleteRows(selDecors)}
              rowSelectionModel={selDecors}
              onRowSelectionModelChange={setSelDecors}
              catalog={catalog}
              initialVisibilityModel={DECORS_DEFAULT_VISIBILITY}
              onDuplicateRow={handleDuplicateRow}
              hideCroquis={true}
            />
          </div>
        )}

        {mods.store && (
          <div style={{ ...S.modernCard, padding: 0, marginBottom: 24 }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${COLORS.border}` }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#374151', textTransform: 'uppercase' }}>Stores</div>
            </div>
            <MinuteGrid
              title=""
              rows={rowsStores}
              onRowsChange={mergeChildRowsFor("stores")}
              schema={STORES_SCHEMA}
              enableCellFormulas={enableCellFormulas}
              formulaCtx={extendedCtx}
              onAdd={React.useCallback(() => handleAddRow("stores"), [handleAddRow])}
              onDelete={() => handleDeleteRows(selStores)}
              rowSelectionModel={selStores}
              onRowSelectionModelChange={setSelStores}
              catalog={catalog}
              initialVisibilityModel={STORES_DEFAULT_VISIBILITY}
              onDuplicateRow={handleDuplicateRow}
              hideCroquis={true}
            />
          </div>
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
