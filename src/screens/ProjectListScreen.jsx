// src/screens/ProjectListScreen.jsx
import React, { useMemo, useState, useEffect } from "react";
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { Edit2, Plus, FileText } from 'lucide-react';

import { SmartFilterBar } from "../components/ui/SmartFilterBar.jsx";
import { useViewportWidth } from "../lib/hooks/useViewportWidth";
import { formatDateFR } from "../lib/utils/format";
import { truncate } from "../lib/utils/truncate";

import CreateProjectDialog from "../components/CreateProjectDialog.jsx";
import { SCHEMA_64 } from "../lib/schemas/production.js";
import { computeFormulas } from "../lib/formulas/compute.js";
import { createBlankProject } from "../lib/import/createBlankProject.js";

import { useAuth } from "../auth";
import { can } from "../lib/authz";
// 👇 IMPORT IMPORTANT
import { uid } from "../lib/utils/uid";

const getStatusColor = (status) => {
  const s = (status || "").toLowerCase();
  if (s.includes("valid") || s.includes("prod")) return { bg: "#DEF7EC", text: "#03543F" };
  if (s.includes("valid") || s.includes("sign")) return { bg: "#E1EFFE", text: "#1E429F" };
  if (s.includes("attente") || s.includes("devis")) return { bg: "#FEF3C7", text: "#92400E" };
  return { bg: "#F3F4F6", text: "#374151" };
};

export function ProjectListScreen({ projects, setProjects, onOpenProject, minutes = [] }) {
  const [showCreate, setShowCreate] = useState(false);
  const list = Array.isArray(projects) ? projects : [];
  const { currentUser } = useAuth();
  const canCreate = ["ADMIN", "ORDONNANCEMENT", "ADV"].includes(currentUser?.role) || can(currentUser, "project.create");
  const canSeeChiffrage = can(currentUser, "chiffrage.view");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState([]);

  useEffect(() => {
    setActiveFilters([{ id: 'my_projects', label: '👤 Mes Projets', field: 'manager' }]);
  }, []);

  const handleRemoveFilter = (id) => setActiveFilters(prev => prev.filter(f => f.id !== id));

  const filteredProjects = useMemo(() => {
    let res = list;
    if (activeFilters.some(f => f.id === 'my_projects')) {
      const userName = (currentUser?.displayName || currentUser?.name || "").toLowerCase();
      const userEmail = (currentUser?.email || "").toLowerCase();
      if (userName || userEmail) {
        res = res.filter(p => {
          const mgr = (p.manager || "").toLowerCase();
          return (userName && mgr.includes(userName)) || (userEmail && mgr.includes(userEmail)) || !p.manager;
        });
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      res = res.filter(p => [p.name, p.manager, p.status, p.notes].some(x => String(x || "").toLowerCase().includes(q)));
    }
    return res;
  }, [list, searchQuery, activeFilters, currentUser]);

  return (
    <div style={{ minHeight: '100vh', background: '#F9F7F2', padding: '24px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto 24px auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1F2937', margin: 0, letterSpacing: '-0.5px' }}>Dossiers en Production</h1>
          {canCreate && (
            <button onClick={() => setShowCreate(true)} style={{ background: '#1F2937', color: 'white', padding: '8px 16px', borderRadius: 8, border: 'none', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <Plus size={18} /> + Nouveau Dossier
            </button>
          )}
        </div>
        <SmartFilterBar searchQuery={searchQuery} onSearchChange={setSearchQuery} activeFilters={activeFilters} onRemoveFilter={handleRemoveFilter} />
      </div>

      <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto', background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 6px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#F3F4F6', borderBottom: '1px solid #E5E7EB' }}>
              <tr>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Dossier</th>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Client / Notes</th>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Responsable</th>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Statut</th>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Livraison</th>
                <th style={{ padding: '12px 16px', width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((p, idx) => {
                const statusStyle = getStatusColor(p?.status);
                return (
                  <tr key={p?.id || idx} className="project-row" style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer', transition: 'background 0.1s' }} onClick={() => onOpenProject?.(p)} onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'} onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#111827', fontSize: 15 }}>{p?.name || "Sans nom"}</div>
                      <div style={{ fontSize: 12, color: '#9CA3AF' }}>#{String(p?.id || "").slice(-4)}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#4B5563', maxWidth: 300 }}>{truncate(p?.notes || "—", 40)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: stringToColor(p?.manager || "?") }}>{(p?.manager?.[0] || "?").toUpperCase()}</Avatar>
                        <span style={{ fontSize: 14, color: '#374151' }}>{p?.manager || "—"}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Chip label={p?.status || "Brouillon"} size="small" sx={{ bgcolor: statusStyle.bg, color: statusStyle.text, fontWeight: 600, fontSize: 12, height: 24 }} />
                    </td>
                    <td style={{ padding: '12px 16px', color: '#6B7280', fontSize: 14 }}>{formatDateFR(p?.due)}</td>
                    <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4, opacity: 0.6 }} className="actions">
                        <Tooltip title="Éditer"><IconButton size="small" onClick={() => onOpenProject?.(p)}><Edit2 size={16} /></IconButton></Tooltip>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredProjects.length === 0 && (<tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}><FileText size={48} style={{ opacity: 0.2, marginBottom: 16 }} /><div>Aucun projet trouvé.</div></td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateProjectDialog
          open={showCreate}
          onClose={() => setShowCreate(false)}
          minutes={canSeeChiffrage ? (Array.isArray(minutes) ? minutes : []) : []}
          prodSchema={SCHEMA_64}
          onCreateFromMinute={(payload) => {
            const { name, rows, meta } = payload || {};
            const project = createBlankProject({ name });
            // 👇 ICI
            project.id = project.id || uid();
            project.name = name || meta?.minuteName || project.name || "Nouveau Dossier";
            project.sourceMinuteId = meta?.id || null;
            project.budget = meta?.budgetSnapshot || { prepa: 0, conf: 0, pose: 0 };
            project.manager = meta?.owner || project.manager;
            project.notes = meta?.notes || project.notes;
            project.rows = computeFormulas(rows || [], SCHEMA_64);
            setProjects?.((arr) => [project, ...(Array.isArray(arr) ? arr : [])]);
            setShowCreate(false);
            onOpenProject?.(project);
          }}
          onCreateBlank={(projectName, _dummyRows, config) => {
            const project = createBlankProject({ name: projectName });
            // 👇 ET ICI
            project.id = project.id || uid();
            project.name = projectName || "Nouveau Dossier";
            project.budget = { prepa: 0, conf: 0, pose: 0 };
            project.config = config;
            project.rows = [];
            setProjects?.((arr) => [project, ...(Array.isArray(arr) ? arr : [])]);
            setShowCreate(false);
            onOpenProject?.(project);
          }}
        />
      )}
    </div>
  );
}

function stringToColor(string) {
  let hash = 0;
  for (let i = 0; i < string.length; i++) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).substr(-2);
  }
  return color;
}
export default ProjectListScreen;