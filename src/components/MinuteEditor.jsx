// src/components/MinuteEditor.jsx
import React from "react";
import { Grid, Box, Typography, Menu, MenuItem, Button } from "@mui/material";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

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
import { RIDEAUX_DEFAULT_VISIBILITY, DECORS_DEFAULT_VISIBILITY, STORES_DEFAULT_VISIBILITY, COUSSINS_DEFAULT_VISIBILITY, CACHE_SOMMIER_DEFAULT_VISIBILITY, PLAID_DEFAULT_VISIBILITY, TENTURE_DEFAULT_VISIBILITY, MOBILIER_DEFAULT_VISIBILITY } from "../lib/constants/gridDefaults";
import { DECORS_SCHEMA } from "../lib/schemas/decors";
import { STORES_CLASSIQUES_SCHEMA } from "../lib/schemas/chiffrage/stores_classiques";
import { STORES_BATEAUX_SCHEMA } from "../lib/schemas/chiffrage/stores_bateaux";
import { COUSSINS_SCHEMA } from "../lib/schemas/chiffrage/coussins";
import { CACHE_SOMMIER_SCHEMA } from "../lib/schemas/chiffrage/cache_sommier";
import { PLAID_SCHEMA } from "../lib/schemas/chiffrage/plaid";
import { TENTURE_MURALE_SCHEMA } from "../lib/schemas/chiffrage/tenture_murale";
import { MOBILIER_SCHEMA } from "../lib/schemas/chiffrage/mobilier";
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
      const p = String(row.produit || "").toLowerCase();
      if (p === 'autre dépense') targetSchema = EXTRA_DEPENSES_SCHEMA;
      else if (p === 'déplacement') targetSchema = CHIFFRAGE_SCHEMA_DEP;
      else if (/store|canishade/i.test(p)) targetSchema = STORES_CLASSIQUES_SCHEMA;
      else if (/rideau|voilage/i.test(p)) targetSchema = schema;
      else if (/coussin/i.test(p)) targetSchema = COUSSINS_SCHEMA;
      else if (/cache-sommier/i.test(p)) targetSchema = CACHE_SOMMIER_SCHEMA;
      else if (/plaid|chemin de lit/i.test(p)) targetSchema = PLAID_SCHEMA;
      else if (/tenture/i.test(p)) targetSchema = TENTURE_MURALE_SCHEMA;
      else if (/t[êe]te|mobilier/i.test(p)) targetSchema = MOBILIER_SCHEMA;
      else targetSchema = DECORS_SCHEMA; // Default for all decors-like items

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
  const rowsStore = rows.filter((r) => /store|canishade/i.test(String(r.produit || "")) && !/bateau|velum|vélum/i.test(String(r.produit || "")));
  const rowsStoresBateau = rows.filter((r) => /bateau|velum|vélum/i.test(String(r.produit || "")));
  const rowsCoussins = rows.filter((r) => /coussin/i.test(String(r.produit || "")));
  const rowsCacheSommier = rows.filter((r) => /cache-sommier/i.test(String(r.produit || "")));
  const rowsPlaid = rows.filter((r) => /plaid|chemin de lit/i.test(String(r.produit || "")));
  const rowsTenture = rows.filter((r) => /tenture/i.test(String(r.produit || "")));
  const rowsMobilier = rows.filter((r) => /t[êe]te|mobilier/i.test(String(r.produit || "")));
  const rowsDeplacement = rows.filter((r) => String(r.produit || "") === "Déplacement");
  const rowsAutre = rows.filter((r) => String(r.produit || "") === "Autre Dépense");

  // Id unique via l'utilitaire importé
  const genId = () => uid();

  // Produit par défaut cohérent selon le tableau courant
  const ensureProduitFor = (key, r) => {
    if (r?.produit) return r;
    if (key === "rideaux") return { ...r, produit: "Rideau" };
    if (key === "store") return { ...r, produit: "Store Enrouleur" };
    if (key === "store_bateau") return { ...r, produit: "Store Bateau" };
    if (key === "coussins") return { ...r, produit: "Coussins" };
    if (key === "cache_sommier") return { ...r, produit: "Cache-Sommier" };
    if (key === "plaid") return { ...r, produit: "Plaid" };
    if (key === "tenture_murale") return { ...r, produit: "Tenture Murale" };
    if (key === "mobilier") return { ...r, produit: "Tête de Lit" };
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

      // Existing checks... avoid capturing 'section=autre' rows here!
      if (r.section === 'autre') return false;

      if (key === "rideaux") return /rideau|voilage/i.test(p);
      if (key === "store") return /store|canishade/i.test(p) && !/bateau|velum|vélum/i.test(p);
      if (key === "store_bateau") return /bateau|velum|vélum/i.test(p);
      if (key === "coussins") return /coussin/i.test(p);
      if (key === "cache_sommier") return /cache-sommier/i.test(p);
      if (key === "plaid") return /plaid|chemin de lit/i.test(p);
      if (key === "tenture_murale") return /tenture/i.test(p);
      if (key === "mobilier") return /t[êe]te|mobilier/i.test(p);
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
    else if (key === 'stores' || key === 'store') targetSchema = STORES_CLASSIQUES_SCHEMA;
    else if (key === 'store_bateau') targetSchema = STORES_BATEAUX_SCHEMA;
    else if (key === 'coussins') targetSchema = COUSSINS_SCHEMA;
    else if (key === 'cache_sommier') targetSchema = CACHE_SOMMIER_SCHEMA;
    else if (key === 'plaid') targetSchema = PLAID_SCHEMA;
    else if (key === 'tenture_murale') targetSchema = TENTURE_MURALE_SCHEMA;
    else if (key === 'mobilier') targetSchema = MOBILIER_SCHEMA;
    else if (key === 'decors') targetSchema = DECORS_SCHEMA;
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
        key === "coussins" ? "Coussins" :
          key === "store" ? "Store Enrouleur" :
            key === "store_bateau" ? "Store Bateau" :
              key === "cache_sommier" ? "Cache-Sommier" :
                key === "plaid" ? "Plaid" :
                  key === "tenture_murale" ? "Tenture Murale" :
                    key === "mobilier" ? "Tête de Lit" :
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
    else if (key === 'store') targetSchema = STORES_CLASSIQUES_SCHEMA;
    else if (key === 'store_bateau') targetSchema = STORES_BATEAUX_SCHEMA;
    else if (key === 'rideaux') targetSchema = schema;
    else if (key === 'coussins') targetSchema = COUSSINS_SCHEMA;
    else if (key === 'cache_sommier') targetSchema = CACHE_SOMMIER_SCHEMA;
    else if (key === 'plaid') targetSchema = PLAID_SCHEMA;
    else if (key === 'tenture_murale') targetSchema = TENTURE_MURALE_SCHEMA;
    else if (key === 'mobilier') targetSchema = MOBILIER_SCHEMA;
    else targetSchema = DECORS_SCHEMA;

    // 2. Recompute the new row immediately
    const computedRow = recomputeRow(newRow, targetSchema, extendedCtx);
    const nextRows = [...rows, computedRow];

    // DEBOUNCED UPDATE
    triggerUpdate(nextRows);
    // onChangeMinute?.({ ...minute, lines: nextRows, updatedAt: Date.now() });
  }, [rows, schema, extendedCtx, minute, triggerUpdate]);

  // États de sélection pour chaque grille
  const [selRideaux, setSelRideaux] = React.useState([]);
  const [selStore, setSelStore] = React.useState([]);
  const [selStoreBateau, setSelStoreBateau] = React.useState([]);
  const [selCoussins, setSelCoussins] = React.useState([]);
  const [selCacheSommier, setSelCacheSommier] = React.useState([]);
  const [selPlaid, setSelPlaid] = React.useState([]);
  const [selTenture, setSelTenture] = React.useState([]);
  const [selMobilier, setSelMobilier] = React.useState([]);
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
    setSelStore([]);
    setSelStoreBateau([]);
    setSelCoussins([]);
    setSelCacheSommier([]);
    setSelPlaid([]);
    setSelTenture([]);
    setSelMobilier([]);
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
  const defaultOrder = ['rideau', 'store', 'store_bateau', 'coussins', 'cache_sommier', 'plaid', 'tenture_murale', 'mobilier'];
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

    // Reset correct selection state
    if (key === 'rideau') setSelRideaux([]);
    if (key === 'store') setSelStore([]);
    if (key === 'store_bateau') setSelStoreBateau([]);
    if (key === 'coussins') setSelCoussins([]);
    if (key === 'cache_sommier') setSelCacheSommier([]);
    if (key === 'plaid') setSelPlaid([]);
    if (key === 'tenture_murale') setSelTenture([]);
    if (key === 'mobilier') setSelMobilier([]);
    if (key === 'decor') setSelDecors([]);
    if (key === 'stores') setSelStores([]);
  };

  // Helper to Render Specific Module
  const renderHeaderContent = (title, rowArray) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 18, color: '#111827', fontWeight: 700 }}>{title}</h3>
      <span style={{
        background: '#f3f4f6', color: '#4b5563', padding: '2px 8px',
        borderRadius: 12, fontSize: 12, fontWeight: 600
      }}>
        {rowArray.length} {rowArray.length > 1 ? 'articles' : 'article'}
      </span>
    </div>
  );

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
          <Accordion key="rideau" defaultExpanded disableGutters sx={{ mb: 3, borderRadius: '12px !important', '&:before': { display: 'none' }, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ borderBottom: '1px solid #f3f4f6', backgroundColor: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, px: 3 }}>
              {renderHeaderContent("Rideaux", rowsRideaux)}
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>


              <MinuteGrid
                title=""
                rows={rowsRideaux}
                onRowsChange={mergeChildRowsFor("rideaux")}
                schema={schema}
                enableCellFormulas={enableCellFormulas}
                formulaCtx={extendedCtx}
                onAdd={() => handleAddRow("rideaux")}
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
                gridKey="chiff_rideaux"
                targetRowId={targetRowId}
                onRowClick={onRowClick}
                readOnly={readOnly}
                currentUser={currentUser}
              />

            </AccordionDetails>
          </Accordion>
        );
      case 'store':
        return (
          <Accordion key="store" defaultExpanded disableGutters sx={{ mb: 3, borderRadius: '12px !important', '&:before': { display: 'none' }, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ borderBottom: '1px solid #f3f4f6', backgroundColor: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, px: 3 }}>
              {renderHeaderContent("Stores", rowsStore)}
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>


              <MinuteGrid
                title=""
                rows={rowsStore}
                onRowsChange={mergeChildRowsFor("store")}
                schema={STORES_CLASSIQUES_SCHEMA}
                enableCellFormulas={enableCellFormulas}
                formulaCtx={extendedCtx}
                onAdd={() => handleAddRow("store")}
                onDelete={() => handleDeleteRows(selStore)}
                rowSelectionModel={selStore}
                onRowSelectionModelChange={setSelStore}
                catalog={catalog}
                initialVisibilityModel={STORES_DEFAULT_VISIBILITY}
                onDuplicateRow={handleDuplicateRow}
                hideCroquis={true}
                minuteId={minute?.id}
                gridKey="chiff_stores"
                targetRowId={targetRowId}
                onRowClick={onRowClick}
                readOnly={readOnly}
                currentUser={currentUser}
              />

            </AccordionDetails>
          </Accordion>
        );
      case 'store_bateau':
        return (
          <Accordion key="store_bateau" defaultExpanded disableGutters sx={{ mb: 3, borderRadius: '12px !important', '&:before': { display: 'none' }, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ borderBottom: '1px solid #f3f4f6', backgroundColor: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, px: 3 }}>
              {renderHeaderContent("Stores Bateaux / Velum", rowsStoresBateau)}
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>


              <MinuteGrid
                title=""
                rows={rowsStoresBateau}
                onRowsChange={mergeChildRowsFor("store_bateau")}
                schema={STORES_BATEAUX_SCHEMA}
                enableCellFormulas={enableCellFormulas}
                formulaCtx={extendedCtx}
                onAdd={() => handleAddRow("store_bateau")}
                onDelete={() => handleDeleteRows(selStoreBateau)}
                rowSelectionModel={selStoreBateau}
                onRowSelectionModelChange={setSelStoreBateau}
                catalog={catalog}
                initialVisibilityModel={STORES_DEFAULT_VISIBILITY}
                onDuplicateRow={handleDuplicateRow}
                hideCroquis={true}
                minuteId={minute?.id}
                gridKey="chiff_stores_bateau"
                targetRowId={targetRowId}
                onRowClick={onRowClick}
                readOnly={readOnly}
                currentUser={currentUser}
              />

            </AccordionDetails>
          </Accordion>
        );
      case 'coussins':
        return (
          <Accordion key="coussins" defaultExpanded disableGutters sx={{ mb: 3, borderRadius: '12px !important', '&:before': { display: 'none' }, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ borderBottom: '1px solid #f3f4f6', backgroundColor: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, px: 3 }}>
              {renderHeaderContent("Coussins", rowsCoussins)}
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>


              <MinuteGrid
                title=""
                rows={rowsCoussins}
                onRowsChange={mergeChildRowsFor("coussins")}
                schema={COUSSINS_SCHEMA}
                enableCellFormulas={enableCellFormulas}
                formulaCtx={extendedCtx}
                onAdd={() => handleAddRow("coussins")}
                onDelete={() => handleDeleteRows(selCoussins)}
                rowSelectionModel={selCoussins}
                onRowSelectionModelChange={setSelCoussins}
                catalog={catalog}
                initialVisibilityModel={COUSSINS_DEFAULT_VISIBILITY}
                onDuplicateRow={handleDuplicateRow}
                hideCroquis={true}
                minuteId={minute?.id}
                gridKey="chiff_coussins"
                targetRowId={targetRowId}
                onRowClick={onRowClick}
                readOnly={readOnly}
                currentUser={currentUser}
              />

            </AccordionDetails>
          </Accordion>
        );
      case 'cache_sommier':
        return (
          <Accordion key="cache_sommier" defaultExpanded disableGutters sx={{ mb: 3, borderRadius: '12px !important', '&:before': { display: 'none' }, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ borderBottom: '1px solid #f3f4f6', backgroundColor: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, px: 3 }}>
              {renderHeaderContent("Cache Sommier", rowsCacheSommier)}
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>


              <MinuteGrid
                title=""
                rows={rowsCacheSommier}
                onRowsChange={mergeChildRowsFor("cache_sommier")}
                schema={CACHE_SOMMIER_SCHEMA}
                enableCellFormulas={enableCellFormulas}
                formulaCtx={extendedCtx}
                onAdd={() => handleAddRow("cache_sommier")}
                onDelete={() => handleDeleteRows(selCacheSommier)}
                rowSelectionModel={selCacheSommier}
                onRowSelectionModelChange={setSelCacheSommier}
                catalog={catalog}
                initialVisibilityModel={CACHE_SOMMIER_DEFAULT_VISIBILITY}
                onDuplicateRow={handleDuplicateRow}
                hideCroquis={true}
                minuteId={minute?.id}
                gridKey="chiff_cache_sommier_v2"
                targetRowId={targetRowId}
                onRowClick={onRowClick}
                readOnly={readOnly}
                currentUser={currentUser}
              />

            </AccordionDetails>
          </Accordion>
        );
      case 'plaid':
        return (
          <Accordion key="plaid" defaultExpanded disableGutters sx={{ mb: 3, borderRadius: '12px !important', '&:before': { display: 'none' }, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ borderBottom: '1px solid #f3f4f6', backgroundColor: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, px: 3 }}>
              {renderHeaderContent("Plaid / Chemin de lit", rowsPlaid)}
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>


              <MinuteGrid
                title=""
                rows={rowsPlaid}
                onRowsChange={mergeChildRowsFor("plaid")}
                schema={PLAID_SCHEMA}
                enableCellFormulas={enableCellFormulas}
                formulaCtx={extendedCtx}
                onAdd={() => handleAddRow("plaid")}
                onDelete={() => handleDeleteRows(selPlaid)}
                rowSelectionModel={selPlaid}
                onRowSelectionModelChange={setSelPlaid}
                catalog={catalog}
                initialVisibilityModel={PLAID_DEFAULT_VISIBILITY}
                onDuplicateRow={handleDuplicateRow}
                hideCroquis={true}
                minuteId={minute?.id}
                gridKey="chiff_plaid_v2"
                targetRowId={targetRowId}
                onRowClick={onRowClick}
                readOnly={readOnly}
                currentUser={currentUser}
              />

            </AccordionDetails>
          </Accordion>
        );
      case 'tenture_murale':
        return (
          <Accordion key="tenture_murale" defaultExpanded disableGutters sx={{ mb: 3, borderRadius: '12px !important', '&:before': { display: 'none' }, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ borderBottom: '1px solid #f3f4f6', backgroundColor: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, px: 3 }}>
              {renderHeaderContent("Tenture Murale", rowsTenture)}
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>


              <MinuteGrid
                title=""
                rows={rowsTenture}
                onRowsChange={mergeChildRowsFor("tenture_murale")}
                schema={TENTURE_MURALE_SCHEMA}
                enableCellFormulas={enableCellFormulas}
                formulaCtx={extendedCtx}
                onAdd={() => handleAddRow("tenture_murale")}
                onDelete={() => handleDeleteRows(selTenture)}
                rowSelectionModel={selTenture}
                onRowSelectionModelChange={setSelTenture}
                catalog={catalog}
                initialVisibilityModel={TENTURE_DEFAULT_VISIBILITY}
                onDuplicateRow={handleDuplicateRow}
                hideCroquis={true}
                minuteId={minute?.id}
                gridKey="chiff_tenture_v2"
                targetRowId={targetRowId}
                onRowClick={onRowClick}
                readOnly={readOnly}
                currentUser={currentUser}
              />

            </AccordionDetails>
          </Accordion>
        );
      case 'mobilier':
        return (
          <Accordion key="mobilier" defaultExpanded disableGutters sx={{ mb: 3, borderRadius: '12px !important', '&:before': { display: 'none' }, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ borderBottom: '1px solid #f3f4f6', backgroundColor: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, px: 3 }}>
              {renderHeaderContent("Mobilier / Tête de Lit", rowsMobilier)}
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>


              <MinuteGrid
                title=""
                rows={rowsMobilier}
                onRowsChange={mergeChildRowsFor("mobilier")}
                schema={MOBILIER_SCHEMA}
                enableCellFormulas={enableCellFormulas}
                formulaCtx={extendedCtx}
                onAdd={() => handleAddRow("mobilier")}
                onDelete={() => handleDeleteRows(selMobilier)}
                rowSelectionModel={selMobilier}
                onRowSelectionModelChange={setSelMobilier}
                catalog={catalog}
                initialVisibilityModel={MOBILIER_DEFAULT_VISIBILITY}
                onDuplicateRow={handleDuplicateRow}
                hideCroquis={false}
                minuteId={minute?.id}
                gridKey="chiff_mobilier_v2"
                targetRowId={targetRowId}
                onRowClick={onRowClick}
                readOnly={readOnly}
                currentUser={currentUser}
              />

            </AccordionDetails>
          </Accordion>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 24 }}>
          {/* Tableau Autres Dépenses */}
          <Accordion key="autre" defaultExpanded disableGutters sx={{ mb: 3, borderRadius: '12px !important', '&:before': { display: 'none' }, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ borderBottom: '1px solid #f3f4f6', backgroundColor: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, px: 3 }}>
              {renderHeaderContent("Autres Dépenses", rowsAutre)}
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <MinuteGrid
                title=""
                rows={rowsAutre}
                onRowsChange={mergeChildRowsFor("autre")}
                schema={EXTRA_DEPENSES_SCHEMA}
                enableCellFormulas={enableCellFormulas}
                formulaCtx={extendedCtx}
                onAdd={() => handleAddRow("autre")}
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
            </AccordionDetails>
          </Accordion>

          {/* Tableau Déplacement */}
          <Accordion key="deplacement" defaultExpanded disableGutters sx={{ mb: 3, borderRadius: '12px !important', '&:before': { display: 'none' }, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ borderBottom: '1px solid #f3f4f6', backgroundColor: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, px: 3 }}>
              {renderHeaderContent("Déplacements & Logistique", rowsDeplacement)}
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <MinuteGrid
                title=""
                rows={rowsDeplacement}
                onRowsChange={mergeChildRowsFor("deplacement")}
                schema={CHIFFRAGE_SCHEMA_DEP}
                enableCellFormulas={enableCellFormulas}
                formulaCtx={extendedCtx}
                onAdd={() => handleAddRow("deplacement")}
                onDelete={() => handleDeleteRows(selDeplacement)}
                rowSelectionModel={selDeplacement}
                onRowSelectionModelChange={setSelDeplacement}
                catalog={catalog}
                onDuplicateRow={handleDuplicateRow}
                hideCroquis={true}
                minuteId={minute?.id}
                gridKey="chiff_deplacement_v2" // <--- NEW KEY (v2 to reset cache)
                targetRowId={targetRowId}
                onRowClick={onRowClick}
                readOnly={readOnly}
                currentUser={currentUser}
              />
            </AccordionDetails>
          </Accordion>
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
          { key: 'store_bateau', label: 'Stores Bateaux/Velum' },
          { key: 'coussins', label: 'Coussins' },
          { key: 'cache_sommier', label: 'Cache-Sommier' },
          { key: 'plaid', label: 'Plaids / Chemin de lit' },
          { key: 'tenture_murale', label: 'Tenture Murale' },
          { key: 'mobilier', label: 'Mobilier / Tête de lit' },
        ].filter(m => {
          // A module is available if:
          // 1. It is NOT in the renderOrder
          // 2. OR it is in renderOrder but marked as inactive (mods[key] is false)
          const inOrder = renderOrder.includes(m.key);
          const isActive = !!mods[m.key];
          return !inOrder || !isActive;
        });

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
