import React from "react";

import MinuteEditor from "../components/MinuteEditor";
import ShoppingListScreen from "../screens/ShoppingListScreen";
import DataTable from "../components/DataTable";
import MoulinetteView from "../components/modules/Moulinette/MoulinetteView";
import DashboardSummary from "../components/DashboardSummary";

import { COLORS, S } from "../lib/constants/ui";
import { CHIFFRAGE_SCHEMA } from "../lib/schemas/chiffrage";
import { CHIFFRAGE_SCHEMA_DEP } from "../lib/schemas/deplacement";
import { EXTRA_DEPENSES_SCHEMA } from "../lib/schemas/extraDepenses";

import { computeFormulas, preserveManualAfterCompute } from "../lib/formulas/compute";
import { uid } from "../lib/utils/uid";

// 🔐 droits
import { useAuth } from "../auth";
import { can } from "../lib/authz";

// Helper for numeric conversion
const toNum = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

function ChiffrageScreen({ minuteId, minutes, setMinutes, onBack }) {
  // ──────────────────────────────────────────────────────────────
  // Droits
  // ──────────────────────────────────────────────────────────────
  const { currentUser } = useAuth();
  const canView = can(currentUser, "chiffrage.view");
  const canEdit = can(currentUser, "chiffrage.edit");

  if (!canView) {
    return (
      <div style={S.contentWrap}>
        <div style={{ marginBottom: 12 }}>
          <button style={S.smallBtn} onClick={onBack}>← Retour</button>
        </div>
        <div style={{ padding: 24, border: `1px solid ${COLORS.border}`, borderRadius: 12, background: "#fff" }}>
          Accès refusé.
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // Données minute
  // ──────────────────────────────────────────────────────────────
  const minute = React.useMemo(
    () => (minutes || []).find((m) => m.id === minuteId),
    [minutes, minuteId]
  );

  const [schema, setSchema] = React.useState(CHIFFRAGE_SCHEMA);

  const paramsMap = React.useMemo(() => {
    const out = {};
    (minute?.params || []).forEach((p) => {
      if (p?.name) out[p.name] = p?.value;
    });
    return out;
  }, [minute?.params]);

  // Calculate Base CA (Pre-Commission) from raw minute data to avoid state loops.
  // We sum everything EXCEPT Commission lines.
  const baseCA = React.useMemo(() => {
    let sum = 0;
    // Main Lines
    (minute?.lines || []).forEach(r => sum += toNum(r.prix_total));
    // Deplacements
    (minute?.deplacements || []).forEach(r => sum += toNum(r.prix_total));
    // Autos / Extras (Non-Commission)
    (minute?.extraDepenses || []).forEach(r => {
      if (!r.categorie?.includes('Commission')) {
        sum += toNum(r.prix_total);
      }
    });
    return sum;
  }, [minute?.lines, minute?.deplacements, minute?.extraDepenses]);

  const formulaCtx = React.useMemo(() => ({ paramsMap, totalCA: baseCA }), [paramsMap, baseCA]);

  const [rows, setRows] = React.useState(() =>
    computeFormulas(minute?.lines || [], schema, formulaCtx)
  );

  const [depRows, setDepRows] = React.useState(
    computeFormulas(minute?.deplacements || [], CHIFFRAGE_SCHEMA_DEP, formulaCtx)
  );

  React.useEffect(() => {
    const computedMain = computeFormulas(minute?.lines || [], schema, formulaCtx);
    setRows((prev) => preserveManualAfterCompute(computedMain, prev || []));

    const computedDep = computeFormulas(minute?.deplacements || [], CHIFFRAGE_SCHEMA_DEP, formulaCtx);
    setDepRows(computedDep);
  }, [minute?.id, minute?.lines, minute?.deplacements, schema, formulaCtx]);

  const mods = minute?.modules || { rideau: true, store: true, decor: true };

  // ──────────────────────────────────────────────────────────────
  // Handlers
  // ──────────────────────────────────────────────────────────────
  const updateMinute = (patch) => {
    if (!canEdit) return;
    const next = { ...minute, ...patch };
    setMinutes((prev) => prev.map((m) => (m.id === minute.id ? next : m)));
  };

  // Lignes principales
  const handleRowsChange = (nr) => {
    if (!canEdit) return;
    const next = Array.isArray(nr) ? nr : [];
    setRows(next);
    updateMinute({ lines: next });
  };

  // Déplacements
  const handleDepRowsChange = (nr) => {
    if (!canEdit) return;
    const next = Array.isArray(nr) ? nr : [];
    setDepRows(next);
    updateMinute({ deplacements: next });
  };

  // ──────────────────────────────────────────────────────────────
  // Autres dépenses
  // ──────────────────────────────────────────────────────────────
  const [extraRows, setExtraRows] = React.useState(() =>
    Array.isArray(minute?.extraDepenses) ? minute.extraDepenses : []
  );

  React.useEffect(() => {
    setExtraRows(Array.isArray(minute?.extraDepenses) ? minute.extraDepenses : []);
  }, [minute?.id, minute?.extraDepenses]);

  const handleExtraRowsChange = (nr) => {
    if (!canEdit) return;
    const next = Array.isArray(nr) ? nr : [];
    setExtraRows(next);
    updateMinute({ extraDepenses: next });
  };
  // ——— Helpers récap CA ———

  const nfEur0 = React.useMemo(
    () => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }),
    []
  );

  // Regroupe les CA par grands blocs + totaux dépenses/dep
  const recap = React.useMemo(() => {
    let caRideaux = 0, caDecors = 0, caStores = 0, caAutres = 0;

    for (const r of rows || []) {
      const prod = String(r?.produit || "").toLowerCase();
      const total = toNum(r?.prix_total);
      if (!total) continue;

      if (prod.includes("store")) caStores += total;
      else if (prod.includes("décor") || prod.includes("decor")) caDecors += total;
      else if (prod.includes("rideau") || prod.includes("voilage")) caRideaux += total;
      else caAutres += total;
    }

    const caTotal = caRideaux + caDecors + caStores + caAutres;

    const extrasTotal = (extraRows || []).reduce((s, r) => s + toNum(r?.prix_total), 0);
    const depTotal = (depRows || []).reduce((s, r) => s + toNum(r?.prix_total), 0);

    const offreTotale = caTotal + extrasTotal + depTotal;

    return {
      caRideaux, caDecors, caStores, caAutres, caTotal,
      extrasTotal, depTotal, offreTotale,
    };
  }, [rows, extraRows, depRows, toNum]);


  // ──────────────────────────────────────────────────────────────
  // Paramètres minute
  // ──────────────────────────────────────────────────────────────


  const slugParamName = (raw) =>
    String(raw || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const toNumOrNull = (v) => {
    if (v === "" || v == null) return null;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const DEFAULT_PARAMS = [
    { id: uid(), name: "taux_horaire", type: "prix", value: 135 },
    { id: uid(), name: "prix_hotel", type: "prix", value: 150 },
    { id: uid(), name: "prix_achat_tissu", type: "prix", value: null },
  ];

  const [paramDraft, setParamDraft] = React.useState(() => {
    const base = Array.isArray(minute?.params) ? minute.params : [];
    return (base.length ? base : DEFAULT_PARAMS);
  });

  React.useEffect(() => {
    const base = Array.isArray(minute?.params) ? minute.params : [];
    setParamDraft(base.length ? base : DEFAULT_PARAMS);
  }, [minute?.id]);

  React.useEffect(() => {
    if (!canEdit) return;
    const cleaned = (paramDraft || []).map(p => ({
      id: p.id || uid(),
      name: slugParamName(p.name || ""),
      type: p.type === "coef" ? "coef" : "prix",
      value: toNumOrNull(p.value),
    }));
    updateMinute({ params: cleaned });
  }, [paramDraft]);

  const addParam = () => { if (canEdit) setParamDraft(d => ([...(d || []), { id: uid(), name: "", type: "prix", value: null }])); };
  const setParamField = (id, key, value) => { if (canEdit) setParamDraft(d => (d || []).map(p => p.id === id ? { ...p, [key]: value } : p)); };
  const removeParam = (id) => { if (canEdit) setParamDraft(d => (d || []).filter(p => p.id !== id)); };

  // ──────────────────────────────────────────────────────────────
  // En-tête minute
  // ──────────────────────────────────────────────────────────────
  const [name, setName] = React.useState(minute?.name || "Minute sans nom");
  const [notes, setNotes] = React.useState(minute?.notes || "");
  React.useEffect(() => {
    setName(minute?.name || "Minute sans nom");
    setNotes(minute?.notes || "");
  }, [minuteId, minute?.name, minute?.notes]);

  const saveHeader = () => {
    if (!canEdit) return;
    updateMinute({ name: name || "Minute sans nom", notes });
  };

  // ──────────────────────────────────────────────────────────────
  // Onglets
  // ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = React.useState("minutes");

  if (!minute) {
    return (
      <div style={S.contentWrap}>
        <div style={{ marginBottom: 12 }}>
          <button style={S.smallBtn} onClick={onBack}>← Retour</button>
        </div>
        <div style={{ padding: 24, border: `1px solid ${COLORS.border}`, borderRadius: 12, background: "#fff" }}>
          Minute introuvable.
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // Rendu
  // ──────────────────────────────────────────────────────────────
  return (
    <div style={S.contentWide}>
      {/* Barre supérieure */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <button style={S.smallBtn} onClick={onBack}>← Retour</button>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du devis / minute"
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${COLORS.border}`,
              background: "#fff",
              fontWeight: 800,
            }}
            disabled={!canEdit}
          />
          <button style={S.smallBtn} onClick={saveHeader} disabled={!canEdit}>
            Enregistrer
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, justifySelf: "end", alignItems: "center" }}>
          <div style={{ opacity: 0.7 }}>
            {new Date(minute.updatedAt || minute.createdAt || Date.now()).toLocaleString("fr-FR")}
          </div>

        </div>
      </div>

      {/* Onglets */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button style={S.pill(activeTab === "minutes")} onClick={() => setActiveTab("minutes")}>Minutes</button>
        <button style={S.pill(activeTab === "achats")} onClick={() => setActiveTab("achats")}>Liste Achats</button>
        <button style={S.pill(activeTab === "moulinette")} onClick={() => setActiveTab("moulinette")}>Moulinette</button>
      </div>

      {/* Notes minute */}
      <div style={{ marginBottom: 12 }}>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optionnel)"
          rows={2}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: `1px solid ${COLORS.border}`,
            background: "#fff",
            resize: "vertical",
          }}
          disabled={!canEdit}
        />
      </div>



      {/* Onglet Minutes */}
      {activeTab === "minutes" && (
        <div style={{ display: "grid", gap: 12, overflow: "hidden" }}>
          {/* Récap CA Dashboard */}
          <DashboardSummary recap={recap} nf={nfEur0} />
          {/* Rangée du bas : grand tableau des minutes (inclut maintenant Autres Dépenses et Déplacements via fusion) */}
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
              onChangeMinute={(m) => {
                if (!canEdit) return;
                const all = m.lines || [];

                // Split back logic
                const newLines = all.filter(r => r.produit !== "Autre Dépense" && r.produit !== "Déplacement");
                const newExtras = all.filter(r => r.produit === "Autre Dépense");
                const newDeps = all.filter(r => r.produit === "Déplacement");

                updateMinute({
                  lines: newLines,
                  extraDepenses: newExtras,
                  deplacements: newDeps,
                  // Also update other minute fields if modified (like name, status, catalog)
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
            />
          </div>
        </div>
      )}

      {activeTab === "achats" && <ShoppingListScreen minutes={[minute]} />}

      {activeTab === "moulinette" && (
        <MoulinetteView rows={rows} extraRows={extraRows} depRows={depRows} />
      )}
    </div>
  );
}

export default ChiffrageScreen;