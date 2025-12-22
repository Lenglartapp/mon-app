// src/screens/ProductionProjectScreen.jsx
import React, { useEffect, useMemo, useState } from "react";
import { COLORS, S } from "../lib/constants/ui.js";

import MinuteGrid from "../components/MinuteGrid.jsx"; // Replaces DataTable
import DashboardTiles from "../components/DashboardTiles.jsx";
import EtiquettesSection from "../components/EtiquettesSection.jsx";
import MinutesScreen from "./MinutesScreen.jsx";

import { computeFormulas, preserveManualAfterCompute } from "../lib/formulas/compute";
import { SCHEMA_64 } from "../lib/schemas/production.js";
import { STAGES, DEFAULT_VIEWS } from "../lib/constants/views.js"; // Import DEFAULT_VIEWS
import { recomputeRow } from "../lib/formulas/recomputeRow";
import { uid } from "../lib/utils/uid"; // Import uid

import { Search, Filter, Layers3, Star, FlaskConical } from "lucide-react";
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

/**
 * Props:
 *  - project
 *  - onBack()
 *  - onUpdateProjectRows(newRows)  ← pour persister dans App.jsx
 */
export function ProductionProjectScreen({ project, onBack, onUpdateProjectRows }) {
  const [stage, setStage] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [schema, setSchema] = useState(SCHEMA_64);

  const { currentUser } = useAuth();
  const canEditProd = can(currentUser, "production.edit");
  const seeChiffrage = can(currentUser, "chiffrage.view");

  // Lignes locales (édition fluide)
  const initialRows = useMemo(
    () => computeFormulas(project?.rows || [], SCHEMA_64),
    [project?.id]
  );
  const [rows, setRows] = useState(initialRows);

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

  // 🧷 Persister côté parent à chaque modif locale
  useEffect(() => {
    if (typeof onUpdateProjectRows === "function") {
      onUpdateProjectRows(rows);
    }
  }, [rows, onUpdateProjectRows]);

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
  const rowsDecors = filteredRows.filter((r) => /d[ée]cor/i.test(String(r.produit || "")));
  const rowsStores = filteredRows.filter((r) => /store/i.test(String(r.produit || "")));

  const recomputeAll = (arr) => (arr || []).map(r => recomputeRow(r, schema));

  // Helper to handle both updates and deletions for a specific subset
  const handleSubsetChange = (newSubsetRows, filterRegex) => {
    if (!canEditProd) return;

    setRows((allRows) => {
      // 1. Identify which rows in 'allRows' belong to this subset (based on the *same* logic used to filter them originally)
      // This is crucial: we must know what the "previous state" of this subset was implies.
      // Actually, we can just check which rows in 'allRows' MATCH the filter, and assume they form the 'oldSubset'.
      const oldSubset = allRows.filter(r => filterRegex.test(String(r.produit || "")));

      // 2. Identify Deleted IDs
      // IDs present in oldSubset but MISSING in newSubsetRows
      const newIds = new Set(newSubsetRows.map(r => r.id));
      const deletedIds = new Set(oldSubset.filter(r => !newIds.has(r.id)).map(r => r.id));

      // 3. Prepare Updates
      const updatedMap = new Map(newSubsetRows.map(r => [r.id, r]));

      // 4. Reconstruct 'allRows'
      // - Keep rows NOT in the subset (preserve them)
      // - If in subset and Deleted -> Remove
      // - If in subset and Kept -> Update if needed
      return allRows
        .filter(r => !deletedIds.has(r.id)) // Remove deleted
        .map(r => {
          if (updatedMap.has(r.id)) {
            // It's in the new subset, update it
            return recomputeRow(updatedMap.get(r.id), schema);
          }
          return r; // Not in the subset (or not updated, but wait, if it's in oldSubset and not in newIds, it was deleted above)
        });
    });
  };

  const mergeChildRowsFor = (tableKey) => {
    // Legacy wrapper if needed, or replace usages directly
    // Define regex based on tableKey
    let regex = /./; // Default
    if (tableKey === "rideaux") regex = /rideau|voilage/i;
    else if (tableKey === "stores") regex = /store/i;
    else if (tableKey === "decors") regex = /d[ée]cor/i;

    return (nr) => handleSubsetChange(nr, regex);
  };

  const handleRowsChangeInstallation = (nr) => {
    if (!canEditProd) return;
    // Installation view (all rows), so we can just replace 'rows' but safely
    // Actually simpler: just recompute all new rows
    setRows(nr.map(r => recomputeRow(r, schema)));
  };

  // --- ADD ROW LOGIC ---
  const handleAddRow = (produitType = "Rideau") => {
    const newRow = {
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
      created: Date.now()
    };

    const computed = recomputeRow(newRow, schema);
    setRows(prev => [...prev, computed]);
  };

  const handleDuplicateRow = (id) => {
    if (!canEditProd) return;
    const index = rows.findIndex(r => r.id === id);
    if (index === -1) return;

    const source = rows[index];
    // Deep copy / safe copy
    const newRow = {
      ...source,
      id: uid(),
      piece: source.piece ? `${source.piece} (Copie)` : source.piece,
      comments: source.comments ? [...source.comments] : []
    };

    // Recompute to ensure consistency
    const computed = recomputeRow(newRow, schema);

    const newRows = [...rows];
    newRows.splice(index + 1, 0, computed);
    setRows(newRows);
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
    ].map(r => recomputeRow(r, schema)); // Ensure formulas computed

    setRows(prev => [...prev, ...testRows]);
    alert("Données de test ajoutées ! (3 lignes)");
  };


  const projectName = project?.name || "—";
  const visibleStages = STAGES.filter(p => p.key !== "chiffrage" || seeChiffrage);

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
    overflow: 'hidden' // Ensure header border respects radius
  };

  return (
    <div style={S.contentWide}>
      <div style={{ margin: "4px 0 12px", color: COLORS.text, fontWeight: 600 }}>
        <button
          onClick={onBack}
          style={{ background: "none", border: "none", padding: 0, margin: 0, cursor: "pointer", color: COLORS.text }}
        >
          Production
        </button>
        {" / "}<span style={{ fontWeight: 800 }}>{projectName}</span>
        {project?.manager ? (
          <span style={{ marginLeft: 8, opacity: .7 }}>— {project.manager}</span>
        ) : null}
      </div>

      <div style={S.pills}>
        {visibleStages.map((p) => (
          <button key={p.key} style={S.pill(stage === p.key)} onClick={() => setStage(p.key)}>
            {p.label}
          </button>
        ))}
      </div>

      <div style={S.searchRow}>
        <div style={S.searchBox}>
          <Search size={18} style={{ position: "absolute", left: 10, top: 12, opacity: 0.6 }} />
          <input
            placeholder="Recherche"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={S.searchInput}
          />
        </div>
        <div style={S.toolsRow}>
          <span style={S.toolBtn}><Filter size={16} /> Filtre</span>
          <span style={S.toolBtn}><Layers3 size={16} /> Regrouper</span>
          <button
            style={{ ...S.toolBtn, border: "none", background: "none", color: "#6366f1", fontWeight: 600 }}
            onClick={handleLoadTestData}
          >
            <FlaskConical size={16} /> Test Data
          </button>
        </div>
      </div>

      {stage === "dashboard" && (
        <DashboardTiles rows={rows} projectHours={{ conf: 0, pose: 0 }} />
      )}

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
        <div style={S.contentWide}>
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
          />
        </div>
      )}

      {stage === "bpf" && (
        <>
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
            />
          </div>

          <div style={cardStyle}>
            <div style={cardHeaderStyle}>BPF Décors de lit</div>
            <MinuteGrid
              rows={rowsDecors}
              onRowsChange={mergeChildRowsFor("decors")}
              schema={schema}
              enableCellFormulas={true}
              initialVisibilityModel={getVisibilityModel('bpf', 'decors', schema)}
              onAdd={() => handleAddRow("Décor de lit")}
              onDuplicateRow={handleDuplicateRow}
            />
          </div>

          <div style={cardStyle}>
            <div style={cardHeaderStyle}>BPF Stores</div>
            <MinuteGrid
              rows={rowsStores}
              onRowsChange={mergeChildRowsFor("stores")}
              schema={schema}
              enableCellFormulas={true}
              initialVisibilityModel={getVisibilityModel('bpf', 'stores', schema)}
              onAdd={() => handleAddRow("Store Bateau")}
              onDuplicateRow={handleDuplicateRow}
            />
          </div>
        </>
      )}

      {stage === "bpp" && (
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>BPP (Préparation Mécanismes)</div>
          <MinuteGrid
            rows={filteredRows}
            onRowsChange={handleRowsChangeInstallation} // reuse generic updater
            schema={schema}
            enableCellFormulas={true}
            initialVisibilityModel={getVisibilityModel('bpp', 'all', schema)}
            onDuplicateRow={handleDuplicateRow}
          />
        </div>
      )}
    </div>
  );
}

export default ProductionProjectScreen;