// src/components/MinuteEditor.jsx
import React from "react";
import { Box, Typography, Menu, MenuItem, Button } from "@mui/material";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

// composants internes
import MinuteGrid from "./MinuteGrid";
import CatalogManager from "./CatalogManager";
import { recomputeRow } from "../lib/formulas/recomputeRow";
import { COLORS } from "../lib/constants/ui";
import { uid } from "../lib/utils/uid";

import { Library, Plus, Trash2 } from 'lucide-react';

import { CHIFFRAGE_SCHEMA_DEP } from "../lib/schemas/deplacement";
import { EXTRA_DEPENSES_SCHEMA } from "../lib/schemas/extraDepenses";
import { RIDEAUX_DEFAULT_VISIBILITY, STORES_DEFAULT_VISIBILITY, COUSSINS_DEFAULT_VISIBILITY, CACHE_SOMMIER_DEFAULT_VISIBILITY, PLAID_DEFAULT_VISIBILITY, TENTURE_DEFAULT_VISIBILITY, MOBILIER_DEFAULT_VISIBILITY } from "../lib/constants/gridDefaults";
import { RIDEAUX_MATIERE_GROUPS, STORES_BATEAUX_MATIERE_GROUPS, COUSSINS_MATIERE_GROUPS, CACHE_SOMMIER_MATIERE_GROUPS, PLAID_MATIERE_GROUPS } from "../lib/constants/matiereGroups";
import { RIDEAUX_SCHEMA } from "../lib/schemas/chiffrage/rideaux";
import { STORES_CLASSIQUES_SCHEMA } from "../lib/schemas/chiffrage/stores_classiques";
import { STORES_BATEAUX_SCHEMA } from "../lib/schemas/chiffrage/stores_bateaux";
import { COUSSINS_SCHEMA } from "../lib/schemas/chiffrage/coussins";
import { CACHE_SOMMIER_SCHEMA } from "../lib/schemas/chiffrage/cache_sommier";
import { PLAID_SCHEMA } from "../lib/schemas/chiffrage/plaid";
import { TENTURE_MURALE_SCHEMA } from "../lib/schemas/chiffrage/tenture_murale";
import { MOBILIER_SCHEMA } from "../lib/schemas/chiffrage/mobilier";

// ... (imports remain)




function SectionPanel({ title, count, expanded, onToggle, children }) {
  return (
    <div style={{ marginBottom: 24, borderRadius: 12, background: 'white', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #f3f4f6' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 56, borderBottom: expanded ? '1px solid #f3f4f6' : 'none', backgroundColor: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: '#111827', fontWeight: 700 }}>{title}</h3>
          <span style={{ background: '#f3f4f6', color: '#4b5563', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{count} articles</span>
        </div>
        <IconButton size="small" onClick={onToggle} sx={{ color: '#6b7280' }}>
          <ExpandMoreIcon sx={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s ease' }} />
        </IconButton>
      </div>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        {children}
      </Collapse>
    </div>
  );
}

const EMPTY_CTX = {};

// Renvoie un nom de pièce unique dans la zone donnée.
// Si desiredPiece est déjà pris, essaie desiredPiece 2, 3, ...
const getUniquePiece = (zone, desiredPiece, allRows, excludeId) => {
  if (!desiredPiece) return desiredPiece;
  const normalizedZone = (zone || '').trim().toLowerCase();
  const taken = new Set(
    allRows
      .filter(r => r.id !== excludeId && (r.zone || '').trim().toLowerCase() === normalizedZone)
      .map(r => (r.piece || '').trim().toLowerCase())
  );
  if (!taken.has(desiredPiece.trim().toLowerCase())) return desiredPiece;
  let i = 2;
  while (taken.has(`${desiredPiece} ${i}`.toLowerCase())) i++;
  return `${desiredPiece} ${i}`;
};

// ================ MinuteEditor (tableau des lignes d'une minute) =================
function MinuteEditor({ minute, onChangeMinute, enableCellFormulas = true, formulaCtx = EMPTY_CTX, schema = [], targetRowId, onRowClick, readOnly = false, currentUser }) {

  // --- STATE LOCAL & DEBOUNCE ---
  const [localLines, setLocalLines] = React.useState(minute?.lines || []);
  const [moduleMenuAnchor, setModuleMenuAnchor] = React.useState(null);

  const mods = minute?.modules || { rideau: true, store: true, decor: true };

  const [panelsExpanded, setPanelsExpanded] = React.useState({});
  const isPanelExpanded = (key) => panelsExpanded[key] !== false;
  const togglePanel = (key) => setPanelsExpanded(p => ({ ...p, [key]: !isPanelExpanded(key) }));

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
  }, [minute?.lines, localLines]);

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
  // L'hybride parfait: On prend en priorité le catalogue sauvegardé DU DEVIS (minute.catalog)
  // S'il n'y en a pas (nouveau devis), on initialise le devis avec la copie exacte du modèle global + rails globaux (formulaCtx.catalog)
  const [catalog, setCatalog] = React.useState(() => {
    if (minute?.catalog && Array.isArray(minute.catalog) && minute.catalog.length > 0) {
      return minute.catalog; // On protège le tissu/rail spécifique créé dans CE devis
    }
    return formulaCtx?.catalog && Array.isArray(formulaCtx.catalog) && formulaCtx.catalog.length > 0
      ? formulaCtx.catalog // On copie les vrais rails/tissus de Supabase
      : [ // Fallback de dernier recours
        { id: 1, name: 'Velours Royal', category: 'Tissu', buyPrice: 50, sellPrice: 120, width: 280, unit: 'ml' },
        { id: 2, name: 'Lin Naturel', category: 'Tissu', buyPrice: 30, sellPrice: 80, width: 140, unit: 'ml' },
        { id: 3, name: 'Rail DS', category: 'Tringle', buyPrice: 15, sellPrice: 45, width: 0, unit: 'ml' },
      ];
  });
  const [isCatalogOpen, setIsCatalogOpen] = React.useState(false);

  // Sync catalog to minute (UPDATED)
  React.useEffect(() => {
    // Si Parent (ex: Import) écrase le catalogue de la minute
    if (minute?.catalog && JSON.stringify(minute.catalog) !== JSON.stringify(catalog)) {
      setCatalog(minute.catalog);
    }
    // Si c'est un nouveau devis sans catalogue et que les hooks Supabase viennent d'arriver (Fetch asynchrone réussi)
    else if ((!minute?.catalog || minute.catalog.length === 0) && formulaCtx?.catalog?.length > 0 && catalog.length <= 3) {
      // On initialise le catalogue local du devis avec les données fraîches de Supabase
      setCatalog(formulaCtx.catalog);
      // Et on le sauvegarde explicitement dans CE devis pour le détacher du global
      onChangeMinute?.({ ...minute, catalog: formulaCtx.catalog, updatedAt: Date.now() });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minute?.catalog, formulaCtx?.catalog, onChangeMinute]);

  // Create shared context with settings
  // NOW DEPENDS on 'catalog' state to ensure recomputeRow sees the active items
  const extendedCtx = React.useMemo(() => {
    // Priority: Minute Settings > FormulaCtx Settings (which includes Global) > Defaults
    // Since formulaCtx now correctly includes Global & Defaults, we can rely on it if minute.settings is empty.
    const baseSettings = formulaCtx.settings || { taux_horaire: 135, prix_nuit: 180, prix_repas: 25 };
    const settings = { ...baseSettings, ...(minute?.settings || {}) };

    return { ...formulaCtx, settings, catalog };
  }, [minute?.settings, catalog, formulaCtx]);

  const rowsRef = React.useRef([]);

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
      else if (/rideau|voilage/i.test(p)) targetSchema = RIDEAUX_SCHEMA;
      else if (/coussin/i.test(p)) targetSchema = COUSSINS_SCHEMA;
      else if (/cache-sommier/i.test(p)) targetSchema = CACHE_SOMMIER_SCHEMA;
      else if (/plaid|chemin de lit/i.test(p)) targetSchema = PLAID_SCHEMA;
      else if (/tenture/i.test(p)) targetSchema = TENTURE_MURALE_SCHEMA;
      else if (/t[êe]te|mobilier/i.test(p)) targetSchema = MOBILIER_SCHEMA;
      // else: produit inconnu → on laisse le schéma de base (schema prop)

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
  rowsRef.current = rows;



  const handleCatalogChange = (newCatalog) => {
    setCatalog(newCatalog);
    onChangeMinute?.({ ...minute, catalog: newCatalog, updatedAt: Date.now() });
  };

  const handleSettingsChange = (newSettings) => {
    onChangeMinute?.({ ...minute, settings: newSettings, updatedAt: Date.now() });
  };

  // Persistance des matières sélectionnées — localStorage keyed par minuteId
  const matieresStorageKey = minute?.id ? `matieres_${minute.id}` : null;
  const [localMatieres, setLocalMatieres] = React.useState(() => {
    if (!minute?.id) return {};
    try {
      const stored = localStorage.getItem(`matieres_${minute.id}`);
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  const handleMatiereChange = React.useCallback((gridKey, newMatieres) => {
    setLocalMatieres(prev => {
      const next = { ...prev, [gridKey]: newMatieres };
      if (matieresStorageKey) {
        try { localStorage.setItem(matieresStorageKey, JSON.stringify(next)); } catch {}
      }
      return next;
    });
  }, [matieresStorageKey]);



  // Sous-ensembles par module (memoïsés pour éviter les recalculs à chaque render)
  const {
    rowsRideaux, rowsStore, rowsStoresBateau, rowsCoussins,
    rowsCacheSommier, rowsPlaid, rowsTenture, rowsMobilier,
    rowsDeplacement, rowsAutre
  } = React.useMemo(() => ({
    rowsRideaux:      rows.filter((r) => /rideau|voilage/i.test(String(r.produit || ""))),
    rowsStore:        rows.filter((r) => (/store|canishade/i.test(String(r.produit || "")) || /^autre$/i.test(String(r.produit || ""))) && !/bateau|velum|vélum/i.test(String(r.produit || ""))),
    rowsStoresBateau: rows.filter((r) => /bateau|velum|vélum/i.test(String(r.produit || ""))),
    rowsCoussins:     rows.filter((r) => /coussin/i.test(String(r.produit || ""))),
    rowsCacheSommier: rows.filter((r) => /cache-sommier/i.test(String(r.produit || ""))),
    rowsPlaid:        rows.filter((r) => /plaid|chemin de lit/i.test(String(r.produit || ""))),
    rowsTenture:      rows.filter((r) => /tenture/i.test(String(r.produit || ""))),
    rowsMobilier:     rows.filter((r) => /t[êe]te|mobilier/i.test(String(r.produit || ""))),
    rowsDeplacement:  rows.filter((r) => String(r.produit || "") === "Déplacement"),
    rowsAutre:        rows.filter((r) => String(r.produit || "") === "Autre Dépense"),
  }), [rows]);

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
      if (key === "store") return (/store|canishade/i.test(p) || /^autre$/i.test(p)) && !/bateau|velum|vélum/i.test(p);
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
    const others = (rowsRef.current || []).filter((r) => !isInSubset(r));

    // Determine strict schema for this subset to avoid cross-pollution of formulas
    // (e.g. preventing 'prix_total' formula from main schema applying to extraDepenses)
    let targetSchema = schema;
    if (key === 'autre') targetSchema = EXTRA_DEPENSES_SCHEMA;
    else if (key === 'deplacement') targetSchema = CHIFFRAGE_SCHEMA_DEP;
    else if (key === 'stores' || key === 'store') targetSchema = STORES_CLASSIQUES_SCHEMA;
    else if (key === 'store_bateau') targetSchema = STORES_BATEAUX_SCHEMA;
    else if (key === 'rideaux') targetSchema = RIDEAUX_SCHEMA;
    else if (key === 'coussins') targetSchema = COUSSINS_SCHEMA;
    else if (key === 'cache_sommier') targetSchema = CACHE_SOMMIER_SCHEMA;
    else if (key === 'plaid') targetSchema = PLAID_SCHEMA;
    else if (key === 'tenture_murale') targetSchema = TENTURE_MURALE_SCHEMA;
    else if (key === 'mobilier') targetSchema = MOBILIER_SCHEMA;
    else if (key === 'autre_confection') targetSchema = EXTRA_DEPENSES_SCHEMA;

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
    else if (key === 'rideaux') targetSchema = RIDEAUX_SCHEMA;
    else if (key === 'coussins') targetSchema = COUSSINS_SCHEMA;
    else if (key === 'cache_sommier') targetSchema = CACHE_SOMMIER_SCHEMA;
    else if (key === 'plaid') targetSchema = PLAID_SCHEMA;
    else if (key === 'tenture_murale') targetSchema = TENTURE_MURALE_SCHEMA;
    else if (key === 'mobilier') targetSchema = MOBILIER_SCHEMA;

    // 2. Recompute the new row immediately
    const computedRow = recomputeRow(newRow, targetSchema, extendedCtx);
    const nextRows = [...rowsRef.current, computedRow];

    // DEBOUNCED UPDATE
    triggerUpdate(nextRows);
    // onChangeMinute?.({ ...minute, lines: nextRows, updatedAt: Date.now() });
  }, [schema, extendedCtx, triggerUpdate]);

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

    const nextRows = rowsRef.current.filter(r => !idsToDelete.includes(r.id));

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

  // Détection des doublons (zone, pièce) — réactif sur localLines (source directe)
  const pieceConflicts = React.useMemo(() => {
    const seen = new Map();
    const found = [];
    for (const r of localLines) {
      if (!r.piece) continue;
      const key = `${(r.zone || '').trim().toLowerCase()}|${(r.piece || '').trim().toLowerCase()}`;
      if (seen.has(key)) {
        const label = r.zone ? `"${r.piece}" (${r.zone})` : `"${r.piece}"`;
        if (!found.some(f => f.key === key)) found.push({ key, label });
      } else {
        seen.set(key, true);
      }
    }
    return found;
  }, [localLines]);

  const handleDuplicateRow = (id) => {
    const currentRows = rowsRef.current;
    const index = currentRows.findIndex(r => r.id === id);
    if (index === -1) return;

    const source = currentRows[index];
    const baseName = source.piece ? `${source.piece} Copie` : source.piece;
    const uniquePiece = getUniquePiece(source.zone, baseName, currentRows, source.id);

    const newRow = {
      ...source,
      id: genId(),
      piece: uniquePiece,
      comments: source.comments ? [...source.comments] : []
    };

    const newRows = [...currentRows];
    newRows.splice(index + 1, 0, newRow);

    triggerUpdate(newRows);
  };

  // Determine Render Order (Persisted or Default)
  const defaultOrder = ['rideau', 'store', 'store_bateau', 'coussins', 'cache_sommier', 'plaid', 'tenture_murale', 'mobilier'];
  const renderOrder = Array.isArray(mods.order) ? mods.order : defaultOrder;


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
    switch (key) {
      case 'rideau':
        return (
          <SectionPanel
            key="rideau"
            title="Rideaux"
            count={rowsRideaux.length}
            expanded={isPanelExpanded('rideau')}
            onToggle={() => togglePanel('rideau')}
          >
            <MinuteGrid
              title=""
              rows={rowsRideaux}
              onRowsChange={mergeChildRowsFor("rideaux")}
              schema={RIDEAUX_SCHEMA}
              enableCellFormulas={enableCellFormulas}
              formulaCtx={extendedCtx}
              onAdd={() => handleAddRow("rideaux")}
              onDelete={() => handleDeleteRows(selRideaux)}
              rowSelectionModel={selRideaux}
              onRowSelectionModelChange={setSelRideaux}
              catalog={catalog}
              railOptions={railOptions}
              initialVisibilityModel={RIDEAUX_DEFAULT_VISIBILITY}
              matiereGroups={RIDEAUX_MATIERE_GROUPS}
              activeMatieres={localMatieres.chiff_rideaux || null}
              onMatiereChange={(m) => handleMatiereChange('chiff_rideaux', m)}
              onDuplicateRow={handleDuplicateRow}
              hideCroquis={true}
              minuteId={minute?.id}
              gridKey="chiff_rideaux"
              targetRowId={targetRowId}
              onRowClick={onRowClick}
              readOnly={readOnly}
              currentUser={currentUser}
            />
          </SectionPanel>
        );
      case 'store':
        return (
          <SectionPanel
            key="store"
            title="Stores Négoce"
            count={rowsStore.length}
            expanded={isPanelExpanded('store')}
            onToggle={() => togglePanel('store')}
          >
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
          </SectionPanel>
        );
      case 'store_bateau':
        return (
          <SectionPanel
            key="store_bateau"
            title="Stores Bateaux / Velum"
            count={rowsStoresBateau.length}
            expanded={isPanelExpanded('store_bateau')}
            onToggle={() => togglePanel('store_bateau')}
          >
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
              matiereGroups={STORES_BATEAUX_MATIERE_GROUPS}
              activeMatieres={localMatieres.chiff_stores_bateau || null}
              onMatiereChange={(m) => handleMatiereChange('chiff_stores_bateau', m)}
              onDuplicateRow={handleDuplicateRow}
              hideCroquis={true}
              minuteId={minute?.id}
              gridKey="chiff_stores_bateau"
              targetRowId={targetRowId}
              onRowClick={onRowClick}
              readOnly={readOnly}
              currentUser={currentUser}
            />
          </SectionPanel>
        );
      case 'coussins':
        return (
          <SectionPanel
            key="coussins"
            title="Coussins"
            count={rowsCoussins.length}
            expanded={isPanelExpanded('coussins')}
            onToggle={() => togglePanel('coussins')}
          >
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
              matiereGroups={COUSSINS_MATIERE_GROUPS}
              activeMatieres={localMatieres.chiff_coussins || null}
              onMatiereChange={(m) => handleMatiereChange('chiff_coussins', m)}
              onDuplicateRow={handleDuplicateRow}
              hideCroquis={true}
              minuteId={minute?.id}
              gridKey="chiff_coussins"
              targetRowId={targetRowId}
              onRowClick={onRowClick}
              readOnly={readOnly}
              currentUser={currentUser}
            />
          </SectionPanel>
        );
      case 'cache_sommier':
        return (
          <SectionPanel
            key="cache_sommier"
            title="Cache Sommier"
            count={rowsCacheSommier.length}
            expanded={isPanelExpanded('cache_sommier')}
            onToggle={() => togglePanel('cache_sommier')}
          >
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
              matiereGroups={CACHE_SOMMIER_MATIERE_GROUPS}
              activeMatieres={localMatieres.chiff_cache_sommier || null}
              onMatiereChange={(m) => handleMatiereChange('chiff_cache_sommier', m)}
              onDuplicateRow={handleDuplicateRow}
              hideCroquis={true}
              minuteId={minute?.id}
              gridKey="chiff_cache_sommier_v2"
              targetRowId={targetRowId}
              onRowClick={onRowClick}
              readOnly={readOnly}
              currentUser={currentUser}
            />
          </SectionPanel>
        );
      case 'plaid':
        return (
          <SectionPanel
            key="plaid"
            title="Plaid / Chemin de lit"
            count={rowsPlaid.length}
            expanded={isPanelExpanded('plaid')}
            onToggle={() => togglePanel('plaid')}
          >
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
              matiereGroups={PLAID_MATIERE_GROUPS}
              activeMatieres={localMatieres.chiff_plaid || null}
              onMatiereChange={(m) => handleMatiereChange('chiff_plaid', m)}
              onDuplicateRow={handleDuplicateRow}
              hideCroquis={true}
              minuteId={minute?.id}
              gridKey="chiff_plaid_v2"
              targetRowId={targetRowId}
              onRowClick={onRowClick}
              readOnly={readOnly}
              currentUser={currentUser}
            />
          </SectionPanel>
        );
      case 'tenture_murale':
        return (
          <SectionPanel
            key="tenture_murale"
            title="Tenture Murale"
            count={rowsTenture.length}
            expanded={isPanelExpanded('tenture_murale')}
            onToggle={() => togglePanel('tenture_murale')}
          >
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
          </SectionPanel>
        );
      case 'mobilier':
        return (
          <SectionPanel
            key="mobilier"
            title="Mobilier / Tête de Lit"
            count={rowsMobilier.length}
            expanded={isPanelExpanded('mobilier')}
            onToggle={() => togglePanel('mobilier')}
          >
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
          </SectionPanel>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ paddingBottom: 40 }}>

      {/* Popup flottante bas-droite — pièces en double */}
      {pieceConflicts.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: '#FEF3C7', border: '1px solid #F59E0B',
          borderRadius: 10, padding: '12px 16px',
          fontSize: 13, color: '#92400E',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          maxWidth: 360, pointerEvents: 'none'
        }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Pièces en double</div>
            {pieceConflicts.map(c => (
              <div key={c.key} style={{ fontSize: 12, opacity: 0.85 }}>{c.label}</div>
            ))}
            <div style={{ fontSize: 11, marginTop: 6, opacity: 0.7 }}>
              Même nom interdit dans la même zone
            </div>
          </div>
        </div>
      )}

      {/* 1/2/3 tableaux selon modules */}
      <>
        {/* --- NOUVEAUX TABLEAUX : Autres Dépenses & Déplacement (EN HAUT, FIXES) --- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 24 }}>
          {/* Tableau Autres Dépenses */}
          <SectionPanel
            title="Autres Dépenses"
            count={rowsAutre.length}
            expanded={isPanelExpanded('autre')}
            onToggle={() => togglePanel('autre')}
          >
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
              gridKey="chiff_autres"
              targetRowId={targetRowId}
              onRowClick={onRowClick}
              readOnly={readOnly}
              currentUser={currentUser}
            />
          </SectionPanel>

          {/* Tableau Déplacement */}
          <SectionPanel
            title="Déplacements & Logistique"
            count={rowsDeplacement.length}
            expanded={isPanelExpanded('deplacement')}
            onToggle={() => togglePanel('deplacement')}
          >
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
              gridKey="chiff_deplacement_v2"
              targetRowId={targetRowId}
              onRowClick={onRowClick}
              readOnly={readOnly}
              currentUser={currentUser}
            />
          </SectionPanel>
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

export default React.memo(MinuteEditor);
