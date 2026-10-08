// src/screens/ProjectListScreen.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useFillViewportHeight } from "../lib/hooks/useFillViewportHeight";
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { Edit2, Plus, FileText, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Archive, Upload, Filter, ChevronLeft, ChevronRight, Calendar, MapPin } from 'lucide-react';

import { SmartFilterBar } from "../components/ui/SmartFilterBar.jsx";
import { isConditionActive, evaluateCondition } from "../components/FilterPanel.jsx";
import ConditionFilterButton from "../components/ui/ConditionFilterButton";
import { useViewportWidth } from "../lib/hooks/useViewportWidth";
import { formatDateFR } from "../lib/utils/format";

import CreateProjectDialog from "../components/CreateProjectDialog.jsx";
import ImportProjectsDialog from "../components/ImportProjectsDialog.jsx";
import OdooLinkCell from "../components/odoo/OdooLinkCell.jsx";
import { SCHEMA_64 } from "../lib/schemas/production.js";
import { createBlankProject } from "../lib/import/createBlankProject.js";
import { buildProjectFromMinute } from "../lib/import/projectFromMinute.js";

import { useAuth } from "../auth";

import { can, role } from "../lib/authz";
import { FORMULES_METRAGE_V2 } from "../lib/formulas/metrageVersion";
import { FORMULES_STORES_V1 } from "../lib/formulas/storesBateauxMetrage";
// 👇 IMPORT IMPORTANT
import { uid } from "../lib/utils/uid";

import { PROJECT_STATUS_OPTIONS } from "../lib/constants/projectStatus";
import { PROJECT_STATUS_TONE } from "../lib/constants/daStyles";
import { TonePill, StatusSelectPill } from "../components/ui/ToolbarControls";
import { isInternalProject } from "../lib/planning/internalProject";

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

export function ProjectListScreen({ projects, setProjects, onOpenProject, minutes = [], onCreate, onDelete, onUpdateProject, onUpdateMinute, onLoadMinuteDetail, onBack }) {
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const list = Array.isArray(projects) ? projects : [];
  const { currentUser, users } = useAuth();
  const canCreate = ["ADMIN", "ORDONNANCEMENT", "ADV"].includes(currentUser?.role) || can(currentUser, "project.create");
  const canSeeChiffrage = can(currentUser, "chiffrage.view");
  const [activeFilters, setActiveFilters] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const [filterConditions, setFilterConditions] = useState([]);
  const listScrollRef = useRef(null);
  const listHeight = useFillViewportHeight(listScrollRef);

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
    // Le statut est stocké en interne (TODO, IN_PROGRESS…) mais affiché traduit :
    // on cherche donc à la fois dans le code et dans le libellé, sinon taper
    // « en cours » ne remonte jamais rien.
    const fieldText = (p, field) => field === 'status'
      ? `${p.status || ''} ${PROJECT_STATUS_OPTIONS[p?.status]?.label || ''}`
      : String(p[field] ?? '');
    const textFilters = activeFilters.filter(f => f.id !== 'my_projects' && f.value);
    textFilters.forEach(f => {
      const q = f.value.toLowerCase();
      if (f.field === 'all') {
        res = res.filter(p => ['name', 'manager', 'status', 'notes'].some(k => fieldText(p, k).toLowerCase().includes(q)));
      } else {
        res = res.filter(p => fieldText(p, f.field).toLowerCase().includes(q));
      }
    });

    const activeConditions = filterConditions.filter(isConditionActive);

    // Les archivés sont masqués par défaut — sauf si l'utilisateur filtre
    // explicitement sur le statut (sinon « Statut est Archivé » ne remonte rien).
    const filtreStatutExplicite =
      activeConditions.some(c => c.field === 'status') ||
      textFilters.some(f => f.field === 'status');
    if (showArchived) {
      res = res.filter(p => p.status === 'ARCHIVED');
    } else if (!filtreStatutExplicite) {
      res = res.filter(p => p.status !== 'ARCHIVED');
    }

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
    <div style={{ minHeight: isMobile ? '100vh' : undefined, background: '#FFFFFF', padding: isMobile ? '16px' : '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
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

      <div style={{ maxWidth: 1440, width: '100%', margin: '0 auto 24px auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
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
            <h1 style={{ fontSize: 32, fontWeight: 400, fontFamily: 'Roboto, system-ui, sans-serif', color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>Projets</h1>
          </div>
          {canCreate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="header-actions"
                onClick={() => setShowCreate(true)}
                style={{
                  // Mêmes dimensions que les boutons d'action du chiffrage (Bibliothèque…), fond bleu nuit conservé
                  background: '#1E2447', color: 'white', padding: '8px 14px', borderRadius: 8, border: '1px solid #1E2447',
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                  marginBottom: isMobile ? 0 : 4,
                  width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'center' : 'flex-start'
                }}
              >
                <Plus size={16} /> Nouveau Projet
              </button>
              {/* Import Excel : utile au bureau, pas sur téléphone */}
              {!isMobile && <button
                onClick={() => setShowImport(true)}
                title="Importer des projets depuis Excel"
                style={{
                  background: 'white', color: '#374151', padding: '8px 14px', borderRadius: 8,
                  border: '1px solid #E0DED9', display: 'flex', alignItems: 'center', gap: 8,
                  cursor: 'pointer', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', marginBottom: isMobile ? 0 : 4,
                }}
              >
                <Upload size={16} /> Import Excel
              </button>}
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
          {/* Filtrer + Archives alignés sur le bord droit du tableau */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <ConditionFilterButton schema={PROJECT_FILTER_SCHEMA} conditions={filterConditions} onChange={setFilterConditions} />
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
                '&:hover': { bgcolor: showArchived ? '#BFDBFE' : '#F4F4F4' }
              }}
            >
              <Archive size={20} />
            </IconButton>
          </Tooltip>
          </div>
        </div>
      </div>

      {/* --- MOBILE VIEW (CARDS) --- */}
      <div
        style={{
          maxWidth: 1440, width: '100%', margin: '0 auto',
          display: isMobile ? 'flex' : 'none', // JS Toggle
          flexDirection: 'column', gap: 12
        }}
      >
        {filteredProjects.map((p) => {
          const statusOpt = PROJECT_STATUS_OPTIONS[p?.status] || PROJECT_STATUS_OPTIONS.TODO;
          const budget = p.budget || { prepa: 0, conf: 0, pose: 0 };
          const dateStr = p.deadline ? formatDateFR(p.deadline) : "—";

          // Carte mobile : toute la carte ouvre la fiche (pas de crayon ni de poubelle au doigt).
          return (
            <button key={p.id} onClick={() => onOpenProject?.(p)} style={{
              width: '100%', textAlign: 'left', fontFamily: 'Roboto, system-ui, sans-serif', cursor: 'pointer',
              background: 'white', borderRadius: 12, padding: '14px 16px', border: '1px solid #E0DED9',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#111827', lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {p.name || "Sans nom"}
                  </div>
                  <span style={{ flexShrink: 0 }}><TonePill tone={PROJECT_STATUS_TONE[p?.status || 'TODO']}>{statusOpt.label}</TonePill></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 13, color: '#6B7280' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Avatar sx={{ width: 20, height: 20, fontSize: 10, bgcolor: stringToColor(p?.manager || "?") }}>
                      {(p?.manager?.[0] || "?").toUpperCase()}
                    </Avatar>
                    {p.manager || "Non assigné"}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Calendar size={13} color="#9B9A97" /> {dateStr}
                  </span>
                </div>
                {p.location && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B7280', minWidth: 0 }}>
                    <MapPin size={13} color="#9B9A97" style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.location}</span>
                  </div>
                )}
                <div style={{ fontSize: 12, color: '#9B9A97' }}>
                  Prépa {budget.prepa || 0}h · Conf {budget.conf || 0}h · Pose {budget.pose || 0}h
                </div>
              </div>
              <ChevronRight size={18} color="#C9C7C2" style={{ flexShrink: 0 }} />
            </button>
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
          maxWidth: 1440, width: '100%', margin: '0 auto',
          background: 'white', border: '1px solid #E0DED9', borderRadius: 8, overflow: 'hidden',
          display: isMobile ? 'none' : 'block' // JS Toggle
        }}
      >
        {/* Écrans étroits : date de création masquée et heures regroupées, pour éviter tout défilement horizontal */}
        <style>{`.col-hours-merged { display: none; }
          @media (max-width: 1180px) { .col-created, .col-hours { display: none; } .col-hours-merged { display: table-cell; } }`}</style>
        {/* Seul le tableau défile (page fixe, en-têtes collés, barre masquée) — comme la liste Chiffrages */}
        <div ref={listScrollRef} className="df-list-scroll" style={{ overflow: 'auto', maxHeight: listHeight ?? undefined }}>
          <table className="df-list-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#F4F4F4', borderBottom: '1px solid #E0DED9' }}>
              <tr>
                <th style={{ padding: '12px 10px', fontSize: 13, fontWeight: 600, color: '#374151' }}>Projet</th>
                <th style={{ padding: '12px 10px', fontSize: 13, fontWeight: 600, color: '#374151' }}>Responsable</th>
                <th style={{ padding: '12px 10px', fontSize: 13, fontWeight: 600, color: '#374151', textAlign: 'center' }}>Statut</th>
                <th style={{ padding: '12px 10px', fontSize: 13, fontWeight: 600, color: '#374151' }}>Livraison</th>
                <th style={{ padding: '12px 10px', fontSize: 13, fontWeight: 600, color: '#374151' }}>Odoo</th>

                {/* Creation Date */}
                <th
                  onClick={() => handleSort('created_at')}
                  className="col-created"
                  style={{ padding: '12px 10px', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer', userSelect: 'none' }}
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
                    className="col-hours"
                    onClick={() => handleSort(key)}
                    style={{ padding: '12px 8px', fontSize: 13, fontWeight: 600, color: '#374151', textAlign: 'right', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      {label}
                      {sortConfig.key === key ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : <ArrowUpDown size={12} style={{ opacity: 0.3 }} />}
                    </div>
                  </th>
                ))}
                {/* Écran étroit : les 3 budgets d'heures regroupés en une colonne */}
                <th className="col-hours-merged" title="Heures budgétées : préparation / confection / pose" style={{ padding: '12px 8px', fontSize: 13, fontWeight: 600, color: '#374151', textAlign: 'right', whiteSpace: 'nowrap' }}>H. P / C / P</th>
                <th style={{ padding: '12px 10px', width: 64, position: 'sticky', right: 0, background: '#F4F4F4' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((p, idx) => {
                const budget = p.budget || { prepa: 0, conf: 0, pose: 0 };
                // Dossier interne : ni responsable, ni livraison, ni budget vendu.
                // Afficher des champs éditables vides laisserait croire qu'il manque
                // une saisie — on neutralise plutôt les colonnes qui n'ont pas de sens.
                const internal = isInternalProject(p);

                return (
                  <tr key={p?.id || idx} className="project-row" style={{ borderBottom: '1px solid #E8E6E2', transition: 'background 0.1s', background: 'white' }} onClick={() => onOpenProject?.(p)} onMouseEnter={(e) => e.currentTarget.style.background = '#F4F4F4'} onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                    {/* DOSSIER */}
                    <td style={{ padding: '12px 10px' }}>
                      <div style={{ fontWeight: 600, color: '#111827', fontSize: 14, minWidth: 150 }}>{p?.name || "Sans nom"}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>#{String(p?.id || "").slice(-4)}</div>
                    </td>

                    {/* RESPONSABLE */}
                    <td style={{ padding: '12px 10px' }} onClick={(e) => e.stopPropagation()}>
                      {internal ? <span style={{ color: '#D1D5DB', fontSize: 13 }}>—</span> : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar sx={{ width: 24, height: 24, fontSize: 10, bgcolor: stringToColor(p?.manager || "?") }}>{(p?.manager?.[0] || "?").toUpperCase()}</Avatar>
                        <select
                          value={p?.manager || ""}
                          onChange={(e) => handleUpdate(p.id, { manager: e.target.value })}
                          style={{
                            border: 'none', background: 'transparent', fontSize: 13, color: '#374151', cursor: 'pointer', outline: 'none',
                            fontWeight: 500, maxWidth: 120, textOverflow: 'ellipsis'
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
                      )}
                    </td>

                    {/* STATUT */}
                    <td style={{ padding: '12px 10px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      {/* Statut : pastille + liste déroulante, identique partout (StatusSelectPill).
                          Le dossier interne ne doit jamais pouvoir être archivé par mégarde : il recueille
                          du temps en continu et disparaîtrait de la liste, avec tout son historique. */}
                      <StatusSelectPill
                        value={p?.status || "TODO"}
                        options={PROJECT_STATUS_OPTIONS}
                        tones={PROJECT_STATUS_TONE}
                        onChange={(v) => handleUpdate(p.id, { status: v })}
                        disabled={internal}
                        title={internal ? "Le dossier interne reste toujours actif" : "Changer le statut"}
                      />
                    </td>

                    {/* LIVRAISON */}
                    <td style={{ padding: '12px 10px' }} onClick={(e) => e.stopPropagation()}>
                      {internal ? <span style={{ color: '#D1D5DB', fontSize: 13 }}>—</span> : (
                      <input
                        type="date"
                        value={p?.deadline ? p.deadline.split('T')[0] : ""}
                        onChange={(e) => handleUpdate(p.id, { deadline: e.target.value })}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: p?.deadline ? '#374151' : '#9CA3AF',
                          fontSize: 12.5, width: 112,
                          fontFamily: 'inherit',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      />
                      )}
                    </td>

                    {/* ODOO */}
                    <td style={{ padding: '12px 10px' }} onClick={(e) => e.stopPropagation()}>
                      <OdooLinkCell
                        idProjetOdoo={p?.id_projet_odoo || null}
                        internal={internal}
                        dense
                        onLink={(odooId) => handleUpdate(p.id, { id_projet_odoo: odooId })}
                      />
                    </td>

                    {/* CREATION */}
                    <td className="col-created" style={{ padding: '12px 10px', fontSize: 13, color: '#6B7280' }}>
                      {new Date(p.created_at || p.createdAt || Date.now()).toLocaleDateString("fr-FR")}
                    </td>

                    {/* BUDGETS */}
                    <td className="col-hours" style={{ padding: '12px 8px', textAlign: 'right', fontSize: 13, whiteSpace: 'nowrap', color: internal ? '#D1D5DB' : '#374151' }}>{internal ? '—' : `${budget.prepa || 0} h`}</td>
                    <td className="col-hours" style={{ padding: '12px 8px', textAlign: 'right', fontSize: 13, whiteSpace: 'nowrap', color: internal ? '#D1D5DB' : '#374151' }}>{internal ? '—' : `${budget.conf || 0} h`}</td>
                    <td className="col-hours" style={{ padding: '12px 8px', textAlign: 'right', fontSize: 13, whiteSpace: 'nowrap', color: internal ? '#D1D5DB' : '#374151' }}>{internal ? '—' : `${budget.pose || 0} h`}</td>
                    <td className="col-hours-merged" style={{ padding: '12px 8px', textAlign: 'right', fontSize: 13, whiteSpace: 'nowrap', color: internal ? '#D1D5DB' : '#374151' }}>{internal ? '—' : `${budget.prepa || 0} / ${budget.conf || 0} / ${budget.pose || 0} h`}</td>

                    {/* ACTIONS */}
                    <td style={{ padding: '12px 10px', position: 'sticky', right: 0, background: 'inherit' }} onClick={(e) => e.stopPropagation()}>
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
              {filteredProjects.length === 0 && (<tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}><FileText size={48} style={{ opacity: 0.2, marginBottom: 16 }} /><div>Aucun projet trouvé.</div></td></tr>)}
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
            onLoadMinuteDetail={onLoadMinuteDetail}
            prodSchema={SCHEMA_64}
            onCreateFromMinute={async (payload) => {
              const { name, rows, meta, deliveryDate, location, intervention_type, expedition_type } = payload || {};
              // Construction partagée avec la création automatique depuis une commande Odoo
              // (src/lib/import/projectFromMinute.js) : mêmes lignes, formules, budget, matières.
              const project = buildProjectFromMinute(
                { ...(meta || {}), lines: rows || [] },
                { name: name || meta?.minuteName, deliveryDate, location, intervention_type, expedition_type },
              );
              project.origin = { type: 'import', minuteName: meta?.name || meta?.minuteName || name };

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
                // Nouveau projet → formules de métrage v2 (projet + chaque ligne, lue par les getters).
                config: { ...(config || {}), formules_metrage: FORMULES_METRAGE_V2, formules_stores: FORMULES_STORES_V1 },
                deadline: config?.deliveryDate || null,
                location: config?.location || null,
                intervention_type: config?.intervention_type || null,
                expedition_type: config?.expedition_type || null,
                rows: createBlankProject(config, SCHEMA_64).map(r => ({ ...r, formules_metrage: FORMULES_METRAGE_V2, formules_stores: FORMULES_STORES_V1 })),
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