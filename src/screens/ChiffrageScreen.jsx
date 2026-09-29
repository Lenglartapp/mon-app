import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

import { slugify } from "../lib/utils/slugify";
import MinuteEditor from "../components/MinuteEditor";
import ShoppingListScreen from "../screens/ShoppingListScreen";
import MoulinetteView from "../components/modules/Moulinette/MoulinetteView";
import DashboardSummary from "../components/DashboardSummary";
import LineDetailPanel from "../components/LineDetailPanel";
import CatalogManager from "../components/CatalogManager";

import { COLORS, S } from "../lib/constants/ui";
import { CHIFFRAGE_SCHEMA } from "../lib/schemas/chiffrage";
import { CHIFFRAGE_SCHEMA_DEP } from "../lib/schemas/deplacement";

import { computeFormulas, preserveManualAfterCompute } from "../lib/formulas/compute";
import { recomputeRow } from "../lib/formulas/recomputeRow";
import { uid } from "../lib/utils/uid";

import { useAuth, ROLES } from "../auth";
import { can } from "../lib/authz";
import { useNotifications } from "../contexts/NotificationContext";
import { useAppSettings, useCatalog, useCatalogRail } from "../hooks/useSupabase";
import { calculateProfitability } from '../lib/financial/profitabilityCalculator';

import MinuteHistoryDialog from "../components/MinuteHistoryDialog";
import VariantTabs from "../components/VariantTabs";
import { buildFamilyTabs, nextFamilyVersion, variantShade } from "../lib/minuteFamily";
import { HeaderCard, HeaderPanel, EditableTitle, StatusPill, HeaderButton, MetaItem, OwnerPicker } from "../components/ui/EntityHeader";
import { formatAnyDateFR } from "../lib/utils/formatDate";
import { readVersionContent, mergeVisualsFromCurrent } from "../lib/minuteVersions";
import { buildSettingsLogs, buildCatalogLogs, buildStatusLog, appendHistory } from "../lib/minuteHistory";
import { MOBILIER_PRODUIT_RE } from "../lib/constants/productRouting";
import { applyCatalogRenames } from "../lib/utils/catalogRename";
import RecalibrationModal from "../components/RecalibrationModal";
import { BookOpen, History, FileUp, SlidersHorizontal } from 'lucide-react';
import { importGlobalExcel } from "../lib/utils/importGlobalExcel";

const toNum = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// Statuts du chiffrage (mêmes couleurs que la liste ChiffrageRoot)
const CHIFFRAGE_STATUS = {
  DRAFT: { label: "À faire", color: "#9CA3AF" },
  IN_PROGRESS: { label: "En cours", color: "#3B82F6" },
  PENDING_APPROVAL: { label: "À valider", color: "#F59E0B" },
  REVISE: { label: "À reprendre", color: "#EF4444" },
  VALIDATED: { label: "Validée", color: "#10B981" },
  ORDERED: { label: "Commande", color: "#8B5CF6" },
  ORDER_COMPLETED: { label: "Commande terminée", color: "#059669" },
  LOST: { label: "Perdu", color: "#EF4444" },
};

// Optimisation: Composant Isolé pour les Notes afin d'éviter le re-render global à chaque frappe
const NotesField = React.memo(({ initialValue, onSave, readOnly, canEdit }) => {
  const [localNotes, setLocalNotes] = React.useState(initialValue);
  const notesRef = React.useRef(null);

  React.useEffect(() => {
    setLocalNotes(initialValue);
  }, [initialValue]);

  React.useEffect(() => {
    if (notesRef.current) {
      notesRef.current.style.height = "auto";
      notesRef.current.style.height = notesRef.current.scrollHeight + "px";
    }
  }, [localNotes]);

  return (
    <textarea
      ref={notesRef}
      value={localNotes}
      onChange={(e) => setLocalNotes(e.target.value)}
      onBlur={() => {
        if (localNotes !== initialValue) {
          onSave(localNotes);
        }
      }}
      placeholder="Ajouter une note de contexte..."
      rows={1}
      style={{
        width: '100%',
        minHeight: 60,
        border: 'none',
        background: 'transparent',
        outline: 'none',
        resize: 'none',
        fontSize: 13.5,
        lineHeight: 1.5,
        color: '#422006',
        overflow: 'hidden',
        fontFamily: 'inherit'
      }}
      readOnly={!canEdit || readOnly}
    />
  );
});

// Memoize External Components for better performance
const MemoizedMinuteEditor = React.memo(MinuteEditor);
const MemoizedDashboardSummary = React.memo(DashboardSummary);
const MemoizedShoppingListScreen = React.memo(ShoppingListScreen);
const MemoizedMoulinetteView = React.memo(MoulinetteView);

function ChiffrageScreen({ minuteId, minutes, onUpdate, onCreate, onLoadMinuteDetail, onBack, onOpenMinute, highlightRowId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [localRowId, setLocalRowId] = React.useState(null);
  const [showHistory, setShowHistory] = React.useState(false);
  // Incrémenté après une restauration en place → force le remount de l'éditeur
  // pour qu'il affiche immédiatement le contenu restauré (évite toute course de sync).
  const [restoreNonce, setRestoreNonce] = React.useState(0);
  const [showCatalog, setShowCatalog] = React.useState(false);
  const [showRecalibration, setShowRecalibration] = React.useState(false);

  // Data Hooks
  const { settings: globalSettings } = useAppSettings();
  const { catalog } = useCatalog(); // Tissus globaux
  const { catalogRails } = useCatalogRail(); // NOUVEAU: Rails globaux
  const { currentUser, users = [] } = useAuth();
  const assignableUsers = React.useMemo(
    () => users.filter(u => u.role === ROLES.ADMIN || u.role === ROLES.ADV || u.role === 'sales'),
    [users]
  );
  const { addNotification } = useNotifications();

  // Highlight Row Effect
  React.useEffect(() => {
    if (highlightRowId) setLocalRowId(highlightRowId);
  }, [highlightRowId]);

  // Permissions
  const canView = can(currentUser, "chiffrage.view");
  const canEdit = can(currentUser, "chiffrage.edit");

  // Minute Data
  const minute = React.useMemo(
    () => (minutes || []).find((m) => m.id.toLowerCase().startsWith(String(minuteId).toLowerCase())),
    [minutes, minuteId]
  );

  // PERF — La liste des chiffrages est légère (sans `lines`/`deplacements`/`params`…).
  // À l'ouverture, on charge la minute COMPLÈTE par son id et on la fusionne dans la
  // liste globale (via onLoadMinuteDetail). `detailLoadedId` indique quelle minute a
  // bien reçu son détail complet → utilisé pour neutraliser le "heal-on-open" tant que
  // les lignes ne sont pas chargées (sinon il réécrirait ca_total à 0).
  const [detailLoadedId, setDetailLoadedId] = React.useState(null);
  // Guard par ref (et non `cancelled`) : loadMinuteDetail fusionne le détail dans la
  // liste globale → re-render → cet effet se relancerait. Le ref évite tout double
  // chargement (et toute boucle) en dédupliquant par id de minute.
  const requestedDetailRef = React.useRef(null);
  // Échec du chargement (base lente/injoignable, délai dépassé) : on l'affiche avec un
  // bouton « Réessayer » au lieu d'un loader infini. detailRetry relance l'effet.
  const [detailErrorId, setDetailErrorId] = React.useState(null);
  const [detailRetry, setDetailRetry] = React.useState(0);
  React.useEffect(() => {
    if (!minute?.id || !onLoadMinuteDetail) return;
    if (detailLoadedId === minute.id) return;
    if (requestedDetailRef.current === minute.id) return; // déjà en cours pour cette minute
    requestedDetailRef.current = minute.id;
    const id = minute.id;
    Promise.resolve(onLoadMinuteDetail(id)).catch(() => null).then((full) => {
      // Ne marquer "prêt" qu'en cas de succès : sinon le heal-on-open écraserait
      // ca_total/marges à 0 sur des lignes encore vides.
      if (full) { setDetailLoadedId(id); setDetailErrorId(null); }
      else { requestedDetailRef.current = null; setDetailErrorId(id); }
    });
  }, [minute?.id, detailLoadedId, onLoadMinuteDetail, detailRetry]);
  const detailReady = detailLoadedId === minute?.id;

  const [schema, setSchema] = React.useState(CHIFFRAGE_SCHEMA);

  // Modules State (Optimistic)
  const [localModules, setLocalModules] = React.useState(minute?.modules || { rideau: true, store: true, decor: true });
  // Settings State (Optimistic)
  const [localSettings, setLocalSettings] = React.useState(minute?.settings || {});

  React.useEffect(() => {
    if (minute?.modules) setLocalModules(minute.modules);
    if (minute?.settings) setLocalSettings(minute.settings);
  }, [minute?.modules, minute?.settings]);

  // Params
  const paramsMap = React.useMemo(() => {
    const out = {};
    (minute?.params || []).forEach((p) => {
      if (p?.name) out[p.name] = p?.value;
    });
    return out;
  }, [minute?.params]);

  // Base CA (Production + Logistique only)
  const baseCA = React.useMemo(() => {
    let sum = 0;
    (minute?.lines || []).forEach(r => sum += toNum(r.prix_total));
    (minute?.deplacements || []).forEach(r => sum += toNum(r.prix_total));
    return sum;
  }, [minute?.lines, minute?.deplacements]);

  // Formula Context
  const formulaCtx = React.useMemo(() => {
    const defaults = { taux_horaire: 135, prix_nuit: 180, prix_repas: 25, vatRate: 20 };
    const global = globalSettings ? {
      ...globalSettings,
      taux_horaire: globalSettings.hourlyRate ?? globalSettings.taux_horaire
    } : {};
    const local = localSettings || {};
    // paramsMap has highest priority: c'est la colonne fiable qui persiste après navigation
    const fromParams = {};
    if (paramsMap.taux_horaire != null) fromParams.taux_horaire = Number(paramsMap.taux_horaire);
    if (paramsMap.prix_nuit != null) fromParams.prix_nuit = Number(paramsMap.prix_nuit);
    if (paramsMap.prix_repas != null) fromParams.prix_repas = Number(paramsMap.prix_repas);
    if (paramsMap.coef_sous_traitance != null) fromParams.coef_sous_traitance = Number(paramsMap.coef_sous_traitance);
    if (paramsMap.commission_rate != null) fromParams.commission_rate = Number(paramsMap.commission_rate);
    const effectiveSettings = { ...defaults, ...global, ...local, ...fromParams };

    // Priorité : catalog per-minute (bibliothèque d'achat de la minute) > catalog global
    const globalCatalog = [...(catalog || []), ...(catalogRails || [])];
    const effectiveCatalog = (minute?.catalog && minute.catalog.length > 0)
      ? minute.catalog
      : globalCatalog;

    return {
      paramsMap,
      totalCA: baseCA,
      settings: effectiveSettings,
      catalog: effectiveCatalog
    };
  }, [paramsMap, baseCA, globalSettings, catalog, catalogRails, localSettings, minute?.catalog]);

  // Rows State
  const [rows, setRows] = React.useState(() => computeFormulas(minute?.lines || [], schema, formulaCtx));
  const [depRows, setDepRows] = React.useState(() =>
    (minute?.deplacements || []).map(r =>
      recomputeRow({ ...r, produit: r.produit || "Déplacement" }, CHIFFRAGE_SCHEMA_DEP, formulaCtx)
    )
  );
  const [extraRows, setExtraRows] = React.useState(minute?.extraDepenses || []);

  // Sync Logic
  React.useEffect(() => {
    const computedMain = computeFormulas(minute?.lines || [], schema, formulaCtx);
    setRows((prev) => preserveManualAfterCompute(computedMain, prev || []));
    const computedDeps = (minute?.deplacements || []).map(r =>
      recomputeRow({ ...r, produit: r.produit || "Déplacement" }, CHIFFRAGE_SCHEMA_DEP, formulaCtx)
    );
    setDepRows(computedDeps);
    setExtraRows(minute?.extraDepenses || []);
  }, [minute?.id, minute?.lines, minute?.deplacements, minute?.extraDepenses, schema, formulaCtx]);

  const mods = localModules;

  // ——— JOURNAL BIBLIOTHÈQUE / PARAMÈTRES GLOBAUX ———
  // Les modifications de la bibliothèque d'articles (ajout, suppression, coef,
  // prix d'achat…) et des paramètres globaux (taux horaire…) sont journalisées
  // dans `modules.history`, la MÊME liste que les changements de statut, et
  // rendues telles quelles par MinuteHistoryDialog (bouton « Historique »).
  const historyAuthor = currentUser?.name || currentUser?.email || 'Utilisateur';

  // Ref pour que deux journalisations rapprochées ne s'écrasent pas : le prop
  // `minute.modules` n'est à jour qu'au re-render suivant l'update optimiste.
  const modulesRef = React.useRef(minute?.modules);
  React.useEffect(() => { modulesRef.current = minute?.modules; }, [minute?.modules]);

  // Renvoie le nouveau `modules` à joindre au payload, ou null si rien à noter.
  const pushHistory = React.useCallback((entries) => {
    if (!entries || entries.length === 0) return null;
    const next = appendHistory(modulesRef.current, entries);
    modulesRef.current = next;
    return next;
  }, []);

  // Recap Logic
  const recap = React.useMemo(() => {
    let caRideaux = 0, caStores = 0, caStoresBateau = 0, caDivers = 0;
    let caCoussins = 0, caCacheSommier = 0, caPlaid = 0, caTenture = 0, caMobilier = 0;
    let hConf = 0, hPose = 0, hPrepa = 0;

    // 1. Process Main Production Grid (rows)
    for (const r of rows || []) {
      const prod = String(r?.produit || "").toLowerCase();
      const total = toNum(r?.prix_total);
      const q = toNum(r?.quantite) || 1;

      // Sum all production hours
      hConf += (toNum(r?.heures_confection) * q);
      hPose += (toNum(r?.heures_pose) * q);
      hPrepa += (toNum(r?.heures_prepa) * q);

      if (!total) continue;

      // Categorize Revenue
      if (/bateau|velum|vélum/i.test(prod)) caStoresBateau += total;
      else if (/store|canishade/i.test(prod) || /^autre$/i.test(prod)) caStores += total;
      else if (/coussin/i.test(prod)) caCoussins += total;
      else if (/cache-sommier/i.test(prod)) caCacheSommier += total;
      else if (/plaid|chemin de lit/i.test(prod)) caPlaid += total;
      else if (/tenture/i.test(prod)) caTenture += total;
      else if (MOBILIER_PRODUIT_RE.test(prod)) caMobilier += total;
      else if (prod.includes("rideau") || prod.includes("voilage") || !prod) caRideaux += total;
      else caDivers += total;
    }

    // 2. Process Logistics / Déplacements (depRows)
    const depTotal = (depRows || []).reduce((s, r) => s + toNum(r?.prix_total), 0);
    (depRows || []).forEach(r => {
      const q = toNum(r?.quantite) || 1;
      const h = toNum(r?.heures_facturees) * q;
      hPose += h;
    });

    // 3. Process Autres Dépenses (extraRows)
    const extrasTotal = (extraRows || []).reduce((s, r) => s + toNum(r?.prix_total), 0);
    (extraRows || []).forEach(r => {
      const q = toNum(r?.quantite) || 1;
      hConf += (toNum(r?.heures_confection) * q);
      hPose += (toNum(r?.heures_pose) * q);
      hPrepa += (toNum(r?.heures_prepa) * q);
    });

    const caTotal = caRideaux + caCoussins + caCacheSommier + caPlaid + caTenture + caMobilier + caStores + caStoresBateau + caDivers;
    const offreTotale = caTotal + depTotal; // Excludes extrasTotal (Frais) as requested

    return {
      caRideaux, caCoussins, caCacheSommier, caPlaid, caTenture, caMobilier, caStores, caStoresBateau, caDivers,
      caTotal, extrasTotal, depTotal, offreTotale, hConf, hPose, hPrepa
    };
  }, [rows, extraRows, depRows]);

  const nfEur0 = React.useMemo(() => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }), []);

  // Update Wrapper (Memoized)
  const updateMinute = React.useCallback((patch) => {
    if (!canEdit) return;
    if (onUpdate && minute?.id) onUpdate(minute.id, patch);
  }, [canEdit, onUpdate, minute?.id]);

  // PERF — Props STABLES pour l'éditeur (React.memo). Recréés inline à chaque rendu,
  // ils forçaient un re-rendu complet de l'éditeur et de toutes ses grilles au moindre
  // changement d'état de l'écran (ouvrir/fermer une ligne, taper le nom du devis…)
  // — et, via performSave, déclenchaient une sauvegarde immédiate à chaque fois.
  const editorMinute = React.useMemo(() => ({
    ...minute,
    // Toujours passer localSettings (état local autoritatif) pour éviter
    // la race condition où minute.settings est stale pendant un save Supabase
    settings: localSettings,
    lines: [
      ...(rows || []),
      ...(extraRows || []).map(r => ({ ...r, produit: r.produit || "Autre Dépense" })),
      ...(depRows || []).map(r => ({ ...r, produit: r.produit || "Déplacement" }))
    ],
    modules: mods
  }), [minute, localSettings, rows, extraRows, depRows, mods]);

  const handleEditorChange = React.useCallback((m) => {
    if (!canEdit) return;
    const all = m.lines || [];

    // GARDE-FOU ANTI-VIDAGE : ne jamais remplacer une minute pleine par une minute vide.
    // Protège notamment la SUPPRESSION DE TABLEAU — seul save qui court-circuite la
    // protection de performSave. Le remontage forcé de l'éditeur (key sur les modules)
    // peut y renvoyer une liste momentanément vide → tous les tableaux se vidaient.
    const currentCount = (rows?.length || 0) + (extraRows?.length || 0) + (depRows?.length || 0);
    if (all.length === 0 && currentCount > 0) {
      console.warn('[chiffrage] Écrasement vide bloqué (garde-fou suppression tableau).', {
        minuteId: minute?.id,
        lignesConservees: currentCount,
        modulesDemandes: m.modules,
      });
      // On applique quand même le changement de modules / méta, mais on PRÉSERVE les lignes.
      if (m.modules) setLocalModules(m.modules);
      updateMinute({
        lines: rows,
        extraDepenses: extraRows,
        deplacements: depRows,
        name: m.name,
        notes: m.notes,
        status: m.status,
        catalog: m.catalog,
        modules: m.modules,
        matieres: m.matieres,
      });
      return;
    }

    const newLines = all.filter(r => r.produit !== "Autre Dépense" && r.produit !== "Déplacement");
    const newExtras = all.filter(r => r.produit === "Autre Dépense");
    const newDeps = all.filter(r => r.produit === "Déplacement");

    setRows(newLines);
    setExtraRows(newExtras);
    setDepRows(newDeps);
    if (m.modules) setLocalModules(m.modules);

    // NE JAMAIS lire m.settings ici — les settings viennent UNIQUEMENT
    // du callback onSettingsChange du CatalogManager (ci-dessous).
    // Lire m.settings ici provoquerait un écrasement des settings
    // par une closure stale de performSave dans MinuteEditor.

    // Le ca_total + marges sont recalculés et persistés de façon centralisée
    // dans updateMinute (hook useMinutes) dès que lines/deplacements changent.
    updateMinute({
      lines: newLines,
      extraDepenses: newExtras,
      deplacements: newDeps,
      name: m.name,
      notes: m.notes,
      status: m.status,
      catalog: m.catalog,
      modules: m.modules,
      matieres: m.matieres,
    });
  }, [canEdit, rows, extraRows, depRows, minute?.id, updateMinute]);

  // --- HEAL-ON-OPEN (Étape 1b) ---
  // Le détail recalcule les prix en direct à l'ouverture (catalogue/taux actuels).
  // Si le ca_total stocké en BDD diverge de ce recalcul (minute non rééditée depuis
  // une dérive de prix), on resynchronise le cache pour que la liste des chiffrages
  // affiche EXACTEMENT le même montant que le CA TOTAL du détail.
  // Le timer se ré-arme à chaque changement de `rows` → il ne se déclenche qu'une
  // fois les calculs stabilisés (catalogue chargé), évitant toute écriture transitoire.
  const healTimerRef = React.useRef(null);
  React.useEffect(() => {
    if (!minute?.id || !canEdit) return undefined;
    // Ne jamais "soigner" tant que le détail complet n'est pas chargé : `rows` serait
    // vide et on écraserait ca_total/marges à 0.
    if (!detailReady) return undefined;
    if (healTimerRef.current) clearTimeout(healTimerRef.current);
    healTimerRef.current = setTimeout(() => {
      const { kpis } = calculateProfitability(rows || [], depRows || [], extraRows || []);
      const storedCa = Math.round(Number(minute.ca_total || 0));
      const freshCa = Math.round(Number(kpis.ca_total || 0));
      if (Math.abs(storedCa - freshCa) >= 1) {
        updateMinute({
          ca_total:  freshCa,
          marge_eur: kpis.contribution        || 0,
          marge_pct: kpis.contribution_pct    || 0,
          renta_hh:  kpis.contribution_horaire || 0,
        });
      }
    }, 1500);
    return () => { if (healTimerRef.current) clearTimeout(healTimerRef.current); };
  }, [minute?.id, minute?.ca_total, rows, depRows, extraRows, canEdit, updateMinute, detailReady]);

  // Local status for optimistic UI
  const [localStatus, setLocalStatus] = React.useState(minute?.status || "DRAFT");

  React.useEffect(() => {
    setLocalStatus(minute?.status || "DRAFT");
  }, [minute?.status]);

  // Status Change with Logging (Memoized)
  const handleStatusChange = React.useCallback((newStatus) => {
    if (!canEdit) return;
    const oldStatus = minute?.status || "DRAFT";
    if (newStatus === oldStatus) return;

    // Optimistic Update
    setLocalStatus(newStatus);

    const performUpdate = () => {
      // Ensure Author Name is valid
      const safeAuthor = currentUser?.name || currentUser?.email || 'Utilisateur';

      // Même mécanique que les autres journalisations (ref à jour + plafond 500).
      const payload = {
        status: newStatus,
        modules: pushHistory([buildStatusLog(oldStatus, newStatus, safeAuthor)]),
      };

      if (newStatus === "VALIDATED") {
        payload.budgetSnapshot = { prepa: recap?.hPrepa || 0, conf: recap?.hConf || 0, pose: recap?.hPose || 0 };
      }
      updateMinute(payload);
    };

    if (newStatus === "VALIDATED") {
      if (confirm("Valider ce devis ?")) performUpdate();
      else setLocalStatus(oldStatus); // Revert
    } else {
      // ⚠️ Sans ce `else`, performUpdate() n'était appelé QUE pour « Validée » :
      // tous les autres changements de statut (En cours, À reprendre, Commande,
      // Commande terminée, Perdu, À valider, À faire) ne modifiaient que l'état
      // LOCAL. Ils n'étaient ni enregistrés en base — donc perdus au rechargement —
      // ni journalisés dans l'historique.
      performUpdate();
    }
  }, [canEdit, minute, currentUser, recap, updateMinute]);

  // Créer une variante simple (copie sans recalibrage)
  const handleCreateVariant = React.useCallback(async () => {
    if (!minute || !onCreate) return;
    const rootId = minute.parentId || minute.id;
    const siblings = (minutes || []).filter(m => (m.parentId || m.id) === rootId && m.id !== rootId);
    const newVersion = nextFamilyVersion(minutes, rootId);
    const baseName = minute.name
      .replace(/ Recalibrage \d+$/i, '')
      .replace(/ Variante \d+$/i, '')
      .replace(/ Variante$/i, '')
      .replace(/ — v\d+.*$/, '');
    const varianteCount = siblings.filter(m => / Variante/i.test(m.name)).length;
    const newName = varianteCount === 0 ? `${baseName} Variante` : `${baseName} Variante ${varianteCount + 1}`;
    const copy = {
      ...minute,
      id: uid(),
      lines: minute.lines || [],
      tables: minute.lines || [],
      version: newVersion,
      parentId: rootId,
      name: newName,
      status: 'DRAFT',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const result = await onCreate(copy);
    const newId = result?.data?.[0]?.id || copy.id;
    if (onOpenMinute) onOpenMinute(newId);
    else onBack();
  }, [minute, minutes, onCreate, onBack, onOpenMinute]);

  // ——— RESTAURATION D'UNE VERSION (historique de versions) ———
  // A. Revenir à la version SUR le devis actuel (remplace le contenu). L'état courant
  //    est auto-capturé par le trigger juste avant → réversible.
  const handleRestoreInPlace = React.useCallback(async (version) => {
    if (!canEdit || !minute?.id) return;
    const content = await readVersionContent(version.id);
    if (!content) { addNotification?.("Version introuvable.", "error"); return; }
    // On préserve les visuels actuels (les versions n'archivent pas les croquis/photos).
    const mergedLines = mergeVisualsFromCurrent(content.lines || [], rows);
    const mainFx = computeFormulas(mergedLines, schema, formulaCtx);
    const depsFx = (content.deplacements || []).map(r =>
      recomputeRow({ ...r, produit: r.produit || "Déplacement" }, CHIFFRAGE_SCHEMA_DEP, formulaCtx));
    const extras = content.extra_depenses || [];
    setRows(mainFx); setDepRows(depsFx); setExtraRows(extras);
    const when = new Date(version.captured_at).toLocaleString("fr-FR");
    const journal = pushHistory([{ id: uid(), type: 'log', field: 'Restauration de version',
      from: 'version actuelle', to: `version du ${when}`, author: historyAuthor, createdAt: new Date().toISOString() }]);
    updateMinute({ lines: mainFx, deplacements: depsFx, extraDepenses: extras, ...(journal ? { modules: journal } : {}) });
    setRestoreNonce(n => n + 1);
    addNotification?.(`Devis restauré à la version du ${when}.`, "success");
  }, [canEdit, minute?.id, rows, schema, formulaCtx, updateMinute, historyAuthor, pushHistory, addNotification]);

  // B. Créer une VARIANTE à partir de la version (garde le devis actuel intact).
  const handleRestoreAsVariant = React.useCallback(async (version) => {
    if (!minute || !onCreate) return;
    const content = await readVersionContent(version.id);
    if (!content) { addNotification?.("Version introuvable.", "error"); return; }
    const rootId = minute.parentId || minute.id;
    const siblings = (minutes || []).filter(m => (m.parentId || m.id) === rootId && m.id !== rootId);
    const baseName = (minute.name || '')
      .replace(/ Recalibrage \d+$/i, '').replace(/ Variante \d+$/i, '')
      .replace(/ Variante$/i, '').replace(/ — v\d+.*$/, '');
    const when = new Date(version.captured_at).toLocaleDateString("fr-FR");
    const copy = {
      ...minute,
      id: uid(),
      lines: content.lines || [],
      tables: content.lines || [],
      deplacements: content.deplacements || [],
      extraDepenses: content.extra_depenses || [],
      version: siblings.length + 2,
      parentId: rootId,
      name: `${baseName} (version du ${when})`,
      status: 'DRAFT',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const result = await onCreate(copy);
    const newId = result?.data?.[0]?.id || copy.id;
    if (onOpenMinute) onOpenMinute(newId); else onBack();
  }, [minute, minutes, onCreate, onOpenMinute, onBack, addNotification]);

  const fileInputRef = React.useRef(null);
  const handleGlobalImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const importedRows = await importGlobalExcel(file, formulaCtx, catalog);

      if (!importedRows || importedRows.length === 0) {
        if (addNotification) addNotification("Aucune ligne valide à importer.", "warning");
        e.target.value = null;
        return;
      }

      const newLines = [...(rows || []), ...importedRows];
      setRows(newLines);

      // Update Minute state (propagates to MinuteEditor)
      updateMinute({ lines: newLines });

      if (addNotification) addNotification(`${importedRows.length} ligne(s) importée(s) avec succès !`, "success");
    } catch (err) {
      if (addNotification) addNotification(`Erreur d'import : ${err.message}`, "error");
    }

    e.target.value = null; // reset input
  };

  // Header State
  const [name, setName] = React.useState(minute?.name || "Minute sans nom");
  const [notes, setNotes] = React.useState(minute?.notes || "");
  const notesRef = React.useRef(null);

  React.useEffect(() => {
    setName(minute?.name || "Minute sans nom");
  }, [minuteId, minute?.name]);

  const familyTabs = React.useMemo(() => buildFamilyTabs(minutes, minute), [minutes, minute]);
  const activeTabShade = React.useMemo(() => {
    const i = familyTabs.findIndex(t => t.id === minute?.id);
    return variantShade(Math.max(i, 0), familyTabs.length).bg;
  }, [familyTabs, minute?.id]);

  const handleNotesSave = React.useCallback((newNotes) => {
    updateMinute({ notes: newNotes });
  }, [updateMinute]);

  // Tabs
  const [activeTab, setActiveTab] = React.useState("minutes");

  // Helper Style Island Nav
  const getNavStyle = (isActive) => ({
    padding: '8px 20px',
    borderRadius: 99,
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    transition: 'all 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
    outline: 'none',
    background: isActive ? '#1E2447' : 'transparent',
    color: isActive ? '#FFFFFF' : '#4B5563',
    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
  });

  // Row Opening
  const openedRow = React.useMemo(() => {
    if (!localRowId) return null;
    const all = [...(rows || []), ...(depRows || []), ...(extraRows || [])];
    return all.find(r => r.id === localRowId || r.id.startsWith(localRowId));
  }, [localRowId, rows, depRows, extraRows]);

  // Sync localRowId ↔ URL (/chiffrage/minuteSlug/rowSlug)
  const minuteBasePath = minute
    ? `/chiffrage/${minute.id.slice(0, 8)}-${slugify(minute.name)}`
    : null;

  React.useEffect(() => {
    if (!minuteBasePath) return;
    if (localRowId) {
      const shortId = String(localRowId).slice(0, 8);
      const parts = openedRow
        ? [openedRow.zone, openedRow.piece, openedRow.produit].filter(Boolean).map(slugify)
        : [];
      const rowSlug = parts.length ? `${shortId}-${parts.join('-')}` : shortId;
      navigate(`${minuteBasePath}/${rowSlug}`, { replace: true });
    } else {
      navigate(minuteBasePath, { replace: true });
    }
  }, [localRowId, openedRow, minuteBasePath]);

  // document.title
  React.useEffect(() => {
    const minuteTitle = name || "Chiffrage";
    if (openedRow) {
      const parts = [openedRow.zone, openedRow.piece, openedRow.produit].filter(Boolean);
      const rowLabel = parts.length ? parts.join(" — ") : "Ligne";
      document.title = `${rowLabel} · ${minuteTitle} — LENGLART`;
    } else {
      document.title = `${minuteTitle} — LENGLART`;
    }
  }, [openedRow, name]);

  const handleDetailUpdate = React.useCallback((updatedRow) => {
    if (!canEdit) return;
    if ((rows || []).some(r => r.id === updatedRow.id)) {
      const newLines = rows.map(r => r.id === updatedRow.id ? updatedRow : r);
      setRows(newLines);
      updateMinute({ lines: newLines }); // optimistic
    } else if ((depRows || []).some(r => r.id === updatedRow.id)) {
      const newDeps = depRows.map(r => r.id === updatedRow.id ? updatedRow : r);
      setDepRows(newDeps);
      updateMinute({ deplacements: newDeps });
    } else if ((extraRows || []).some(r => r.id === updatedRow.id)) {
      const newExtras = extraRows.map(r => r.id === updatedRow.id ? updatedRow : r);
      setExtraRows(newExtras);
      updateMinute({ extraDepenses: newExtras });
    }
  }, [canEdit, rows, depRows, extraRows, updateMinute]);

  if (!canView) return <div style={S.contentWrap}>Accès refusé</div>;
  if (!minute) return <div style={S.contentWrap}>Minute introuvable</div>;

  // SÉCURITÉ DONNÉES (critique) : tant que le détail complet (lignes) n'est pas chargé,
  // on NE rend PAS l'éditeur. Sinon MinuteEditor monterait avec des lignes vides, sa
  // protection "tableau vide" serait désactivée (compteur init à 0) et un flush/save
  // pourrait écraser le devis par du vide au moindre re-rendu. On affiche un loader.
  if (!detailReady) {
    return (
      <div style={S.contentWide}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0, fontSize: 13, fontWeight: 500, marginTop: 8 }}>← Retour</button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 12, color: '#6B7280' }}>
          {detailErrorId !== minute?.id && (
            <div style={{ width: 28, height: 28, border: '3px solid #E5E7EB', borderTopColor: '#1E2447', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          )}
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{minute?.name || 'Chiffrage'}</div>
          {detailErrorId === minute?.id ? (
            <>
              <div style={{ fontSize: 13, color: '#B91C1C', textAlign: 'center', maxWidth: 420 }}>
                Le chiffrage n'a pas pu être chargé (serveur lent ou connexion interrompue). Aucune donnée n'a été modifiée.
              </div>
              <button
                onClick={() => { setDetailErrorId(null); setDetailRetry((n) => n + 1); }}
                style={{ background: '#1E2447', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
              >
                Réessayer
              </button>
            </>
          ) : (
            <div style={{ fontSize: 13 }}>Chargement du chiffrage…</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={S.contentWide}>
      {/* Header : fiche d'identité (gauche) + notes (droite), actions en dessous */}
      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0, fontSize: 13, fontWeight: 500, marginBottom: 12 }}>← Retour</button>
        <HeaderCard
          left={
            <>
              <EditableTitle
                value={name}
                canEdit={canEdit}
                placeholder="Nom du projet"
                onSave={(v) => { setName(v); updateMinute({ name: v }); }}
              />
              <div style={{ fontSize: 15, color: '#6B7280', marginTop: 2 }}>{minute?.client || "Client non spécifié"}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
                <StatusPill
                  value={localStatus}
                  options={CHIFFRAGE_STATUS}
                  onChange={handleStatusChange}
                  disabled={!canEdit && localStatus !== "VALIDATED"}
                />
                <HeaderButton onClick={() => setShowHistory(true)} title="Historique des modifications et versions">
                  <History size={15} /> Historique
                </HeaderButton>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 28px', alignItems: 'flex-start', marginTop: 18 }}>
                <MetaItem label="Chargé d'affaires">
                  <OwnerPicker
                    value={minute?.owner || ""}
                    users={assignableUsers}
                    canEdit={canEdit}
                    onChange={(owner) => updateMinute({ owner })}
                  />
                </MetaItem>
                <MetaItem label="Créé le">{formatAnyDateFR(minute?.createdAt)}</MetaItem>
                <MetaItem label="Livraison estimée">
                  {canEdit ? (
                    <input
                      type="date"
                      value={minute?.delivery_date || minute?.deliveryDate || ""}
                      onChange={(e) => updateMinute({ delivery_date: e.target.value || null })}
                      style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '3px 6px', fontSize: 13, color: '#374151', background: 'white', outline: 'none', fontFamily: 'inherit' }}
                    />
                  ) : formatAnyDateFR(minute?.delivery_date || minute?.deliveryDate)}
                </MetaItem>
              </div>
            </>
          }
          right={
            <HeaderPanel title="Notes" tone="notes">
              <NotesField
                initialValue={minute?.notes || ""}
                onSave={handleNotesSave}
                canEdit={canEdit}
                readOnly={minute?.status === "VALIDATED"}
              />
            </HeaderPanel>
          }
        />

        {/* Intercalaires de variantes (gauche) + actions (droite) */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginTop: 14, borderBottom: `1px solid ${activeTabShade}` }}>
          <VariantTabs
            tabs={familyTabs}
            activeId={minute?.id}
            onOpen={(id) => onOpenMinute?.(id)}
            onCreate={canEdit ? handleCreateVariant : undefined}
          />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept=".xlsx, .xls"
            onChange={handleGlobalImport}
          />
          <button onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, background: '#10B981', color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <FileUp size={16} /> Importer Excel
          </button>

          {canEdit && (
            <button
              onClick={() => setShowRecalibration(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, background: '#1E2447', color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
              title="Recalibrer le devis vers un montant cible"
            >
              <SlidersHorizontal size={16} /> Recalibrer
            </button>
          )}
          <button onClick={() => setShowCatalog(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, background: 'white', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#374151', fontSize: 13, fontWeight: 600 }}>
            <BookOpen size={16} /> Bibliothèque
          </button>
        </div>
        </div>
      </div>

      <MinuteHistoryDialog
        open={showHistory}
        onClose={() => setShowHistory(false)}
        minute={minute}
        canEdit={canEdit}
        onRestoreInPlace={handleRestoreInPlace}
        onRestoreAsVariant={handleRestoreAsVariant}
      />

      {showRecalibration && (
        <RecalibrationModal
          minute={minute}
          minutes={minutes}
          onClose={() => setShowRecalibration(false)}
          onCreateVariant={async (variant) => {
            if (onCreate) {
              const result = await onCreate(variant);
              const newId = result?.data?.[0]?.id || variant.id;
              setShowRecalibration(false);
              if (onOpenMinute) onOpenMinute(newId);
              else onBack();
            }
          }}
        />
      )}

      {/* Tabs */}
      {/* Tabs */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <div style={{
          display: 'inline-flex',
          background: 'white',
          padding: 5,
          borderRadius: 99,
          gap: 4,
          flexWrap: 'wrap',
          justifyContent: 'center',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
        }}>
          <button style={getNavStyle(activeTab === "minutes")} onClick={() => setActiveTab("minutes")}>Minutes</button>
          <button style={getNavStyle(activeTab === "achats")} onClick={() => setActiveTab("achats")}>Liste Achats</button>
          {can(currentUser, "chiffrage.moulinette") && <button style={getNavStyle(activeTab === "moulinette")} onClick={() => setActiveTab("moulinette")}>Moulinette</button>}
        </div>
      </div>

      {/* Minutes Tab */}
      {activeTab === "minutes" && (
        <div style={{ display: "grid", gap: 12, overflow: "hidden" }}>
          <MemoizedDashboardSummary recap={recap} nf={nfEur0} activeModules={mods} />
          <div style={{ minWidth: 0, overflowX: "auto" }}>
            <MemoizedMinuteEditor
              key={`${minute?.id}-${restoreNonce}-${Object.keys(mods || {}).filter(k => mods[k]).sort().join('-')}`} // FORCE REMOUNT on module change / restauration
              minute={editorMinute}
              readOnly={minute?.status === "VALIDATED"}
              currentUser={currentUser}
              onChangeMinute={handleEditorChange}
              enableCellFormulas={true}
              formulaCtx={formulaCtx}
              schema={schema}
              setSchema={setSchema}
              targetRowId={localRowId}
              onRowClick={setLocalRowId}
            />
          </div>
        </div>
      )}

      {activeTab === "achats" && <MemoizedShoppingListScreen minutes={[minute]} />}
      {activeTab === "moulinette" && can(currentUser, "chiffrage.moulinette") && (
        <MemoizedMoulinetteView
          rows={rows}
          extraRows={extraRows}
          depRows={depRows}
          commissionRate={formulaCtx.settings.commission_rate ?? 3.5}
          onUpdateCommission={(rate) => {
            const newSettings = { ...formulaCtx.settings, commission_rate: rate };
            setLocalSettings(newSettings); // Optimistic UI

            const historyModules = pushHistory(buildSettingsLogs(formulaCtx.settings, newSettings, historyAuthor));
            if (historyModules) updateMinute({ modules: historyModules });
            // Persiste dans params (colonne fiable) comme les autres réglages
            const updatedParams = [...(minute?.params || [])];
            const idx = updatedParams.findIndex(p => p.name === 'commission_rate');
            if (idx >= 0) updatedParams[idx] = { ...updatedParams[idx], value: Number(rate) };
            else updatedParams.push({ name: 'commission_rate', value: Number(rate) });
            updateMinute({ params: updatedParams });
          }}
        />
      )}

      <CatalogManager
        open={showCatalog}
        onClose={() => setShowCatalog(false)}
        catalog={minute?.catalog || []}
        onCatalogChange={(newCatalog) => {
          const patch = { catalog: newCatalog };
          const modules = pushHistory(buildCatalogLogs(minute?.catalog || [], newCatalog, historyAuthor));
          if (modules) patch.modules = modules;

          // Renommer un article coupait le lien avec les lignes qui l'utilisaient :
          // elles gardaient l'ancien nom et donc, silencieusement, leur ancienne
          // laize. Le nom est recalculé ici depuis Fournisseur + Référence +
          // Coloris, donc corriger une simple coquille suffisait à déclencher ça.
          const prevCatalog = minute?.catalog || [];
          const rn = applyCatalogRenames(rows, prevCatalog, newCatalog);
          const rd = applyCatalogRenames(depRows, prevCatalog, newCatalog);
          const re = applyCatalogRenames(extraRows, prevCatalog, newCatalog);
          if (rn.changed + rd.changed + re.changed > 0) {
            setRows(rn.rows); setDepRows(rd.rows); setExtraRows(re.rows);
            patch.lines = rn.rows;
            patch.deplacements = rd.rows;
            patch.extraDepenses = re.rows;
          }

          updateMinute(patch);
        }}
        settings={formulaCtx.settings}
        onSettingsChange={(newSettings) => {
          setLocalSettings({ ...localSettings, ...newSettings }); // Optimistic UI

          // Journal : compare aux réglages EFFECTIVEMENT affichés (formulaCtx),
          // pas au state local, pour refléter ce que l'utilisateur voyait.
          const historyModules = pushHistory(buildSettingsLogs(formulaCtx.settings, newSettings, historyAuthor));
          if (historyModules) updateMinute({ modules: historyModules });

          // Sauvegarder dans params (colonne fiable, toujours présente)
          const paramKeys = ["taux_horaire", "prix_nuit", "prix_repas", "coef_sous_traitance"];
          const hasParamChange = paramKeys.some(k => newSettings[k] != null);
          if (hasParamChange) {
            const currentParams = minute?.params || [];
            const updatedParams = [...currentParams];
            paramKeys.forEach(key => {
              if (newSettings[key] == null) return;
              const idx = updatedParams.findIndex(p => p.name === key);
              if (idx >= 0) updatedParams[idx] = { ...updatedParams[idx], value: Number(newSettings[key]) };
              else updatedParams.push({ name: key, value: Number(newSettings[key]) });
            });
            updateMinute({ params: updatedParams });
          }

          updateMinute({ settings: { ...formulaCtx.settings, ...newSettings } });
        }}
      />

      {openedRow && (
        <LineDetailPanel
          open={true}
          onClose={() => setLocalRowId(null)}
          row={openedRow}
          schema={schema}
          onRowChange={handleDetailUpdate}
          minuteId={minute.id}
          projectId={null}
          authorName={currentUser?.name || currentUser?.email || 'Utilisateur'}
          currentUser={currentUser}
          allRows={[...(rows || []), ...(depRows || []), ...(extraRows || [])]}
        />
      )}
    </div>
  );
}

export default ChiffrageScreen;