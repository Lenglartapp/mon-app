// src/screens/ProjectListScreen.jsx
import React, { useMemo, useState, useEffect } from "react";
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { Edit2, Plus, FileText, Trash2 } from 'lucide-react';

import { SmartFilterBar } from "../components/ui/SmartFilterBar.jsx";
import { useViewportWidth } from "../lib/hooks/useViewportWidth";
import { formatDateFR } from "../lib/utils/format";
import { truncate } from "../lib/utils/truncate";

import CreateProjectDialog from "../components/CreateProjectDialog.jsx";
import { SCHEMA_64 } from "../lib/schemas/production.js";
import { computeFormulas } from "../lib/formulas/compute.js";
import { createBlankProject } from "../lib/import/createBlankProject.js";

import { useAuth } from "../auth";

import { can, role } from "../lib/authz";
// 👇 IMPORT IMPORTANT
import { uid } from "../lib/utils/uid";

const PROJECT_STATUS_OPTIONS = {
  TODO: { label: "À commencer", color: "#6B7280", bg: "#F3F4F6" },
  IN_PROGRESS: { label: "En cours", color: "#3B82F6", bg: "#EFF6FF" },
  DONE: { label: "Terminé", color: "#10B981", bg: "#ECFDF5" },
  SAV: { label: "SAV", color: "#F59E0B", bg: "#FFFBEB" },
  ARCHIVED: { label: "Archivé", color: "#374151", bg: "#F9FAFB" }
};

export function ProjectListScreen({ projects, setProjects, onOpenProject, minutes = [], onCreate, onDelete, onUpdateProject, onBack }) {
  const [showCreate, setShowCreate] = useState(false);
  const list = Array.isArray(projects) ? projects : [];
  const { currentUser, users } = useAuth();
  const canCreate = ["ADMIN", "ORDONNANCEMENT", "ADV"].includes(currentUser?.role) || can(currentUser, "project.create");
  const canSeeChiffrage = can(currentUser, "chiffrage.view");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState([]);

  const handleUpdate = (id, patch) => {
    // Optimistic local update
    if (setProjects) {
      setProjects(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
    }
    // Remote update
    if (onUpdateProject) {
      onUpdateProject(id, patch);
    }
  };

  useEffect(() => {
    setActiveFilters([{ id: 'my_projects', label: '👤 Mes Dossiers', field: 'manager' }]);
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

  const potentialManagers = useMemo(() => {
    if (!users) return [];
    return users.filter(u => {
      // Use helper to normalize role (handles 'PILOTAGE_PROJET' -> 'op', etc.)
      const r = role(u);
      return ['admin', 'sales', 'op'].includes(r);
    });
  }, [users]);

  return (
    <div style={{ minHeight: '100vh', background: '#F9F7F2', padding: '24px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto 24px auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <button
              onClick={onBack}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#6B7280', fontWeight: 600, fontSize: 13,
                marginBottom: 4, padding: 0, display: 'flex', alignItems: 'center', gap: 4
              }}
            >
              ← Retour
            </button>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1F2937', margin: 0, letterSpacing: '-0.5px' }}>Dossiers</h1>
          </div>
          {canCreate && (
            <button onClick={() => setShowCreate(true)} style={{ background: '#1F2937', color: 'white', padding: '8px 16px', borderRadius: 8, border: 'none', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: 4 }}>
              <Plus size={18} /> Nouveau Dossier
            </button>
          )}
        </div>
        <SmartFilterBar searchQuery={searchQuery} onSearchChange={setSearchQuery} activeFilters={activeFilters} onRemoveFilter={handleRemoveFilter} />
      </div>

      <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto', background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 6px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              <tr>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dossier</th>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Responsable</th>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Statut</th>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Livraison</th>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>H. Prépa</th>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>H. Conf</th>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>H. Pose</th>
                <th style={{ padding: '12px 16px', width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((p, idx) => {
                const statusOpt = PROJECT_STATUS_OPTIONS[p?.status] || PROJECT_STATUS_OPTIONS.TODO;
                const budget = p.budget || { prepa: 0, conf: 0, pose: 0 };

                return (
                  <tr key={p?.id || idx} className="project-row" style={{ borderBottom: '1px solid #F3F4F6', transition: 'background 0.1s' }} onClick={() => onOpenProject?.(p)} onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'} onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                    {/* DOSSIER */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#111827', fontSize: 14 }}>{p?.name || "Sans nom"}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>#{String(p?.id || "").slice(-4)}</div>
                    </td>

                    {/* RESPONSABLE */}
                    <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar sx={{ width: 24, height: 24, fontSize: 10, bgcolor: stringToColor(p?.manager || "?") }}>{(p?.manager?.[0] || "?").toUpperCase()}</Avatar>
                        <select
                          value={p?.manager || ""}
                          onChange={(e) => handleUpdate(p.id, { manager: e.target.value })}
                          style={{
                            border: 'none', background: 'transparent', fontSize: 14, color: '#374151', cursor: 'pointer', outline: 'none',
                            fontWeight: 500
                          }}
                        >
                          <option value="" disabled>—</option>
                          {potentialManagers.length > 0 ? potentialManagers.map(u => (
                            <option key={u.id} value={u.name}>{u.name}</option>
                          )) : (
                            <option value={p?.manager}>{p?.manager || "—"}</option>
                          )}
                          {/* Fallback if current manager is not in list */}
                          {p?.manager && !potentialManagers.find(u => u.name === p.manager) && (
                            <option value={p.manager} disabled>{p.manager}</option>
                          )}
                        </select>
                      </div>
                    </td>

                    {/* STATUT */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <select
                          value={p?.status || "TODO"}
                          onChange={(e) => handleUpdate(p.id, { status: e.target.value })}
                          style={{
                            appearance: 'none',
                            padding: "6px 12px 6px 24px",
                            borderRadius: 20,
                            border: "1px solid #E5E7EB",
                            background: 'white',
                            color: "#374151",
                            fontWeight: 600,
                            fontSize: 12,
                            cursor: 'pointer',
                            textAlign: 'center',
                            outline: 'none',
                            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                            minWidth: 110
                          }}
                        >
                          {Object.entries(PROJECT_STATUS_OPTIONS).map(([key, opt]) => (
                            <option key={key} value={key}>{opt.label}</option>
                          ))}
                        </select>
                        {/* Dot Overlay */}
                        <div style={{
                          position: 'absolute', top: '50%', left: 10, transform: 'translateY(-50%)',
                          width: 6, height: 6, borderRadius: '50%',
                          background: statusOpt.color,
                          pointerEvents: 'none'
                        }} />
                      </div>
                    </td>

                    {/* LIVRAISON */}
                    <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="date"
                        value={p?.delivery_date || ""}
                        onChange={(e) => handleUpdate(p.id, { delivery_date: e.target.value })}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: p?.delivery_date ? '#374151' : '#9CA3AF',
                          fontSize: 13,
                          fontFamily: 'inherit',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      />
                    </td>

                    {/* BUDGETS */}
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: '#374151' }}>{budget.prepa || 0} h</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: '#374151' }}>{budget.conf || 0} h</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: '#374151' }}>{budget.pose || 0} h</td>

                    {/* ACTIONS */}
                    <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4, opacity: 0.6 }} className="actions">
                        <Tooltip title="Éditer"><IconButton size="small" onClick={() => onOpenProject?.(p)}><Edit2 size={16} /></IconButton></Tooltip>
                        <Tooltip title="Supprimer">
                          <IconButton
                            size="small"
                            sx={{ color: '#ef4444' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Supprimer le dossier "${p.name}" définitivement ?`)) {
                                onDelete?.(p.id);
                              }
                            }}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredProjects.length === 0 && (<tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}><FileText size={48} style={{ opacity: 0.2, marginBottom: 16 }} /><div>Aucun projet trouvé.</div></td></tr>)}
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
          onCreateFromMinute={async (payload) => {
            const { name, rows, meta, deliveryDate } = payload || {};
            const project = createBlankProject({ name });
            project.id = project.id || uid();
            project.name = name || meta?.minuteName || project.name || "Nouveau Dossier";
            project.sourceMinuteId = meta?.id || null;
            project.budget = meta?.budgetSnapshot || { prepa: 0, conf: 0, pose: 0 };
            project.manager = meta?.owner || project.manager;
            project.notes = meta?.notes || project.notes;
            project.delivery_date = deliveryDate || null;
            project.rows = computeFormulas(rows || [], SCHEMA_64);

            if (onCreate) {
              try {
                const { data, error } = await onCreate(project);
                if (error) {
                  alert("Erreur création projet (Supabase) :\n" + error.message);
                  return;
                }
                if (data && data[0]) {
                  setShowCreate(false);
                  onOpenProject?.(data[0]);
                }
              } catch (e) {
                alert("Erreur : " + e.message);
              }
            } else if (setProjects) {
              setProjects((arr) => [project, ...(Array.isArray(arr) ? arr : [])]);
              onOpenProject?.(project);
              setShowCreate(false);
            }
          }}
          onCreateBlank={async (projectName, _dummyRows, config) => {
            const project = createBlankProject({ name: projectName });
            project.id = project.id || uid();
            project.name = projectName || "Nouveau Dossier";
            project.budget = { prepa: 0, conf: 0, pose: 0 };
            project.config = config;
            project.delivery_date = config?.deliveryDate || null;
            project.rows = [];

            if (onCreate) {
              try {
                const { data, error } = await onCreate(project);
                if (error) {
                  alert("Erreur création projet (Supabase) :\n" + error.message);
                  return;
                }
                if (data && data[0]) {
                  setShowCreate(false);
                  onOpenProject?.(data[0]);
                }
              } catch (e) {
                alert("Erreur : " + e.message);
              }
            } else if (setProjects) {
              setProjects((arr) => [project, ...(Array.isArray(arr) ? arr : [])]);
              onOpenProject?.(project);
              setShowCreate(false);
            }
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