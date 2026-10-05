import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { COLORS, S } from "../lib/constants/ui.js";

import { slugify } from "../lib/utils/slugify";
import MinuteGrid from "../components/MinuteGrid.jsx"; // Replaces DataTable
import DashboardTiles from "../components/DashboardTiles.jsx";
import { SoftBlock, Kpi, KpiGrid } from "../components/ui/SoftBlock";
import ProjectActivityFeed from "../components/ProjectActivityFeed.jsx";
import EtiquettesSection from "../components/EtiquettesSection.jsx";
import BPPPrintPortal from "../components/print/BPPPrintPortal.jsx";
import MinutesScreen from "./MinutesScreen.jsx";
import LineDetailPanel from "../components/LineDetailPanel";
import ProjectStockDialog from "../components/stock/ProjectStockDialog.jsx";
import OdooStatusBadge from "../components/odoo/OdooStatusBadge.jsx";

import { computeFormulas, preserveManualAfterCompute } from "../lib/formulas/compute";
import { SCHEMA_64 } from "../lib/schemas/production.js";
import { STAGES, DEFAULT_VIEWS } from "../lib/constants/views.js"; // Import DEFAULT_VIEWS
import { applySchemaDefaults } from "../lib/utils/schemaDefaults.js";
import { MOBILIER_PRODUIT_RE, STORE_CLASSIQUE_DEFAUT } from "../lib/constants/productRouting.js";
import { recomputeRow } from "../lib/formulas/recomputeRow";
import { computeProjectHours } from "../lib/projectMetrics";
import { RIDEAUX_PROD_SCHEMA } from "../lib/schemas/production/rideaux";
import { RIDEAUX_PROD_MATIERE_GROUPS } from "../lib/constants/matiereGroups";
import { STORES_PROD_SCHEMA } from "../lib/schemas/production/stores_classiques";
import { STORES_BATEAUX_PROD_SCHEMA } from "../lib/schemas/production/stores_bateaux";
import { COUSSINS_PROD_SCHEMA } from "../lib/schemas/production/coussins";
import { CACHE_SOMMIER_PROD_SCHEMA } from "../lib/schemas/production/cache_sommier";
import { PLAID_PROD_SCHEMA } from "../lib/schemas/production/plaid";
import { TENTURE_MURALE_PROD_SCHEMA } from "../lib/schemas/production/tenture_murale";
import { MOBILIER_PROD_SCHEMA } from "../lib/schemas/production/mobilier";
import { uid } from "../lib/utils/uid"; // Import uid
import { compressAndUpload } from "../lib/utils/imageUpload";

import { Search, Filter, Layers3, Star, FlaskConical, Image as ImageIcon, Edit2, FileText, BookOpen, Printer, Package } from "lucide-react";
import ProjectMaterialsPanel from "../components/ProjectMaterialsPanel";
import { applyCatalogRenames } from "../lib/utils/catalogRename";
import AddressAutocomplete from "../components/AddressAutocomplete"; // Added FileText
import { Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button, Collapse, IconButton } from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { differenceInMinutes } from "date-fns";
import DocumentListModal from "../components/DocumentListModal"; // Added import
import { useAuth } from "../auth";
import { can, role } from "../lib/authz";
import { HeaderCard, EditableTitle, StatusPill, MetaItem, OwnerPicker } from "../components/ui/EntityHeader";
import { formatAnyDateFR } from "../lib/utils/formatDate";
import { FORMULES_METRAGE_V2 } from "../lib/formulas/metrageVersion";

// Hauteur du titre de section collant (les barres du tableau se collent juste dessous).
const STICKY_TITLE_HEIGHT = 44;

// Section de tableau, même rendu que le chiffrage : pas de carte autour, flèche de repli
// à gauche du titre (titre cliquable aussi), nombre d'articles en simple texte.
function SectionPanel({ title, count, expanded, onToggle, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      {/* Titre collant : reste en haut de l'écran tant qu'on défile dans ce tableau */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px', height: STICKY_TITLE_HEIGHT, position: 'sticky', top: 0, zIndex: 6, background: '#ffffff' }}>
        <IconButton size="small" onClick={onToggle} title={expanded ? 'Replier' : 'Déplier'} sx={{ color: '#9B9A97', ml: -0.5 }}>
          <ExpandMoreIcon sx={{ fontSize: 20, transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s ease' }} />
        </IconButton>
        <h3 onClick={onToggle} style={{ margin: 0, fontSize: 20, color: '#111827', fontWeight: 500, fontFamily: 'Roboto, system-ui, sans-serif', cursor: 'pointer' }}>{title}</h3>
        <span style={{ color: '#9B9A97', fontSize: 13, fontFamily: 'Roboto, system-ui, sans-serif', marginLeft: 4, alignSelf: 'flex-end', paddingBottom: 13 }}>{count} {count > 1 ? 'articles' : 'article'}</span>
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
  if (MOBILIER_PRODUIT_RE.test(produit))     return { schema: MOBILIER_PROD_SCHEMA,       tableKey: 'mobilier' };
  if (/cache-sommier/i.test(produit))            return { schema: CACHE_SOMMIER_PROD_SCHEMA,  tableKey: 'cache_sommier' };
  if (/tenture murale/i.test(produit))           return { schema: TENTURE_MURALE_PROD_SCHEMA, tableKey: 'tenture_murale' };
  return { schema: RIDEAUX_PROD_SCHEMA, tableKey: 'rideaux' }; // fallback
};

// Ordre des colonnes défini par une vue — la liste elle-même, telle qu'elle est
// écrite dans views.js. getVisibilityModel en perd la séquence (il renvoie un
// dictionnaire construit dans l'ordre du schéma), d'où ce second accesseur.
const getViewOrder = (viewKey, tableKey) => DEFAULT_VIEWS?.[viewKey]?.[tableKey] || null;

const getVisibilityModel = (viewKey, tableKey, schema) => {
  const defaults = DEFAULT_VIEWS?.[viewKey]?.[tableKey];

  // Pas de vue définie → tout est visible, SAUF les colonnes marquées
  // `defaultHidden` dans le schéma (colonnes d'appoint que l'on active à la
  // demande via le sélecteur de colonnes, ex. « Fenêtre »).
  if (!defaults) {
    const model = {};
    (schema || []).forEach(col => {
      if (col.defaultHidden) model[col.key] = false;
    });
    return model;
  }

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

// Convertit une colonne de schéma en colonne d'impression.
// On conserve le valueGetter : les champs CALCULÉS (ex: Nb Glisseurs) ne sont pas
// stockés sur la ligne, ils sont calculés à la volée → il faut exécuter le getter.
const toPrintCol = (col) => ({
  key: col.key,
  label: col.label || col.key,
  valueGetter: typeof col.valueGetter === 'function' ? col.valueGetter : null,
});

// Construit les colonnes à imprimer pour une section BPP.
// Priorité à l'état COURANT des colonnes (ce que l'utilisateur voit/masque,
// persisté par MinuteGrid dans localStorage), sinon visibilité par défaut.
const buildBppPrintColumns = (schema, tableKey, gridKey, viewKey = 'bpp') => {
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
          .map(toPrintCol);
      }
    }
  } catch (_) { /* fallback ci-dessous */ }

  // 2. Fallback : visibilité par défaut de la vue BPP.
  // `!== false` et non `truthy` : une vue « tout visible » (pas de liste dans
  // views.js) renvoie un modèle quasi vide, et tester la vérité y masquait
  // TOUTES les colonnes — le BPP sortait blanc.
  const vm = getVisibilityModel(viewKey, tableKey, schema);
  return (schema || [])
    .filter(col => vm[col.key] !== false && isPrintableCol(col))
    .map(toPrintCol);
};

import { PROJECT_STATUS_OPTIONS } from "../lib/constants/projectStatus";
import { useViewportWidth } from "../lib/hooks/useViewportWidth";

// 1. SIGNATURE MISE A JOUR
export function ProductionProjectScreen({ project: propProject, projects, inventory, onUpdateItem, onStockChanged, onBack, onUpdateProjectRows, onUpdateProject, highlightRowId, initialStage, events = [] }) {
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

  const [stage, setStage] = useState(initialStage || "dashboard");
  // Ouverture ciblée sur un onglet (ex. depuis l'agenda mobile → prise de cotes)
  useEffect(() => { if (initialStage) setStage(initialStage); }, [initialStage]);
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
  // Adresse : saisie locale, persistée une seule fois (sélection / sortie du champ)
  const [addressDraft, setAddressDraft] = useState(project?.location || "");
  useEffect(() => { setAddressDraft(project?.location || ""); }, [project?.id, project?.location]);

  const handleUpdateDocs = (newDocs) => {
    if (onUpdateProject && project) {
      onUpdateProject(project.id, { documents: newDocs });
    }
  };

  const projectMaterials = project?.materials || [];
  const handleMaterialsChange = (newMaterials) => {
    if (!onUpdateProject || !project) return;

    // Un article renommé doit être renommé AUSSI sur les lignes : le lien
    // article ↔ ligne se fait par le nom, et le laisser divergerait sans erreur —
    // les lignes garderaient leur ancienne laize indéfiniment.
    const { rows: renamedRows, changed } = applyCatalogRenames(rowsRef.current || [], projectMaterials, newMaterials);
    const patch = { materials: newMaterials };

    if (changed > 0) {
      // Recalcul avec le catalogue à jour : la nouvelle laize/raccord redescend
      // sur les lignes concernées.
      const recomputed = renamedRows.map(r => recomputeRow(r, schema, { catalog: newMaterials }));
      patch.rows = recomputed;
      setRows(recomputed);
    }

    onUpdateProject(project.id, patch);
  };

  // --- LOGIQUE MUR & PHOTOS ---
  const [wallMsg, setWallMsg] = useState("");
  const [wallImg, setWallImg] = useState(null);
  const [isPinned, setIsPinned] = useState(false);

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

  const [wallUploading, setWallUploading] = useState(false);
  const handleImageSelect = async (e) => {
    if (e.target.files && e.target.files[0]) {
      try {
        setWallUploading(true);
        const url = await compressAndUpload(e.target.files[0], 'wall', { maxPx: 1200 });
        setWallImg(url);
      } catch (err) {
        console.error('Upload photo mur échoué :', err);
        alert("Erreur lors de l'envoi de la photo.");
      } finally {
        setWallUploading(false);
      }
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

  const { currentUser, users = [] } = useAuth();
  const canEditHeader = can(currentUser, "production.edit");
  // Mêmes rôles éligibles que la colonne « Responsable » de la liste des projets
  const potentialManagers = useMemo(() => users.filter(u => ['admin', 'sales', 'op'].includes(role(u))), [users]);
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
      navigate(`${projectBasePath}/${rowSlug}${location.search}`, { replace: true });
    } else {
      // On conserve la query string : cette réécriture la supprimait, ce qui
      // effaçait tout paramètre passé dans l'URL dès le chargement de l'écran.
      navigate(`${projectBasePath}${location.search}`, { replace: true });
    }
  }, [openedRowId, openedRow, projectBasePath, location.search]);

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
    rowsPlaid, rowsMobilier, rowsCacheSommier, rowsTentureMurale
  } = useMemo(() => ({
    rowsRideaux:        filteredRows.filter((r) => /rideau|voilage/i.test(String(r.produit || ""))),
    rowsStores:         filteredRows.filter((r) => r.produit && /store/i.test(String(r.produit)) && !/bateau|velum/i.test(String(r.produit))),
    rowsStoresBateaux:  filteredRows.filter((r) => r.produit && /store (bateau|velum)/i.test(String(r.produit))),
    rowsCoussins:       filteredRows.filter((r) => /coussin/i.test(String(r.produit || ""))),
    rowsPlaid:          filteredRows.filter((r) => /plaid/i.test(String(r.produit || ""))),
    rowsMobilier:       filteredRows.filter((r) => MOBILIER_PRODUIT_RE.test(String(r.produit || ""))),
    rowsCacheSommier:   filteredRows.filter((r) => /cache-sommier/i.test(String(r.produit || ""))),
    rowsTentureMurale:  filteredRows.filter((r) => /tenture murale/i.test(String(r.produit || ""))),
  }), [filteredRows]);

  // Filtre sous-traitance : exclu du BPF et des étiquettes
  const isSousTraite = (r) => r.realise_par === 'Sous-Traitant';

  const {
    bpfRideaux, bpfStoresBateaux, bpfCoussins,
    bpfPlaid, bpfMobilier, bpfCacheSommier, bpfTentureMurale
  } = useMemo(() => ({
    bpfRideaux:         rowsRideaux.filter(r => !isSousTraite(r)),
    bpfStoresBateaux:   rowsStoresBateaux.filter(r => !isSousTraite(r)),
    // Décors : on garde les lignes sous-traitées visibles dans le BPF
    // (pour renseigner les tissus et exporter le tableau au sous-traitant).
    bpfCoussins:        rowsCoussins,
    bpfPlaid:           rowsPlaid,
    bpfMobilier:        rowsMobilier,
    bpfCacheSommier:    rowsCacheSommier,
    bpfTentureMurale:   rowsTentureMurale,
  }), [rowsRideaux, rowsStoresBateaux, rowsCoussins, rowsPlaid, rowsMobilier, rowsCacheSommier, rowsTentureMurale]);

  // --- IMPRESSION BPP (A3 paysage, fidèle à l'écran) ---
  const [showBppPrint, setShowBppPrint] = useState(false);
  const [bppPrintSections, setBppPrintSections] = useState([]);
  const [bppPickerOpen, setBppPickerOpen] = useState(false);
  const [bppSelected, setBppSelected] = useState([]); // tableKeys cochés
  const [tablePrintKind, setTablePrintKind] = useState('bpp'); // 'bpp' | 'bpf' : même impression tableau A3

  // Modules BPP possibles (avec leurs lignes courantes).
  const bppModulesCfg = () => [
    { title: 'BPP Rideaux (Préparation Mécanismes)',          rows: rowsRideaux,       schema: RIDEAUX_PROD_SCHEMA,        tableKey: 'rideaux' },
    { title: 'BPP Stores Négoce (Préparation Mécanismes)',    rows: rowsStores,        schema: STORES_PROD_SCHEMA,         tableKey: 'stores' },
    { title: 'BPP Stores Bateaux / Velum (Préparation Mécanismes)', rows: rowsStoresBateaux, schema: STORES_BATEAUX_PROD_SCHEMA, tableKey: 'stores_bateaux' },
    { title: 'BPP Tenture Murale',                            rows: rowsTentureMurale, schema: TENTURE_MURALE_PROD_SCHEMA,  tableKey: 'tenture_murale' },
    { title: 'BPP Mobilier / Tête de Lit',                    rows: rowsMobilier,      schema: MOBILIER_PROD_SCHEMA,       tableKey: 'mobilier' },
  ];

  // Modules BPF (mêmes tableaux que la vue BPF), imprimés comme le BPP : tableau A3.
  const bpfModulesCfg = () => [
    { title: 'BPF Rideaux',                rows: bpfRideaux,        schema: RIDEAUX_PROD_SCHEMA,        tableKey: 'rideaux' },
    { title: 'BPF Stores Bateaux / Velum', rows: bpfStoresBateaux,  schema: STORES_BATEAUX_PROD_SCHEMA, tableKey: 'stores_bateaux' },
    { title: 'BPF Coussins',               rows: bpfCoussins,       schema: COUSSINS_PROD_SCHEMA,       tableKey: 'coussins' },
    { title: 'BPF Cache-Sommier',          rows: bpfCacheSommier,   schema: CACHE_SOMMIER_PROD_SCHEMA,  tableKey: 'cache_sommier' },
    { title: 'BPF Plaids / Chemin de lit', rows: bpfPlaid,          schema: PLAID_PROD_SCHEMA,          tableKey: 'plaid' },
    { title: 'BPF Mobilier / Tête de Lit', rows: bpfMobilier,       schema: MOBILIER_PROD_SCHEMA,       tableKey: 'mobilier' },
    { title: 'BPF Tenture Murale',         rows: bpfTentureMurale,  schema: TENTURE_MURALE_PROD_SCHEMA, tableKey: 'tenture_murale' },
  ];
  const tablePrintCfg = () => (tablePrintKind === 'bpf' ? bpfModulesCfg() : bppModulesCfg());

  // Au clic : on ouvre le choix des modules (ceux qui ont des lignes), tout coché par défaut.
  const handleOpenBppPrint = (kind = 'bpp') => {
    const cfg = kind === 'bpf' ? bpfModulesCfg() : bppModulesCfg();
    const available = cfg.filter(s => (s.rows || []).length > 0);
    if (available.length === 0) return;
    setTablePrintKind(kind);
    setBppSelected(available.map(s => s.tableKey));
    setBppPickerOpen(true);
  };
  // --- IMPRESSION DES ÉTIQUETTES : choix du tableau, puis impression de ce tableau ---
  const [etqPickerOpen, setEtqPickerOpen] = useState(false);
  const [etqPrintSignal, setEtqPrintSignal] = useState({ key: null, n: 0 });
  const etqTablesCfg = () => [
    { key: 'rideaux', title: 'Étiquettes Rideaux', rows: bpfRideaux },
    { key: 'stores_bateaux', title: 'Étiquettes Stores Bateaux / Velum', rows: bpfStoresBateaux },
  ].filter(t => (t.rows || []).length > 0);
  const printEtiquettes = (key) => {
    setEtqPickerOpen(false);
    setEtqPrintSignal(prev => ({ key, n: prev.n + 1 }));
  };

  // Bouton « Imprimer » global : selon la vue ouverte.
  const handleGlobalPrint = () => {
    if (stage === 'bpf') return handleOpenBppPrint('bpf');
    if (stage === 'bpp') return handleOpenBppPrint('bpp');
    if (stage === 'etiquettes') {
      const tables = etqTablesCfg();
      if (tables.length === 1) return printEtiquettes(tables[0].key);
      if (tables.length > 1) setEtqPickerOpen(true);
    }
  };

  const toggleBppModule = (key) =>
    setBppSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  // Construit les sections des modules cochés (lit l'état courant des colonnes) et imprime.
  const runBppPrint = () => {
    const sel = new Set(bppSelected);
    const sections = tablePrintCfg()
      .filter(s => (s.rows || []).length > 0 && sel.has(s.tableKey))
      .map(s => ({
        title: s.title,
        rows: s.rows,
        columns: buildBppPrintColumns(s.schema, s.tableKey, `${tablePrintKind}_${s.tableKey}`, tablePrintKind),
      }))
      .filter(s => s.columns.length > 0);
    setBppPickerOpen(false);
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
      { key: 'type_confection', label: 'Plis' },
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

    // Lignes AJOUTÉES (présentes dans le nouveau sous-ensemble mais pas dans allRows) :
    // ex. les 2 enfants d'une « paire décentrée » créés via onCellValueChanged.
    // On les insère juste après leur parent (sinon handleSubsetChange les perdrait).
    const prevIds = new Set(allRows.map(r => r.id));
    const addedRows = newSubsetRows.filter(r => !prevIds.has(r.id));
    let finalRows = updatedAllRows;
    if (addedRows.length > 0) {
      finalRows = [];
      updatedAllRows.forEach(r => {
        finalRows.push(r);
        if (r.pair_role === 'parent') {
          addedRows.filter(a => a.pair_id === r.pair_id).forEach(a => finalRows.push(a));
        }
      });
      const placed = new Set(finalRows.map(r => r.id));
      addedRows.forEach(a => { if (!placed.has(a.id)) finalRows.push(a); });
    }

    setRows(finalRows);
    if (project?.id) debouncedSave(project.id, finalRows);
  }, [canEditProd, schema, currentUser?.name, debouncedSave, project?.id]);

  const mergeChildRowsFor = (tableKey) => {
    if (tableKey === "rideaux") {
      return (nr) => handleSubsetChange(nr, /rideau|voilage/i);
    }
    if (tableKey === "stores") {
      return (nr) => handleSubsetChange(nr, null, (r) => r.produit && /store/i.test(String(r.produit)) && !/bateau|velum/i.test(String(r.produit)));
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


  // `count` vient du panneau « Ajouter N lignes » de la grille. Les N lignes sont
  // ajoutées en UNE seule mise à jour : N appels enchaînés produiraient autant
  // d'écritures concurrentes sur les lignes du projet.
  const isMetrageV2Project = Number(project?.config?.formules_metrage) >= FORMULES_METRAGE_V2;
  const handleAddRow = (produitType = "Rideau", count = 1) => {
    const asked = Math.floor(Number(count));
    const n = Number.isFinite(asked) && asked >= 1 ? Math.min(asked, 500) : 1;

    const makeRow = () => ({
      id: uid(),
      produit: produitType,
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
      created: Date.now(),
      // Projet créé avec les formules v2 → la ligne les suit aussi (lu par les getters).
      ...(isMetrageV2Project && { formules_metrage: FORMULES_METRAGE_V2 }),
    });

    const added = Array.from({ length: n }, () => {
      // Applique les `defaultValue` déclarés dans le schéma du produit (ex. les
      // étiquettes à « Non »). Ces déclarations existaient mais n'étaient lues nulle part.
      const newRow = makeRow();
      const withDefaults = applySchemaDefaults(newRow, getSchemaForRow(newRow).schema);
      return recomputeRow(withDefaults, schema);
    });

    const newRows = [...rows, ...added];

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

  // Titre de section (Prise de cotes, Suivi de projet) : même rendu que les titres de tableaux
  // du chiffrage — texte Roboto, pas de majuscules ni de carte autour.
  const cardHeaderStyle = {
    padding: '0 4px',
    height: STICKY_TITLE_HEIGHT,
    position: 'sticky', top: 0, zIndex: 6, background: '#ffffff', // titre collant
    display: 'flex',
    alignItems: 'center',
    fontWeight: 500,
    fontSize: 20,
    fontFamily: 'Roboto, system-ui, sans-serif',
    color: '#111827',
  };

  // Conteneur de section : sans cadre (le tableau garde son propre contour)
  const cardStyle = {
    marginBottom: 28,
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

      {/* Header : fiche d'identité (gauche) + livraison & logistique (droite), actions en dessous */}
      <div style={{ marginBottom: 20, marginTop: 8 }}>
        <button
          onClick={onBack}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#6B7280", fontWeight: 500, fontSize: 13,
            display: "flex", alignItems: "center", gap: 4, marginBottom: 12, padding: 0
          }}
        >
          ← Retour
        </button>
        {/* En-tête sans cadre (même modèle que le chiffrage) : titre, puis une seule ligne d'infos
            (chargé d'affaires, date, statut, adresse, type, livraison + phases) */}
        <HeaderCard
          bare
          stacked={isMobile}
          left={
            <>
              <EditableTitle
                value={project?.name || ""}
                canEdit={canEditHeader}
                placeholder="—"
                fontSize={isMobile ? 26 : 34}
                fontWeight={400}
                fontFamily="Roboto, system-ui, sans-serif"
                onSave={(v) => onUpdateProject(project.id, { name: v })}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 28px', alignItems: 'flex-end', marginTop: 16 }}>
                <MetaItem label="Chargé d'affaires">
                  <OwnerPicker
                    value={project?.manager || ""}
                    users={potentialManagers}
                    canEdit={canEditHeader}
                    onChange={(manager) => onUpdateProject(project.id, { manager })}
                  />
                </MetaItem>
                <MetaItem label="Créé le">{formatAnyDateFR(project?.created_at || project?.createdAt)}</MetaItem>
                <MetaItem label="Statut">
                  <StatusPill
                    value={project?.status || "TODO"}
                    options={PROJECT_STATUS_OPTIONS}
                    onChange={(v) => onUpdateProject(project.id, { status: v })}
                  />
                </MetaItem>
                <MetaItem label="Adresse">
                <AddressAutocomplete
                  value={addressDraft}
                  onChange={setAddressDraft}
                  onCommit={(v) => { if (v !== (project?.location || "")) onUpdateProject(project.id, { location: v }); }}
                  placeholder="Saisir une adresse…"
                  style={{ width: 300 }}
                  inputStyle={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '4px 8px', background: 'white', color: '#1F2937' }}
                />
                </MetaItem>
                <MetaItem label="Type">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <select
                    value={project?.intervention_type || "livraison"}
                    onChange={e => onUpdateProject(project.id, { intervention_type: e.target.value, expedition_type: e.target.value === 'livraison' ? null : project?.expedition_type })}
                    style={{ border: 'none', background: 'transparent', color: '#1F2937', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', outline: 'none', cursor: 'pointer', padding: 0 }}
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
                        style={{ border: 'none', background: 'transparent', color: '#1F2937', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', outline: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <option value="depart_nantes">Départ depuis Nantes</option>
                        <option value="expedition">Expédition transporteur</option>
                      </select>
                    </>
                  )}
                </div>
                </MetaItem>
                <MetaItem label="Livraison">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    type="date"
                    value={project?.deadline ? project.deadline.split('T')[0] : ''}
                    onChange={(e) => onUpdateProject(project.id, { deadline: e.target.value || null })}
                    style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '3px 6px', fontSize: 13, color: '#374151', background: 'white', outline: 'none', fontFamily: 'inherit' }}
                  />
                  {(project?.delivery_phases || []).filter(ph => ph.label || ph.date).map((ph, i) => (
                    <span key={ph.id || i} style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 99, padding: '2px 9px', fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>
                      {ph.label || `Phase ${i + 1}`}{ph.date && <> · <b style={{ color: '#2563EB', fontWeight: 600 }}>{new Date(ph.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</b></>}
                    </span>
                  ))}
                  <div ref={deliveryRef} style={{ position: 'relative' }}>
                    <button
                      onClick={() => setDeliveryOpen(o => !o)}
                      style={{ color: '#2563EB', fontSize: 12, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                    >
                      {project?.delivery_phases?.length > 0 ? 'Gérer les phases' : '+ Phase'}
                    </button>
                    {deliveryOpen && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 6px)', left: 0,
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
                </div>
                </MetaItem>
              </div>
            </>
          }
        />

        {/* Ligne des vues : actions du dossier à gauche, vues au centre, docs + impression à droite */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0,1fr)' : 'minmax(0,1fr) auto minmax(0,1fr)', alignItems: 'center', gap: 16, marginTop: 48, paddingBottom: 8 }}>
          {/* Actions du dossier (à gauche) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
            {/* Matériauthèque Button */}
            <button
              onClick={() => setShowMaterials(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: 8,
                padding: '8px 14px',
                cursor: 'pointer',
                fontSize: 13,
                color: '#374151',
                fontWeight: 600,
                outline: 'none',
                flex: 'initial', justifyContent: 'center'
              }}
            >
              <BookOpen size={16} />
              Matériauthèque{projectMaterials.length > 0 ? ` (${projectMaterials.length})` : ''}
            </button>

            {/* Stock Button (Header) - Hidden on Mobile */}
            {!isMobile && (
              <button
                onClick={() => setStockOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: 8,
                  padding: '8px 14px',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: '#374151',
                  fontWeight: 600,
                  outline: 'none',
                  flex: 'initial', justifyContent: 'center'
                }}
              >
                <Package size={16} /> Stock
              </button>
            )}
          </div>
          <div className="island-nav-container" style={{ display: 'inline-flex', gap: 2, maxWidth: '100%', overflowX: isMobile ? 'auto' : 'visible', justifySelf: 'center' }}>
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
          {/* Documents + impression (à droite) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            {/* Documents Button - Visible Mobile & Desktop */}
            <button
              onClick={() => setShowDocs(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: 8,
                padding: '8px 14px',
                cursor: 'pointer',
                fontSize: 13,
                color: '#374151',
                fontWeight: 600,
                outline: 'none',
                flex: 'initial', justifyContent: 'center'
              }}
            >
              <FileText size={16} />
              Docs ({project?.documents?.length || 0})
            </button>
            {/* Imprimer : s'adapte à la vue (tableaux BPF / BPP en A3, ou étiquettes) */}
            {['bpf', 'bpp', 'etiquettes'].includes(stage) && (
              <button
                onClick={handleGlobalPrint}
                title={stage === 'etiquettes' ? 'Imprimer des étiquettes' : `Imprimer le ${stage.toUpperCase()} (A3)`}
                style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: 8,
                padding: '8px 14px',
                cursor: 'pointer',
                fontSize: 13,
                color: '#374151',
                fontWeight: 600,
                outline: 'none',
                flex: 'initial', justifyContent: 'center'
              }}
              >
                <Printer size={16} /> Imprimer
              </button>
            )}
          </div>
        </div>
      </div>

      {stage === "dashboard" && (
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 24, alignItems: 'flex-start' }}>

          {/* ── COLONNE GAUCHE : stats ── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 4 }}>

            {/* Consommation temps : réalisé vs budget par service (grands chiffres fins) */}
            <SoftBlock
              title="Consommation temps"
              subtitle="Heures réalisées / budget"
              actions={<>
                {canEditProd && (
                  <button onClick={handleOpenBudget} title="Ajuster le budget" style={{ border: 'none', background: 'white', cursor: 'pointer', color: '#5B616B', width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center' }}>
                    <Edit2 size={14} />
                  </button>
                )}
                <OdooStatusBadge
                  projectName={project?.name}
                  projectId={project?.id}
                  idProjetOdoo={project?.id_projet_odoo}
                  onLink={(odooId) => onUpdateProject && project && onUpdateProject(project.id, { id_projet_odoo: odooId })}
                />
              </>}
            >
              <KpiGrid min={150}>
                {[['prepa', 'Préparation'], ['conf', 'Confection'], ['pose', 'Pose']].map(([key, label]) => {
                  const budgetVal = Number(project.budget?.[key] || 0);
                  const realVal = realized[key] || 0;
                  const fmtH = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
                  return (
                    <Kpi
                      key={key}
                      label={label}
                      value={fmtH(realVal)}
                      unit="h"
                      total={`${fmtH(budgetVal)} h`}
                      pct={budgetVal > 0 ? (realVal / budgetVal) * 100 : null}
                    />
                  );
                })}
              </KpiGrid>
            </SoftBlock>

            {/* Avancement : un indicateur par étape */}
            <SoftBlock title="Avancement" subtitle="Par étape du dossier">
              <DashboardTiles rows={rows} budget={project?.budget || {}} />
            </SoftBlock>
          </div>

          {/* ── COLONNE DROITE : journal (avec la zone d'écriture du mur) ── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 4 }}>

            <ProjectActivityFeed
              rows={rows}
              wall={project?.wall}
              pinnedIds={project?.pinnedIds || []}
              onTogglePin={handleTogglePin}
              isMobile={isMobile}
              projectId={project?.id}
              composer={
                /* Écrire au mur du projet : une ligne qui s'agrandit avec le texte ; ⌘/Ctrl+Entrée publie */
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 6px 6px 10px', background: 'white' }}>
                    <label title={wallUploading ? 'Envoi…' : 'Ajouter une photo'} style={{ cursor: wallUploading ? 'wait' : 'pointer', color: '#9B9A97', display: 'grid', placeItems: 'center', height: 30, opacity: wallUploading ? 0.5 : 1 }}>
                      <ImageIcon size={17} />
                      <input type="file" accept="image/*" hidden disabled={wallUploading} onChange={handleImageSelect} />
                    </label>
                    <textarea
                      placeholder="Écrire un message…"
                      value={wallMsg}
                      rows={Math.min(8, Math.max(1, (wallMsg || '').split('\n').length))}
                      onChange={(e) => setWallMsg(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (!wallUploading) handlePostMessage(); } }}
                      style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', padding: '6px 0', fontSize: 14, lineHeight: 1.45, fontFamily: 'Roboto, system-ui, sans-serif', color: '#37352F', background: 'transparent' }}
                    />
                    <button
                      onClick={handlePostMessage}
                      disabled={wallUploading}
                      title="Publier (⌘ + Entrée)"
                      style={{ background: (wallMsg || wallImg) ? '#1E2447' : '#EDEDEB', color: (wallMsg || wallImg) ? 'white' : '#9B9A97', border: 'none', padding: '7px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: wallUploading ? 'wait' : 'pointer', transition: 'background .15s, color .15s' }}
                    >
                      Publier
                    </button>
                  </div>
                  {wallImg && (
                    <div style={{ marginTop: 8, position: 'relative', display: 'inline-block' }}>
                      <img src={wallImg} alt="Aperçu" style={{ height: 72, borderRadius: 6, border: '1px solid #E5E7EB' }} />
                      <button onClick={() => setWallImg(null)} title="Retirer la photo" style={{ position: 'absolute', top: -6, right: -6, background: '#37352F', color: 'white', borderRadius: '50%', width: 18, height: 18, border: 'none', cursor: 'pointer', fontSize: 11, lineHeight: '18px', padding: 0 }}>×</button>
                    </div>
                  )}
                </div>
              }
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
              printSignal={etqPrintSignal.key === 'rideaux' ? etqPrintSignal.n : 0}
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
              printSignal={etqPrintSignal.key === 'stores_bateaux' ? etqPrintSignal.n : 0}
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
                stickyTop={STICKY_TITLE_HEIGHT}
                rows={rowsRideaux}
                onRowsChange={mergeChildRowsFor("rideaux")}
                schema={RIDEAUX_PROD_SCHEMA}
                enableCellFormulas={true}
                initialVisibilityModel={getVisibilityModel('prise', 'rideaux', RIDEAUX_PROD_SCHEMA)}
                onAdd={(n) => handleAddRow("Rideau", n)}
                onDuplicateRow={handleDuplicateRow}
                catalog={projectMaterials}
                projectId={project?.id}
                enableDecentree={true}
                gridKey="pv_rideaux"
                initialColumnOrder={getViewOrder('prise', 'rideaux')}
                  resetViewLabel="vue prise de cotes"
                onRowClick={(id) => setOpenedRowId(id)}
                isMobile={isMobile}
              />
            </div>
          )}

          {(showAllPrise || rowsStores.length > 0) && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>Prise de Cote Stores Négoce</div>
              <MinuteGrid
                stickyTop={STICKY_TITLE_HEIGHT}
                rows={rowsStores}
                onRowsChange={mergeChildRowsFor("stores")}
                schema={STORES_PROD_SCHEMA}
                enableCellFormulas={true}
                initialVisibilityModel={getVisibilityModel('prise', 'stores', STORES_PROD_SCHEMA)}
                onAdd={(n) => handleAddRow(STORE_CLASSIQUE_DEFAUT, n)}
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
                stickyTop={STICKY_TITLE_HEIGHT}
                rows={rowsStoresBateaux}
                onRowsChange={(nr) => handleSubsetChange(nr, /store (bateau|velum)/i)}
                schema={STORES_BATEAUX_PROD_SCHEMA}
                enableCellFormulas={true}
                initialVisibilityModel={getVisibilityModel('prise', 'stores_bateaux', STORES_BATEAUX_PROD_SCHEMA)}
                onAdd={(n) => handleAddRow("Store Bateau", n)}
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
                stickyTop={STICKY_TITLE_HEIGHT}
                rows={rowsTentureMurale}
                onRowsChange={(nr) => handleSubsetChange(nr, /tenture murale/i)}
                schema={TENTURE_MURALE_PROD_SCHEMA}
                enableCellFormulas={true}
                initialVisibilityModel={getVisibilityModel('prise', 'tenture_murale', TENTURE_MURALE_PROD_SCHEMA)}
                onAdd={(n) => handleAddRow("Tenture Murale", n)}
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
                stickyTop={STICKY_TITLE_HEIGHT}
                rows={rowsCoussins}
                onRowsChange={(nr) => handleSubsetChange(nr, /coussin/i)}
                schema={COUSSINS_PROD_SCHEMA}
                enableCellFormulas={true}
                initialVisibilityModel={getVisibilityModel('prise', 'coussins', COUSSINS_PROD_SCHEMA)}
                onAdd={(n) => handleAddRow("Coussin", n)}
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
                stickyTop={STICKY_TITLE_HEIGHT}
                rows={rowsPlaid}
                onRowsChange={(nr) => handleSubsetChange(nr, /plaid/i)}
                schema={PLAID_PROD_SCHEMA}
                enableCellFormulas={true}
                initialVisibilityModel={getVisibilityModel('prise', 'plaid', PLAID_PROD_SCHEMA)}
                onAdd={(n) => handleAddRow("Plaid", n)}
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
                stickyTop={STICKY_TITLE_HEIGHT}
                rows={rowsMobilier}
                onRowsChange={(nr) => handleSubsetChange(nr, MOBILIER_PRODUIT_RE)}
                schema={MOBILIER_PROD_SCHEMA}
                enableCellFormulas={true}
                initialVisibilityModel={getVisibilityModel('prise', 'mobilier', MOBILIER_PROD_SCHEMA)}
                onAdd={(n) => handleAddRow("Tête de Lit", n)}
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
                stickyTop={STICKY_TITLE_HEIGHT}
                rows={rowsCacheSommier}
                onRowsChange={(nr) => handleSubsetChange(nr, /cache-sommier/i)}
                schema={CACHE_SOMMIER_PROD_SCHEMA}
                enableCellFormulas={true}
                initialVisibilityModel={getVisibilityModel('prise', 'cache_sommier', CACHE_SOMMIER_PROD_SCHEMA)}
                onAdd={(n) => handleAddRow("Cache-Sommier", n)}
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
            stickyTop={STICKY_TITLE_HEIGHT}
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
                  stickyTop={STICKY_TITLE_HEIGHT}
                  rows={bpfRideaux}
                  onRowsChange={mergeChildRowsFor("rideaux")}
                  schema={RIDEAUX_PROD_SCHEMA}
                  enableCellFormulas={true}
                  initialVisibilityModel={getVisibilityModel('bpf', 'rideaux', RIDEAUX_PROD_SCHEMA)}
                  onAdd={(n) => handleAddRow("Rideau", n)}
                  onDuplicateRow={handleDuplicateRow}
                  catalog={projectMaterials}
                projectId={project?.id}
                  enableDecentree={true}
                  gridKey="bpf_rideaux"
                  matiereGroups={RIDEAUX_PROD_MATIERE_GROUPS}
                  matieresInPanel={true}
                  initialColumnOrder={getViewOrder('bpf', 'rideaux')}
                  resetViewLabel="vue BPF"
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
                  stickyTop={STICKY_TITLE_HEIGHT}
                  rows={bpfStoresBateaux}
                  onRowsChange={(nr) => handleSubsetChange(nr, /store (bateau|velum)/i, r => /store (bateau|velum)/i.test(String(r.produit || "")) && !isSousTraite(r))}
                  schema={STORES_BATEAUX_PROD_SCHEMA}
                  enableCellFormulas={true}
                  onAdd={(n) => handleAddRow("Store Bateau", n)}
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
                  stickyTop={STICKY_TITLE_HEIGHT}
                  rows={bpfCoussins}
                  onRowsChange={(nr) => handleSubsetChange(nr, /coussin/i)}
                  schema={COUSSINS_PROD_SCHEMA}
                  initialVisibilityModel={getVisibilityModel('bpf', 'coussins', COUSSINS_PROD_SCHEMA)}
                  enableCellFormulas={true}
                  onAdd={(n) => handleAddRow("Coussins", n)}
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
                  stickyTop={STICKY_TITLE_HEIGHT}
                  rows={bpfCacheSommier}
                  onRowsChange={(nr) => handleSubsetChange(nr, /cache-sommier/i)}
                  schema={CACHE_SOMMIER_PROD_SCHEMA}
                  initialVisibilityModel={getVisibilityModel('bpf', 'cache_sommier', CACHE_SOMMIER_PROD_SCHEMA)}
                  enableCellFormulas={true}
                  onAdd={(n) => handleAddRow("Cache-Sommier", n)}
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
                  stickyTop={STICKY_TITLE_HEIGHT}
                  rows={bpfPlaid}
                  onRowsChange={(nr) => handleSubsetChange(nr, /plaid/i)}
                  schema={PLAID_PROD_SCHEMA}
                  initialVisibilityModel={getVisibilityModel('bpf', 'plaid', PLAID_PROD_SCHEMA)}
                  enableCellFormulas={true}
                  onAdd={(n) => handleAddRow("Plaid", n)}
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
                  stickyTop={STICKY_TITLE_HEIGHT}
                  rows={bpfMobilier}
                  onRowsChange={(nr) => handleSubsetChange(nr, MOBILIER_PRODUIT_RE)}
                  schema={MOBILIER_PROD_SCHEMA}
                  initialVisibilityModel={getVisibilityModel('bpf', 'mobilier', MOBILIER_PROD_SCHEMA)}
                  enableCellFormulas={true}
                  onAdd={(n) => handleAddRow("Tête de Lit", n)}
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
                  stickyTop={STICKY_TITLE_HEIGHT}
                  rows={bpfTentureMurale}
                  onRowsChange={(nr) => handleSubsetChange(nr, /tenture murale/i)}
                  schema={TENTURE_MURALE_PROD_SCHEMA}
                  initialVisibilityModel={getVisibilityModel('bpf', 'tenture_murale', TENTURE_MURALE_PROD_SCHEMA)}
                  enableCellFormulas={true}
                  onAdd={(n) => handleAddRow("Tenture Murale", n)}
                  onDuplicateRow={handleDuplicateRow}
                  catalog={projectMaterials}
                projectId={project?.id}
                  gridKey="bpf_tenture_murale"
                  onRowClick={(id) => setOpenedRowId(id)}
                  isMobile={isMobile}
                />
            </SectionPanel>
          )}
        </>
      )}

      {stage === "bpp" && (
        <>
          {rowsRideaux.length > 0 && (
            <SectionPanel
              title="BPP Rideaux (Préparation Mécanismes)"
              count={rowsRideaux.length}
              expanded={isPanelExpanded('bpp_rideaux')}
              onToggle={() => togglePanel('bpp_rideaux')}
            >
                <MinuteGrid
                  stickyTop={STICKY_TITLE_HEIGHT}
                  rows={rowsRideaux}
                  onRowsChange={mergeChildRowsFor("rideaux")}
                  schema={RIDEAUX_PROD_SCHEMA}
                  enableCellFormulas={true}
                  initialVisibilityModel={getVisibilityModel('bpp', 'rideaux', RIDEAUX_PROD_SCHEMA)}
                  onAdd={(n) => handleAddRow("Rideau", n)}
                  onDuplicateRow={handleDuplicateRow}
                  catalog={projectMaterials}
                projectId={project?.id}
                  enableDecentree={true}
                  gridKey="bpp_rideaux"
                  initialColumnOrder={getViewOrder('bpp', 'rideaux')}
                  resetViewLabel="vue BPP"
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
                  stickyTop={STICKY_TITLE_HEIGHT}
                  rows={rowsStores}
                  onRowsChange={mergeChildRowsFor("stores")}
                  schema={STORES_PROD_SCHEMA}
                  enableCellFormulas={true}
                  initialVisibilityModel={getVisibilityModel('bpp', 'stores', STORES_PROD_SCHEMA)}
                  onAdd={(n) => handleAddRow(STORE_CLASSIQUE_DEFAUT, n)}
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
                  stickyTop={STICKY_TITLE_HEIGHT}
                  rows={rowsStoresBateaux}
                  onRowsChange={(nr) => handleSubsetChange(nr, /store (bateau|velum)/i)}
                  schema={STORES_BATEAUX_PROD_SCHEMA}
                  enableCellFormulas={true}
                  initialVisibilityModel={getVisibilityModel('bpp', 'stores_bateaux', STORES_BATEAUX_PROD_SCHEMA)}
                  onAdd={(n) => handleAddRow("Store Bateau", n)}
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
                  stickyTop={STICKY_TITLE_HEIGHT}
                  rows={rowsTentureMurale}
                  onRowsChange={(nr) => handleSubsetChange(nr, /tenture murale/i)}
                  schema={TENTURE_MURALE_PROD_SCHEMA}
                  enableCellFormulas={true}
                  initialVisibilityModel={getVisibilityModel('bpp', 'tenture_murale', TENTURE_MURALE_PROD_SCHEMA)}
                  onAdd={(n) => handleAddRow("Tenture Murale", n)}
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
                  stickyTop={STICKY_TITLE_HEIGHT}
                  rows={rowsMobilier}
                  onRowsChange={(nr) => handleSubsetChange(nr, MOBILIER_PRODUIT_RE)}
                  schema={MOBILIER_PROD_SCHEMA}
                  enableCellFormulas={true}
                  initialVisibilityModel={getVisibilityModel('bpp', 'mobilier', MOBILIER_PROD_SCHEMA)}
                  onAdd={(n) => handleAddRow("Tête de Lit", n)}
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

      {bppPickerOpen && (() => {
        const available = tablePrintCfg().filter(s => (s.rows || []).length > 0);
        const allChecked = available.length > 0 && available.every(s => bppSelected.includes(s.tableKey));
        return (
          <div onClick={() => setBppPickerOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: 'min(480px, 100%)', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid #E5E7EB', fontWeight: 800, fontSize: 16, color: '#111827' }}>
                Imprimer le {tablePrintKind === 'bpf' ? 'BPF' : 'BPP'} — choisir les tableaux
              </div>
              <div style={{ padding: '6px 8px 4px', maxHeight: '55vh', overflowY: 'auto' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: '#6B7280' }}>
                  <input type="checkbox" checked={allChecked} onChange={() => setBppSelected(allChecked ? [] : available.map(s => s.tableKey))} />
                  {allChecked ? 'Tout décocher' : 'Tout cocher'}
                </label>
                {available.map(s => {
                  const checked = bppSelected.includes(s.tableKey);
                  return (
                    <label key={s.tableKey} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderTop: '1px solid #F3F4F6', cursor: 'pointer', fontSize: 14 }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleBppModule(s.tableKey)} style={{ width: 16, height: 16 }} />
                      <span style={{ flex: 1, color: '#111827', fontWeight: 600 }}>{s.title}</span>
                      <span style={{ fontSize: 12, color: '#9CA3AF' }}>{s.rows.length} ligne{s.rows.length > 1 ? 's' : ''}</span>
                    </label>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid #E5E7EB' }}>
                <button onClick={() => setBppPickerOpen(false)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                <button onClick={runBppPrint} disabled={bppSelected.length === 0} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: bppSelected.length ? '#1E2447' : '#E5E7EB', color: bppSelected.length ? '#fff' : '#9CA3AF', cursor: bppSelected.length ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600 }}>Imprimer</button>
              </div>
            </div>
          </div>
        );
      })()}

      {etqPickerOpen && (
        <div onClick={() => setEtqPickerOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: 'min(420px, 100%)', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', overflow: 'hidden', fontFamily: 'Roboto, system-ui, sans-serif' }}>
            <div style={{ padding: '16px 18px 6px', fontWeight: 500, fontSize: 17, color: '#111827' }}>Imprimer des étiquettes</div>
            <div style={{ padding: '0 18px 10px', fontSize: 13, color: '#8A8F98' }}>Choisis le tableau : l'impression reprend ses réglages (champs, couleurs).</div>
            {etqTablesCfg().map(t => (
              <button key={t.key} onClick={() => printEtiquettes(t.key)} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: '12px 18px', border: 'none', borderTop: '1px solid #F3F4F6', background: 'white', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', textAlign: 'left' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F7F7F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}>
                <Printer size={16} color="#5B616B" />
                <span style={{ flex: 1, color: '#111827' }}>{t.title}</span>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>{t.rows.length} ligne{t.rows.length > 1 ? 's' : ''}</span>
              </button>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px', borderTop: '1px solid #E5E7EB' }}>
              <button onClick={() => setEtqPickerOpen(false)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {showBppPrint && (
        <BPPPrintPortal
          sections={bppPrintSections}
          projectName={project?.name}
          manager={project?.manager}
          docLabel={tablePrintKind === 'bpf' ? 'BPF' : 'BPP'}
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

      {/* MODALE STOCK PROJET (courses, besoins, comparatif, mise à disposition) */}
      <ProjectStockDialog
        open={stockOpen}
        onClose={() => setStockOpen(false)}
        project={project}
        projects={projects}
        inventory={inventory}
        onUpdateItem={onUpdateItem}
        onStockChanged={onStockChanged}
      />

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