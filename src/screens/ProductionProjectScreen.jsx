// src/screens/ProductionProjectScreen.jsx
import React, { useEffect, useMemo, useState } from "react";
import { COLORS, S } from "../lib/constants/ui.js";

import DataTable from "../components/DataTable.jsx";
import DashboardTiles from "../components/DashboardTiles.jsx";
import EtiquettesSection from "../components/EtiquettesSection.jsx";
import MinutesScreen from "./MinutesScreen.jsx";

import { computeFormulas, preserveManualAfterCompute } from "../lib/formulas/compute";
import { SCHEMA_64 } from "../lib/schemas/production.js";
import { STAGES } from "../lib/constants/views.js";
import { recomputeRow } from "../lib/formulas/recomputeRow";

import { Search, Filter, Layers3, Star } from "lucide-react";
import { useAuth } from "../auth";
import { can } from "../lib/authz";

/**
 * Props:
 *  - project
 *  - onBack()
 *  - onUpdateProjectRows(newRows)  ← pour persister dans App.jsx
 */
export function ProductionProjectScreen({ project, onBack, onUpdateProjectRows }) {
  const [stage, setStage]   = useState("dashboard");
  const [search, setSearch] = useState("");
  const [schema, setSchema] = useState(SCHEMA_64);

  const { currentUser } = useAuth();
  const canEditProd  = can(currentUser, "production.edit");
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

  // Sous-ensembles
  const rowsRideaux = rows.filter((r) => /rideau|voilage/i.test(String(r.produit || "")));
  const rowsDecors  = rows.filter((r) => /d[ée]cor/i.test(String(r.produit || "")));
  const rowsStores  = rows.filter((r) => /store/i.test(String(r.produit || "")));

  const recomputeAll = (arr) => (arr || []).map(r => recomputeRow(r, schema));

  const mergeChildRowsFor = (tableKey) => {
    return (nr) => {
      if (!canEditProd) return; // lecture seule
      setRows((all) => {
        const isInTable = (r) => {
          const p = String(r?.produit || "");
          if (tableKey === "rideaux") return /rideau|voilage/i.test(p);
          if (tableKey === "decors")  return /d[ée]cor/i.test(p);
          if (tableKey === "stores")  return /store/i.test(p);
          return false;
        };
        const others   = (all || []).filter((r) => !isInTable(r));
        const previous = (all || []).filter((r) => isInTable(r));

        const computed = recomputeAll(nr);
        const merged   = preserveManualAfterCompute(computed, previous);

        return [...others, ...merged];
      });
    };
  };

  const projectName = project?.name || "—";
  const visibleStages = STAGES.filter(p => p.key !== "chiffrage" || seeChiffrage);

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
          <span style={S.toolBtn}><Filter size={16}/> Filtre</span>
          <span style={S.toolBtn}><Layers3 size={16}/> Regrouper</span>
          <span style={S.toolBtn}><Star size={16}/> Favoris</span>
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
          <EtiquettesSection title="Etiquettes Rideaux" tableKey="rideaux" rows={rowsRideaux} schema={schema} />
          <EtiquettesSection title="Etiquettes Stores"  tableKey="stores"  rows={rowsStores}  schema={schema} />
        </div>
      )}

      {stage === "prise" && (
        <>
          <DataTable
            title="PRISE DE COTE RIDEAU"
            tableKey="rideaux"
            rows={rowsRideaux}
            onRowsChange={mergeChildRowsFor("rideaux")}
            schema={schema}
            setSchema={setSchema}
            searchQuery={search}
            viewKey="prise"
            enableCellFormulas={true}
          />
          <DataTable
            title="PRISE DE COTE STORE"
            tableKey="stores"
            rows={rowsStores}
            onRowsChange={mergeChildRowsFor("stores")}
            schema={schema}
            setSchema={setSchema}
            searchQuery={search}
            viewKey="prise"
            enableCellFormulas={true}
          />
        </>
      )}

      {stage === "installation" && (
        <DataTable
          title="Suivi Installation / Livraison"
          tableKey="all"
          rows={rows}
          onRowsChange={(nr) => {
            if (!canEditProd) return;
            const computed = (nr || []).map(r => recomputeRow(r, schema));
            const next     = preserveManualAfterCompute(computed, rows || []);
            setRows(next); // persistera via useEffect([rows])
          }}
          schema={schema}
          setSchema={setSchema}
          searchQuery={search}
          viewKey="installation"
          enableCellFormulas={true}
        />
      )}

      {stage === "bpf" && (
        <>
          <DataTable title="BPF Rideaux"        tableKey="rideaux" rows={rowsRideaux} onRowsChange={mergeChildRowsFor("rideaux")} schema={schema} setSchema={setSchema} searchQuery={search} viewKey="bpf" enableCellFormulas={true} />
          <DataTable title="BPF Décors de lit"  tableKey="decors"  rows={rowsDecors}  onRowsChange={mergeChildRowsFor("decors")}  schema={schema} setSchema={setSchema} searchQuery={search} viewKey="bpf" enableCellFormulas={true} />
          <DataTable title="BPF Stores"         tableKey="stores"  rows={rowsStores}  onRowsChange={mergeChildRowsFor("stores")}  schema={schema} setSchema={setSchema} searchQuery={search} viewKey="bpf" enableCellFormulas={true} />
        </>
      )}
    </div>
  );
}

export default ProductionProjectScreen;