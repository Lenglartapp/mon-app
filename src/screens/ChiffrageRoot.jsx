// src/screens/ChiffrageRoot.jsx
import React, { useState, useMemo, useEffect, useRef } from "react";
import { Plus, Copy, Trash2, FileText, ArrowUpDown, ArrowUp, ArrowDown, Archive, Filter, ChevronDown, ChevronRight, GitBranch, SlidersHorizontal } from "lucide-react";
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

import { useAuth, ROLES } from "../auth";
// 👇 IMPORT CRUCIAL
import { uid } from "../lib/utils/uid";
import { SmartFilterBar } from "../components/ui/SmartFilterBar.jsx";
import { DataGrid } from '@mui/x-data-grid';
import { frFR } from '@mui/x-data-grid/locales';
import { calculateProfitability } from '../lib/financial/profitabilityCalculator';
import { useAppSettings, useCatalog } from "../hooks/useSupabase";
import { computeFormulas } from "../lib/formulas/compute";
import { CHIFFRAGE_SCHEMA } from "../lib/schemas/chiffrage";

// CONSTANTES & HELPERS
const SEARCH_FIELDS = [
  { id: 'name',   label: 'Nom du chiffrage' },
  { id: 'client', label: 'Client' },
  { id: 'owner',  label: "Chargé d'affaires" },
  { id: 'status', label: 'Statut' },
];

const FILTER_FIELDS = [
  { id: 'ca_ht',    label: 'Montant HT',           unit: '€',   adminOnly: false },
  { id: 'marge_pct', label: 'Contribution %',       unit: '%',   adminOnly: true },
  { id: 'renta_hh',  label: 'Contribution Horaire', unit: '€/h', adminOnly: true },
];

const OPERATORS = [
  { id: 'gt',      label: 'est supérieur à' },
  { id: 'gte',     label: 'est supérieur ou égal à' },
  { id: 'lt',      label: 'est inférieur à' },
  { id: 'lte',     label: 'est inférieur ou égal à' },
  { id: 'eq',      label: 'est égal à' },
  { id: 'between', label: 'est compris entre' },
];

const newCondition = () => ({ id: `c${Date.now()}${Math.random()}`, field: 'ca_ht', operator: 'gt', value: '', value2: '' });

const STATUS_OPTIONS = {
  DRAFT: { label: "À faire", color: "#9CA3AF", bg: "#F3F4F6", text: "#374151" }, // Gray
  IN_PROGRESS: { label: "En cours", color: "#3B82F6", bg: "#EFF6FF", text: "#1E3A8A" }, // Blue
  PENDING_APPROVAL: { label: "À valider", color: "#F59E0B", bg: "#FFFBEB", text: "#92400E" }, // Orange
  REVISE: { label: 'À reprendre', color: '#EF4444', bg: '#FEF2F2', text: '#991B1B' },
  VALIDATED: { label: 'Validée', color: '#10B981', bg: '#ECFDF5', text: '#065F46' },
  ORDERED: { label: 'Commande', color: '#8B5CF6', bg: '#F5F3FF', text: '#5B21B6' },
  ORDER_COMPLETED: { label: 'Commande terminée', color: '#059669', bg: '#ECFDF5', text: '#064E3B' },
  LOST: { label: 'Perdu', color: '#EF4444', bg: '#FEF2F2', text: '#991B1B' }
};

// Helper for numeric conversion (same as ChiffrageScreen)
const toNum = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// Compute CA (Production + Deplacements, exclude Extras for consistency)
const calculateTotalCA = (m) => {
  let sum = 0;
  // Production lines
  if (Array.isArray(m.lines)) {
    m.lines.forEach(r => sum += toNum(r.prix_total));
  }
  // Deplacements
  if (Array.isArray(m.deplacements)) {
    m.deplacements.forEach(r => sum += toNum(r.prix_total));
  }
  return sum;
};

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

export default function ChiffrageRoot({ minutes = [], onCreate, onOpenMinute, onDelete, onUpdate, onBack }) {
  const { currentUser, users } = useAuth?.() || { currentUser: { name: "—" }, users: [] };
  const { settings: globalSettings } = useAppSettings();
  const { catalog } = useCatalog();
  const [newMinOpen, setNewMinOpen] = useState(false);

  // Status Menu State
  const [statusMenu, setStatusMenu] = useState({ anchor: null, minuteId: null });
  // Owner Menu State
  const [ownerMenu, setOwnerMenu] = useState({ anchor: null, minuteId: null });

  // Filtering Menus
  const [statusFilterAnchor, setStatusFilterAnchor] = useState(null);
  const [ownerFilterAnchor, setOwnerFilterAnchor] = useState(null);

  const showKPIs = currentUser?.role === ROLES.ADMIN;

  const handleStatusClick = (event, id) => {
    event.stopPropagation();
    setStatusMenu({ anchor: event.currentTarget, minuteId: id });
  };

  const handleStatusClose = () => setStatusMenu({ anchor: null, minuteId: null });

  const handleStatusSelect = (status) => {
    if (statusMenu.minuteId && onUpdate) {
      onUpdate(statusMenu.minuteId, { status });
    }
    handleStatusClose();
  };

  const handleOwnerClick = (event, id) => {
    event.stopPropagation();
    setOwnerMenu({ anchor: event.currentTarget, minuteId: id });
  };

  const handleOwnerClose = () => setOwnerMenu({ anchor: null, minuteId: null });

  const handleOwnerSelect = (ownerName) => {
    if (ownerMenu.minuteId && onUpdate) {
      onUpdate(ownerMenu.minuteId, { owner: ownerName });
    }
    handleOwnerClose();
  };

  const toggleFilter = (field, value, label) => {
    const filterId = `${field}_${value}`;
    setActiveFilters(prev => {
      if (prev.find(f => f.id === filterId)) {
        return prev.filter(f => f.id !== filterId);
      }
      return [...prev, { id: filterId, label: `${label}`, field, value }];
    });
  };

  // Filter Sales/Admin users
  const assignableUsers = users.filter(u => u.role === ROLES.ADMIN || u.role === ROLES.ADV || u.role === 'sales');

  // Sort State

  // Sort State
  const [sortConfig, setSortConfig] = useState({ key: 'updatedAt', direction: 'desc' });

  const handleSort = (key) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Creation Form State
  const [newMin, setNewMin] = useState({
    charge: (currentUser?.name || "").trim(),
    projet: "",
    client: "", // New Client Field
    deliveryDate: "", // Nouveau champ pour la date de livraison estimée
    note: "",
    status: "DRAFT",
    modules: {
      rideau: true,
      store: false,
      store_bateau: false,
      coussins: false,
      cache_sommier: false,
      mobilier: false,
      tenture_murale: false,
      plaid: false
    },
  });

  const [isCreating, setIsCreating] = useState(false);

  const [activeFilters, setActiveFilters] = useState([]);
  const [conditions, setConditions] = useState([newCondition()]);
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(false);
  const advancedPanelRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (advancedPanelRef.current && !advancedPanelRef.current.contains(e.target)) {
        setShowAdvancedPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setActiveFilters([{ id: 'my_minutes', label: '👤 Mes chiffrages', field: 'owner' }]);
  }, []);

  const [showArchived, setShowArchived] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  const toggleGroup = (parentId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(parentId) ? next.delete(parentId) : next.add(parentId);
      return next;
    });
  };

  const norm = (m) => {
    // 1. Recompute Lines (Logic duplicated from ChiffrageScreen for consistency)
    const paramsMap = {};
    (m.params || []).forEach((p) => { if (p?.name) paramsMap[p.name] = p?.value; });

    let baseCA = 0;
    (m.lines || []).forEach(r => baseCA += toNum(r.prix_total));
    (m.deplacements || []).forEach(r => baseCA += toNum(r.prix_total));

    const defaults = { taux_horaire: 135, prix_nuit: 180, prix_repas: 25, vatRate: 20 };
    const globalSelect = globalSettings ? { ...globalSettings, taux_horaire: globalSettings.hourlyRate ?? globalSettings.taux_horaire } : {};
    const local = m.settings || {};
    const effectiveSettings = { ...defaults, ...globalSelect, ...local };

    const formulaCtx = {
      paramsMap,
      totalCA: baseCA,
      settings: effectiveSettings,
      catalog: catalog || []
    };

    // Compute Rows
    const computedRows = computeFormulas(m.lines || [], CHIFFRAGE_SCHEMA, formulaCtx);

    // 2. Calculate KPIs using computed rows
    const kpiData = calculateProfitability(computedRows || [], m.deplacements || [], m.extraDepenses || []);
    const kpis = kpiData.kpis;

    return {
      id: m.id,
      name: m.name || "Minute sans nom",
      client: m.client || "",
      delivery_date: m.delivery_date || m.deliveryDate || "",
      notes: m.notes || "",
      version: m.version ?? 1,
      parentId: m.parentId || null,
      lines: m.lines || [],
      params: m.params || [],
      deplacements: m.deplacements || [],
      createdAt: m.createdAt || Date.now(),
      updatedAt: m.updatedAt || Date.now(),
      owner: m.owner || currentUser?.name || "—",
      status: m.status || "DRAFT",
      modules: m.modules,
      // KPIs
      ca_ht: kpis.ca_total || 0,
      marge_eur: kpis.contribution || 0, // Contribution displayed as Marge EUR
      marge_pct: kpis.contribution_pct || 0, // Contribution % displayed as Marge %
      renta_hh: kpis.contribution_horaire || 0,
    };
  };

  const list = useMemo(() => {
    // Recalculate only if we have settings (avoid double calc on mount if settings not loaded yet, or just calc)
    // Actually safe to calc with defaults
    return (minutes || []).map(norm).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [minutes, globalSettings, catalog]); // Dependency on Settings

  const removeFilter = (id) => setActiveFilters(prev => prev.filter(f => f.id !== id));
  const addFilter = (filter) => setActiveFilters(prev => {
    if (prev.find(f => f.id === filter.id)) return prev;
    return [...prev, filter];
  });

  const updateCondition = (id, key, val) =>
    setConditions(prev => prev.map(c =>
      c.id === id ? { ...c, [key]: val, ...(key === 'operator' && val !== 'between' ? { value2: '' } : {}) } : c
    ));
  const removeCondition = (id) =>
    setConditions(prev => prev.length > 1 ? prev.filter(c => c.id !== id) : prev);

  const applyConditions = () => {
    const valid = conditions.filter(c => c.value !== '' && !isNaN(Number(c.value)));
    if (valid.length === 0) return;
    valid.forEach(cond => {
      const fieldDef = FILTER_FIELDS.find(f => f.id === cond.field);
      const opDef = OPERATORS.find(o => o.id === cond.operator);
      const v1 = Number(cond.value).toLocaleString('fr-FR');
      const label = cond.operator === 'between'
        ? `${fieldDef.label} entre ${v1} et ${Number(cond.value2 || 0).toLocaleString('fr-FR')} ${fieldDef.unit}`
        : `${fieldDef.label} ${opDef.label} ${v1} ${fieldDef.unit}`;
      addFilter({
        id: `adv_${cond.id}`,
        label,
        field: 'advanced',
        matchType: 'advanced',
        filterField: cond.field,
        operator: cond.operator,
        value: cond.value,
        value2: cond.value2 || '',
      });
    });
    setConditions([newCondition()]);
    setShowAdvancedPanel(false);
  };

  const filteredList = useMemo(() => {
    let res = list;
    if (activeFilters.some(f => f.id === 'my_minutes')) {
      const userName = currentUser?.name || currentUser?.displayName || currentUser?.email || "";
      if (userName) {
        res = res.filter(m => {
          const owner = (m.owner || "").toLowerCase();
          const user = userName.toLowerCase();
          return owner.includes(user) || user.includes(owner) || !m.owner;
        });
      }
    }

    // Field filters — OR within same field, AND across fields
    // matchType 'contains' = substring (from search bar), else = exact match (from filter menus)
    const fieldFilters = activeFilters.filter(f => f.field && f.id !== 'my_minutes' && f.matchType !== 'advanced');
    if (fieldFilters.length > 0) {
      const grouped = fieldFilters.reduce((acc, f) => {
        if (!acc[f.field]) acc[f.field] = [];
        acc[f.field].push(f);
        return acc;
      }, {});

      Object.keys(grouped).forEach(field => {
        res = res.filter(m => grouped[field].some(f => {
          if (f.matchType === 'contains') {
            if (f.field === 'all') {
              return [m.name, m.client, m.owner, m.notes].some(x => String(x || '').toLowerCase().includes(f.value.toLowerCase()));
            }
            if (f.field === 'status') {
              return (STATUS_OPTIONS[m.status]?.label || '').toLowerCase().includes(f.value.toLowerCase());
            }
            return String(m[f.field] || '').toLowerCase().includes(f.value.toLowerCase());
          }
          return String(m[field] || '') === String(f.value);
        }));
      });
    }

    // Conditions avancées (chips créés depuis le constructeur) — toutes AND
    const advancedConds = activeFilters.filter(f => f.matchType === 'advanced');
    if (advancedConds.length > 0) {
      res = res.filter(m => advancedConds.every(f => {
        const mVal = m[f.filterField];
        const v1 = Number(f.value);
        const v2 = Number(f.value2 || 0);
        switch (f.operator) {
          case 'gt':      return mVal > v1;
          case 'gte':     return mVal >= v1;
          case 'lt':      return mVal < v1;
          case 'lte':     return mVal <= v1;
          case 'eq':      return Math.abs(mVal - v1) < 0.5;
          case 'between': return mVal >= Math.min(v1, v2) && mVal <= Math.max(v1, v2);
          default:        return true;
        }
      }));
    }

    if (showArchived) {
      // Show ONLY Archived (Lost/Completed)
      res = res.filter(m => ['LOST', 'ORDER_COMPLETED'].includes(m.status));
    } else {
      // Show ONLY Active (Not Lost/Completed)
      res = res.filter(m => !['LOST', 'ORDER_COMPLETED'].includes(m.status));
    }

    // Apply Sort
    if (sortConfig.key) {
      res = [...res].sort((a, b) => { // Copy to avoid mutating
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return res;
  }, [list, activeFilters, currentUser, sortConfig, showArchived]);

  const handleCreateMinute = async () => {
    const { charge, projet, client, deliveryDate, note, status, modules } = newMin;
    if (!projet.trim() || !charge.trim() || !deliveryDate) return;
    if (!Object.values(modules).some(v => v === true)) return;

    setIsCreating(true);
    try {
      const now = Date.now();
      const localId = uid();

      const m = {
        id: localId,
        name: projet.trim(),
        client: (client || "").trim() || "Client inconnu", // Client added
        delivery_date: deliveryDate, // Enregistrement de la date (format PostgreSQL classique)
        notes: (note || "").trim(),
        version: 1,
        lines: [],
        params: [
          { id: uid(), name: "taux_horaire", type: "prix", value: globalSettings?.hourlyRate ?? globalSettings?.taux_horaire ?? 135 },
          { id: uid(), name: "prix_achat_tissu", type: "prix", value: null },
          { id: uid(), name: "nuit_hotel", type: "prix", value: 150 },
        ],
        deplacements: [],
        createdAt: now,
        updatedAt: now,
        owner: charge.trim(),
        status,
        modules: { ...modules },
      };

      if (onCreate) {
        // 1. On attend la réponse OFFICIELLE de Supabase
        const { data, error } = await onCreate(m);

        if (error) {
          console.error("ERREUR CRITIQUE SUPABASE:", error);
          alert(`ERREUR SUPABASE :\nCode: ${error.code}\nMessage: ${error.message}`);
          throw new Error(error.message);
        }

        if (!data || data.length === 0) {
          throw new Error("No data returned");
        }

        const realId = data[0].id;
        setNewMinOpen(false);
        if (onOpenMinute) onOpenMinute(realId);
      }
    } catch (e) {
      console.error("Create error:", e);
      if (!e.message.includes("ERREUR SUPABASE")) {
        alert("Erreur JS : " + e.message);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const duplicate = (id) => {
    const src = minutes.find(x => x.id === id);
    if (!src) return;
    // Le parent est toujours la racine : si src est déjà une variante, on pointe vers son parent
    const rootParentId = src.parentId || src.id;
    // Compter les variantes existantes pour nommer la copie
    const siblingCount = minutes.filter(m => (m.parentId || m.id) === rootParentId && m.id !== rootParentId).length;
    const newVersion = siblingCount + 2; // v2, v3, etc.
    const copy = {
      ...src,
      id: uid(),
      name: src.name.replace(/ — v\d+.*$/, ''), // Retire un suffixe de version précédent
      version: newVersion,
      parentId: rootParentId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "DRAFT",
    };
    if (onCreate) onCreate(copy);
  };

  const removeOne = (id) => {
    if (window.confirm("Voulez-vous vraiment supprimer ce chiffrage ? Cette action est irréversible.")) {
      if (onDelete) onDelete(id);
    }
  };

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
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1F2937', margin: 0, letterSpacing: '-0.5px' }}>Chiffrages</h1>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setNewMinOpen(true)} style={{ background: '#1E2447', color: 'white', padding: '8px 16px', borderRadius: 8, border: 'none', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: 4 }}>
              <Plus size={18} /> Nouveau Chiffrage
            </button>
          </div>
        </div>

        {/* Search & Filter Row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SmartFilterBar
            fields={SEARCH_FIELDS}
            activeFilters={activeFilters}
            onAddFilter={addFilter}
            onRemoveFilter={removeFilter}
          />

          {/* Constructeur de conditions */}
          <div ref={advancedPanelRef} style={{ position: 'relative' }}>
            {(() => {
              const activeCount = activeFilters.filter(f => f.matchType === 'advanced').length;
              return (
                <Tooltip title="Filtres avancés">
                  <IconButton
                    onClick={() => setShowAdvancedPanel(p => !p)}
                    sx={{
                      position: 'relative',
                      bgcolor: showAdvancedPanel || activeCount > 0 ? '#EEF2FF' : 'white',
                      color: showAdvancedPanel || activeCount > 0 ? '#4338CA' : '#6B7280',
                      border: `1px solid ${showAdvancedPanel || activeCount > 0 ? '#C7D2FE' : '#E5E7EB'}`,
                      borderRadius: 2, height: 38, width: 38,
                      '&:hover': { bgcolor: '#EEF2FF' },
                    }}
                  >
                    <SlidersHorizontal size={18} />
                    {activeCount > 0 && (
                      <span style={{
                        position: 'absolute', top: 4, right: 4,
                        width: 8, height: 8, borderRadius: '50%',
                        background: '#6366F1', border: '1px solid white',
                      }} />
                    )}
                  </IconButton>
                </Tooltip>
              );
            })()}

            {showAdvancedPanel && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                background: 'white', borderRadius: 10, width: 340,
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)', border: '1px solid #E5E7EB', zIndex: 200,
                padding: 16,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
                  Filtres avancés
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {conditions.map((cond, i) => {
                    const availableFields = FILTER_FIELDS.filter(f => !f.adminOnly || showKPIs);
                    const selStyle = {
                      width: '100%', padding: '7px 10px', borderRadius: 6,
                      border: '1px solid #E5E7EB', fontSize: 13, background: 'white',
                      outline: 'none', cursor: 'pointer', color: '#111827',
                    };
                    return (
                      <div key={cond.id}>
                        {i > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <div style={{ flex: 1, height: 1, background: '#F3F4F6' }} />
                            <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>ET</span>
                            <div style={{ flex: 1, height: 1, background: '#F3F4F6' }} />
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <select value={cond.field} onChange={e => updateCondition(cond.id, 'field', e.target.value)} style={{ ...selStyle, flex: 1 }}>
                              {availableFields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                            </select>
                            {conditions.length > 1 && (
                              <button
                                onClick={() => removeCondition(cond.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4, fontSize: 16, lineHeight: 1, flexShrink: 0 }}
                              >×</button>
                            )}
                          </div>
                          <select value={cond.operator} onChange={e => updateCondition(cond.id, 'operator', e.target.value)} style={selStyle}>
                            {OPERATORS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                          </select>
                          {cond.operator === 'between' ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input
                                type="number" placeholder="Min" value={cond.value}
                                onChange={e => updateCondition(cond.id, 'value', e.target.value)}
                                style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 13, outline: 'none' }}
                              />
                              <span style={{ color: '#9CA3AF', fontSize: 12, flexShrink: 0 }}>et</span>
                              <input
                                type="number" placeholder="Max" value={cond.value2}
                                onChange={e => updateCondition(cond.id, 'value2', e.target.value)}
                                style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 13, outline: 'none' }}
                              />
                            </div>
                          ) : (
                            <input
                              type="number" placeholder="Valeur" value={cond.value}
                              onChange={e => updateCondition(cond.id, 'value', e.target.value)}
                              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button
                    onClick={applyConditions}
                    disabled={conditions.every(c => c.value === '')}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 6, border: 'none',
                      background: conditions.every(c => c.value === '') ? '#E5E7EB' : '#1E2447',
                      color: conditions.every(c => c.value === '') ? '#9CA3AF' : 'white',
                      cursor: conditions.every(c => c.value === '') ? 'not-allowed' : 'pointer',
                      fontSize: 13, fontWeight: 700, letterSpacing: '0.03em',
                    }}
                  >
                    APPLIQUER
                  </button>
                  <button
                    onClick={() => setConditions(prev => [...prev, newCondition()])}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 6,
                      border: '1px solid #1E2447', background: 'white',
                      color: '#1E2447', cursor: 'pointer',
                      fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Ajouter une condition
                  </button>
                </div>
              </div>
            )}
          </div>

          <Tooltip title={showArchived ? "Retour aux dossiers actifs" : "Voir archives (Terminés/Perdus)"}>
            <IconButton
              onClick={() => setShowArchived(!showArchived)}
              sx={{
                bgcolor: showArchived ? '#DBEAFE' : 'white',
                color: showArchived ? '#1E40AF' : '#6B7280',
                border: '1px solid #E5E7EB',
                borderRadius: 2, height: 38, width: 38,
                '&:hover': { bgcolor: showArchived ? '#BFDBFE' : '#F9FAFB' },
              }}
            >
              <Archive size={20} />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto', background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 6px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              <tr>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nom Chiffrage</th>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Client</th>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    Statut
                    <IconButton size="small" onClick={(e) => setStatusFilterAnchor(e.currentTarget)} sx={{ p: 0.5, color: activeFilters.some(f => f.field === 'status') ? '#1E2447' : '#9CA3AF' }}>
                      <Filter size={14} />
                    </IconButton>
                  </div>
                </th>

                {/* Sortable Columns Helper */}
                {[
                  { key: 'ca_ht', label: 'Montant HT' },
                  ...(showKPIs ? [
                    { key: 'marge_pct', label: 'Contribution %' },
                    { key: 'marge_eur', label: 'Contribution €' },
                    { key: 'renta_hh', label: 'Contr. Horaire' },
                  ] : [])
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      {label}
                      {sortConfig.key === key ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : <ArrowUpDown size={14} style={{ opacity: 0.3 }} />}
                    </div>
                  </th>
                ))}

                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mise à jour</th>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    Chargé d'Affaires
                    <IconButton size="small" onClick={(e) => setOwnerFilterAnchor(e.currentTarget)} sx={{ p: 0.5, color: activeFilters.some(f => f.field === 'owner') ? '#1E2447' : '#9CA3AF' }}>
                      <Filter size={14} />
                    </IconButton>
                  </div>
                </th>
                <th style={{ padding: '12px 16px', width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Séparation parents / enfants
                const parents = filteredList.filter(m => !m.parentId);
                const childrenMap = filteredList.reduce((acc, m) => {
                  if (m.parentId) {
                    if (!acc[m.parentId]) acc[m.parentId] = [];
                    acc[m.parentId].push(m);
                  }
                  return acc;
                }, {});

                // Orphelins : variantes dont le parent n'est pas dans filteredList (ex: parent archivé)
                const visibleParentIds = new Set(parents.map(p => p.id));
                const orphans = filteredList.filter(m => m.parentId && !visibleParentIds.has(m.parentId));

                const renderRow = (m, isChild = false) => {
                  const statusInfo = STATUS_OPTIONS[m.status] || STATUS_OPTIONS.DRAFT;
                  const mpct = m.marge_pct || 0;
                  let mColor = '#F59E0B';
                  if (mpct > 60) mColor = '#10B981';
                  else if (mpct < 45) mColor = '#EF4444';
                  const children = childrenMap[m.id] || [];
                  const hasChildren = children.length > 0;
                  const isExpanded = expandedGroups.has(m.id);

                  return (
                    <React.Fragment key={m.id}>
                      <tr
                        className="minute-row"
                        style={{
                          borderBottom: '1px solid #F3F4F6',
                          cursor: 'pointer',
                          transition: 'background 0.1s',
                          background: isChild ? '#FAFAFA' : 'white',
                        }}
                        onClick={() => onOpenMinute?.(m.id)}
                        onMouseEnter={(e) => e.currentTarget.style.background = isChild ? '#F3F4F6' : '#F9FAFB'}
                        onMouseLeave={(e) => e.currentTarget.style.background = isChild ? '#FAFAFA' : 'white'}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {/* Indentation enfant */}
                            {isChild && <div style={{ width: 20, height: 1, borderLeft: '2px solid #E5E7EB', borderBottom: '2px solid #E5E7EB', marginLeft: 8, marginBottom: -8 }} />}
                            {/* Toggle groupe */}
                            {hasChildren && !isChild && (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleGroup(m.id); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#6B7280', display: 'flex', alignItems: 'center' }}
                              >
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </button>
                            )}
                            {!hasChildren && !isChild && <div style={{ width: 20 }} />}
                            <div>
                              <div style={{ fontWeight: 600, color: '#111827', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                                {m.name || "Minute sans nom"}
                                {isChild && (
                                  <span style={{ fontSize: 10, background: '#EFF6FF', color: '#1D4ED8', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                                    Variante
                                  </span>
                                )}
                                {hasChildren && (
                                  <span style={{ fontSize: 10, background: '#F3F4F6', color: '#6B7280', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                                    {children.length} variante{children.length > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                                v{m.version} • #{String(m.id || "").slice(-4)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 14, color: '#374151', fontWeight: 500 }}>
                          {m.client || "Client inconnu"}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <Chip
                            label={statusInfo.label}
                            size="small"
                            onClick={(e) => handleStatusClick(e, m.id)}
                            sx={{ bgcolor: statusInfo.bg, color: statusInfo.text, fontWeight: 700, fontSize: 11, height: 24, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
                          />
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 700, color: '#111827', fontSize: 14 }}>
                            {Math.round(m.ca_ht).toLocaleString("fr-FR")} €
                          </div>
                        </td>
                        {showKPIs && (
                          <>
                            <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div style={{ fontWeight: 700, color: mColor, fontSize: 14 }}>{Math.round(m.marge_pct)} %</div>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div style={{ fontSize: 14, color: '#4B5563' }}>{Math.round(m.marge_eur).toLocaleString("fr-FR")} €</div>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div style={{ fontWeight: 700, color: '#1E3A8A', fontSize: 14 }}>
                                {Math.round(m.renta_hh).toLocaleString("fr-FR")} <small style={{ fontSize: 10, color: '#9CA3AF' }}>€/h</small>
                              </div>
                            </td>
                          </>
                        )}
                        <td style={{ padding: '12px 16px', color: '#6B7280', fontSize: 13 }}>
                          {new Date(m.updatedAt || m.createdAt).toLocaleDateString("fr-FR")} <small>{new Date(m.updatedAt || m.createdAt).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}</small>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={(e) => handleOwnerClick(e, m.id)}>
                            <Avatar sx={{ width: 26, height: 26, fontSize: 11, bgcolor: stringToColor(m.owner || "?") }}>{(m.owner?.[0] || "?").toUpperCase()}</Avatar>
                            <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{m.owner || "—"}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <Tooltip title="Supprimer">
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); removeOne(m.id); }} sx={{ opacity: 0.4, '&:hover': { opacity: 1 } }}>
                              <Trash2 size={16} />
                            </IconButton>
                          </Tooltip>
                        </td>
                      </tr>
                      {/* Variantes dépliées */}
                      {hasChildren && isExpanded && children
                        .sort((a, b) => a.version - b.version)
                        .map(child => renderRow(child, true))
                      }
                    </React.Fragment>
                  );
                };

                const rows = [...parents.map(p => renderRow(p, false)), ...orphans.map(o => renderRow(o, true))];

                return rows.length > 0 ? rows : (
                  <tr>
                    <td colSpan={showKPIs ? 10 : 7} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
                      <FileText size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
                      <div>Aucun chiffrage trouvé.</div>
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>
      {
        newMinOpen && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setNewMinOpen(false)}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: 480, background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Nouvelle minute</h3>
                <IconButton onClick={() => setNewMinOpen(false)} size="small"><Trash2 size={18} style={{ transform: 'rotate(45deg)' }} /></IconButton>
              </div>
              <div style={{ display: "grid", gap: 16 }}>
                {/* Charge d'affaire */}
                <label>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>Chargé·e d’affaires</div>
                  <input style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #D1D5DB" }} value={newMin.charge} onChange={(e) => setNewMin(m => ({ ...m, charge: e.target.value }))} />
                </label>

                {/* Nom Projet */}
                <label>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>Nom du chiffrage *</div>
                  <input autoFocus style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #D1D5DB" }} value={newMin.projet} onChange={(e) => setNewMin(m => ({ ...m, projet: e.target.value }))} placeholder={`Ex: Villa Saint-Tropez`} />
                </label>

                {/* Client (New) */}
                <label>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>Client *</div>
                  <input style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #D1D5DB" }} value={newMin.client} onChange={(e) => setNewMin(m => ({ ...m, client: e.target.value }))} placeholder="Ex: M. Dupont" />
                </label>

                {/* Date de livraison estimée */}
                <label>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>Date de livraison estimée *</div>
                  <input type="date" style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #D1D5DB" }} value={newMin.deliveryDate} onChange={(e) => setNewMin(m => ({ ...m, deliveryDate: e.target.value }))} />
                </label>

                {/* Status */}
                <label>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>Statut</div>
                  <select
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #D1D5DB" }}
                    value={newMin.status}
                    onChange={(e) => setNewMin(m => ({ ...m, status: e.target.value }))}
                  >
                    {Object.entries(STATUS_OPTIONS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </label>

                {/* Modules */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 8 }}>Modules à inclure</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 16px' }}>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}><input type="checkbox" checked={newMin.modules.rideau} onChange={(e) => setNewMin(m => ({ ...m, modules: { ...m.modules, rideau: e.target.checked } }))} /> Rideaux</label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}><input type="checkbox" checked={newMin.modules.store} onChange={(e) => setNewMin(m => ({ ...m, modules: { ...m.modules, store: e.target.checked } }))} /> Stores</label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}><input type="checkbox" checked={newMin.modules.store_bateau} onChange={(e) => setNewMin(m => ({ ...m, modules: { ...m.modules, store_bateau: e.target.checked } }))} /> Stores Bateaux/Velum</label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}><input type="checkbox" checked={newMin.modules.coussins} onChange={(e) => setNewMin(m => ({ ...m, modules: { ...m.modules, coussins: e.target.checked } }))} /> Coussins</label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}><input type="checkbox" checked={newMin.modules.cache_sommier} onChange={(e) => setNewMin(m => ({ ...m, modules: { ...m.modules, cache_sommier: e.target.checked } }))} /> Cache Sommier</label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}><input type="checkbox" checked={newMin.modules.mobilier} onChange={(e) => setNewMin(m => ({ ...m, modules: { ...m.modules, mobilier: e.target.checked } }))} /> Mobilier</label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}><input type="checkbox" checked={newMin.modules.tenture_murale} onChange={(e) => setNewMin(m => ({ ...m, modules: { ...m.modules, tenture_murale: e.target.checked } }))} /> Tenture Murale</label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}><input type="checkbox" checked={newMin.modules.plaid} onChange={(e) => setNewMin(m => ({ ...m, modules: { ...m.modules, plaid: e.target.checked } }))} /> Plaids Chemin de lit</label>
                  </div>
                </div>

                {/* Note */}
                <label>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>Note</div>
                  <textarea rows={3} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #D1D5DB" }} value={newMin.note} onChange={(e) => setNewMin(m => ({ ...m, note: e.target.value }))} placeholder="Commentaire interne…" />
                </label>

                {/* Actions */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
                  <button onClick={() => setNewMinOpen(false)} style={{ background: 'white', border: '1px solid #D1D5DB', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>Annuler</button>
                  <button onClick={handleCreateMinute} disabled={isCreating || !newMin.charge.trim() || !newMin.projet.trim() || !newMin.client.trim() || !newMin.deliveryDate || !Object.values(newMin.modules).some(v => v === true)} style={{ background: '#1F2937', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', opacity: (isCreating || !newMin.projet.trim() || !newMin.client.trim() || !newMin.deliveryDate) ? 0.5 : 1 }}>{isCreating ? "Création..." : "Créer"}</button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      <Menu
        anchorEl={statusMenu.anchor}
        open={Boolean(statusMenu.anchor)}
        onClose={handleStatusClose}
      >
        {Object.entries(STATUS_OPTIONS).map(([key, opt]) => (
          <MenuItem key={key} onClick={() => handleStatusSelect(key)}>
            <Chip label={opt.label} size="small" sx={{ bgcolor: opt.bg, color: opt.text, fontWeight: 700, fontSize: 11, height: 24 }} />
          </MenuItem>
        ))}
      </Menu>

      {/* OWNER MENU */}
      <Menu
        anchorEl={ownerMenu.anchor}
        open={Boolean(ownerMenu.anchor)}
        onClose={handleOwnerClose}
      >
        {assignableUsers.length > 0 ? assignableUsers.map((u) => (
          <MenuItem key={u.id} onClick={() => handleOwnerSelect(u.name)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar sx={{ width: 24, height: 24, fontSize: 10, bgcolor: stringToColor(u.name) }}>{u.initials}</Avatar>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{u.name}</span>
              <span style={{ fontSize: 10, color: '#9CA3AF' }}>({u.role})</span>
            </div>
          </MenuItem>
        )) : (
          <MenuItem disabled><span style={{ fontSize: 12, color: '#9CA3AF' }}>Aucun utilisateur éligible (Admin/Sales)</span></MenuItem>
        )}
      </Menu>

      {/* FILTER MENUS */}
      <Menu
        anchorEl={statusFilterAnchor}
        open={Boolean(statusFilterAnchor)}
        onClose={() => setStatusFilterAnchor(null)}
      >
        <div style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' }}>Filtrer par statut</div>
        {Object.entries(STATUS_OPTIONS).map(([key, opt]) => (
          <MenuItem key={key} onClick={() => toggleFilter('status', key, `Statut: ${opt.label}`)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
              <input type="checkbox" checked={activeFilters.some(f => f.id === `status_${key}`)} readOnly />
              <Chip label={opt.label} size="small" sx={{ bgcolor: opt.bg, color: opt.text, fontWeight: 700, fontSize: 11, height: 24 }} />
            </div>
          </MenuItem>
        ))}
      </Menu>

      <Menu
        anchorEl={ownerFilterAnchor}
        open={Boolean(ownerFilterAnchor)}
        onClose={() => setOwnerFilterAnchor(null)}
      >
        <div style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' }}>Filtrer par chargé d'affaires</div>
        {users.filter(u => u.role === ROLES.ADMIN || u.role === ROLES.ADV || u.role === 'sales').map((u) => (
          <MenuItem key={u.id} onClick={() => toggleFilter('owner', u.name, `CA: ${u.name}`)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
              <input type="checkbox" checked={activeFilters.some(f => f.id === `owner_${u.name}`)} readOnly />
              <Avatar sx={{ width: 24, height: 24, fontSize: 10, bgcolor: stringToColor(u.name) }}>{u.initials}</Avatar>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{u.name}</span>
            </div>
          </MenuItem>
        ))}
      </Menu>
    </div >
  );
}