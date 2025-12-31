import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { COLORS, S } from "../lib/constants/ui.js";

import MinuteGrid from "../components/MinuteGrid.jsx"; // Replaces DataTable
import DashboardTiles from "../components/DashboardTiles.jsx";
import ProjectActivityFeed from "../components/ProjectActivityFeed.jsx";
import EtiquettesSection from "../components/EtiquettesSection.jsx";
import MinutesScreen from "./MinutesScreen.jsx";
import LineDetailPanel from "../components/LineDetailPanel";

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
 * - projects (Full List from App)
 * - onBack()
 * - onUpdateProjectRows(projectId, newRows)
 */
export function ProductionProjectScreen({ project: propProject, projects, onBack, onUpdateProjectRows, highlightRowId }) {
  const { projectId: urlProjectId } = useParams();

  // Find Project (SECURED)
  const project = useMemo(() => {
    // Mode Télécommande (Prioritaire)
    if (propProject) return propProject;

    // Mode URL (Backup / Deep Link)
    if (!projects || !urlProjectId) return null;

    return projects.find(p => p && String(p.id) === String(urlProjectId));
  }, [propProject, projects, urlProjectId]);

  const [stage, setStage] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [schema, setSchema] = useState(SCHEMA_64);
  const [openedRowId, setOpenedRowId] = useState(null);

  // Auto-open panel from notification
  useEffect(() => {
    if (highlightRowId) {
      setOpenedRowId(highlightRowId);
    }
  }, [highlightRowId]);

  const { currentUser } = useAuth();
  const canEditProd = can(currentUser, "production.edit");
  const seeChiffrage = can(currentUser, "chiffrage.view");

  // Lignes locales (édition fluide)
  const initialRows = useMemo(
    () => computeFormulas(project?.rows || [], SCHEMA_64),
    [project?.id] // Re-compute ONLY if project ID changes
  );
  const [rows, setRows] = useState(initialRows);

  // Calculate opened row
  const openedRow = useMemo(() => (rows || []).find(r => r.id === openedRowId), [rows, openedRowId]);

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

  // Sous-ensembles (sur rows filtrées)
  const rowsRideaux = filteredRows.filter((r) => /rideau|voilage/i.test(String(r.produit || "")));
  const rowsDecors = filteredRows.filter((r) => /d[ée]cor/i.test(String(r.produit || "")));
  const rowsStores = filteredRows.filter((r) => /store/i.test(String(r.produit || "")));

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
      { key: 'largeur', label: 'Largeur' },
      { key: 'hauteur', label: 'Hauteur' },
      { key: 'produit', label: 'Produit' },
      { key: 'piece', label: 'Pièce' }
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

  // --- HANDLERS (AVEC SAUVEGARDE IMMÉDIATE) ---

  // 1. handleSubsetChange (Mise à jour avec historique)
  const handleSubsetChange = (newSubsetRows, filterRegex) => {
    if (!canEditProd) return;
    const allRows = rows;
    const oldSubset = allRows.filter(r => filterRegex.test(String(r.produit || "")));
    const newIds = new Set(newSubsetRows.map(r => r.id));
    const deletedIds = new Set(oldSubset.filter(r => !newIds.has(r.id)).map(r => r.id));
    const updatedMap = new Map(newSubsetRows.map(r => [r.id, r]));

    const updatedAllRows = allRows
      .filter(r => !deletedIds.has(r.id))
      .map(r => {
        if (updatedMap.has(r.id)) {
          const newRaw = updatedMap.get(r.id);
          // On compare pour l'historique
          const rowWithHistory = updateRowWithHistory(r, newRaw, currentUser?.name);
          return recomputeRow(rowWithHistory, schema);
        }
        return r;
      });

    setRows(updatedAllRows);
    if (project?.id) onUpdateProjectRows(project.id, updatedAllRows);
  };

  const mergeChildRowsFor = (tableKey) => {
    let regex = /./; // Default
    if (tableKey === "rideaux") regex = /rideau|voilage/i;
    else if (tableKey === "stores") regex = /store/i;
    else if (tableKey === "decors") regex = /d[ée]cor/i;

    return (nr) => handleSubsetChange(nr, regex);
  };

  // 2. handleRowsChangeInstallation (Mise à jour avec historique)
  const handleRowsChangeInstallation = (nr) => {
    if (!canEditProd) return;
    // Difficile de comparer en masse sans map, mais on tente une map par ID
    const oldMap = new Map(rows.map(r => [r.id, r]));

    const computed = nr.map(newR => {
      const oldR = oldMap.get(newR.id);
      if (oldR) {
        const rowWithHistory = updateRowWithHistory(oldR, newR, currentUser?.name);
        return recomputeRow(rowWithHistory, schema);
      }
      return recomputeRow(newR, schema);
    });

    setRows(computed);
    if (project?.id) onUpdateProjectRows(project.id, computed);
  };

  // 3. handleDetailUpdate (Mise à jour avec historique)
  const handleDetailUpdate = (updatedRow) => {
    if (!canEditProd) return;
    const newRows = rows.map(r => {
      if (r.id === updatedRow.id) {
        const rowWithHistory = updateRowWithHistory(r, updatedRow, currentUser?.name);
        return recomputeRow(rowWithHistory, schema);
      }
      return r;
    });
    setRows(newRows);
    if (project?.id) onUpdateProjectRows(project.id, newRows);
  };


  // 4. handleAddRow
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

  if (!project && projects && projects.length > 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>Chargement du projet en cours...</div>;
  }

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <DashboardTiles rows={rows} projectHours={{ conf: 0, pose: 0 }} />
          <ProjectActivityFeed rows={rows} />
        </div>
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
              projectId={project?.id}
              onRowClick={(id) => setOpenedRowId(id)}

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
              projectId={project?.id}
              onRowClick={(id) => setOpenedRowId(id)}

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
            projectId={project?.id}
            onRowClick={(id) => setOpenedRowId(id)}

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
              projectId={project?.id}
              onRowClick={(id) => setOpenedRowId(id)}

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
              projectId={project?.id}
              onRowClick={(id) => setOpenedRowId(id)}

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
              projectId={project?.id}
              onRowClick={(id) => setOpenedRowId(id)}

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
            projectId={project?.id}
            onRowClick={(id) => setOpenedRowId(id)}

          />
        </div>
      )}

      {openedRow && (
        <LineDetailPanel
          open={true}
          onClose={() => setOpenedRowId(null)}
          row={openedRow}
          schema={schema}
          onRowChange={handleDetailUpdate}
          projectId={project?.id}
          minuteId={null} // Pas de minuteId en prod global
        />
      )}
    </div>
  );
}

export default ProductionProjectScreen;