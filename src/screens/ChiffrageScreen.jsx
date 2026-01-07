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
import { useAppSettings, useCatalog } from "../hooks/useSupabase";

import MinuteHistoryDialog from "../components/MinuteHistoryDialog";
import { BookOpen, History } from 'lucide-react';

const toNum = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

function ChiffrageScreen({ minuteId, minutes, onUpdate, onBack, highlightRowId }) {
  const [localRowId, setLocalRowId] = React.useState(null);
  const [showHistory, setShowHistory] = React.useState(false);
  const [showCatalog, setShowCatalog] = React.useState(false);

  // Data Hooks
  const { settings: globalSettings } = useAppSettings();
  const { catalog } = useCatalog();
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
    const local = minute?.settings || {};
    const effectiveSettings = { ...defaults, ...global, ...local };

    return {
      paramsMap,
      totalCA: baseCA,
      settings: effectiveSettings,
      catalog: catalog || []
    };
  }, [paramsMap, baseCA, globalSettings, catalog, minute?.settings]);

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

  const mods = minute?.modules || { rideau: true, store: true, decor: true };

  // Update Wrapper
  const updateMinute = (patch) => {
    if (!canEdit) return;
    if (onUpdate) onUpdate(minute.id, patch);
  };

  // Local status for optimistic UI
  const [localStatus, setLocalStatus] = React.useState(minute?.status || "DRAFT");

  React.useEffect(() => {
    setLocalStatus(minute?.status || "DRAFT");
  }, [minute?.status]);

  // Status Change with Logging
  const handleStatusChange = (newStatus) => {
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
    } else {
      performUpdate();
    }
  };

  // Recap Logic
  const recap = React.useMemo(() => {
    let caRideaux = 0, caDecors = 0, caStores = 0, caAutres = 0;
    let hConf = 0, hPose = 0, hPrepa = 0;

    for (const r of rows || []) {
      const prod = String(r?.produit || "").toLowerCase();
      const total = toNum(r?.prix_total);
      const qty = toNum(r?.quantite) || 1;

      hConf += (toNum(r?.heures_confection) * qty);
      hPose += (toNum(r?.heures_pose) * qty);
      hPrepa += (toNum(r?.heures_prepa) * qty);

      if (!total) continue;
      if (prod.includes("store")) caStores += total;
      else if (prod.includes("décor") || prod.includes("decor")) caDecors += total;
      else if (prod.includes("rideau") || prod.includes("voilage")) caRideaux += total;
      else caAutres += total;
    }

    const caTotal = caRideaux + caDecors + caStores + caAutres;
    const extrasTotal = (extraRows || []).reduce((s, r) => s + toNum(r?.prix_total), 0);
    const depTotal = (depRows || []).reduce((s, r) => s + toNum(r?.prix_total), 0);

    (depRows || []).forEach(r => { hPose += toNum(r?.heures_facturees); });

    const offreTotale = caTotal + depTotal;

    return { caRideaux, caDecors, caStores, caAutres, caTotal, extrasTotal, depTotal, offreTotale, hConf, hPose, hPrepa };
  }, [rows, extraRows, depRows]);

  const nfEur0 = React.useMemo(() => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }), []);

  // Header State
  const [name, setName] = React.useState(minute?.name || "Minute sans nom");
  const [notes, setNotes] = React.useState(minute?.notes || "");
  const notesRef = React.useRef(null);

  // Auto-resize notes
  React.useEffect(() => {
    if (notesRef.current) {
      notesRef.current.style.height = "auto";
      notesRef.current.style.height = notesRef.current.scrollHeight + "px";
    }
  }, [notes]);

  React.useEffect(() => {
    setName(minute?.name || "Minute sans nom");
    setNotes(minute?.notes || "");
  }, [minuteId, minute?.name, minute?.notes]);

  // Tabs
  const [activeTab, setActiveTab] = React.useState("minutes");

  // Row Opening
  const openedRow = React.useMemo(() => {
    if (!localRowId) return null;
    const all = [...(rows || []), ...(depRows || []), ...(extraRows || [])];
    return all.find(r => r.id === localRowId);
  }, [localRowId, rows, depRows, extraRows]);

  const handleDetailUpdate = (updatedRow) => {
    if (!canEdit) return;
    if ((rows || []).some(r => r.id === updatedRow.id)) {
      setRows(prev => prev.map(r => r.id === updatedRow.id ? updatedRow : r));
      updateMinute({ lines: rows.map(r => r.id === updatedRow.id ? updatedRow : r) }); // optimistic
    } else if ((depRows || []).some(r => r.id === updatedRow.id)) {
      setDepRows(prev => prev.map(r => r.id === updatedRow.id ? updatedRow : r));
      updateMinute({ deplacements: depRows.map(r => r.id === updatedRow.id ? updatedRow : r) });
    } else if ((extraRows || []).some(r => r.id === updatedRow.id)) {
      setExtraRows(prev => prev.map(r => r.id === updatedRow.id ? updatedRow : r));
      updateMinute({ extraDepenses: extraRows.map(r => r.id === updatedRow.id ? updatedRow : r) });
    }
  };

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
            <textarea
              ref={notesRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => updateMinute({ notes })}
              placeholder="Ajouter une note de contexte..."
              rows={1}
              style={{ width: '100%', border: 'none', background: 'transparent', borderBottom: '1px dashed #E5E7EB', outline: 'none', resize: 'none', fontSize: 14, overflow: 'hidden', fontFamily: 'Roboto, sans-serif' }}
              readOnly={!canEdit}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 32 }}>
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
              <option value="VALIDATED">Validée</option>
            </select>
            <div style={{
              position: 'absolute', top: '50%', left: 10, transform: 'translateY(-50%)', width: 8, height: 8, borderRadius: '50%', pointerEvents: 'none',
              background: localStatus === 'VALIDATED' ? '#10B981' : localStatus === 'PENDING_APPROVAL' ? '#F59E0B' : localStatus === 'IN_PROGRESS' ? '#3B82F6' : '#9CA3AF'
            }} />
          </div>
        </div>
      </div>

      <MinuteHistoryDialog open={showHistory} onClose={() => setShowHistory(false)} minute={minute} />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button style={S.pill(activeTab === "minutes")} onClick={() => setActiveTab("minutes")}>Minutes</button>
        <button style={S.pill(activeTab === "achats")} onClick={() => setActiveTab("achats")}>Liste Achats</button>
        {can(currentUser, "chiffrage.moulinette") && <button style={S.pill(activeTab === "moulinette")} onClick={() => setActiveTab("moulinette")}>Moulinette</button>}
      </div>

      {/* Minutes Tab */}
      {activeTab === "minutes" && (
        <div style={{ display: "grid", gap: 12, overflow: "hidden" }}>
          <DashboardSummary recap={recap} nf={nfEur0} />
          <div style={{ minWidth: 0, overflowX: "auto" }}>
            <MinuteEditor
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
                updateMinute({
                  lines: newLines,
                  extraDepenses: newExtras,
                  deplacements: newDeps,
                  name: m.name,
                  notes: m.notes,
                  status: m.status,
                  catalog: m.catalog,
                  settings: m.settings
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

      {activeTab === "achats" && <ShoppingListScreen minutes={[minute]} />}
      {activeTab === "moulinette" && can(currentUser, "chiffrage.moulinette") && <MoulinetteView rows={rows} extraRows={extraRows} depRows={depRows} />}

      <CatalogManager
        open={showCatalog}
        onClose={() => setShowCatalog(false)}
        catalog={minute?.catalog || []}
        onCatalogChange={(newCatalog) => updateMinute({ catalog: newCatalog })}
        settings={formulaCtx.settings}
        onSettingsChange={(newSettings) => updateMinute({ settings: newSettings })}
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