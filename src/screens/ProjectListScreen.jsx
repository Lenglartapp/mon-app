// src/screens/ProjectListScreen.jsx
import React, { useMemo, useState, useEffect } from "react";
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { Edit2, Plus, FileText, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Archive, Upload, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

import { SmartFilterBar } from "../components/ui/SmartFilterBar.jsx";
import FilterPanel, { isConditionActive, evaluateCondition } from "../components/FilterPanel.jsx";
import { useViewportWidth } from "../lib/hooks/useViewportWidth";
import { formatDateFR } from "../lib/utils/format";
import { truncate } from "../lib/utils/truncate";

import CreateProjectDialog from "../components/CreateProjectDialog.jsx";
import ImportProjectsDialog from "../components/ImportProjectsDialog.jsx";
import { SCHEMA_64 } from "../lib/schemas/production.js";
import { computeFormulas } from "../lib/formulas/compute.js";
import { createBlankProject } from "../lib/import/createBlankProject.js";

import { useAuth } from "../auth";

import { can, role } from "../lib/authz";
// 👇 IMPORT IMPORTANT
import { uid } from "../lib/utils/uid";
import { extractMaterialsFromLines } from "../lib/data/demo";

import { PROJECT_STATUS_OPTIONS } from "../lib/constants/projectStatus";

const PROJECT_FILTER_SCHEMA = [
  { key: 'name',    label: 'Nom du projet',      type: 'text' },
  { key: 'manager', label: 'Responsable',         type: 'text' },
  { key: 'status',  label: 'Statut',              type: 'select', options: Object.entries(PROJECT_STATUS_OPTIONS).map(([k, v]) => ({ value: k, label: v.label })) },
  { key: 'notes',   label: 'Notes',               type: 'text' },
  { key: 'due',     label: 'Date de livraison',   type: 'text' },
  { key: 'prepa',   label: 'Heures Prépa',        type: 'number' },
  { key: 'conf',    label: 'Heures Conf',         type: 'number' },
  { key: 'pose',    label: 'Heures Pose',         type: 'number' },
];

export function ProjectListScreen({ projects, setProjects, onOpenProject, minutes = [], onCreate, onDelete, onUpdateProject, onUpdateMinute, onBack }) {
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const list = Array.isArray(projects) ? projects : [];
  const { currentUser, users } = useAuth();
  const canCreate = ["ADMIN", "ORDONNANCEMENT", "ADV"].includes(currentUser?.role) || can(currentUser, "project.create");
  const canSeeChiffrage = can(currentUser, "chiffrage.view");
  const [activeFilters, setActiveFilters] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const [filterConditions, setFilterConditions] = useState([]);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  const [showArchived, setShowArchived] = useState(false);

  const handleSort = (key) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

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

  const SEARCH_FIELDS = [
    { id: 'name',    label: 'Nom du projet' },
    { id: 'manager', label: 'Responsable' },
    { id: 'status',  label: 'Statut' },
    { id: 'notes',   label: 'Notes' },
  ];

  useEffect(() => {
    setActiveFilters([{ id: 'my_projects', label: '👤 Mes Projets', field: 'manager', value: currentUser?.name || currentUser?.displayName || '' }]);
  }, []);

  const handleAddFilter = (filter) => setActiveFilters(prev => [...prev, filter]);
  const handleRemoveFilter = (id) => setActiveFilters(prev => prev.filter(f => f.id !== id));

  const filteredProjects = useMemo(() => {
    let res = list;

    // Filtre "Mes Projets"
    const myFilter = activeFilters.find(f => f.id === 'my_projects');
    if (myFilter) {
      const userName = (currentUser?.displayName || currentUser?.name || "").toLowerCase();
      const userEmail = (currentUser?.email || "").toLowerCase();
      if (userName || userEmail) {
        res = res.filter(p => {
          const mgr = (p.manager || "").toLowerCase();
          return (userName && mgr.includes(userName)) || (userEmail && mgr.includes(userEmail)) || !p.manager;
        });
      }
    }

    // Filtres texte (champ spécifique ou tous les champs)
    const textFilters = activeFilters.filter(f => f.id !== 'my_projects' && f.value);
    textFilters.forEach(f => {
      const q = f.value.toLowerCase();
      if (f.field === 'all') {
        res = res.filter(p => [p.name, p.manager, p.status, p.notes].some(x => String(x || "").toLowerCase().includes(q)));
      } else {
        res = res.filter(p => String(p[f.field] || "").toLowerCase().includes(q));
      }
    });

    if (!showArchived) {
      res = res.filter(p => p.status !== 'ARCHIVED');
    }

    const activeConditions = filterConditions.filter(isConditionActive);
    if (activeConditions.length > 0) {
      res = res.filter(p => {
        const flat = { ...p, prepa: p.budget?.prepa || 0, conf: p.budget?.conf || 0, pose: p.budget?.pose || 0 };
        let result = evaluateCondition(activeConditions[0], flat);
        for (let i = 1; i < activeConditions.length; i++) {
          const cond = activeConditions[i];
          const val = evaluateCondition(cond, flat);
          result = cond.logic === 'ou' ? result || val : result && val;
        }
        return result;
      });
    }

    if (sortConfig.key) {
      res = [...res].sort((a, b) => {
        const getValue = (obj, k) => {
          if (k.includes('.')) return k.split('.').reduce((o, i) => o?.[i], obj);
          return obj?.[k];
        };
        const valA = getValue(a, sortConfig.key) || 0;
        const valB = getValue(b, sortConfig.key) || 0;
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return res;
  }, [list, activeFilters, currentUser, sortConfig, showArchived, filterConditions]);

  // FIX: useViewportWidth returns a number, not an object
  const width = useViewportWidth();
  console.log("Largeur actuelle :", width, "isMobile :", width <= 768);
  const isMobile = width <= 768;

  const potentialManagers = useMemo(() => {
    if (!users) return [];
    return users.filter(u => {
      // Use helper to normalize role (handles 'PILOTAGE_PROJET' -> 'op', etc.)
      const r = role(u);
      return ['admin', 'sales', 'op'].includes(r);
    });
  }, [users]);

  return (
    <div style={{ minHeight: '100vh', background: '#F9F7F2', padding: isMobile ? '16px' : '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* CSS Fallback for Responsive Toggle */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: block !important; }
          .header-row { flexDirection: column !important; alignItems: flex-start !important; }
          .header-actions { width: 100% !important; }
        }
        @media (min-width: 769px) {
          .desktop-only { display: block !important; }
          .mobile-only { display: none !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto 24px auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          className="header-row"
          style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-end', gap: isMobile ? 12 : 0 }}
        >
          <div style={{ width: isMobile ? '100%' : 'auto' }}>
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
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1F2937', margin: 0, letterSpacing: '-0.5px' }}>Projets</h1>
          </div>
          {canCreate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="header-actions"
                onClick={() => setShowCreate(true)}
                style={{
                  background: '#1E2447', color: 'white', padding: '8px 16px', borderRadius: 8, border: 'none',
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: isMobile ? 0 : 4,
                  width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'center' : 'flex-start'
                }}
              >
                <Plus size={18} /> Nouveau Projet
              </button>
              <button
                onClick={() => setShowImport(true)}
                title="Importer des projets depuis Excel"
                style={{
                  background: '#F3F4F6', color: '#374151', padding: '8px 12px', borderRadius: 8,
                  border: '1px solid #D1D5DB', display: 'flex', alignItems: 'center', gap: 6,
                  cursor: 'pointer', fontWeight: 500, fontSize: 13, marginBottom: isMobile ? 0 : 4,
                }}
              >
                <Upload size={15} /> Import Excel
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <SmartFilterBar
            fields={SEARCH_FIELDS}
            activeFilters={activeFilters}
            onAddFilter={handleAddFilter}
            onRemoveFilter={handleRemoveFilter}
            placeholder="Nom, responsable, statut..."
          />
          <div style={{ position: 'relative' }}>
            {(() => {
              const hasActive = filterConditions.some(isConditionActive);
              return (
                <button
                  onClick={() => setFilterPanelOpen(o => !o)}
                  style={{
                    cursor: 'pointer', padding: '5px 12px', height: 38,
                    background: hasActive ? '#dcfce7' : (filterPanelOpen ? '#eff6ff' : 'white'),
                    color: hasActive ? '#15803d' : '#374151',
                    border: `1px solid ${hasActive ? '#86efac' : (filterPanelOpen ? '#2563eb' : '#d1d5db')}`,
                    borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                    fontWeight: hasActive ? 600 : 400,
                  }}
                >
                  <Filter size={14} />
                  Filtrer
                  {hasActive && (
                    <span style={{ background: '#16a34a', color: 'white', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '0 6px', lineHeight: '18px' }}>
                      {filterConditions.filter(isConditionActive).length}
                    </span>
                  )}
                </button>
              );
            })()}
            {filterPanelOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }} onClick={() => setFilterPanelOpen(false)} />
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 1001 }}>
                  <FilterPanel
                    schema={PROJECT_FILTER_SCHEMA}
                    conditions={filterConditions}
                    onChange={setFilterConditions}
                  />
                </div>
              </>
            )}
          </div>
          <Tooltip title={showArchived ? "Retour aux dossiers actifs" : "Voir archives"}>
            <IconButton
              onClick={() => setShowArchived(!showArchived)}
              sx={{
                bgcolor: showArchived ? '#DBEAFE' : 'white',
                color: showArchived ? '#1E40AF' : '#6B7280',
                border: '1px solid #E5E7EB',
                borderRadius: 2,
                height: 38,
                width: 38,
                '&:hover': { bgcolor: showArchived ? '#BFDBFE' : '#F9FAFB' }
              }}
            >
              <Archive size={20} />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {/* --- MOBILE VIEW (CARDS) --- */}
      <div
        style={{
          maxWidth: 1200, width: '100%', margin: '0 auto',
          display: isMobile ? 'flex' : 'none', // JS Toggle
          flexDirection: 'column', gap: 12
        }}
      >
        {filteredProjects.map((p) => {
          const statusOpt = PROJECT_STATUS_OPTIONS[p?.status] || PROJECT_STATUS_OPTIONS.TODO;
          const budget = p.budget || { prepa: 0, conf: 0, pose: 0 };
          const dateStr = p.deadline ? formatDateFR(p.deadline) : "—";

          return (
            <div key={p.id} style={{
              background: 'white', borderRadius: 12, padding: 16,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: 12
            }}>
              {/* HEADER: Name + Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginBottom: 2 }}>
                    {truncate(p.name || "Sans nom", 25)}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>#{String(p.id).slice(-4)}</div>
                </div>
                {/* STATUS BADGE SIMPLIFIED */}
                <div style={{
                  padding: "4px 10px", borderRadius: 16, background: statusOpt.bg, color: statusOpt.color,
                  fontSize: 11, fontWeight: 700
                }}>
                  {statusOpt.label}
                </div>
              </div>

              {/* BODY: Manager + Date */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar sx={{ width: 24, height: 24, fontSize: 10, bgcolor: stringToColor(p?.manager || "?") }}>
                    {(p?.manager?.[0] || "?").toUpperCase()}
                  </Avatar>
                  <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                    {p.manager || "Non assigné"}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4B5563' }}>
                  <span role="img" aria-label="date">📅</span> {dateStr}
                </div>
              </div>

              {/* FOOTER: Budgets + Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F3F4F6', paddingTop: 12, marginTop: 4 }}>
                <div style={{ fontSize: 12, color: '#6B7280', display: 'flex', gap: 8 }}>
                  <span><strong style={{ color: '#374151' }}>P:</strong> {budget.prepa}h</span>
                  <span><strong style={{ color: '#374151' }}>C:</strong> {budget.conf}h</span>
                  <span><strong style={{ color: '#374151' }}>I:</strong> {budget.pose}h</span>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => onOpenProject?.(p)}
                    style={{
                      background: '#F3F4F6', border: 'none', borderRadius: 6, padding: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5563'
                    }}
                  >
                    <Edit2 size={16} />
                  </button>
                  {currentUser?.role !== 'pose' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Supprimer ${p.name} ?`)) onDelete?.(p.id);
                    }}
                    style={{
                      background: '#FEF2F2', border: 'none', borderRadius: 6, padding: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626'
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filteredProjects.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', background: 'white', borderRadius: 12 }}>
            <FileText size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
            <div>Aucun projet trouvé.</div>
          </div>
        )}
      </div>

      {/* --- DESKTOP VIEW (TABLE) --- */}
      <div
        className="desktop-only"
        style={{
          maxWidth: 1200, width: '100%', margin: '0 auto',
          background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 6px rgba(0,0,0,0.02)', overflow: 'hidden',
          display: isMobile ? 'none' : 'block' // JS Toggle
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              <tr>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Projet</th>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Responsable</th>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Statut</th>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Livraison</th>

                {/* Creation Date */}
                <th
                  onClick={() => handleSort('created_at')}
                  style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    Création
                    {sortConfig.key === 'created_at' ? (
                      sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : <ArrowUpDown size={12} style={{ opacity: 0.3 }} />}
                  </div>
                </th>

                {[
                  { key: 'budget.prepa', label: 'H. Prépa' },
                  { key: 'budget.conf', label: 'H. Conf' },
                  { key: 'budget.pose', label: 'H. Pose' },
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      {label}
                      {sortConfig.key === key ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : <ArrowUpDown size={12} style={{ opacity: 0.3 }} />}
                    </div>
                  </th>
                ))}
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
                        value={p?.deadline ? p.deadline.split('T')[0] : ""}
                        onChange={(e) => handleUpdate(p.id, { deadline: e.target.value })}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: p?.deadline ? '#374151' : '#9CA3AF',
                          fontSize: 13,
                          fontFamily: 'inherit',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      />
                    </td>

                    {/* CREATION */}
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>
                      {new Date(p.created_at || p.createdAt || Date.now()).toLocaleDateString("fr-FR")}
                    </td>

                    {/* BUDGETS */}
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: '#374151' }}>{budget.prepa || 0} h</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: '#374151' }}>{budget.conf || 0} h</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: '#374151' }}>{budget.pose || 0} h</td>

                    {/* ACTIONS */}
                    <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4, opacity: 0.6 }} className="actions">
                        <Tooltip title="Éditer"><IconButton size="small" onClick={() => onOpenProject?.(p)}><Edit2 size={16} /></IconButton></Tooltip>
                        {currentUser?.role !== 'pose' && (
                        <Tooltip title="Supprimer">
                          <IconButton
                            size="small"
                            sx={{ color: '#ef4444' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Supprimer le projet "${p.name}" définitivement ?`)) {
                                onDelete?.(p.id);
                              }
                            }}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </Tooltip>
                        )}
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


      <ImportProjectsDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        users={users}
        onCreate={async (project) => {
          if (onCreate) {
            const { data, error } = await onCreate(project);
            if (error) throw new Error(error.message);
            if (data?.[0]) {
              setProjects?.(prev => [data[0], ...(Array.isArray(prev) ? prev : [])]);
            }
          } else if (setProjects) {
            setProjects(prev => [project, ...(Array.isArray(prev) ? prev : [])]);
          }
        }}
      />

      {
        showCreate && (
          <CreateProjectDialog
            open={showCreate}
            onClose={() => setShowCreate(false)}
            minutes={canSeeChiffrage ? (Array.isArray(minutes) ? minutes : []) : []}
            prodSchema={SCHEMA_64}
            onCreateFromMinute={async (payload) => {
              const { name, rows, meta, deliveryDate, location, intervention_type, expedition_type } = payload || {};
              const project = createBlankProject({ name });
              project.id = project.id || uid();
              project.name = name || meta?.minuteName || project.name || "Nouveau Projet";
              project.sourceMinuteId = meta?.id || null;
              // Calculate budget from rows directly to ensure accuracy
              const calculateBudgetFromRows = (rs) => {
                let p = 0, c = 0, i = 0;
                (rs || []).forEach(r => {
                  const qty = Number(r.quantite) || 1;
                  p += (Number(r.heures_prepa) || 0) * qty;
                  c += (Number(r.heures_confection) || 0) * qty;
                  i += (Number(r.heures_pose) || 0) * qty;
                });
                return { prepa: p, conf: c, pose: i };
              };

              // Force calculation from rows (Source of Truth) instead of potentially empty/outdated snapshot
              project.budget = calculateBudgetFromRows(rows);
              project.manager = meta?.owner || project.manager;
              project.notes = meta?.notes || project.notes;
              project.deadline = deliveryDate || null;
              project.location = location || null;
              project.intervention_type = intervention_type || null;
              project.expedition_type = expedition_type || null;
              project.rows = computeFormulas(rows || [], SCHEMA_64);
              project.materials = extractMaterialsFromLines(rows || []);

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
                    // Update source minute status to ORDERED
                    if (project.sourceMinuteId && onUpdateMinute) {
                      onUpdateMinute(project.sourceMinuteId, { status: "ORDERED" });
                    }
                  }
                } catch (e) {
                  alert("Erreur : " + e.message);
                }
              } else if (setProjects) {
                setProjects((arr) => [project, ...(Array.isArray(arr) ? arr : [])]);
                onOpenProject?.(project);
                // Update source minute status to ORDERED
                if (project.sourceMinuteId && onUpdateMinute) {
                  onUpdateMinute(project.sourceMinuteId, { status: "ORDERED" });
                }
                setShowCreate(false);
              }
            }}
            onCreateBlank={async (projectName, _dummyRows, config) => {
              const project = {
                id: uid(),
                name: projectName || "Nouveau Projet",
                budget: { prepa: 0, conf: 0, pose: 0 },
                config: config,
                deadline: config?.deliveryDate || null,
                location: config?.location || null,
                intervention_type: config?.intervention_type || null,
                expedition_type: config?.expedition_type || null,
                rows: createBlankProject(config, SCHEMA_64),
                created_at: new Date().toISOString()
              };

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
        )
      }
    </div >
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