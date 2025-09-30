// src/screens/ProjectListScreen.jsx
import React, { useMemo, useState } from "react";

import { COLORS, S } from "../lib/constants/ui.js";
import { useViewportWidth } from "../lib/hooks/useViewportWidth";
import { Plus, Search, Filter, Layers3, Star } from "lucide-react";
import { formatDateFR } from "../lib/utils/format";
import { truncate } from "../lib/utils/truncate";

// Dialog + schémas + compute
import CreateProductionProjectDialog from "../components/CreateProductionProjectDialog.jsx";
import { CHIFFRAGE_SCHEMA } from "../lib/schemas/chiffrage.js";
import { SCHEMA_64 } from "../lib/schemas/production.js";
import { computeFormulas } from "../lib/formulas/compute.js";
import { createBlankProject } from "../lib/import/createBlankProject.js";

export function ProjectListScreen({
  projects,
  setProjects,
  onOpenProject,
  // ⬇️ injecté depuis App.jsx (quoteMinutes)
  minutes = [],
}) {
  const [q, setQ] = useState("");
  const width = useViewportWidth();

  // état du dialog
  const [showCreate, setShowCreate] = useState(false);

  const list = Array.isArray(projects) ? projects : [];

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return list;
    return list.filter((p) =>
      [p?.name, p?.manager, p?.status, p?.notes].some((x) =>
        String(x || "").toLowerCase().includes(qq)
      )
    );
  }, [list, q]);

  return (
    <div style={S.contentWrap}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: width < 900 ? "1fr" : "280px 1fr",
          gap: 24,
          alignItems: "end",
        }}
      >
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.text }}>
            Production
          </div>

          {/* Ouvre le dialog “Nouveau projet” */}
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            style={{
              marginTop: 12,
              background: COLORS.tile,
              color: "#fff",
              padding: "10px 14px",
              borderRadius: 10,
              border: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
            }}
          >
            <Plus size={16} /> Nouveau
          </button>
        </div>

        <div>
          <div style={{ fontSize: 18, marginBottom: 6 }}>Recherche</div>
          <div style={S.searchBox}>
            <Search
              size={18}
              style={{ position: "absolute", left: 10, top: 12, opacity: 0.6 }}
            />
            <input
              id="project-search"
              name="project-search"
              placeholder="Rechercher un dossier"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={S.searchInput}
              aria-label="Rechercher un dossier"
            />
          </div>
          <div style={{ ...S.toolsRow, marginTop: 10 }}>
            <span style={S.toolBtn}>
              <Filter size={16} /> Filtre
            </span>
            <span style={S.toolBtn}>
              <Layers3 size={16} /> Regrouper
            </span>
            <span style={S.toolBtn}>
              <Star size={16} /> Favoris
            </span>
          </div>
        </div>
      </div>

      <div style={{ ...S.tableBlock, marginTop: 18, borderRadius: 20 }}>
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Nom dossier</th>
                <th style={S.th}>Date de livraison</th>
                <th style={S.th}>Chargé·e de projet</th>
                <th style={S.th}>Statut</th>
                <th style={S.th}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, idx) => (
                <tr key={p.id || idx} style={idx % 2 ? S.trAlt : undefined}>
                  <td style={S.td}>
                    <button
                      type="button"
                      onClick={() => onOpenProject?.(p)}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        margin: 0,
                        cursor: "pointer",
                        fontWeight: 800,
                        color: COLORS.text,
                      }}
                    >
                      {p?.name || "—"}
                    </button>
                  </td>
                  <td style={S.td}>{formatDateFR(p?.due)}</td>
                  <td style={S.td}>{p?.manager || "—"}</td>
                  <td style={S.td}>
                    <span
                      style={{
                        ...S.smallBtn,
                        background: "#FCD34D",
                        borderColor: "#FCD34D",
                      }}
                    >
                      {p?.status || "En cours"}
                    </span>
                  </td>
                  <td style={S.td} title={p?.notes || ""}>
                    {truncate(p?.notes || "", 18)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td style={S.td} colSpan={5}>
                    Aucun dossier ne correspond à « {q} ».
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog de création (depuis minute ou vide) */}
      {showCreate && (
        <CreateProductionProjectDialog
          minutes={Array.isArray(minutes) ? minutes : []}
          minuteSchema={CHIFFRAGE_SCHEMA}
          prodSchema={SCHEMA_64}
          onCancel={() => setShowCreate(false)}
          // ➜ Création depuis une minute : le dialog renvoie (projectName, rows)
           onCreateFromMinute={(payload) => {
   const { name, rows, meta } = payload || {};

   // 1) Base projet
   const project = createBlankProject({ name });

   // 2) Métadonnées venant de la minute
   project.name = name || meta?.minuteName || project.name;
   project.sourceMinuteId = meta?.id || null;
   project.manager = meta?.owner || project.manager; // chargé d’affaires
   project.notes = meta?.notes || project.notes;

   // 3) LIGNES : on ÉCRASE TOUT par les lignes importées (recalculées)
   project.rows = computeFormulas(rows || [], SCHEMA_64);

   // 4) Push + open
   setProjects?.((arr) => [project, ...(Array.isArray(arr) ? arr : [])]);
   setShowCreate(false);
   onOpenProject?.(project);
 }}
          // ➜ Création vierge : le dialog renvoie (projectName, rows)
          onCreateBlank={(projectName, rows) => {
            const project = createBlankProject({ name: projectName });
            project.rows = computeFormulas(rows, SCHEMA_64);
            setProjects?.((arr) => [
              project,
              ...(Array.isArray(arr) ? arr : []),
            ]);
            setShowCreate(false);
            onOpenProject?.(project);
          }}
        />
      )}
    </div>
  );
}