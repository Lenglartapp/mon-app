// src/components/MinuteEditor.jsx
import React from "react";
import { Grid, Box, Typography, Menu, MenuItem, Button } from "@mui/material";

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
import { Library, Plus, Trash2 } from 'lucide-react';

import { CHIFFRAGE_SCHEMA_DEP } from "../lib/schemas/deplacement";
import { EXTRA_DEPENSES_SCHEMA } from "../lib/schemas/extraDepenses";
import { RIDEAUX_DEFAULT_VISIBILITY, DECORS_DEFAULT_VISIBILITY, STORES_DEFAULT_VISIBILITY } from "../lib/constants/gridDefaults";
import { DECORS_SCHEMA } from "../lib/schemas/decors";
import { STORES_SCHEMA } from "../lib/schemas/stores";
import { AUTRES_SCHEMA } from "../lib/schemas/autres";
import { parseRideauxImport } from '../utils/importRideaux';

// ... (imports remain)




const EMPTY_CTX = {};

// ================ MinuteEditor (tableau des lignes d'une minute) =================
function MinuteEditor({ minute, onChangeMinute, enableCellFormulas = true, formulaCtx = EMPTY_CTX, schema = [], setSchema, targetRowId, onRowClick, readOnly = false, currentUser }) {

  // --- STATE LOCAL & DEBOUNCE ---
  const [localLines, setLocalLines] = React.useState(minute?.lines || []);
  const [moduleMenuAnchor, setModuleMenuAnchor] = React.useState(null);

  const mods = minute?.modules || { rideau: true, store: true, decor: true };

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
  // Sync catalog to minute (UPDATED FROM PARENT)
  React.useEffect(() => {
    // When parent updates minute.catalog (e.g. from CatalogManager), update local state
    if (minute?.catalog && minute.catalog !== catalog) {
      console.warn("🔥 MinuteEditor SYNC: New catalog received!", minute.catalog);
      setCatalog(minute.catalog);
    } else {
      console.log("MinuteEditor: No sync needed. m.cat:", !!minute?.catalog, "local:", catalog.length);
      if (catalog.length > 0) {
        console.log("DATA INSPECTION:", JSON.stringify(catalog.map(i => ({ name: i.name, unit: i.unit, cat: i.category })), null, 2));
      }
    }
  }, [minute?.catalog, catalog]);

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
      if (row.section === 'autre') targetSchema = AUTRES_SCHEMA;
      else if (p === 'Autre Dépense') targetSchema = EXTRA_DEPENSES_SCHEMA;
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



  // Sous-ensembles par module
  const rowsRideaux = rows.filter((r) => /rideau|voilage/i.test(String(r.produit || "")));
  // Updated Decors filter to include new types
  const rowsDecors = rows.filter((r) => /d[ée]cor|coussin|plaid|t[êe]te|tenture|cache/i.test(String(r.produit || "")));
  const rowsStores = rows.filter((r) => /store/i.test(String(r.produit || "")));

  // Nouveaux sous-ensembles
  // "Autre Confection" -> use 'section' property primarily to avoid confusion with "Autre Dépense"
  // If section is missing (legacy), we rely on nothing? No, legacy rows won't be here.
  const rowsAutreConfection = rows.filter(r => r.section === 'autre');

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
    if (key === "autre_confection") return { ...r, produit: "", section: 'autre' };
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
      // Priority check for Section='autre' (new module)
      if (key === 'autre_confection') return r.section === 'autre';

      const p = String(r.produit || "");

      // Existing checks... avoid capturing 'section=autre' rows here!
      if (r.section === 'autre') return false;

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
    else if (key === 'autre_confection') targetSchema = AUTRES_SCHEMA;

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
            key === "deplacement" ? "Déplacement" :
              key === "autre_confection" ? "" : "Autre Dépense",
      section: key === "autre_confection" ? 'autre' : undefined, // TAG SECTION
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
    else if (key === 'autre_confection') targetSchema = AUTRES_SCHEMA;

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
  const [selAutreConfection, setSelAutreConfection] = React.useState([]);

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

  // Determine Render Order (Persisted or Default)
  const defaultOrder = ['rideau', 'decor', 'store', 'autre_confection'];
  const renderOrder = Array.isArray(mods.order) ? mods.order : defaultOrder;

  // Helper to remove a module
  const handleRemoveModule = (key, label, rowsToDelete) => {
    if (!confirm(`Voulez-vous vraiment supprimer le module "${label}" ?\n${rowsToDelete.length} ligne(s) seront supprimées.`)) return;

    // 1. Remove rows
    const idsToDelete = new Set(rowsToDelete.map(r => r.id));
    const newLines = (minute?.lines || []).filter(r => !idsToDelete.has(r.id));

    // 2. Update modules (active=false, remove from order)
    const currentOrder = Array.isArray(mods.order) ? mods.order : defaultOrder;
    const newOrder = currentOrder.filter(k => k !== key);

    // 3. Trigger Update
    onChangeMinute?.({
      ...minute,
      lines: newLines,
      modules: { ...mods, [key]: false, order: newOrder },
      updatedAt: Date.now()
    });
  };

  // Helper to Render Specific Module
  const renderModule = (key) => {
    // Common Header Renderer
    const renderHeader = (label, rowsForModule) => (
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#374151', textTransform: 'uppercase' }}>{label}</div>
        <Button
          color="error"
          size="small"
          onClick={() => handleRemoveModule(key, label, rowsForModule)}
          sx={{ minWidth: 0, padding: 1 }}
        >
          <Trash2 size={18} />
        </Button>
      </div>
    );

    switch (key) {
      case 'rideau':
        return (
          <div key="rideau" style={{ ...S.modernCard, padding: 0, marginBottom: 24 }}>
            {renderHeader("Rideaux", rowsRideaux)}
            <MinuteGrid
              title=""
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
              gridKey="chiff_rideaux" // <--- NEW KEY
              targetRowId={targetRowId}
              onRowClick={onRowClick}
              readOnly={readOnly}
              currentUser={currentUser}
            />
          </div>
        );
      case 'decor':
        return (
          <div key="decor" style={{ ...S.modernCard, padding: 0, marginBottom: 24 }}>
            {renderHeader("Décors de lit", rowsDecors)}
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
              gridKey="chiff_decors" // <--- NEW KEY
              targetRowId={targetRowId}
              onRowClick={onRowClick}
              readOnly={readOnly}
              currentUser={currentUser}
            />
          </div>
        );
      case 'store':
        return (
          <div key="store" style={{ ...S.modernCard, padding: 0, marginBottom: 24 }}>
            {renderHeader("Stores", rowsStores)}
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
              gridKey="chiff_stores" // <--- NEW KEY
              targetRowId={targetRowId}
              onRowClick={onRowClick}
              readOnly={readOnly}
              currentUser={currentUser}
            />
          </div>
        );
      case 'autre_confection':
        return (
          <div key="autre_confection" style={{ ...S.modernCard, padding: 0, marginBottom: 24 }}>
            {renderHeader("AUTRE / SUR-MESURE", rowsAutreConfection)}
            <MinuteGrid
              title=""
              rows={rowsAutreConfection}
              onRowsChange={mergeChildRowsFor("autre_confection")}
              schema={AUTRES_SCHEMA}
              enableCellFormulas={enableCellFormulas}
              formulaCtx={extendedCtx}
              onAdd={React.useCallback(() => handleAddRow("autre_confection"), [handleAddRow])}
              onDelete={() => handleDeleteRows(selAutreConfection)}
              rowSelectionModel={selAutreConfection}
              onRowSelectionModelChange={setSelAutreConfection}
              catalog={catalog}
              initialVisibilityModel={{ st_conf_pa: false, st_conf_pv: false, st_pose_pa: false, st_pose_pv: false }}
              onDuplicateRow={handleDuplicateRow}
              hideCroquis={true}
              minuteId={minute?.id}
              gridKey="chiff_autre_confection" // <--- NEW KEY
              targetRowId={targetRowId}
              onRowClick={onRowClick}
              readOnly={readOnly}
              currentUser={currentUser}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ paddingBottom: 40 }}>

      {/* 1/2/3 tableaux selon modules */}
      <>
        {/* --- NOUVEAUX TABLEAUX : Autres Dépenses & Déplacement (EN HAUT, FIXES) --- */}
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
                gridKey="chiff_autres" // <--- NEW KEY
                targetRowId={targetRowId}
                onRowClick={onRowClick}
                readOnly={readOnly}
                currentUser={currentUser}
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
                gridKey="chiff_deplacement" // <--- NEW KEY
                targetRowId={targetRowId}
                onRowClick={onRowClick}
                readOnly={readOnly}
                currentUser={currentUser}
              />
            </div>
          </div>
        </div>

        {/* --- MODULES DYNAMIQUES --- */}
        {renderOrder.map(key => {
          // Render only if active
          if (!mods[key]) return null;
          return renderModule(key);
        })}
      </>

      {/* --- ADD MODULE BUTTON --- */}
      {(() => {
        const availableModules = [
          { key: 'rideau', label: 'Rideaux' },
          { key: 'store', label: 'Stores' },
          { key: 'decor', label: 'Décors de lit' },
          { key: 'autre_confection', label: 'Autre / Sur-mesure' },
        ].filter(m => !mods[m.key]);

        if (availableModules.length === 0 || readOnly) return null;

        return (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24, marginBottom: 24 }}>
            <Button
              variant="outlined"
              startIcon={<Plus size={18} />}
              onClick={(e) => setModuleMenuAnchor(e.currentTarget)}
              sx={{
                borderRadius: 8,
                textTransform: 'none',
                fontWeight: 600,
                borderColor: '#E5E7EB',
                color: '#374151',
                bgcolor: 'white',
                '&:hover': { bgcolor: '#F9FAFB', borderColor: '#D1D5DB' }
              }}
            >
              Ajouter un module
            </Button>
            <Menu
              anchorEl={moduleMenuAnchor}
              open={Boolean(moduleMenuAnchor)}
              onClose={() => setModuleMenuAnchor(null)}
            >
              {availableModules.map((m) => (
                <MenuItem key={m.key} onClick={() => {
                  // APPEND to order
                  const currentOrder = Array.isArray(mods.order) ? mods.order : defaultOrder;
                  // Remove the added key if it somehow exists (just in case), then append
                  const cleanOrder = currentOrder.filter(k => k !== m.key);
                  const newOrder = [...cleanOrder, m.key];

                  onChangeMinute?.({
                    ...minute,
                    modules: { ...mods, [m.key]: true, order: newOrder },
                    updatedAt: Date.now()
                  });
                  setModuleMenuAnchor(null);
                }}>
                  {m.label}
                </MenuItem>
              ))}
            </Menu>
          </div>
        );
      })()}

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
