import React from "react";
import DataTable from "../components/DataTable.jsx";
import { INVENTORY_SCHEMA } from "../lib/schemas/inventory.js";
import { buildTissueIndex } from "../lib/inventory/buildTissueIndex.js";
import { computeFormulas } from "../lib/formulas/compute.js";
import { S } from "../lib/constants/ui.js";

export default function InventoryScreen({ minutes = [], projects = [], rows, setRows, onBack }) {
  const [schema, setSchema] = React.useState(INVENTORY_SCHEMA);
  const [q, setQ] = React.useState("");

  // Options dynamiques pour le select "tissu_key"
  const options = React.useMemo(
    () => buildTissueIndex(minutes, projects),
    [minutes, projects]
  );

  // Injecte les options dans le schéma (clé: tissu_key)
  React.useEffect(() => {
    setSchema((sc) => {
      const i = sc.findIndex(c => c.key === "tissu_key");
      if (i === -1) return sc;
      const next = [...sc];
      next[i] = { ...next[i], options: options.map(o => o.label) }; // options = labels
      return next;
    });
  }, [options]);

  // Quand l’utilisateur choisit un tissu_key, on pré-remplit des champs de liaison
  const onRowsChange = (nr) => {
    const filled = (nr || []).map((r) => {
      const lab = r.tissu_key;
      if (!lab) return r;

      const opt = options.find(o => o.label === lab);
      if (!opt) return r;

      return {
        ...r,
        source_type: opt.source_type,
        source_id:   opt.source_id,
        projet_nom:  opt.projet_nom,
        laize:       r.laize ?? opt.laize ?? r.laize,
        coloris:     r.coloris ?? opt.coloris ?? r.coloris,
        reference:   r.reference ?? opt.reference ?? r.reference,
      };
    });

    setRows(computeFormulas(filled, schema));
  };

  return (
    <div style={S.contentWide}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button style={S.smallBtn} onClick={onBack}>← Retour</button>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            placeholder="Recherche inventaire"
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            style={S.searchInput}
          />
        </div>
      </div>

      <DataTable
        title="Inventaire tissus"
        tableKey="inventaire"
        rows={rows}
        onRowsChange={onRowsChange}
        schema={schema}
        setSchema={setSchema}
        searchQuery={q}
        viewKey="inventaire"
        enableCellFormulas={true}
      />
    </div>
  );
}