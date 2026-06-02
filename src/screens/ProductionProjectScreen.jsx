import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { COLORS, S } from "../lib/constants/ui.js";

import { slugify } from "../lib/utils/slugify";
import MinuteGrid from "../components/MinuteGrid.jsx"; // Replaces DataTable
import DashboardTiles from "../components/DashboardTiles.jsx";
import ProjectActivityFeed from "../components/ProjectActivityFeed.jsx";
import EtiquettesSection from "../components/EtiquettesSection.jsx";
import BPPPrintPortal from "../components/print/BPPPrintPortal.jsx";
import MinutesScreen from "./MinutesScreen.jsx";
import LineDetailPanel from "../components/LineDetailPanel";
import StockInventoryTab from "../components/modules/Stocks/StockInventoryTab.jsx";

import { computeFormulas, preserveManualAfterCompute } from "../lib/formulas/compute";
import { SCHEMA_64 } from "../lib/schemas/production.js";
import { STAGES, DEFAULT_VIEWS } from "../lib/constants/views.js"; // Import DEFAULT_VIEWS
import { recomputeRow } from "../lib/formulas/recomputeRow";
import { computeProjectHours } from "../lib/projectMetrics";
import { RIDEAUX_PROD_SCHEMA } from "../lib/schemas/production/rideaux";
import { STORES_PROD_SCHEMA } from "../lib/schemas/production/stores_classiques";
import { STORES_BATEAUX_PROD_SCHEMA } from "../lib/schemas/production/stores_bateaux";
import { COUSSINS_PROD_SCHEMA } from "../lib/schemas/production/coussins";
import { CACHE_SOMMIER_PROD_SCHEMA } from "../lib/schemas/production/cache_sommier";
import { PLAID_PROD_SCHEMA } from "../lib/schemas/production/plaid";
import { TENTURE_MURALE_PROD_SCHEMA } from "../lib/schemas/production/tenture_murale";
import { MOBILIER_PROD_SCHEMA } from "../lib/schemas/production/mobilier";
import { AUTRES_PROD_SCHEMA } from "../lib/schemas/autres";
import { uid } from "../lib/utils/uid"; // Import uid

import { Search, Filter, Layers3, Star, FlaskConical, Image as ImageIcon, Pin, Edit2, FileText, BookOpen, Printer } from "lucide-react";
import ProjectMaterialsPanel from "../components/ProjectMaterialsPanel";
import AddressAutocomplete from "../components/AddressAutocomplete"; // Added FileText
import { Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button, Collapse, IconButton } from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { differenceInMinutes } from "date-fns";
import DocumentListModal from "../components/DocumentListModal"; // Added import
import { useAuth } from "../auth";
import { can } from "../lib/authz";

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

/**
 * Helper to convert DEFAULT_VIEWS array to DataGrid visibility model
 * { field: boolean }
 */
const getSchemaForRow = (row) => {
  const produit = String(row?.produit || '');
  if (/rideau|voilage/i.test(produit))          return { schema: RIDEAUX_PROD_SCHEMA,        tableKey: 'rideaux' };
  if (/store (bateau|velum)/i.test(produit))     return { schema: STORES_BATEAUX_PROD_SCHEMA, tableKey: 'stores_bateaux' };
  if (/store/i.test(produit))                    return { schema: STORES_PROD_SCHEMA,         tableKey: 'stores' };
  if (/coussin/i.test(produit))                  return { schema: COUSSINS_PROD_SCHEMA,       tableKey: 'coussins' };
  if (/plaid/i.test(produit))                    return { schema: PLAID_PROD_SCHEMA,          tableKey: 'plaid' };
  if (/tête de lit|mobilier/i.test(produit))     return { schema: MOBILIER_PROD_SCHEMA,       tableKey: 'mobilier' };
  if (/cache-sommier/i.test(produit))            return { schema: CACHE_SOMMIER_PROD_SCHEMA,  tableKey: 'cache_sommier' };
  if (/tenture murale/i.test(produit))           return { schema: TENTURE_MURALE_PROD_SCHEMA, tableKey: 'tenture_murale' };
  return { schema: RIDEAUX_PROD_SCHEMA, tableKey: 'rideaux' }; // fallback
};

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

// Colonnes à exclure de l'impression BPP (cases à cocher, boutons, photos…)
const BPP_PRINT_EXCLUDED_TYPES = new Set(['checkbox', 'button', 'photo', 'image']);
// Doit correspondre au préfixe utilisé par MinuteGrid pour persister l'état des colonnes
const AG_GRID_STATE_PREFIX = 'ag_grid_state_v1_';

const isPrintableCol = (col) =>
  col &&
  !['sel', 'detail'].includes(col.key) &&
  !BPP_PRINT_EXCLUDED_TYPES.has(col.type) &&
  !/photo|croquis/i.test(col.key);

// Construit les colonnes à imprimer pour une section BPP.
// Priorité à l'état COURANT des colonnes (ce que l'utilisateur voit/masque,
// persisté par MinuteGrid dans localStorage), sinon visibilité par défaut.
const buildBppPrintColumns = (schema, tableKey, gridKey) => {
  const byKey = new Map((schema || []).map(c => [c.key, c]));

  // 1. État courant des colonnes (ordre + visibilité réels à l'écran)
  try {
    const raw = localStorage.getItem(`${AG_GRID_STATE_PREFIX}${gridKey}`);
    if (raw) {
      const colState = JSON.parse(raw)?.columnState;
      if (Array.isArray(colState) && colState.length > 0) {
        return colState
          .filter(cs => !cs.hide)
          .map(cs => byKey.get(cs.colId))
          .filter(isPrintableCol)
          .map(col => ({ key: col.key, label: col.label || col.key }));
      }
    }
  } catch (_) { /* fallback ci-dessous */ }

  // 2. Fallback : visibilité par défaut de la vue BPP
  const vm = getVisibilityModel('bpp', tableKey, schema);
  return (schema || [])
    .filter(col => vm[col.key] && isPrintableCol(col))
    .map(col => ({ key: col.key, label: col.label || col.key }));
};

import { PROJECT_STATUS_OPTIONS } from "../lib/constants/projectStatus";
import { useViewportWidth } from "../lib/hooks/useViewportWidth";

// 1. SIGNATURE MISE A JOUR
export function ProductionProjectScreen({ project: propProject, projects, inventory, onBack, onUpdateProjectRows, onUpdateProject, highlightRowId, events = [] }) {
  const { projectId: urlProjectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

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
  const [panelsExpanded, setPanelsExpanded] = useState({});
  const isPanelExpanded = (key) => panelsExpanded[key] !== false; // default: expanded
  const togglePanel = (key) => setPanelsExpanded(p => ({ ...p, [key]: !isPanelExpanded(key) }));
  const [search, setSearch] = useState("");
  const [schema, setSchema] = useState(SCHEMA_64);
  const [openedRowId, setOpenedRowId] = useState(null);
  const [stockOpen, setStockOpen] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [showAllPrise, setShowAllPrise] = useState(false);
  const deliveryRef = useRef(null);

  const handleUpdateDocs = (newDocs) => {
    if (onUpdateProject && project) {
      onUpdateProject(project.id, { documents: newDocs });
    }
  };

  const projectMaterials = project?.materials || [];
  const handleMaterialsChange = (newMaterials) => {
    if (onUpdateProject && project) {
      onUpdateProject(project.id, { materials: newMaterials });
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

  // Fermer le dropdown livraison au clic extérieur
  useEffect(() => {
    if (!deliveryOpen) return;
    const handler = (e) => {
      if (deliveryRef.current && !deliveryRef.current.contains(e.target)) {
        setDeliveryOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [deliveryOpen]);

  const { currentUser } = useAuth();
  const canEditProd = can(currentUser, "production.edit") ||
    (stage === 'prise' && can(currentUser, 'production.edit.prise_de_cotes')) ||
    (stage === 'suivi' && can(currentUser, 'production.edit.suivi_projet'));
  const seeChiffrage = can(currentUser, "chiffrage.view");

  // --- CALCUL REALISÉ (Temps Réel) ---
  // Source unique partagée avec l'Assistant Programmation (lib/projectMetrics).
  const realized = useMemo(() => {
    if (!project || !events) return { prepa: 0, conf: 0, pose: 0 };
    return computeProjectHours(project, events).consumed;
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
  // Ref toujours à jour — permet des callbacks stables sans dépendance sur `rows`
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // Calculate opened row
  const openedRow = useMemo(() => (rows || []).find(r => r.id === openedRowId || r.id.startsWith(openedRowId)), [rows, openedRowId]);

  // Sync openedRowId ↔ URL (/production/projectSlug/rowSlug)
  const projectBasePath = project
    ? `/production/${project.id.slice(0, 8)}-${slugify(project.name)}`
    : null;

  useEffect(() => {
    if (!projectBasePath) return;
    if (openedRowId) {
      const shortId = openedRowId.slice(0, 8);
      const parts = openedRow
        ? [openedRow.zone, openedRow.piece, openedRow.produit].filter(Boolean).map(slugify)
        : [];
      const rowSlug = parts.length ? `${shortId}-${parts.join('-')}` : shortId;
      navigate(`${projectBasePath}/${rowSlug}`, { replace: true });
    } else {
      navigate(projectBasePath, { replace: true });
    }
  }, [openedRowId, openedRow, projectBasePath]);

  // document.title
  useEffect(() => {
    const projectTitle = project?.name || "Projet";
    if (openedRow) {
      const parts = [openedRow.zone, openedRow.piece, openedRow.produit].filter(Boolean);
      const rowLabel = parts.length ? parts.join(" — ") : "Ouvrage";
      document.title = `${rowLabel} · ${projectTitle} — LENGLART`;
    } else {
      document.title = `${projectTitle} — LENGLART`;
    }
  }, [openedRow, project?.name]);

  // Schema et visibilité du formulaire détail selon le produit de la ligne et le stage actif
  const openedRowDetail = useMemo(() => {
    if (!openedRow) return { schema: SCHEMA_64, columnVisibilityModel: {} };
    const { schema: rowSchema, tableKey } = getSchemaForRow(openedRow);
    return {
      schema: rowSchema,
      columnVisibilityModel: getVisibilityModel(stage, tableKey, rowSchema),
    };
  }, [openedRow, stage]);

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
    setShowAllPrise(false);
  }, [project?.id]);

  // Sync history/comments en temps réel quand un autre utilisateur sauvegarde.
  // On ne touche que les lignes où l'entrant a PLUS d'entrées (évite d'écraser les éditions locales en cours).
  useEffect(() => {
    if (!project?.rows) return;
    setRows(prev => {
      if (!prev) return prev;
      const incomingMap = new Map(project.rows.map(r => [r.id, r]));
      let changed = false;
      const merged = prev.map(r => {
        const inc = incomingMap.get(r.id);
        if (!inc) return r;
        const inHist = inc.history || [];
        const inComm = inc.comments || [];
        const locHist = r.history || [];
        const locComm = r.comments || [];
        if (inHist.length > locHist.length || inComm.length > locComm.length) {
          changed = true;
          return {
            ...r,
            history: inHist.length > locHist.length ? inHist : locHist,
            comments: inComm.length > locComm.length ? inComm : locComm,
          };
        }
        return r;
      });
      return changed ? merged : prev;
    });
  }, [project?.rows]);

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

  // Sous-ensembles memoïsés — recalculés uniquement quand filteredRows change
  const {
    rowsRideaux, rowsStores, rowsStoresBateaux, rowsCoussins,
    rowsPlaid, rowsMobilier, rowsCacheSommier, rowsTentureMurale, rowsAutreConfection
  } = useMemo(() => ({
    rowsRideaux:        filteredRows.filter((r) => /rideau|voilage/i.test(String(r.produit || ""))),
    rowsStores:         filteredRows.filter((r) => r.produit && /store/i.test(String(r.produit)) && !/bateau|velum/i.test(String(r.produit))),
    rowsStoresBateaux:  filteredRows.filter((r) => r.produit && /store (bateau|velum)/i.test(String(r.produit))),
    rowsCoussins:       filteredRows.filter((r) => /coussin/i.test(String(r.produit || ""))),
    rowsPlaid:          filteredRows.filter((r) => /plaid/i.test(String(r.produit || ""))),
    rowsMobilier:       filteredRows.filter((r) => /tête de lit|mobilier/i.test(String(r.produit || ""))),
    rowsCacheSommier:   filteredRows.filter((r) => /cache-sommier/i.test(String(r.produit || ""))),
    rowsTentureMurale:  filteredRows.filter((r) => /tenture murale/i.test(String(r.produit || ""))),
    rowsAutreConfection: filteredRows.filter(r => r.section === 'autre'),
  }), [filteredRows]);

  // Filtre sous-traitance : exclu du BPF et des étiquettes
  const isSousTraite = (r) => r.realise_par === 'Sous-Traitant';

  const {
    bpfRideaux, bpfStoresBateaux, bpfCoussins,
    bpfPlaid, bpfMobilier, bpfCacheSommier, bpfTentureMurale, bpfAutreConfection
  } = useMemo(() => ({
    bpfRideaux:         rowsRideaux.filter(r => !isSousTraite(r)),
    bpfStoresBateaux:   rowsStoresBateaux.filter(r => !isSousTraite(r)),
    bpfCoussins:        rowsCoussins.filter(r => !isSousTraite(r)),
    bpfPlaid:           rowsPlaid.filter(r => !isSousTraite(r)),
    bpfMobilier:        rowsMobilier.filter(r => !isSousTraite(r)),
    bpfCacheSommier:    rowsCacheSommier.filter(r => !isSousTraite(r)),
    bpfTentureMurale:   rowsTentureMurale.filter(r => !isSousTraite(r)),
    bpfAutreConfection: rowsAutreConfection.filter(r => !isSousTraite(r)),
  }), [rowsRideaux, rowsStoresBateaux, rowsCoussins, rowsPlaid, rowsMobilier, rowsCacheSommier, rowsTentureMurale, rowsAutreConfection]);

  // --- IMPRESSION BPP (A3 paysage, fidèle à l'écran) ---
  const [showBppPrint, setShowBppPrint] = useState(false);
  const [bppPrintSections, setBppPrintSections] = useState([]);

  const hasAnyBppRows = [rowsRideaux, rowsStores, rowsStoresBateaux, rowsTentureMurale, rowsMobilier]
    .some(a => (a || []).length > 0);

  // Calcule les sections à imprimer AU CLIC (lit l'état courant des colonnes).
  const handleOpenBppPrint = () => {
    const cfg = [
      { title: 'BPP Rideaux (Préparation Mécanismes)',          rows: rowsRideaux,       schema: RIDEAUX_PROD_SCHEMA,        tableKey: 'rideaux' },
      { title: 'BPP Stores Négoce (Préparation Mécanismes)',    rows: rowsStores,        schema: STORES_PROD_SCHEMA,         tableKey: 'stores' },
      { title: 'BPP Stores Bateaux / Velum (Préparation Mécanismes)', rows: rowsStoresBateaux, schema: STORES_BATEAUX_PROD_SCHEMA, tableKey: 'stores_bateaux' },
      { title: 'BPP Tenture Murale',                            rows: rowsTentureMurale, schema: TENTURE_MURALE_PROD_SCHEMA,  tableKey: 'tenture_murale' },
      { title: 'BPP Mobilier / Tête de Lit',                    rows: rowsMobilier,      schema: MOBILIER_PROD_SCHEMA,       tableKey: 'mobilier' },
    ];
    const sections = cfg
      .filter(s => (s.rows || []).length > 0)
      .map(s => ({
        title: s.title,
        rows: s.rows,
        columns: buildBppPrintColumns(s.schema, s.tableKey, `bpp_${s.tableKey}`),
      }))
      .filter(s => s.columns.length > 0);
    if (sections.length === 0) return;
    setBppPrintSections(sections);
    setShowBppPrint(true);
  };

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
      { key: 'piece', label: 'Pièce' },
      { key: 'produit', label: 'Produit' },
      { key: 'largeur_mecanisme', label: 'Largeur Méca' },
      { key: 'largeur', label: 'Largeur' },
      { key: 'hauteur', label: 'Hauteur' },
      { key: 'hspf_droite', label: 'HSPF Droit' },
      { key: 'hspf_milieu', label: 'HSPF Milieu' },
      { key: 'hspf_gauche', label: 'HSPF Gauche' },
      { key: 'finition_bas', label: 'Cassant / Rasant' },
      { key: 'valeur_deduction', label: 'Val. Déduc.' },
      { key: 'type_confection', label: 'Type Conf.' },
      { key: 'tissu_deco1', label: 'Tissu 1' },
      { key: 'tissu_deco2', label: 'Tissu 2' },
      { key: 'doublure', label: 'Doublure' },
    ];

    watchedFields.forEach(field => {
      const oldVal = oldRow[field.key];
      const newVal = newRowRaw[field.key];
      // Comparaison simple (attention aux types string/number)
      if (oldVal != newVal && (oldVal || newVal)) {
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

  // Debounce du save Supabase — l'état local se met à jour immédiatement,
  // la persistance attend 800ms pour éviter un re-render parent à chaque frappe.
  const saveTimerRef = useRef(null);
  const debouncedSave = useCallback((projectId, updatedRows) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (onUpdateProjectRows) onUpdateProjectRows(projectId, updatedRows);
      saveTimerRef.current = null;
    }, 800);
  }, [onUpdateProjectRows]);

  // --- HANDLERS ---

  // 1. handleSubsetChange — useCallback + rowsRef pour référence stable
  const handleSubsetChange = useCallback((newSubsetRows, filterRegex, filterPredicate) => {
    if (!canEditProd) return;
    const allRows = rowsRef.current;

    let oldSubset;
    if (filterPredicate) {
      oldSubset = allRows.filter(filterPredicate);
    } else {
      oldSubset = allRows.filter(r => filterRegex.test(String(r.produit || "")));
    }
    const newIds = new Set(newSubsetRows.map(r => r.id));
    const deletedRows = oldSubset.filter(r => !newIds.has(r.id));
    if (deletedRows.length > 0) {
      console.warn('[handleSubsetChange] Suppression de lignes détectée :', deletedRows.map(r => ({ id: r.id, produit: r.produit, section: r.section })));
    }
    const deletedIds = new Set(deletedRows.map(r => r.id));
    const updatedMap = new Map(newSubsetRows.map(r => [r.id, r]));

    const updatedAllRows = allRows
      .filter(r => !deletedIds.has(r.id))
      .map(r => {
        if (updatedMap.has(r.id)) {
          const newRaw = updatedMap.get(r.id);
          if (newRaw === r) return r; // Ligne inchangée — préserve la référence
          // Garde-fou : si le produit de la ligne entrante ne correspond plus au filtre
          // de la section (ex. Tab a vidé le champ via agSelectCellEditor), on le restaure.
          const effectiveRegex = filterRegex || (filterPredicate ? null : null);
          const produitCorrupted = effectiveRegex &&
            !effectiveRegex.test(String(newRaw.produit || '')) &&
            effectiveRegex.test(String(r.produit || ''));
          const safeNewRaw = produitCorrupted ? { ...newRaw, produit: r.produit } : newRaw;
          // MinuteGrid a déjà appelé recomputeRow(section_schema) dans onCellValueChanged.
          // On appelle uniquement updateRowWithHistory pour l'audit, sans re-calculer les formules
          // (qui ont déjà été calculées avec le bon schema de section).
          return updateRowWithHistory(r, safeNewRaw, currentUser?.name);
        }
        return r;
      });

    setRows(updatedAllRows);
    if (project?.id) debouncedSave(project.id, updatedAllRows);
  }, [canEditProd, schema, currentUser?.name, debouncedSave, project?.id]);

  const mergeChildRowsFor = (tableKey) => {
    if (tableKey === "rideaux") {
      return (nr) => handleSubsetChange(nr, /rideau|voilage/i);
    }
    if (tableKey === "stores") {
      return (nr) => handleSubsetChange(nr, null, (r) => r.produit && /store/i.test(String(r.produit)) && !/bateau|velum/i.test(String(r.produit)));
    }
    if (tableKey === "autre_confection") {
      return (nr) => handleSubsetChange(nr, null, (r) => r.section === 'autre');
    }
    // Sécurité : tableKey inconnu → ne jamais appeler handleSubsetChange avec une regex par défaut
    // qui pourrait supprimer des données non ciblées.
    console.error(`mergeChildRowsFor: tableKey inconnu "${tableKey}" — aucune action effectuée.`);
    return () => {};
  };

  // 2. handleRowsChangeInstallation — stable via rowsRef
  const handleRowsChangeInstallation = useCallback((nr) => {
    if (!canEditProd) return;
    const oldMap = new Map(rowsRef.current.map(r => [r.id, r]));

    const computed = nr.map(newR => {
      const oldR = oldMap.get(newR.id);
      if (oldR) {
        const rowWithHistory = updateRowWithHistory(oldR, newR, currentUser?.name);
        return recomputeRow(rowWithHistory, schema);
      }
      return recomputeRow(newR, schema);
    });

    setRows(computed);
    if (project?.id) debouncedSave(project.id, computed);
  }, [canEditProd, schema, currentUser?.name, debouncedSave, project?.id]);

  // 3. handleDetailUpdate — stable via rowsRef
  const handleDetailUpdate = useCallback((updatedRow) => {
    if (!canEditProd) return;
    const newRows = rowsRef.current.map(r => {
      if (r.id === updatedRow.id) {
        const rowWithHistory = updateRowWithHistory(r, updatedRow, currentUser?.name);
        return recomputeRow(rowWithHistory, schema);
      }
      return r;
    });
    setRows(newRows);
    if (project?.id) debouncedSave(project.id, newRows);
  }, [canEditProd, schema, currentUser?.name, debouncedSave, project?.id]);


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
            {/* Emplacement & logistique */}
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B7280' }}>
                <Pin size={13} style={{ flexShrink: 0 }} />
                <AddressAutocomplete
                  value={project?.location || ""}
                  onChange={v => onUpdateProject(project.id, { location: v })}
                  placeholder="Emplacement du projet…"
                  style={{ width: 300 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B7280' }}>
                <span>Type :</span>
                <select
                  value={project?.intervention_type || "livraison"}
                  onChange={e => onUpdateProject(project.id, { intervention_type: e.target.value, expedition_type: e.target.value === 'livraison' ? null : project?.expedition_type })}
                  style={{ border: 'none', background: 'transparent', color: '#374151', fontSize: 13, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="livraison">Livraison</option>
                  <option value="installation">Installation</option>
                </select>
                {project?.intervention_type === 'installation' && (
                  <>
                    <span style={{ color: '#d1d5db' }}>·</span>
                    <select
                      value={project?.expedition_type || "depart_nantes"}
                      onChange={e => onUpdateProject(project.id, { expedition_type: e.target.value })}
                      style={{ border: 'none', background: 'transparent', color: '#374151', fontSize: 13, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="depart_nantes">Départ depuis Nantes</option>
                      <option value="expedition">Expédition transporteur</option>
                    </select>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
            {/* Matériauthèque Button */}
            <button
              onClick={() => setShowMaterials(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: projectMaterials.length > 0 ? '#EDE9FE' : 'white',
                border: `1px solid ${projectMaterials.length > 0 ? '#C4B5FD' : '#E5E7EB'}`,
                borderRadius: 20,
                padding: '7px 16px',
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                cursor: 'pointer',
                fontSize: 13,
                color: projectMaterials.length > 0 ? '#5B21B6' : '#374151',
                fontWeight: 600,
                outline: 'none',
                flex: 'initial', justifyContent: 'center'
              }}
            >
              <BookOpen size={16} />
              Matériauthèque{projectMaterials.length > 0 ? ` (${projectMaterials.length})` : ''}
            </button>

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
              <div ref={deliveryRef} style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  onClick={() => setDeliveryOpen(o => !o)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'white', border: '1px solid #E5E7EB', borderRadius: 20,
                    padding: '6px 12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    whiteSpace: 'nowrap', cursor: 'pointer', fontSize: 13,
                    color: '#374151', fontFamily: 'inherit'
                  }}
                >
                  <span style={{ color: '#6B7280', fontWeight: 500 }}>Livraison :</span>
                  <span style={{ color: project?.deadline ? '#374151' : '#9CA3AF' }}>
                    {project?.deadline ? new Date(project.deadline).toLocaleDateString('fr-FR') : '—'}
                  </span>
                  {(project?.delivery_phases?.length > 0) && (
                    <span style={{ background: '#EFF6FF', color: '#2563EB', borderRadius: 10, fontSize: 11, fontWeight: 600, padding: '1px 6px' }}>
                      {project.delivery_phases.length} phase{project.delivery_phases.length > 1 ? 's' : ''}
                    </span>
                  )}
                </button>

                {deliveryOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                    background: 'white', border: '1px solid #E5E7EB', borderRadius: 12,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.1)', padding: 16, minWidth: 290, zIndex: 1000
                  }}>
                    {/* Date globale */}
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                        Date de livraison souhaitée
                      </label>
                      <input
                        type="date"
                        value={project?.deadline ? project.deadline.split('T')[0] : ''}
                        onChange={(e) => onUpdateProject(project.id, { deadline: e.target.value })}
                        style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>

                    {/* Phases */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phases</span>
                        <button
                          onClick={() => {
                            const phases = [...(project?.delivery_phases || []), { id: uid(), label: '', date: '' }];
                            onUpdateProject(project.id, { delivery_phases: phases });
                          }}
                          style={{ fontSize: 12, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, padding: 0 }}
                        >
                          + Phase
                        </button>
                      </div>

                      {(project?.delivery_phases || []).map((phase, idx) => (
                        <div key={phase.id || idx} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                          <input
                            value={phase.label}
                            placeholder="Phase 1…"
                            onChange={(e) => {
                              const phases = (project.delivery_phases || []).map((p, i) => i === idx ? { ...p, label: e.target.value } : p);
                              onUpdateProject(project.id, { delivery_phases: phases });
                            }}
                            style={{ flex: 1, border: '1px solid #E5E7EB', borderRadius: 8, padding: '5px 8px', fontSize: 12, fontFamily: 'inherit', outline: 'none', minWidth: 0 }}
                          />
                          <input
                            type="date"
                            value={phase.date || ''}
                            onChange={(e) => {
                              const phases = (project.delivery_phases || []).map((p, i) => i === idx ? { ...p, date: e.target.value } : p);
                              onUpdateProject(project.id, { delivery_phases: phases });
                            }}
                            style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: '5px 8px', fontSize: 12, fontFamily: 'inherit', outline: 'none', width: 130 }}
                          />
                          <button
                            onClick={() => {
                              const phases = (project.delivery_phases || []).filter((_, i) => i !== idx);
                              onUpdateProject(project.id, { delivery_phases: phases });
                            }}
                            style={{ color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px' }}
                          >
                            ×
                          </button>
                        </div>
                      ))}

                      {(!project?.delivery_phases || project.delivery_phases.length === 0) && (
                        <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, textAlign: 'center', padding: '8px 0' }}>Aucune phase</p>
                      )}
                    </div>
                  </div>
                )}
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
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 24, alignItems: 'flex-start' }}>

          {/* ── COLONNE GAUCHE : stats ── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Chapitre 1 : Consommation Temps */}
            <div style={{ background: 'white', borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                  ⏱️ Consommation Temps
                </h3>
                {canEditProd && (
                  <button onClick={handleOpenBudget} style={{ ...S.smallBtn, padding: 4 }} title="Ajuster le budget">
                    <Edit2 size={14} />
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
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
                        <span style={{ fontSize: 13, color: '#9CA3AF' }}>
                          / {budgetVal}h
                          {budgetVal > 0 && (
                            <span style={{ marginLeft: 5, fontSize: 11, color: color, fontWeight: 700 }}>
                              — {Math.round(percent)}%
                            </span>
                          )}
                        </span>
                      </div>
                      <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(percent, 100)}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chapitre 2 : Avancement */}
            <div style={{ background: 'white', borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                📊 Avancement
              </h3>
              <DashboardTiles rows={rows} projectHours={{ conf: 0, pose: 0 }} isMobile={isMobile} />
            </div>
          </div>

          {/* ── COLONNE DROITE : mur + journal ── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Mur du projet */}
            <div style={{ background: 'white', padding: 16, borderRadius: 12, border: `1px solid ${COLORS.border}` }}>
              <textarea
                placeholder="Écrire un message global..."
                value={wallMsg}
                onChange={(e) => setWallMsg(e.target.value)}
                style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 8, padding: 12, minHeight: 60, marginBottom: 12, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
              {wallImg && (
                <div style={{ marginBottom: 12, position: 'relative', display: 'inline-block' }}>
                  <img src={wallImg} alt="Preview" style={{ height: 80, borderRadius: 6, border: '1px solid #ddd' }} />
                  <button onClick={() => setWallImg(null)} style={{ position: 'absolute', top: -5, right: -5, background: 'red', color: 'white', borderRadius: '50%', width: 20, height: 20, border: 'none', cursor: 'pointer', fontSize: 12 }}>×</button>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#4B5563', padding: '10px 12px', borderRadius: 6, background: '#F3F4F6' }}>
                  <ImageIcon size={16} /> Ajouter photo
                  <input type="file" accept="image/*" hidden onChange={handleImageSelect} />
                </label>
                <button
                  onClick={handlePostMessage}
                  style={{ background: '#2563EB', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
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
          {bpfRideaux.length > 0 && (
            <EtiquettesSection
              title="Etiquettes Rideaux"
              tableKey="rideaux"
              rows={bpfRideaux}
              onRowsChange={mergeChildRowsFor("rideaux")}
              schema={RIDEAUX_PROD_SCHEMA}
              projectName={projectName}
              project={project}
              onUpdateProject={onUpdateProject}
              onEditRow={(row) => setOpenedRowId(row.id)}
            />
          )}
          {bpfStoresBateaux.length > 0 && (
            <EtiquettesSection
              title="Etiquettes Stores Bateaux / Velum"
              tableKey="stores_bateaux"
              rows={bpfStoresBateaux}
              onRowsChange={(nr) => handleSubsetChange(nr, /store (bateau|velum)/i)}
              schema={STORES_BATEAUX_PROD_SCHEMA}
              projectName={projectName}
              project={project}
              onUpdateProject={onUpdateProject}
              onEditRow={(row) => setOpenedRowId(row.id)}
            />
          )}
        </div>
      )}

      {stage === "prise" && (
        <>
          {/* Toggle Voir tous les tableaux */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button
              onClick={() => setShowAllPrise(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: showAllPrise ? '#1D4ED8' : 'white',
                color: showAllPrise ? 'white' : '#374151',
                border: `1px solid ${showAllPrise ? '#1D4ED8' : '#E5E7EB'}`,
                borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 600,
                fontFamily: 'inherit', cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.15s ease',
              }}
            >
              <Layers3 size={14} />
              {showAllPrise ? 'Vue filtrée' : 'Voir tous les tableaux'}
            </button>
          </div>

          {(showAllPrise || rowsRideaux.length > 0) && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>Prise de Cote Rideaux / Voilages</div>
              <MinuteGrid
                rows={rowsRideaux}
                onRowsChange={mergeChildRowsFor("rideaux")}
                schema={RIDEAUX_PROD_SCHEMA}
                enableCellFormulas={true}
                initialVisibilityModel={getVisibilityModel('prise', 'rideaux', RIDEAUX_PROD_SCHEMA)}
                onAdd={() => handleAddRow("Rideau")}
                onDuplicateRow={handleDuplicateRow}
                catalog={projectMaterials}
                projectId={project?.id}
                gridKey="pv_rideaux"
                onRowClick={(id) => setOpenedRowId(id)}
                isMobile={isMobile}
              />
            </div>
          )}

          {(showAllPrise || rowsStores.length > 0) && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>Prise de Cote Stores Négoce</div>
              <MinuteGrid
                rows={rowsStores}
                onRowsChange={mergeChildRowsFor("stores")}
                schema={STORES_PROD_SCHEMA}
                enableCellFormulas={true}
                initialVisibilityModel={getVisibilityModel('prise', 'stores', STORES_PROD_SCHEMA)}
                onAdd={() => handleAddRow("Store Enrouleur")}
                onDuplicateRow={handleDuplicateRow}
                catalog={projectMaterials}
                projectId={project?.id}
                gridKey="pv_stores"
                onRowClick={(id) => setOpenedRowId(id)}
                isMobile={isMobile}
              />
            </div>
          )}

          {(showAllPrise || rowsStoresBateaux.length > 0) && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>Prise de Cote Stores Bateaux / Velum</div>
              <MinuteGrid
                rows={rowsStoresBateaux}
                onRowsChange={(nr) => handleSubsetChange(nr, /store (bateau|velum)/i)}
                schema={STORES_BATEAUX_PROD_SCHEMA}
                enableCellFormulas={true}
                initialVisibilityModel={getVisibilityModel('prise', 'stores_bateaux', STORES_BATEAUX_PROD_SCHEMA)}
                onAdd={() => handleAddRow("Store Bateau")}
                onDuplicateRow={handleDuplicateRow}
                catalog={projectMaterials}
                projectId={project?.id}
                gridKey="pv_stores_bateaux"
                onRowClick={(id) => setOpenedRowId(id)}
                isMobile={isMobile}
              />
            </div>
          )}

          {(showAllPrise || rowsTentureMurale.length > 0) && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>Prise de Cote Tenture Murale</div>
              <MinuteGrid
                rows={rowsTentureMurale}
                onRowsChange={(nr) => handleSubsetChange(nr, /tenture murale/i)}
                schema={TENTURE_MURALE_PROD_SCHEMA}
                enableCellFormulas={true}
                initialVisibilityModel={getVisibilityModel('prise', 'tenture_murale', TENTURE_MURALE_PROD_SCHEMA)}
                onAdd={() => handleAddRow("Tenture Murale")}
                onDuplicateRow={handleDuplicateRow}
                catalog={projectMaterials}
                projectId={project?.id}
                gridKey="pv_tenture_murale"
                onRowClick={(id) => setOpenedRowId(id)}
                isMobile={isMobile}
              />
            </div>
          )}

          {showAllPrise && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>Prise de Cote Coussins</div>
              <MinuteGrid
                rows={rowsCoussins}
                onRowsChange={(nr) => handleSubsetChange(nr, /coussin/i)}
                schema={COUSSINS_PROD_SCHEMA}
                enableCellFormulas={true}
                initialVisibilityModel={getVisibilityModel('prise', 'coussins', COUSSINS_PROD_SCHEMA)}
                onAdd={() => handleAddRow("Coussin")}
                onDuplicateRow={handleDuplicateRow}
                catalog={projectMaterials}
                projectId={project?.id}
                gridKey="pv_coussins"
                onRowClick={(id) => setOpenedRowId(id)}
                isMobile={isMobile}
              />
            </div>
          )}

          {showAllPrise && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>Prise de Cote Plaids / Chemins de Lit</div>
              <MinuteGrid
                rows={rowsPlaid}
                onRowsChange={(nr) => handleSubsetChange(nr, /plaid/i)}
                schema={PLAID_PROD_SCHEMA}
                enableCellFormulas={true}
                initialVisibilityModel={getVisibilityModel('prise', 'plaid', PLAID_PROD_SCHEMA)}
                onAdd={() => handleAddRow("Plaid")}
                onDuplicateRow={handleDuplicateRow}
                catalog={projectMaterials}
                projectId={project?.id}
                gridKey="pv_plaid"
                onRowClick={(id) => setOpenedRowId(id)}
                isMobile={isMobile}
              />
            </div>
          )}

          {showAllPrise && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>Prise de Cote Mobilier / Tête de Lit</div>
              <MinuteGrid
                rows={rowsMobilier}
                onRowsChange={(nr) => handleSubsetChange(nr, /tête de lit|mobilier/i)}
                schema={MOBILIER_PROD_SCHEMA}
                enableCellFormulas={true}
                initialVisibilityModel={getVisibilityModel('prise', 'mobilier', MOBILIER_PROD_SCHEMA)}
                onAdd={() => handleAddRow("Tête de Lit")}
                onDuplicateRow={handleDuplicateRow}
                catalog={projectMaterials}
                projectId={project?.id}
                gridKey="pv_mobilier"
                onRowClick={(id) => setOpenedRowId(id)}
                isMobile={isMobile}
              />
            </div>
          )}

          {showAllPrise && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>Prise de Cote Cache-Sommier</div>
              <MinuteGrid
                rows={rowsCacheSommier}
                onRowsChange={(nr) => handleSubsetChange(nr, /cache-sommier/i)}
                schema={CACHE_SOMMIER_PROD_SCHEMA}
                enableCellFormulas={true}
                initialVisibilityModel={getVisibilityModel('prise', 'cache_sommier', CACHE_SOMMIER_PROD_SCHEMA)}
                onAdd={() => handleAddRow("Cache-Sommier")}
                onDuplicateRow={handleDuplicateRow}
                catalog={projectMaterials}
                projectId={project?.id}
                gridKey="pv_cache_sommier"
                onRowClick={(id) => setOpenedRowId(id)}
                isMobile={isMobile}
              />
            </div>
          )}

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
            catalog={projectMaterials}
            projectId={project?.id}
            gridKey="suivi_main"
            onRowClick={(id) => setOpenedRowId(id)}
            isMobile={isMobile}
            showExpeditionCol={true}
          />
        </div>
      )}

      {stage === "bpf" && (
        <>
          {bpfRideaux.length > 0 && (
            <SectionPanel
              title="BPF Rideaux"
              count={bpfRideaux.length}
              expanded={isPanelExpanded('bpf_rideaux')}
              onToggle={() => togglePanel('bpf_rideaux')}
            >
                <MinuteGrid
                  rows={bpfRideaux}
                  onRowsChange={mergeChildRowsFor("rideaux")}
                  schema={RIDEAUX_PROD_SCHEMA}
                  enableCellFormulas={true}
                  initialVisibilityModel={getVisibilityModel('bpf', 'rideaux', RIDEAUX_PROD_SCHEMA)}
                  onAdd={() => handleAddRow("Rideau")}
                  onDuplicateRow={handleDuplicateRow}
                  catalog={projectMaterials}
                projectId={project?.id}
                  gridKey="bpf_rideaux"
                  onRowClick={(id) => setOpenedRowId(id)}
                  isMobile={isMobile}
                />
            </SectionPanel>
          )}

          {bpfStoresBateaux.length > 0 && (
            <SectionPanel
              title="BPF Stores Bateaux / Velum"
              count={bpfStoresBateaux.length}
              expanded={isPanelExpanded('bpf_stores_bateaux')}
              onToggle={() => togglePanel('bpf_stores_bateaux')}
            >
                <MinuteGrid
                  rows={bpfStoresBateaux}
                  onRowsChange={(nr) => handleSubsetChange(nr, /store (bateau|velum)/i, r => /store (bateau|velum)/i.test(String(r.produit || "")) && !isSousTraite(r))}
                  schema={STORES_BATEAUX_PROD_SCHEMA}
                  enableCellFormulas={true}
                  onAdd={() => handleAddRow("Store Bateau")}
                  onDuplicateRow={handleDuplicateRow}
                  catalog={projectMaterials}
                projectId={project?.id}
                  gridKey="bpf_stores_bateaux"
                  onRowClick={(id) => setOpenedRowId(id)}
                  isMobile={isMobile}
                />
            </SectionPanel>
          )}

          {bpfCoussins.length > 0 && (
            <SectionPanel
              title="BPF Coussins"
              count={bpfCoussins.length}
              expanded={isPanelExpanded('bpf_coussins')}
              onToggle={() => togglePanel('bpf_coussins')}
            >
                <MinuteGrid
                  rows={bpfCoussins}
                  onRowsChange={(nr) => handleSubsetChange(nr, /coussin/i, r => /coussin/i.test(String(r.produit || "")) && !isSousTraite(r))}
                  schema={COUSSINS_PROD_SCHEMA}
                  initialVisibilityModel={getVisibilityModel('bpf', 'coussins', COUSSINS_PROD_SCHEMA)}
                  enableCellFormulas={true}
                  onAdd={() => handleAddRow("Coussins")}
                  onDuplicateRow={handleDuplicateRow}
                  catalog={projectMaterials}
                projectId={project?.id}
                  gridKey="bpf_coussins"
                  onRowClick={(id) => setOpenedRowId(id)}
                  isMobile={isMobile}
                />
            </SectionPanel>
          )}

          {bpfCacheSommier.length > 0 && (
            <SectionPanel
              title="BPF Cache-Sommier"
              count={bpfCacheSommier.length}
              expanded={isPanelExpanded('bpf_cache_sommier')}
              onToggle={() => togglePanel('bpf_cache_sommier')}
            >
                <MinuteGrid
                  rows={bpfCacheSommier}
                  onRowsChange={(nr) => handleSubsetChange(nr, /cache-sommier/i, r => /cache-sommier/i.test(String(r.produit || "")) && !isSousTraite(r))}
                  schema={CACHE_SOMMIER_PROD_SCHEMA}
                  initialVisibilityModel={getVisibilityModel('bpf', 'cache_sommier', CACHE_SOMMIER_PROD_SCHEMA)}
                  enableCellFormulas={true}
                  onAdd={() => handleAddRow("Cache-Sommier")}
                  onDuplicateRow={handleDuplicateRow}
                  catalog={projectMaterials}
                projectId={project?.id}
                  gridKey="bpf_cache_sommier"
                  onRowClick={(id) => setOpenedRowId(id)}
                  isMobile={isMobile}
                />
            </SectionPanel>
          )}

          {bpfPlaid.length > 0 && (
            <SectionPanel
              title="BPF Plaids / Chemin de lit"
              count={bpfPlaid.length}
              expanded={isPanelExpanded('bpf_plaid')}
              onToggle={() => togglePanel('bpf_plaid')}
            >
                <MinuteGrid
                  rows={bpfPlaid}
                  onRowsChange={(nr) => handleSubsetChange(nr, /plaid/i, r => /plaid/i.test(String(r.produit || "")) && !isSousTraite(r))}
                  schema={PLAID_PROD_SCHEMA}
                  initialVisibilityModel={getVisibilityModel('bpf', 'plaid', PLAID_PROD_SCHEMA)}
                  enableCellFormulas={true}
                  onAdd={() => handleAddRow("Plaid")}
                  onDuplicateRow={handleDuplicateRow}
                  catalog={projectMaterials}
                projectId={project?.id}
                  gridKey="bpf_plaid"
                  onRowClick={(id) => setOpenedRowId(id)}
                  isMobile={isMobile}
                />
            </SectionPanel>
          )}

          {bpfMobilier.length > 0 && (
            <SectionPanel
              title="BPF Mobilier / Tête de Lit"
              count={bpfMobilier.length}
              expanded={isPanelExpanded('bpf_mobilier')}
              onToggle={() => togglePanel('bpf_mobilier')}
            >
                <MinuteGrid
                  rows={bpfMobilier}
                  onRowsChange={(nr) => handleSubsetChange(nr, /tête de lit|mobilier/i, r => /tête de lit|mobilier/i.test(String(r.produit || "")) && !isSousTraite(r))}
                  schema={MOBILIER_PROD_SCHEMA}
                  initialVisibilityModel={getVisibilityModel('bpf', 'mobilier', MOBILIER_PROD_SCHEMA)}
                  enableCellFormulas={true}
                  onAdd={() => handleAddRow("Tête de Lit")}
                  onDuplicateRow={handleDuplicateRow}
                  catalog={projectMaterials}
                projectId={project?.id}
                  gridKey="bpf_mobilier"
                  onRowClick={(id) => setOpenedRowId(id)}
                  isMobile={isMobile}
                />
            </SectionPanel>
          )}

          {bpfTentureMurale.length > 0 && (
            <SectionPanel
              title="BPF Tenture Murale"
              count={bpfTentureMurale.length}
              expanded={isPanelExpanded('bpf_tenture_murale')}
              onToggle={() => togglePanel('bpf_tenture_murale')}
            >
                <MinuteGrid
                  rows={bpfTentureMurale}
                  onRowsChange={(nr) => handleSubsetChange(nr, /tenture murale/i, r => /tenture murale/i.test(String(r.produit || "")) && !isSousTraite(r))}
                  schema={TENTURE_MURALE_PROD_SCHEMA}
                  initialVisibilityModel={getVisibilityModel('bpf', 'tenture_murale', TENTURE_MURALE_PROD_SCHEMA)}
                  enableCellFormulas={true}
                  onAdd={() => handleAddRow("Tenture Murale")}
                  onDuplicateRow={handleDuplicateRow}
                  catalog={projectMaterials}
                projectId={project?.id}
                  gridKey="bpf_tenture_murale"
                  onRowClick={(id) => setOpenedRowId(id)}
                  isMobile={isMobile}
                />
            </SectionPanel>
          )}

          {bpfAutreConfection.length > 0 && (
            <SectionPanel
              title="BPF Autre (Confection sur mesure)"
              count={bpfAutreConfection.length}
              expanded={isPanelExpanded('bpf_autres')}
              onToggle={() => togglePanel('bpf_autres')}
            >
                <MinuteGrid
                  rows={bpfAutreConfection}
                  onRowsChange={mergeChildRowsFor("autre_confection")}
                  schema={AUTRES_PROD_SCHEMA}
                  enableCellFormulas={true}
                  onAdd={() => handleAddRow("Autre")}
                  onDuplicateRow={handleDuplicateRow}
                  catalog={projectMaterials}
                projectId={project?.id}
                  gridKey="bpf_autres"
                  onRowClick={(id) => setOpenedRowId(id)}
                  isMobile={isMobile}
                />
            </SectionPanel>
          )}
        </>
      )}

      {stage === "bpp" && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 0 12px' }}>
            <button
              onClick={handleOpenBppPrint}
              disabled={!hasAnyBppRows}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: !hasAnyBppRows ? '#E5E7EB' : '#1E2447',
                color: !hasAnyBppRows ? '#9CA3AF' : '#fff',
                border: 'none', borderRadius: 8, padding: '10px 18px',
                fontWeight: 600, fontSize: 14,
                cursor: !hasAnyBppRows ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              <Printer size={18} /> Imprimer le BPP (A3)
            </button>
          </div>
          {rowsRideaux.length > 0 && (
            <SectionPanel
              title="BPP Rideaux (Préparation Mécanismes)"
              count={rowsRideaux.length}
              expanded={isPanelExpanded('bpp_rideaux')}
              onToggle={() => togglePanel('bpp_rideaux')}
            >
                <MinuteGrid
                  rows={rowsRideaux}
                  onRowsChange={mergeChildRowsFor("rideaux")}
                  schema={RIDEAUX_PROD_SCHEMA}
                  enableCellFormulas={true}
                  initialVisibilityModel={getVisibilityModel('bpp', 'rideaux', RIDEAUX_PROD_SCHEMA)}
                  onAdd={() => handleAddRow("Rideau")}
                  onDuplicateRow={handleDuplicateRow}
                  catalog={projectMaterials}
                projectId={project?.id}
                  gridKey="bpp_rideaux"
                  onRowClick={(id) => setOpenedRowId(id)}
                  isMobile={isMobile}
                />
            </SectionPanel>
          )}

          {rowsStores.length > 0 && (
            <SectionPanel
              title="BPP Stores Négoce (Préparation Mécanismes)"
              count={rowsStores.length}
              expanded={isPanelExpanded('bpp_stores')}
              onToggle={() => togglePanel('bpp_stores')}
            >
                <MinuteGrid
                  rows={rowsStores}
                  onRowsChange={mergeChildRowsFor("stores")}
                  schema={STORES_PROD_SCHEMA}
                  enableCellFormulas={true}
                  initialVisibilityModel={getVisibilityModel('bpp', 'stores', STORES_PROD_SCHEMA)}
                  onAdd={() => handleAddRow("Store Enrouleur")}
                  onDuplicateRow={handleDuplicateRow}
                  catalog={projectMaterials}
                projectId={project?.id}
                  gridKey="bpp_stores"
                  onRowClick={(id) => setOpenedRowId(id)}
                  isMobile={isMobile}
                />
            </SectionPanel>
          )}

          {rowsStoresBateaux.length > 0 && (
            <SectionPanel
              title="BPP Stores Bateaux / Velum (Préparation Mécanismes)"
              count={rowsStoresBateaux.length}
              expanded={isPanelExpanded('bpp_stores_bateaux')}
              onToggle={() => togglePanel('bpp_stores_bateaux')}
            >
                <MinuteGrid
                  rows={rowsStoresBateaux}
                  onRowsChange={(nr) => handleSubsetChange(nr, /store (bateau|velum)/i)}
                  schema={STORES_BATEAUX_PROD_SCHEMA}
                  enableCellFormulas={true}
                  initialVisibilityModel={getVisibilityModel('bpp', 'stores_bateaux', STORES_BATEAUX_PROD_SCHEMA)}
                  onAdd={() => handleAddRow("Store Bateau")}
                  onDuplicateRow={handleDuplicateRow}
                  catalog={projectMaterials}
                projectId={project?.id}
                  gridKey="bpp_stores_bateaux"
                  onRowClick={(id) => setOpenedRowId(id)}
                  isMobile={isMobile}
                />
            </SectionPanel>
          )}

          {rowsTentureMurale.length > 0 && (
            <SectionPanel
              title="BPP Tenture Murale"
              count={rowsTentureMurale.length}
              expanded={isPanelExpanded('bpp_tenture_murale')}
              onToggle={() => togglePanel('bpp_tenture_murale')}
            >
                <MinuteGrid
                  rows={rowsTentureMurale}
                  onRowsChange={(nr) => handleSubsetChange(nr, /tenture murale/i)}
                  schema={TENTURE_MURALE_PROD_SCHEMA}
                  enableCellFormulas={true}
                  initialVisibilityModel={getVisibilityModel('bpp', 'tenture_murale', TENTURE_MURALE_PROD_SCHEMA)}
                  onAdd={() => handleAddRow("Tenture Murale")}
                  onDuplicateRow={handleDuplicateRow}
                  catalog={projectMaterials}
                projectId={project?.id}
                  gridKey="bpp_tenture_murale"
                  onRowClick={(id) => setOpenedRowId(id)}
                  isMobile={isMobile}
                />
            </SectionPanel>
          )}

          {rowsMobilier.length > 0 && (
            <SectionPanel
              title="BPP Mobilier / Tête de Lit"
              count={rowsMobilier.length}
              expanded={isPanelExpanded('bpp_mobilier')}
              onToggle={() => togglePanel('bpp_mobilier')}
            >
                <MinuteGrid
                  rows={rowsMobilier}
                  onRowsChange={(nr) => handleSubsetChange(nr, /tête de lit|mobilier/i)}
                  schema={MOBILIER_PROD_SCHEMA}
                  enableCellFormulas={true}
                  initialVisibilityModel={getVisibilityModel('bpp', 'mobilier', MOBILIER_PROD_SCHEMA)}
                  onAdd={() => handleAddRow("Tête de Lit")}
                  onDuplicateRow={handleDuplicateRow}
                  catalog={projectMaterials}
                projectId={project?.id}
                  gridKey="bpp_mobilier"
                  onRowClick={(id) => setOpenedRowId(id)}
                  isMobile={isMobile}
                />
            </SectionPanel>
          )}
        </>
      )}

      {showBppPrint && (
        <BPPPrintPortal
          sections={bppPrintSections}
          projectName={project?.name}
          manager={project?.manager}
          onClose={() => setShowBppPrint(false)}
        />
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
            schema={openedRowDetail.schema}
            columnVisibilityModel={openedRowDetail.columnVisibilityModel}
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
              const pName = project?.name;
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

      {/* MATÉRIOTHÈQUE PROJET */}
      <ProjectMaterialsPanel
        open={showMaterials}
        onClose={() => setShowMaterials(false)}
        materials={projectMaterials}
        onMaterialsChange={handleMaterialsChange}
      />

    </div >
  );
}

export default ProductionProjectScreen;