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
function MinuteEditor({ minute, onChangeMinute, enableCellFormulas = true, formulaCtx = EMPTY_CTX, schema = [], setSchema, targetRowId, onRowClick, readOnly = false }) {

  // --- STATE LOCAL & DEBOUNCE ---
  const [localLines, setLocalLines] = React.useState(minute?.lines || []);

  // Refs for Debounce & Safety
  const saveTimerRef = React.useRef(null);
  const pendingLinesRef = React.useRef(null); // To store data for flush
  const lastSavedCountRef = React.useRef(minute?.lines?.length || 0);

  // Sync prop -> local
  React.useEffect(() => {
    if (minute?.lines && minute.lines !== localLines) {
      if (!saveTimerRef.current) {
        setLocalLines(minute.lines);
        lastSavedCountRef.current = minute.lines.length;
      }
    }
  }, [minute?.lines]);

  // FONCTION DE SAUVEGARDE SÉCURISÉE
  const performSave = React.useCallback((newLines) => {
    if (!onChangeMinute) return;

    // 1. PROTECTION "TABLEAU VIDE"
    if (lastSavedCountRef.current > 0 && (!newLines || newLines.length === 0)) {
      console.warn("⛔️ Sauvegarde bloquée : Tentative d'écraser une minute pleine par une minute vide.");
      // On ne sauve PAS.
      return;
    }

    // 2. NETTOYAGE DES DONNÉES (Fix 400 & JSON Validity)
    // On s'assure que les données sont sérialisables et propres
    const cleanLines = newLines.map(row => {
      // Shallow copy pour éviter de muter l'état
      const clean = { ...row };

      // Sécurité : On retire les champs potentiellement problématiques pour Supabase si besoin
      // Ici on suppose que le schéma est respecté.
      // On peut forcer la sérialisation pour être sûr qu'il n'y a pas de fonctions/Symboles
      return clean;
    });

    // Appel Parent (Supabase)
    onChangeMinute({ ...minute, lines: cleanLines, updatedAt: Date.now() });

    // Update ref
    lastSavedCountRef.current = cleanLines.length;
    pendingLinesRef.current = null; // Reset pending

  }, [minute, onChangeMinute]);

  // DEBOUNCE TRIGGER
  const triggerUpdate = React.useCallback((newLines) => {
    // 1. Update UI Immediately
    setLocalLines(newLines);
    pendingLinesRef.current = newLines; // Store for flush

    // 2. Clear previous timer
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    // 3. Set new timer (1000ms)
    saveTimerRef.current = setTimeout(() => {
      performSave(newLines);
      saveTimerRef.current = null;
    }, 1000);

  }, [performSave]);

  // FLUSH ON UNMOUNT
  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current && pendingLinesRef.current) {
        console.log("💾 Flushing pending save on unmount...");
        clearTimeout(saveTimerRef.current);
        performSave(pendingLinesRef.current);
      }
    };
  }, [performSave]);


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
    // Priority: Minute Settings > FormulaCtx Settings (which includes Global) > Defaults
    // Since formulaCtx now correctly includes Global & Defaults, we can rely on it if minute.settings is empty.
    const baseSettings = formulaCtx.settings || { taux_horaire: 135, prix_nuit: 180, prix_repas: 25 };
    const settings = { ...baseSettings, ...(minute?.settings || {}) };

    return { ...formulaCtx, settings, catalog };
  }, [minute?.settings, catalog, formulaCtx]);

  const rows = React.useMemo(() => {
    // UTILISATION DE LOCAL_LINES À LA PLACE DE MINUTE.LINES
    const rawSource = localLines || [];

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
  }, [localLines, schema, extendedCtx]); // Depend on localLines



  const handleCatalogChange = (newCatalog) => {
    setCatalog(newCatalog);
    onChangeMinute?.({ ...minute, catalog: newCatalog, updatedAt: Date.now() });
  };

  const handleSettingsChange = (newSettings) => {
    onChangeMinute?.({ ...minute, settings: newSettings, updatedAt: Date.now() });
  };

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

    // DEBOUNCED UPDATE
    triggerUpdate(withFx);
    // onChangeMinute?.({ ...minute, lines: withFx, updatedAt: Date.now() });
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

    // DEBOUNCED UPDATE
    triggerUpdate(nextRows);
    // onChangeMinute?.({ ...minute, lines: nextRows, updatedAt: Date.now() });
  }, [rows, schema, extendedCtx, minute, triggerUpdate]);

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

    // DEBOUNCED UPDATE (ou immédiat pour delete? on garde debounced pour consistance)
    triggerUpdate(nextRows);
    // onChangeMinute?.({ ...minute, lines: nextRows, updatedAt: Date.now() });

    // Clear selections
    setSelRideaux([]);
    setSelDecors([]);
    setSelStores([]);
    setSelDeplacement([]);
    setSelAutre([]);
  };

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

    triggerUpdate(newRows);
  };

  return (
    <div style={{ paddingBottom: 40 }}>

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
                minuteId={minute?.id}
                targetRowId={targetRowId}
                onRowClick={onRowClick}
                readOnly={readOnly}
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
                minuteId={minute?.id}
                targetRowId={targetRowId}
                onRowClick={onRowClick}
                readOnly={readOnly}
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
              minuteId={minute?.id}
              targetRowId={targetRowId}
              onRowClick={onRowClick}
              readOnly={readOnly}
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
              minuteId={minute?.id}
              targetRowId={targetRowId}
              onRowClick={onRowClick}
              readOnly={readOnly}
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
              minuteId={minute?.id}
              targetRowId={targetRowId}
              onRowClick={onRowClick}
              readOnly={readOnly}
            />
          </div>
        )}
      </>

      <CatalogManager
        open={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        catalog={catalog}
        onCatalogChange={handleCatalogChange}
        settings={extendedCtx.settings}
        onSettingsChange={handleSettingsChange}
      />
    </div>
  );
}

export default MinuteEditor;
