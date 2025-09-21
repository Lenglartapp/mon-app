// src/screens/ProductionProjectScreen.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

import { COLORS, S } from "../lib/constants/ui.js";
import { useActivity } from "../contexts/activity.jsx";
import { useAuth } from "../auth.jsx";

import DataTable from "../components/DataTable.jsx";
import InputCell from "../components/cells/InputCell.jsx";

import { computeFormulas } from "../lib/formulas/compute.js";
import { CHIFFRAGE_SCHEMA } from "../lib/schemas/chiffrage.js";
import { uid } from "../lib/utils/uid.js";

// Si tu utilises des icônes :
import {
  PencilRuler, Database, Boxes, GanttChart,
  Plus, Filter, Layers3, Star, Settings2, Search,
  ChevronUp, ChevronDown, Edit3, ChevronRight, X, MoreVertical,
  Trash2, Copy
} from "lucide-react";

export function ProductionProjectScreen({ projectName, onBack }) {
  return null;
  const [stage, setStage] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [schema, setSchema] = useState(SCHEMA_64);
  const [rows, setRows] = useState(()=> computeFormulas(DEMO_MASTER_ROWS, SCHEMA_64));
  useEffect(()=>{ setRows((rs)=> computeFormulas(rs, schema)); }, [schema]);
  // --- MERGE FIX : accepte aussi les nouvelles lignes créées dans un tableau enfant
  const mergeChildRowsFor = (tableKey) => {
  return (nr) => {
    setRows((all) => {
      const isInTable = (r) => {
        const p = String(r?.produit || "");
        if (tableKey === "rideaux") return /rideau|voilage/i.test(p);
        if (tableKey === "decors")  return /d[ée]cor/i.test(p); // gère "decor"/"décor"
        if (tableKey === "stores")  return /store/i.test(p);
        return false;
      };

      const others = all.filter((r) => !isInTable(r));
      return computeFormulas([...(others || []), ...(nr || [])], schema);
    });
  };
};

// Segments visibles
const rowsRideaux = rows.filter((r) => /rideau|voilage/i.test(String(r.produit)));
const rowsDecors  = rows.filter((r) => /d[ée]cor/i.test(String(r.produit)));
const rowsStores  = rows.filter((r) => /store/i.test(String(r.produit)));

  return (
    <div style={S.contentWide}>
      <div style={{ margin: "4px 0 12px", color: COLORS.text, fontWeight: 600 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", padding: 0, margin: 0, cursor: "pointer", color: COLORS.text }}>Production</button>
        {" / "}<span style={{ fontWeight: 800 }}>{projectName}</span>
      </div>

      <div style={S.pills}>
        {STAGES.map((p)=> (
          <button key={p.key} style={S.pill(stage===p.key)} onClick={()=>setStage(p.key)}>{p.label}</button>
        ))}
      </div>

      <div style={S.searchRow}>
        <div style={S.searchBox}>
          <Search size={18} style={{ position: "absolute", left: 10, top: 12, opacity: .6 }} />
          <input placeholder="Recherche" value={search} onChange={(e)=>setSearch(e.target.value)} style={S.searchInput} />
        </div>
        <div style={S.toolsRow}>
          <span style={S.toolBtn}><Filter size={16}/> Filtre</span>
          <span style={S.toolBtn}><Layers3 size={16}/> Regrouper</span>
          <span style={S.toolBtn}><Star size={16}/> Favoris</span>
        </div>
      </div>

      {/* === DASHBOARD === */}
{stage === "dashboard" && (
  <DashboardTiles
    rows={rows}
    // tu peux mettre 0/0 pour démarrer, on branchera plus tard sur des inputs projet
    projectHours={{ conf: 0, pose: 0 }}
  />
)}
{stage === "chiffrage" && (
  <MinutesScreen
    onExportToProduction={(mappedRows, minute) => {
      // Ajoute les lignes mappées au tableau Production
      setRows((rs) => computeFormulas([...(rs || []), ...mappedRows], schema));
      alert(`Exporté ${mappedRows.length} ligne(s) depuis "${minute?.name || "Minute"}" vers Production.`);
    }}
  />
)}
      {stage === "etiquettes" && (
  // 👉 Rideaux + Stores (pas Décors) — titres Étiquettes
  <div style={S.contentWide}>
    <EtiquettesSection
      title="Etiquettes Rideaux"
      tableKey="rideaux"
      rows={rowsRideaux}
      schema={schema}
    />
    <EtiquettesSection
      title="Etiquettes Stores"
      tableKey="stores"
      rows={rowsStores}
      schema={schema}
    />
  </div>
)}

{stage === "prise" && (
  // 👉 Prise de cotes = 2 tableaux (Rideaux + Stores), titres + presets
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
    />
  </>
)}

{stage === "installation" && (
  // 👉 Installation = 1 seul tableau cumulant tout
  <DataTable
    title="Suivi Installation / Livraison"
    tableKey="all"
    rows={rows} // toutes les lignes (rideaux + décors + stores)
    onRowsChange={(nr) => setRows(computeFormulas(nr, schema))}
    schema={schema}
    setSchema={setSchema}
    searchQuery={search}
    viewKey="installation"
  />
)}

{stage === "bpf" && (
  <>
    <DataTable
      title="BPF Rideaux"
      tableKey="rideaux"
      rows={rowsRideaux}
      onRowsChange={mergeChildRowsFor("rideaux")}
      schema={schema}
      setSchema={setSchema}
      searchQuery={search}
      viewKey="bpf"
    />
    <DataTable
      title="BPF Décors de lit"
      tableKey="decors"
      rows={rowsDecors}
      onRowsChange={mergeChildRowsFor("decors")}
      schema={schema}
      setSchema={setSchema}
      searchQuery={search}
      viewKey="bpf"
    />
    <DataTable
      title="BPF Stores"
      tableKey="stores"
      rows={rowsStores}
      onRowsChange={mergeChildRowsFor("stores")}
      schema={schema}
      setSchema={setSchema}
      searchQuery={search}
      viewKey="bpf"
    />
  </>
)}

</div>
);
}
