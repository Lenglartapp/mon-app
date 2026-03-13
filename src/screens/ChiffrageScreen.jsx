import React from "react";
import MinuteEditor from "../components/MinuteEditor";
import ShoppingListScreen from "../screens/ShoppingListScreen";
import MoulinetteView from "../components/modules/Moulinette/MoulinetteView";
import DashboardSummary from "../components/DashboardSummary";
import LineDetailPanel from "../components/LineDetailPanel";
import CatalogManager from "../components/CatalogManager";

import { COLORS, S } from "../lib/constants/ui";
import { CHIFFRAGE_SCHEMA } from "../lib/schemas/chiffrage";

import { computeFormulas, preserveManualAfterCompute } from "../lib/formulas/compute";
import { uid } from "../lib/utils/uid";

import { useAuth } from "../auth";
import { can } from "../lib/authz";
import { useNotifications } from "../contexts/NotificationContext";
import { useAppSettings, useCatalog, useCatalogRail } from "../hooks/useSupabase";

import MinuteHistoryDialog from "../components/MinuteHistoryDialog";
import { BookOpen, History, FileUp } from 'lucide-react';
import { importGlobalExcel } from "../lib/utils/importGlobalExcel";

const toNum = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
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
        border: 'none', 
        background: 'transparent', 
        borderBottom: '1px dashed #E5E7EB', 
        outline: 'none', 
        resize: 'none', 
        fontSize: 14, 
        overflow: 'hidden', 
        fontFamily: 'Roboto, sans-serif' 
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

function ChiffrageScreen({ minuteId, minutes, onUpdate, onBack, highlightRowId }) {
  const [localRowId, setLocalRowId] = React.useState(null);
  const [showHistory, setShowHistory] = React.useState(false);
  const [showCatalog, setShowCatalog] = React.useState(false);

  // Data Hooks
  const { settings: globalSettings } = useAppSettings();
  const { catalog } = useCatalog(); // Tissus globaux
  const { catalogRails } = useCatalogRail(); // NOUVEAU: Rails globaux
  const { currentUser } = useAuth();
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
    () => (minutes || []).find((m) => String(m.id) === String(minuteId)),
    [minutes, minuteId]
  );

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
    const effectiveSettings = { ...defaults, ...global, ...local };

    return {
      paramsMap,
      totalCA: baseCA,
      settings: effectiveSettings,
      // On passe le catalogue combiné aux formules au cas où !
      catalog: [...(catalog || []), ...(catalogRails || [])]
    };
  }, [paramsMap, baseCA, globalSettings, catalog, catalogRails, localSettings]);

  // Rows State
  const [rows, setRows] = React.useState(() => computeFormulas(minute?.lines || [], schema, formulaCtx));
  const [depRows, setDepRows] = React.useState(minute?.deplacements || []);
  const [extraRows, setExtraRows] = React.useState(minute?.extraDepenses || []);

  // Sync Logic
  React.useEffect(() => {
    const computedMain = computeFormulas(minute?.lines || [], schema, formulaCtx);
    setRows((prev) => preserveManualAfterCompute(computedMain, prev || []));
    setDepRows(minute?.deplacements || []);
    setExtraRows(minute?.extraDepenses || []);
  }, [minute?.id, minute?.lines, minute?.deplacements, minute?.extraDepenses, schema, formulaCtx]);

  const mods = localModules;

  // Update Wrapper (Memoized)
  const updateMinute = React.useCallback((patch) => {
    if (!canEdit) return;
    if (onUpdate) onUpdate(minuteId, patch);
  }, [canEdit, onUpdate, minuteId]);

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

      const logEntry = {
        id: Date.now(),
        type: 'status',
        from: oldStatus,
        to: newStatus,
        date: Date.now(),
        createdAt: new Date().toISOString(),
        author: safeAuthor,
        context: 'Minute'
      };

      // Use modules.history for storage (Safer fallback)
      const currentModules = minute?.modules || { rideau: true, store: true, decor: true };
      const oldLogs = Array.isArray(currentModules.history) ? currentModules.history : [];
      const newLogs = [...oldLogs, logEntry];

      const payload = {
        status: newStatus,
        modules: { ...currentModules, history: newLogs }
      };

      if (newStatus === "VALIDATED") {
        payload.budgetSnapshot = { prepa: recap?.hPrepa || 0, conf: recap?.hConf || 0, pose: recap?.hPose || 0 };
      }
      updateMinute(payload);
    };

    if (newStatus === "VALIDATED") {
      if (confirm("Valider ce devis ?")) performUpdate();
      else setLocalStatus(oldStatus); // Revert
    }
  }, [canEdit, minute, currentUser, recap, updateMinute]);

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
      else if (/store|canishade/i.test(prod)) caStores += total;
      else if (/coussin/i.test(prod)) caCoussins += total;
      else if (/cache-sommier/i.test(prod)) caCacheSommier += total;
      else if (/plaid|chemin de lit/i.test(prod)) caPlaid += total;
      else if (/tenture/i.test(prod)) caTenture += total;
      else if (/t[êe]te|mobilier/i.test(prod)) caMobilier += total;
      else if (prod.includes("rideau") || prod.includes("voilage")) caRideaux += total;
      else caDivers += total;
    }

    // 2. Process Logistics / Déplacements (depRows)
    const depTotal = (depRows || []).reduce((s, r) => s + toNum(r?.prix_total), 0);
    (depRows || []).forEach(r => {
      const q = toNum(r?.quantite) || 1;
      const h = toNum(r?.heures_facturees) * q;
      const typeDep = String(r?.type_deplacement || "").toLowerCase();
      if (typeDep.includes("prise de cote")) {
        hPrepa += h;
      } else {
        hPose += h;
      }
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

  // Header State
  const [name, setName] = React.useState(minute?.name || "Minute sans nom");
  const [notes, setNotes] = React.useState(minute?.notes || "");
  const notesRef = React.useRef(null);

  React.useEffect(() => {
    setName(minute?.name || "Minute sans nom");
  }, [minuteId, minute?.name]);

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
    return all.find(r => r.id === localRowId);
  }, [localRowId, rows, depRows, extraRows]);

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

  return (
    <div style={S.contentWide}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, marginTop: 8 }}>
        <div>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0, fontSize: 13, fontWeight: 500 }}>← Retour</button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
            {canEdit ? (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => updateMinute({ name })}
                style={{ fontSize: 32, fontWeight: 800, color: '#111827', border: 'none', background: 'transparent', outline: 'none', width: '100%' }}
                placeholder="Nom du projet"
              />
            ) : <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0 }}>{name}</h1>}
            <div style={{ fontSize: 16, color: '#6B7280', fontWeight: 300 }}>{minute?.client || "Client non spécifié"}</div>
          </div>
          <div style={{ marginTop: 16, width: '50vw', maxWidth: '800px' }}>
            <NotesField 
              initialValue={minute?.notes || ""} 
              onSave={handleNotesSave} 
              canEdit={canEdit} 
              readOnly={minute?.status === "VALIDATED"}
            />
            {/* DATE DE LIVRAISON ESTIMÉE */}
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#6B7280' }}>Date de livraison estimée :</span>
              {canEdit ? (
                <input 
                  type="date"
                  value={minute?.delivery_date || minute?.deliveryDate || ""}
                  onChange={(e) => updateMinute({ delivery_date: e.target.value })}
                  style={{ border: '1px solid #E5E7EB', borderRadius: 4, padding: '4px 8px', fontSize: 13, color: '#374151', background: 'white', outline: 'none' }}
                />
              ) : (
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1F2937' }}>
                  {(minute?.delivery_date || minute?.deliveryDate) ? new Date(minute.delivery_date || minute.deliveryDate).toLocaleDateString("fr-FR") : "Non renseignée"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 32 }}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept=".xlsx, .xls"
            onChange={handleGlobalImport}
          />
          <button onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', gap: 8, padding: '8px 16px', borderRadius: 8, background: '#10B981', color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <FileUp size={16} /> Importer Excel
          </button>

          <button onClick={() => setShowHistory(true)} style={{ display: 'flex', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'white', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#374151' }} title="Historique">
            <History size={16} />
          </button>
          <button onClick={() => setShowCatalog(true)} style={{ display: 'flex', gap: 8, padding: '8px 16px', borderRadius: 8, background: 'white', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#374151', fontSize: 13, fontWeight: 500 }}>
            <BookOpen size={16} /> Bibliothèque
          </button>

          <div style={{ position: 'relative' }}>
            <select
              value={localStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={!canEdit && localStatus !== "VALIDATED"}
              style={{
                appearance: 'none', padding: "8px 12px 8px 24px", borderRadius: 20, border: "1px solid #E5E7EB", background: 'white',
                fontWeight: 600, color: '#374151', cursor: canEdit ? 'pointer' : 'not-allowed', outline: 'none', fontSize: 13, minWidth: 120, textAlign: 'center'
              }}
            >
              <option value="DRAFT">À faire</option>
              <option value="IN_PROGRESS">En cours</option>
              <option value="PENDING_APPROVAL">À valider</option>
              <option value="REVISE">À reprendre</option>
              <option value="REVISE">À reprendre</option>
              <option value="VALIDATED">Validée</option>
              <option value="ORDERED">Commande</option>
              <option value="ORDER_COMPLETED">Commande terminée</option>
              <option value="LOST">Perdu</option>
            </select>
            <div style={{
              position: 'absolute', top: '50%', left: 10, transform: 'translateY(-50%)', width: 8, height: 8, borderRadius: '50%', pointerEvents: 'none',
              background: localStatus === 'ORDERED' ? '#8B5CF6' : localStatus === 'VALIDATED' ? '#10B981' : localStatus === 'ORDER_COMPLETED' ? '#059669' : localStatus === 'LOST' ? '#EF4444' : localStatus === 'PENDING_APPROVAL' ? '#F59E0B' : localStatus === 'IN_PROGRESS' ? '#3B82F6' : '#9CA3AF'
            }} />
          </div>
        </div>
      </div>

      <MinuteHistoryDialog open={showHistory} onClose={() => setShowHistory(false)} minute={minute} />

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
              key={`${minute?.id}-${Object.keys(mods || {}).filter(k => mods[k]).sort().join('-')}`} // FORCE REMOUNT on module change
              minute={{
                ...minute,
                lines: [
                  ...(rows || []),
                  ...(extraRows || []).map(r => ({ ...r, produit: r.produit || "Autre Dépense" })),
                  ...(depRows || []).map(r => ({ ...r, produit: r.produit || "Déplacement" }))
                ],
                modules: mods
              }}
              readOnly={minute?.status === "VALIDATED"}
              currentUser={currentUser}
              onChangeMinute={(m) => {
                if (!canEdit) return;
                const all = m.lines || [];
                const newLines = all.filter(r => r.produit !== "Autre Dépense" && r.produit !== "Déplacement");
                const newExtras = all.filter(r => r.produit === "Autre Dépense");
                const newDeps = all.filter(r => r.produit === "Déplacement");

                setRows(newLines);
                setExtraRows(newExtras);
                setDepRows(newDeps);
                if (m.modules) setLocalModules(m.modules);

                updateMinute({
                  lines: newLines,
                  extraDepenses: newExtras,
                  deplacements: newDeps,
                  name: m.name,
                  notes: m.notes,
                  status: m.status,
                  catalog: m.catalog,
                  settings: m.settings,
                  modules: m.modules // ADDED: Persist modules
                });
              }}
              enableCellFormulas={true}
              formulaCtx={formulaCtx}
              schema={schema}
              setSchema={setSchema}
              targetRowId={localRowId}
              onRowClick={(id) => setLocalRowId(id)}
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
            updateMinute({ settings: newSettings });
          }}
        />
      )}

      <CatalogManager
        open={showCatalog}
        onClose={() => setShowCatalog(false)}
        catalog={minute?.catalog || []}
        onCatalogChange={(newCatalog) => updateMinute({ catalog: newCatalog })}
        settings={formulaCtx.settings}
        onSettingsChange={(newSettings) => {
          setLocalSettings({ ...localSettings, ...newSettings }); // Optimistic UI
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
        />
      )}
    </div>
  );
}

export default ChiffrageScreen;