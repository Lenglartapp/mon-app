// src/screens/ProjectListScreen.jsx
import React, { useMemo, useState } from "react";

import { COLORS, S } from "../lib/constants/ui.js";
import { useViewportWidth } from "../lib/hooks/useViewportWidth";
import { Plus, Search, Filter, Layers3, Star } from "lucide-react";
import { formatDateFR } from "../lib/utils/format";
import { truncate } from "../lib/utils/truncate";
import { uid } from "../lib/utils/uid.js";

export function ProjectListScreen({ projects, setProjects, onOpenProject }) {
  const [q, setQ] = useState("");
  const width = useViewportWidth();

  // 🔒 garde-fou si projects n'est pas un tableau
  const list = Array.isArray(projects) ? projects : [];

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return list;
    return list.filter((p) =>
      [p?.name, p?.manager, p?.status, p?.notes]
        .some((x) => String(x || "").toLowerCase().includes(qq))
    );
  }, [list, q]);

  const createProject = () => {
    const name = prompt("Nom du dossier ?", "NOUVEAU DOSSIER");
    if (!name) return;
    const p = {
      id: uid(),
      name,
      due: new Date().toISOString().slice(0, 10),
      manager: "Thomas BONNET",
      status: "En cours",
      notes: "",
    };
    setProjects?.((arr) => [p, ...(Array.isArray(arr) ? arr : [])]);
  };

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
          <button
            type="button"
            onClick={createProject}
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
            {/* ✅ id + name => corrige le warning Chrome */}
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
    </div>
  );
}