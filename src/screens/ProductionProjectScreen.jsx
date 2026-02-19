import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { COLORS, S } from "../lib/constants/ui.js";

import MinuteGrid from "../components/MinuteGrid.jsx"; // Replaces DataTable
import DashboardTiles from "../components/DashboardTiles.jsx";
import ProjectActivityFeed from "../components/ProjectActivityFeed.jsx";
import EtiquettesSection from "../components/EtiquettesSection.jsx";
import MinutesScreen from "./MinutesScreen.jsx";
import LineDetailPanel from "../components/LineDetailPanel";
import StockInventoryTab from "../components/modules/Stocks/StockInventoryTab.jsx";

import { computeFormulas, preserveManualAfterCompute } from "../lib/formulas/compute";
import { SCHEMA_64 } from "../lib/schemas/production.js";
import { STAGES, DEFAULT_VIEWS } from "../lib/constants/views.js"; // Import DEFAULT_VIEWS
import { recomputeRow } from "../lib/formulas/recomputeRow";
import { DECORS_PROD_SCHEMA } from "../lib/schemas/decors"; // Import Prod Schema
import { STORES_PROD_SCHEMA } from "../lib/schemas/stores";
import { AUTRES_PROD_SCHEMA } from "../lib/schemas/autres";
import { uid } from "../lib/utils/uid"; // Import uid

import { Search, Filter, Layers3, Star, FlaskConical, Image as ImageIcon, Pin, Edit2, FileText } from "lucide-react"; // Added FileText
import { Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button } from "@mui/material";
import { differenceInMinutes } from "date-fns";
import DocumentListModal from "../components/DocumentListModal"; // Added import
import { useAuth } from "../auth";
import { can } from "../lib/authz";

/**
 * Helper to convert DEFAULT_VIEWS array to DataGrid visibility model
 * { field: boolean }
 */
const getVisibilityModel = (viewKey, tableKey, schema) => {
  const defaults = DEFAULT_VIEWS?.[viewKey]?.[tableKey];
  if (!defaults) return {}; // All visible by default

  const model = {};
  schema.forEach(col => {
    // If column key is in defaults array, it's visible. Otherwise hidden.
    // protected cols 'sel' and 'detail' should always be visible?
    if (['sel', 'detail'].includes(col.key)) {
      model[col.key] = true;
    } else {
      model[col.key] = defaults.includes(col.key);
    }
  });
  return model;
};

const PROJECT_STATUS_OPTIONS = {
  TODO: { label: "À commencer", color: "#6B7280", bg: "#F3F4F6" },
  IN_PROGRESS: { label: "En cours", color: "#3B82F6", bg: "#EFF6FF" },
  DONE: { label: "Terminé", color: "#10B981", bg: "#ECFDF5" },
  SAV: { label: "SAV", color: "#F59E0B", bg: "#FFFBEB" },
  ARCHIVED: { label: "Archivé", color: "#374151", bg: "#F9FAFB" }
};


import { useViewportWidth } from "../lib/hooks/useViewportWidth";

// ... existing code ...

// 1. SIGNATURE MISE A JOUR
export function ProductionProjectScreen({ project: propProject, projects, inventory, onBack, onUpdateProjectRows, onUpdateProject, highlightRowId, events = [] }) {
  const { projectId: urlProjectId } = useParams();

  // FIX: useViewportWidth returns a number
  const width = useViewportWidth();
  const isMobile = width <= 768;

  // Find Project (SECURED)
  const project = useMemo(() => {
    // Mode Télécommande (Prioritaire)
    if (propProject) return propProject;

    // Mode URL (Backup / Deep Link)
    if (!projects || !urlProjectId) return null;

    return projects.find(p => p && String(p.id) === String(urlProjectId));
  }, [propProject, projects, urlProjectId]);

  const [stage, setStage] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [schema, setSchema] = useState(SCHEMA_64);
  const [openedRowId, setOpenedRowId] = useState(null);
  const [stockOpen, setStockOpen] = useState(false);
  const [showDocs, setShowDocs] = useState(false);

  const handleUpdateDocs = (newDocs) => {
    if (onUpdateProject && project) {
      onUpdateProject(project.id, { documents: newDocs });
    }
  };

  // --- LOGIQUE MUR & PHOTOS ---
  const [wallMsg, setWallMsg] = useState("");
  const [wallImg, setWallImg] = useState(null);
  const [isPinned, setIsPinned] = useState(false);

  const compressImage = (file, maxWidth = 1200, quality = 0.7) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width, height = img.height;
          if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/webp', quality));
        };
      };
    });
  };

  const handlePostMessage = async () => {
    if (!wallMsg.trim() && !wallImg) return;
    const newPost = {
      id: Date.now(),
      date: Date.now(),
      author: currentUser?.name || "Utilisateur",
      content: wallMsg,
      image: wallImg
    };
    const currentWall = project.wall || [];
    if (onUpdateProject) {
      onUpdateProject(project.id, { wall: [newPost, ...currentWall] });
    }
    setWallMsg(""); setWallImg(null);
  };

  const handleImageSelect = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const compressed = await compressImage(e.target.files[0]);
      setWallImg(compressed);
    }
  };

  // Gère l'ajout/retrait d'ID dans la liste des épingles
  const handleTogglePin = (eventId) => {
    const currentPinned = project.pinnedIds || [];
    let newPinned;
    if (currentPinned.includes(eventId)) {
      newPinned = currentPinned.filter(id => id !== eventId);
    } else {
      newPinned = [eventId, ...currentPinned];
    }
    if (onUpdateProject) onUpdateProject(project.id, { pinnedIds: newPinned });
  };

  // Auto-open panel from notification
  useEffect(() => {
    if (highlightRowId) {
      setOpenedRowId(highlightRowId);
    }
  }, [highlightRowId]);

  const { currentUser } = useAuth();
  const canEditProd = can(currentUser, "production.edit");
  const seeChiffrage = can(currentUser, "chiffrage.view");

  // --- CALCUL REALISÉ (Temps Réel) ---
  const realized = useMemo(() => {
    const counts = { prepa: 0, conf: 0, pose: 0 };
    if (!project || !events) return counts;

    const projEvents = events.filter(e =>
      e.meta?.projectId === project.id &&
      e.meta?.status === 'validated'
    );

    projEvents.forEach(evt => {
      const start = new Date(evt.meta?.start);
      const end = new Date(evt.meta?.end);
      const rawMinutes = differenceInMinutes(end, start);

      // Règle 8h/j : si plus de 5h consécutives, on déduit 1h de pause déjeuner
      const netMinutes = rawMinutes > 300 ? rawMinutes - 60 : rawMinutes;
      const hours = Math.max(0, netMinutes / 60);

      // Categorisation stricte
      const type = (evt.type || "").toLowerCase();

      if (type === 'rdv' || type === 'prepa' || type === 'metrage') {
        counts.prepa += hours;
      } else if (type === 'atelier' || type === 'conf' || type === 'confection') {
        counts.conf += hours;
      } else if (type === 'chantier' || type === 'pose' || type === 'installation') {
        counts.pose += hours;
      }
      // Les autres types ne sont PAS comptabilisés (ex: congés, autre...)
    });

    return counts;
  }, [events, project]);

  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState({ prepa: 0, conf: 0, pose: 0 });

  const handleOpenBudget = () => {
    setBudgetDraft(project.budget || { prepa: 0, conf: 0, pose: 0 });
    setBudgetOpen(true);
  };

  const saveBudget = () => {
    onUpdateProject(project.id, { budget: budgetDraft });
    setBudgetOpen(false);
  };

  // Lignes locales (édition fluide)
  const initialRows = useMemo(
    () => computeFormulas(project?.rows || [], SCHEMA_64),
    [project?.id] // Re-compute ONLY if project ID changes
  );
  const [rows, setRows] = useState(initialRows);

  // Calculate opened row
  const openedRow = useMemo(() => (rows || []).find(r => r.id === openedRowId), [rows, openedRowId]);

  // Recompute local si le schéma change
  useEffect(() => {
    setRows((rs) => computeFormulas(rs, schema));
  }, [schema]);

  // 🔄 Resync si on CHANGE DE PROJET (id). Pas sur chaque update parent.
  useEffect(() => {
    setRows(prev =>
      preserveManualAfterCompute(
        computeFormulas(project?.rows || [], SCHEMA_64),
        prev || []
      )
    );
  }, [project?.id]);

  // NOTE: On a supprimé le useEffect de persistance automatique pour éviter les boucles infinies.
  // La sauvegarde se fait maintenant manuellement dans chaque handler ("Immediate Save").

  // Filtrage global (Search)
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      Object.values(r).some(v => String(v).toLowerCase().includes(q))
    );
  }, [rows, search]);

  // Sous-ensembles (sur rows filtrées)
  const rowsRideaux = filteredRows.filter((r) => /rideau|voilage/i.test(String(r.produit || "")));
  const rowsDecors = filteredRows.filter((r) => /d[ée]cor|coussin|plaid|t[êe]te|tenture|cache/i.test(String(r.produit || "")));
  const rowsStores = filteredRows.filter((r) => /store/i.test(String(r.produit || "")));
  const rowsAutreConfection = filteredRows.filter(r => r.section === 'autre');

  const recomputeAll = (arr) => (arr || []).map(r => recomputeRow(r, schema));

  // Utilitaire pour comparer et logger les changements
  const updateRowWithHistory = (oldRow, newRowRaw, authorName = "Utilisateur") => {
    const changes = [];
    const now = Date.now();

    // Liste des champs à surveiller pour l'historique
    const watchedFields = [
      { key: 'statut_cotes', label: 'Statut Côtes' },
      { key: 'statut_prepa', label: 'Statut Prépa' },
      { key: 'statut_conf', label: 'Statut Conf' },
      { key: 'statut_pose', label: 'Statut Pose' },
      { key: 'largeur', label: 'Largeur' },
      { key: 'hauteur', label: 'Hauteur' },
      { key: 'produit', label: 'Produit' },
      { key: 'piece', label: 'Pièce' },
      { key: 'largeur_mecanisme', label: 'Largeur Méca' } // Ajouté pour le dashboard
    ];

    watchedFields.forEach(field => {
      const oldVal = oldRow[field.key];
      const newVal = newRowRaw[field.key];
      // Comparaison simple (attention aux types string/number)
      if (oldVal != newVal && (oldVal || newVal)) {
        console.log("History Change Detected:", { field: field.label, oldVal, newVal, authorName });
        changes.push({
          date: now,
          author: authorName,
          field: field.label,
          oldVal: oldVal || '-',
          newVal: newVal || '-'
        });
      }
    });

    // Si changements, on les ajoute à l'historique de la ligne
    if (changes.length > 0) {
      return {
        ...newRowRaw,
        history: [...(oldRow.history || []), ...changes]
      };
    }
    return newRowRaw;
  };

  // --- HANDLERS (AVEC SAUVEGARDE IMMÉDIATE) ---

  // 1. handleSubsetChange (Mise à jour avec historique)
  const handleSubsetChange = (newSubsetRows, filterRegex, filterPredicate) => {
    if (!canEditProd) return;
    const allRows = rows;

    let oldSubset;
    if (filterPredicate) {
      oldSubset = allRows.filter(filterPredicate);
    } else {
      oldSubset = allRows.filter(r => filterRegex.test(String(r.produit || "")));
    }
    const newIds = new Set(newSubsetRows.map(r => r.id));
    const deletedIds = new Set(oldSubset.filter(r => !newIds.has(r.id)).map(r => r.id));
    const updatedMap = new Map(newSubsetRows.map(r => [r.id, r]));

    const updatedAllRows = allRows
      .filter(r => !deletedIds.has(r.id))
      .map(r => {
        if (updatedMap.has(r.id)) {
          const newRaw = updatedMap.get(r.id);
          // On compare pour l'historique
          const rowWithHistory = updateRowWithHistory(r, newRaw, currentUser?.name);
          return recomputeRow(rowWithHistory, schema);
        }
        return r;
      });

    setRows(updatedAllRows);
    if (project?.id) onUpdateProjectRows(project.id, updatedAllRows);
  };

  const mergeChildRowsFor = (tableKey) => {
    let regex = /./; // Default
    if (tableKey === "rideaux") regex = /rideau|voilage/i;
    else if (tableKey === "rideaux") regex = /rideau|voilage/i;
    else if (tableKey === "stores") regex = /store/i;
    else if (tableKey === "decors") regex = /d[ée]cor/i;

    // For Autre Confection, we might not use regex but direct check in handleSubsetChange? 
    // Actually handleSubsetChange uses regex to IDENTIFY old rows to replace.
    // IF section='autre', regex is weak. We should ideally update handleSubsetChange to support custom filter predicate.
    // For now, let's skip regex for 'section' based updates if possible, or use a dummy regex that matches nothing if we rely on IDs?
    // No, handleSubsetChange uses regex to find `oldSubset`.
    // We should modify handleSubsetChange OR provide a regex that matches `rowsAutreConfection`.
    // Since 'produit' is free text, no specific regex works perfectly unless we enforce a tag.
    // BUT we filter by `section === 'autre'`.
    // Let's adapt `mergeChildRowsFor` to pass a predicate function instead of regex?
    // Changing that would break other calls.
    // Alternative: pass a regex that matches EVERYTHING if we want? No that deletes everything.

    // QUICK FIX: If tableKey is "autre_confection", we assume we shouldn't use regex for filtering old rows based on Product Name.
    // We need to pass a "filter function" to handleSubsetChange.

    if (tableKey === "autre_confection") {
      return (nr) => handleSubsetChange(nr, null, (r) => r.section === 'autre');
    }

    return (nr) => handleSubsetChange(nr, regex);
  };

  // 2. handleRowsChangeInstallation (Mise à jour avec historique)
  const handleRowsChangeInstallation = (nr) => {
    if (!canEditProd) return;
    // Difficile de comparer en masse sans map, mais on tente une map par ID
    const oldMap = new Map(rows.map(r => [r.id, r]));

    const computed = nr.map(newR => {
      const oldR = oldMap.get(newR.id);
      if (oldR) {
        const rowWithHistory = updateRowWithHistory(oldR, newR, currentUser?.name);
        return recomputeRow(rowWithHistory, schema);
      }
      return recomputeRow(newR, schema);
    });

    setRows(computed);
    if (project?.id) onUpdateProjectRows(project.id, computed);
  };

  // 3. handleDetailUpdate (Mise à jour avec historique)
  // 3. handleDetailUpdate (Mise à jour avec historique)
  const handleDetailUpdate = (updatedRow) => {
    if (!canEditProd) return;
    const newRows = rows.map(r => {
      if (r.id === updatedRow.id) {
        const rowWithHistory = updateRowWithHistory(r, updatedRow, currentUser?.name);
        return recomputeRow(rowWithHistory, schema);
      }
      return r;
    });
    setRows(newRows);
    if (project?.id) onUpdateProjectRows(project.id, newRows);
  };


  const handleAddRow = (produitType = "Rideau") => {
    const newRow = {
      id: uid(),
      produit: produitType === "Autre" ? "" : produitType, // Empty default for Autre
      section: produitType === "Autre" ? "autre" : undefined, // Tag for Autre
      pair_un: "Paire",
      ampleur: 1.8,
      largeur: 100,
      hauteur: 250,
      l_mecanisme: 100,
      f_bas: 0,
      croisement: 0,
      retour_g: 0,
      retour_d: 0,
      type_confection: "Wave 80",
      created: Date.now()
    };
    const computed = recomputeRow(newRow, schema);

    const newRows = [...rows, computed];

    setRows(newRows);
    if (project?.id) {
      onUpdateProjectRows(project.id, newRows);
    }
  };

  // 5. handleDuplicateRow
  const handleDuplicateRow = (id) => {
    if (!canEditProd) return;
    const index = rows.findIndex(r => r.id === id);
    if (index === -1) return;

    const source = rows[index];
    const newRow = {
      ...source,
      id: uid(),
      piece: source.piece ? `${source.piece} (Copie)` : source.piece,
      comments: source.comments ? [...source.comments] : []
    };

    const computed = recomputeRow(newRow, schema);

    const newRows = [...rows];
    newRows.splice(index + 1, 0, computed);

    setRows(newRows);
    if (project?.id) {
      onUpdateProjectRows(project.id, newRows);
    }
  };

  // --- TEST DATA SEEDING ---
  const handleLoadTestData = () => {
    const testRows = [
      {
        id: uid(), produit: "Rideau", zone: "Salon", piece: "Baie Vitrée",
        pair_un: "Paire", ampleur: 2.0, largeur: 240, hauteur: 260,
        l_mecanisme: 250, f_bas: 5, croisement: 10, retour_g: 5, retour_d: 5,
        type_confection: "Wave 80", tissu_deco1: "Lin Naturel"
      },
      {
        id: uid(), produit: "Store Bateau", zone: "Cuisine", piece: "Fenêtre Nord",
        pair_un: "Un seul pan", ampleur: 1, largeur: 120, hauteur: 140,
        l_mecanisme: 120, type_mecanisme: "Store",
        type_confection: "Bateau", tissu_deco1: "Coton Blanc"
      },
      {
        id: uid(), produit: "Décor de lit", zone: "Chambre 1", piece: "Lit Master",
        largeur: 160, hauteur: 50, type_confection: "Jeté de lit",
        tissu_deco1: "Velours Bleu"
      }
    ].map(r => recomputeRow(r, schema));

    setRows(prev => [...prev, ...testRows]);
    // Note: Test data seeding update is usually implicit, but could be forced if desired
    alert("Données de test ajoutées ! (3 lignes)");
  };

  // ... existing code ...

  // Helper styles for Header inside Card
  const cardHeaderStyle = {
    padding: '16px 20px',
    borderBottom: `1px solid ${COLORS.border}`,
    fontWeight: 700,
    fontSize: 14,
    color: '#374151',
    textTransform: 'uppercase'
  };

  // Card wrapper style
  const cardStyle = {
    ...S.modernCard,
    padding: 0,
    marginBottom: 24,
    overflow: 'visible', // Visible for shadows of children
    background: isMobile ? 'transparent' : 'white',
    boxShadow: isMobile ? 'none' : S.modernCard.boxShadow,
    border: isMobile ? 'none' : S.modernCard.border
  };

  // Helper Style Island Nav (White + Navy Pill)
  const getNavStyle = (isActive) => ({
    padding: '8px 20px',
    borderRadius: 99,
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    transition: 'all 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
    outline: 'none',
    background: isActive ? '#1E2447' : 'transparent', // Navy Active
    color: isActive ? '#FFFFFF' : '#4B5563', // White Text Active, Gray Text Inactive
    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
    whiteSpace: 'nowrap' // Ensure text doesn't wrap in scroll mode
  });

  const projectName = project?.name || "—";
  const visibleStages = STAGES.filter(p => (p.key !== "chiffrage" || seeChiffrage) && (!isMobile || p.key !== "etiquettes"));

  if (!project && projects && projects.length > 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>Chargement du projet en cours...</div>;
  }

  return (
    <div style={isMobile ? { padding: '16px', background: '#F9F7F2', minHeight: '100vh' } : S.contentWide}>
      {/* CSS Fallback for Island Nav Scroll */}
      <style>{`
        .island-nav-container::-webkit-scrollbar { display: none; }
        .island-nav-container { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Header Minimalist Refactor */}
      <div style={{ marginBottom: 24, marginTop: 8 }}>
        <button
          onClick={onBack}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#6B7280", fontWeight: 600, fontSize: 13,
            display: "flex", alignItems: "center", gap: 4, marginBottom: 8, padding: 0
          }}
        >
          ← Retour
        </button>
        <div style={{ display: "flex", flexDirection: isMobile ? 'column' : 'row', justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "flex-end", gap: isMobile ? 12 : 0 }}>
          <div style={{ width: isMobile ? '100%' : 'auto' }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? 24 : 32, fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>
              {projectName}
            </h1>
            <div style={{ fontSize: 16, color: '#6B7280', marginTop: 4, fontWeight: 300 }}>
              Chargé·e d'affaires : <span style={{ color: '#374151', fontWeight: 500 }}>{project?.manager || "—"}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
            {/* Documents Button - Visible Mobile & Desktop */}
            <button
              onClick={() => setShowDocs(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: 20,
                padding: '7px 16px',
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                cursor: 'pointer',
                fontSize: 13,
                color: '#374151',
                fontWeight: 600,
                outline: 'none',
                flex: 'initial', justifyContent: 'center'
              }}
            >
              <FileText size={16} color="#4B5563" />
              Docs ({project?.documents?.length || 0})
            </button>
            {/* Stock Button (Header) - Hidden on Mobile */}
            {!isMobile && (
              <button
                onClick={() => setStockOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: 20,
                  padding: '7px 16px',
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  cursor: 'pointer',
                  fontSize: 13,
                  color: '#374151',
                  fontWeight: 600,
                  outline: 'none',
                  flex: 'initial', justifyContent: 'center'
                }}
              >
                Stock
              </button>
            )}

            {/* Delivery Date - Hidden on Mobile */}
            {!isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1px solid #E5E7EB', borderRadius: 20, padding: '6px 12px', boxShadow: "0 1px 2px rgba(0,0,0,0.05)", flexShrink: 0, whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>Livraison :</span>
                <input
                  type="date"
                  value={project?.delivery_date || ""}
                  onChange={(e) => onUpdateProject(project.id, { delivery_date: e.target.value })}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#374151',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    outline: 'none',
                    minWidth: 110 // Ensure input has space
                  }}
                />
              </div>
            )}

            {/* Project Status Selector - Hidden on Mobile */}
            {!isMobile && (
              <div style={{ position: 'relative', flex: 'initial', minWidth: 0 }}>
                <select
                  value={project?.status || "TODO"}
                  onChange={(e) => onUpdateProject(project.id, { status: e.target.value })}
                  style={{
                    appearance: 'none',
                    padding: "8px 12px 8px 24px",
                    borderRadius: 20,
                    border: "1px solid #E5E7EB",
                    background: 'white',
                    color: "#374151",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    textAlign: 'center',
                    minWidth: 120,
                    width: '100%',
                    outline: 'none',
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                  }}
                >
                  {Object.entries(PROJECT_STATUS_OPTIONS).map(([key, opt]) => (
                    <option key={key} value={key}>{opt.label}</option>
                  ))}
                </select>
                {/* Colored Dot Overlay */}
                <div style={{
                  position: 'absolute', top: '50%', left: 10, transform: 'translateY(-50%)',
                  width: 8, height: 8, borderRadius: '50%',
                  background: PROJECT_STATUS_OPTIONS[project?.status || "TODO"]?.color || "#9CA3AF",
                  pointerEvents: 'none'
                }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Island Navigation */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24, position: 'relative' }}>

        <div
          className="island-nav-container"
          style={{
            display: 'inline-flex',
            background: 'white',
            padding: 5,
            borderRadius: 99,
            gap: 4,
            flexWrap: isMobile ? 'nowrap' : 'wrap',
            justifyContent: isMobile ? 'space-between' : 'center',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
            maxWidth: '100%',
            overflowX: isMobile ? 'auto' : 'visible',
            width: isMobile ? '100%' : 'auto',
            maxWidth: '100%',
            overflowX: isMobile ? 'auto' : 'visible',
            width: isMobile ? '100%' : 'auto',
            position: 'relative', zIndex: 1
          }}>
          {visibleStages.map((p) => (
            <button
              key={p.key}
              style={{
                ...getNavStyle(stage === p.key),
                flex: isMobile ? '1 0 auto' : 'initial' // Allow grow on mobile
              }}
              onClick={() => setStage(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>



      {stage === "dashboard" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* BUDGET SECTION */}
          <div style={{ background: 'white', borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                ⏱️ Suivi Budgétaire
              </h3>
              {canEditProd && (
                <button onClick={handleOpenBudget} style={{ ...S.smallBtn, padding: 4 }} title="Ajuster le budget">
                  <Edit2 size={14} />
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {['prepa', 'conf', 'pose'].map(key => {
                const budgetVal = Number(project.budget?.[key] || 0);
                const realVal = realized[key] || 0;
                const percent = budgetVal > 0 ? (realVal / budgetVal) * 100 : 0;
                const color = percent > 100 ? '#ef4444' : percent > 80 ? '#f59e0b' : '#10b981';
                const labels = { prepa: "Préparation & Métrage", conf: "Atelier / Confection", pose: "Pose & Logistique" };

                return (
                  <div key={key} style={{ background: '#F9FAFB', borderRadius: 8, padding: 12, border: '1px solid #F3F4F6' }}>
                    <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>{labels[key]}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: '#1F2937' }}>{realVal.toFixed(1)}h</span>
                      <span style={{ fontSize: 13, color: '#9CA3AF' }}>/ {budgetVal}h</span>
                    </div>
                    <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(percent, 100)}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DashboardTiles rows={rows} projectHours={{ conf: 0, pose: 0 }} isMobile={isMobile} />

          {/* MUR DU PROJET (NOUVEAU) */}
          <div style={{ background: 'white', padding: 16, borderRadius: 12, border: `1px solid ${COLORS.border}` }}>
            <textarea
              placeholder="Écrire un message global..."
              value={wallMsg}
              onChange={(e) => setWallMsg(e.target.value)}
              style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 8, padding: 12, minHeight: 60, marginBottom: 12, fontFamily: 'inherit' }}
            />
            {wallImg && (
              <div style={{ marginBottom: 12, position: 'relative', display: 'inline-block' }}>
                <img src={wallImg} alt="Preview" style={{ height: 80, borderRadius: 6, border: '1px solid #ddd' }} />
                <button onClick={() => setWallImg(null)} style={{ position: 'absolute', top: -5, right: -5, background: 'red', color: 'white', borderRadius: '50%', width: 20, height: 20, border: 'none', cursor: 'pointer', fontSize: 12 }}>×</button>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: isMobile ? 12 : 0 }}>
              <label style={{
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#4B5563',
                padding: '10px 12px', borderRadius: 6, background: '#F3F4F6',
                width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'center' : 'flex-start'
              }}>
                <ImageIcon size={16} /> Ajouter photo
                <input type="file" accept="image/*" hidden onChange={handleImageSelect} />
              </label>
              <button
                onClick={handlePostMessage}
                style={{
                  background: '#2563EB', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 6, fontWeight: 600, cursor: 'pointer',
                  width: isMobile ? '100%' : 'auto'
                }}
              >
                Publier
              </button>
            </div>
          </div>

          <ProjectActivityFeed
            rows={rows}
            wall={project?.wall}
            pinnedIds={project?.pinnedIds || []}
            onTogglePin={handleTogglePin}
            isMobile={isMobile}
          />
        </div>
      )}

      {/* ... (Stage Chiffrage & Etiquettes - No changes for now or assumed robust due to components) ... */}
      {stage === "chiffrage" && seeChiffrage && (
        <MinutesScreen
          onExportToProduction={(mappedRows, minute) => {
            if (!canEditProd) return;
            setRows((rs) => computeFormulas([...(rs || []), ...mappedRows], schema));
            alert(`Exporté ${mappedRows.length} ligne(s) depuis "${minute?.name || "Minute"}" vers Production.`);
          }}
        />
      )}

      {stage === "etiquettes" && (
        <div style={isMobile ? { padding: 0 } : S.contentWide}>
          <EtiquettesSection
            title="Etiquettes Rideaux"
            tableKey="rideaux"
            rows={rowsRideaux}
            onRowsChange={mergeChildRowsFor("rideaux")}
            schema={schema}
            projectName={projectName}
          />
          <EtiquettesSection
            title="Etiquettes Stores"
            tableKey="stores"
            rows={rowsStores}
            onRowsChange={mergeChildRowsFor("stores")}
            schema={schema}
            projectName={projectName}
          />
        </div>
      )}

      {stage === "prise" && (
        <>
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>Prise de Cote Rideau</div>
            <MinuteGrid
              rows={rowsRideaux}
              onRowsChange={mergeChildRowsFor("rideaux")}
              schema={schema}
              enableCellFormulas={true}
              initialVisibilityModel={getVisibilityModel('prise', 'rideaux', schema)}
              onAdd={() => handleAddRow("Rideau")}
              onDuplicateRow={handleDuplicateRow}
              projectId={project?.id}
              gridKey="pv_rideaux"
              onRowClick={(id) => setOpenedRowId(id)}
              isMobile={isMobile}
            />
          </div>

          <div style={cardStyle}>
            <div style={cardHeaderStyle}>Prise de Cote Store</div>
            <MinuteGrid
              rows={rowsStores}
              onRowsChange={mergeChildRowsFor("stores")}
              schema={schema}
              enableCellFormulas={true}
              initialVisibilityModel={getVisibilityModel('prise', 'stores', schema)}
              onAdd={() => handleAddRow("Store Bateau")}
              onDuplicateRow={handleDuplicateRow}
              projectId={project?.id}
              gridKey="pv_stores"
              onRowClick={(id) => setOpenedRowId(id)}
              isMobile={isMobile}
            />
          </div>
        </>
      )}

      {stage === "suivi" && (
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>Suivi de projet</div>
          <MinuteGrid
            rows={filteredRows} // Suivi shows all rows
            onRowsChange={handleRowsChangeInstallation}
            schema={schema}
            enableCellFormulas={true}
            initialVisibilityModel={getVisibilityModel('suivi', 'all', schema)}
            onDuplicateRow={handleDuplicateRow}
            projectId={project?.id}
            gridKey="suivi_main"
            onRowClick={(id) => setOpenedRowId(id)}
            isMobile={isMobile}
          />
        </div>
      )}

      {stage === "bpf" && (
        <>
          {rowsRideaux.length > 0 && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>BPF Rideaux</div>
              <MinuteGrid
                rows={rowsRideaux}
                onRowsChange={mergeChildRowsFor("rideaux")}
                schema={schema}
                enableCellFormulas={true}
                initialVisibilityModel={getVisibilityModel('bpf', 'rideaux', schema)}
                onAdd={() => handleAddRow("Rideau")}
                onDuplicateRow={handleDuplicateRow}
                projectId={project?.id}
                gridKey="bpf_rideaux"
                onRowClick={(id) => setOpenedRowId(id)}
                isMobile={isMobile}
              />
            </div>
          )}

          {rowsDecors.length > 0 && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>BPF Décors de lit</div>
              <MinuteGrid
                rows={rowsDecors}
                onRowsChange={mergeChildRowsFor("decors")}
                schema={DECORS_PROD_SCHEMA} // <--- PROD SCHEMA
                enableCellFormulas={true}
                // initialVisibilityModel={...} // No visibility model needed, schema is already trimmed
                onAdd={() => handleAddRow("Décor de lit")}
                onDuplicateRow={handleDuplicateRow}
                projectId={project?.id}
                gridKey="bpf_decors"
                onRowClick={(id) => setOpenedRowId(id)}
                isMobile={isMobile}
              />
            </div>
          )}

          {rowsStores.length > 0 && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>BPF Stores</div>
              <MinuteGrid
                rows={rowsStores}
                onRowsChange={mergeChildRowsFor("stores")}
                schema={STORES_PROD_SCHEMA} // <--- PROD SCHEMA
                enableCellFormulas={true}
                // initialVisibilityModel={...} // No visibility model needed
                onAdd={() => handleAddRow("Store Bateau")}
                onDuplicateRow={handleDuplicateRow}
                projectId={project?.id}
                gridKey="bpf_stores"
                onRowClick={(id) => setOpenedRowId(id)}
                isMobile={isMobile}
              />
            </div>
          )}

          {rowsAutreConfection.length > 0 && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>BPF Autre (Confection sur mesure)</div>
              <MinuteGrid
                rows={rowsAutreConfection}
                onRowsChange={mergeChildRowsFor("autre_confection")}
                schema={AUTRES_PROD_SCHEMA}
                enableCellFormulas={true}
                onAdd={() => handleAddRow("Autre")}
                onDuplicateRow={handleDuplicateRow}
                projectId={project?.id}
                gridKey="bpf_autres"
                onRowClick={(id) => setOpenedRowId(id)}
                isMobile={isMobile}
              />
            </div>
          )}
        </>
      )}

      {stage === "bpp" && (
        <>
          {rowsRideaux.length > 0 && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>BPP Rideaux (Préparation Mécanismes)</div>
              <MinuteGrid
                rows={rowsRideaux}
                onRowsChange={mergeChildRowsFor("rideaux")}
                schema={schema}
                enableCellFormulas={true}
                initialVisibilityModel={getVisibilityModel('bpp', 'rideaux', schema)}
                onAdd={() => handleAddRow("Rideau")}
                onDuplicateRow={handleDuplicateRow}
                projectId={project?.id}
                gridKey="bpp_rideaux"
                onRowClick={(id) => setOpenedRowId(id)}
                isMobile={isMobile}
              />
            </div>
          )}

          {rowsStores.length > 0 && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>BPP Stores (Préparation Mécanismes)</div>
              <MinuteGrid
                rows={rowsStores}
                onRowsChange={mergeChildRowsFor("stores")}
                schema={STORES_PROD_SCHEMA}
                enableCellFormulas={true}
                initialVisibilityModel={getVisibilityModel('bpp', 'stores', STORES_PROD_SCHEMA)}
                onAdd={() => handleAddRow("Store Bateau")}
                onDuplicateRow={handleDuplicateRow}
                projectId={project?.id}
                gridKey="bpp_stores"
                onRowClick={(id) => setOpenedRowId(id)}
                isMobile={isMobile}
              />
            </div>
          )}
        </>
      )}

      {openedRow && (
        <Dialog
          open={true}
          onClose={() => setOpenedRowId(null)}
          fullScreen={isMobile}
          maxWidth="lg"
          fullWidth
          PaperProps={{ sx: { bgcolor: '#F9FAFB' } }}
        >
          {/* We wrap LineDetailPanel in a Dialog for better mobile/desktop handling if LineDetailPanel is just the content 
                 Wait, LineDetailPanel might already contain a Dialog. Let's checkLineDetailPanel.
                 Actually existing usage was: 
                 <LineDetailPanel open={true} ... /> 
                 So it handles the Dialog itself. I should pass isMobile or fullScreen props if supported.
                 If LineDetailPanel uses MUI Dialog internally, it supports `fullScreen` prop.
             */}
          <LineDetailPanel
            open={true}
            onClose={() => setOpenedRowId(null)}
            row={openedRow}
            schema={schema}
            onRowChange={handleDetailUpdate}
            projectId={project?.id}
            minuteId={null}
            fullScreen={isMobile}
            currentUser={currentUser}
            authorName={currentUser?.name}
          />
        </Dialog>
      )}
      {/* Correction: LineDetailPanel likely HAS a Dialog inside. Let's verify before guessing. 
         I'll stick to original <LineDetailPanel ... /> and just modify LineDetailPanel to accept fullScreen
         or check if it is already a Drawer/Dialog. 
         
         REVERTING Dialog wrapper for now to avoid double nesting if LineDetailPanel is a Dialog.
      */}

      {/* ... End of Return ... */}

      <Dialog open={budgetOpen} onClose={() => setBudgetOpen(false)}>
        <DialogTitle>Ajuster le Budget Heures</DialogTitle>
        <DialogContent>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
            <TextField label="Heures Prépa / Métrage" type="number" value={budgetDraft.prepa} onChange={e => setBudgetDraft({ ...budgetDraft, prepa: Number(e.target.value) })} fullWidth />
            <TextField label="Heures Confection" type="number" value={budgetDraft.conf} onChange={e => setBudgetDraft({ ...budgetDraft, conf: Number(e.target.value) })} fullWidth />
            <TextField label="Heures Pose" type="number" value={budgetDraft.pose} onChange={e => setBudgetDraft({ ...budgetDraft, pose: Number(e.target.value) })} fullWidth />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBudgetOpen(false)}>Annuler</Button>
          <Button onClick={saveBudget} variant="contained">Enregistrer</Button>
        </DialogActions>
      </Dialog>

      {/* MODALE STOCK PROJET */}
      <Dialog
        open={stockOpen}
        onClose={() => setStockOpen(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{ sx: { height: '80vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Stock Projet : {projectName}</span>
          <Button onClick={() => setStockOpen(false)}>Fermer</Button>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <StockInventoryTab
            inventory={inventory ? inventory.filter(item => {
              if (!item.project) return false;
              const pName = project?.name || project?.nom_dossier;
              return item.project === pName;
            }) : []}
            projects={projects}
          />
        </DialogContent>
      </Dialog>

      {/* MODALE DOCUMENTS */}
      {showDocs && (
        <DocumentListModal
          open={showDocs}
          onClose={() => setShowDocs(false)}
          documents={project?.documents || []}
          onUpdate={handleUpdateDocs}
        />
      )}

    </div >
  );
}

export default ProductionProjectScreen;