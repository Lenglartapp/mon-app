import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, Wrench, ArrowUp, ArrowDown, ArrowUpDown, Clock, X } from 'lucide-react';
import PerformanceEntryModal from './PerformanceEntryModal';
import PerformanceHistoriqueModal from './PerformanceHistoriqueModal';
import { RAISONS_CATALOGUE } from './PerformanceEntryModal';
import { differenceInMinutes, subMonths, startOfDay } from 'date-fns';

const SERVICE_KEYS = ['conf', 'prepa', 'pose'];
const SERVICE_LABELS = { conf: 'Confection', prepa: 'Préparation', pose: 'Pose' };

function computeRealized(events, projectId, consumedImport = {}) {
  const counts = {
    prepa: Number(consumedImport?.prepa) || 0,
    conf:  Number(consumedImport?.conf)  || 0,
    pose:  Number(consumedImport?.pose)  || 0,
  };
  if (!events || !projectId) return counts;
  events
    .filter(e => e.meta?.projectId === projectId && e.meta?.status === 'validated')
    .forEach(evt => {
      const start = new Date(evt.meta?.start);
      const end = new Date(evt.meta?.end);
      const raw = differenceInMinutes(end, start);
      const net = raw > 300 ? raw - 60 : raw;
      const hours = Math.max(0, net / 60);
      const type = (evt.type || '').toLowerCase();
      if (type === 'rdv' || type === 'prepa' || type === 'metrage') counts.prepa += hours;
      else if (type === 'atelier' || type === 'conf' || type === 'confection') counts.conf += hours;
      else if (type === 'chantier' || type === 'pose' || type === 'installation') counts.pose += hours;
    });
  return counts;
}

function getQuarterBounds(offset = 0) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const currentQ = Math.floor(month / 3);

  let q = currentQ - offset;
  let y = year;
  while (q < 0) { q += 4; y -= 1; }
  while (q > 3) { q -= 4; y += 1; }

  const from = new Date(y, q * 3, 1);
  const to   = new Date(y, q * 3 + 3, 0, 23, 59, 59); // dernier jour du trimestre
  return { from, to };
}

function getPeriodeCutoffs(filters) {
  const now = new Date();
  switch (filters.periode) {
    case 'current_q': {
      const { from } = getQuarterBounds(0);
      return { from: startOfDay(from), to: null };
    }
    case 'last_q': {
      const { from, to } = getQuarterBounds(1);
      return { from: startOfDay(from), to };
    }
    case 'last2_q': {
      const { from } = getQuarterBounds(1);
      return { from: startOfDay(from), to: null };
    }
    case '6':
      return { from: startOfDay(subMonths(now, 6)), to: null };
    case '12':
      return { from: startOfDay(subMonths(now, 12)), to: null };
    case 'custom':
      return {
        from: filters.dateFrom ? startOfDay(new Date(filters.dateFrom)) : null,
        to:   filters.dateTo   ? new Date(filters.dateTo + 'T23:59:59') : null,
      };
    default:
      return { from: null, to: null };
  }
}

function EcartBadge({ alloc, real, small }) {
  if (!alloc) return <span style={{ color: '#9CA3AF', fontSize: 12 }}>—</span>;
  const ecart = real - alloc;
  const pct = Math.round((ecart / alloc) * 100);
  const color = pct > 20 ? '#EF4444' : pct > 0 ? '#F59E0B' : '#10B981';
  const bg   = pct > 20 ? '#FEF2F2' : pct > 0 ? '#FFFBEB' : '#F0FDF4';
  const sign = ecart >= 0 ? '+' : '';
  return (
    <span style={{ background: bg, color, borderRadius: 99, padding: small ? '1px 6px' : '2px 8px', fontSize: small ? 11 : 12, fontWeight: 700 }}>
      {sign}{ecart.toFixed(1)}h ({sign}{pct}%)
    </span>
  );
}

// ── Dropdown inline raisons ───────────────────────────────────────────────────
function RaisonsCell({ raisons, onSave }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(raisons || []);
  const [autre, setAutre] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [displayed, setDisplayed] = useState(raisons || []);
  const ref = useRef();
  const triggerRef = useRef();

  useEffect(() => { setDisplayed(raisons || []); }, [raisons]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target) && !triggerRef.current?.contains(e.target)) commit(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, draft, autre]);

  const toggle = (r) => setDraft(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);

  const commit = () => {
    const final = draft.filter(r => r !== 'Autre')
      .concat(draft.includes('Autre') && autre.trim() ? [autre.trim()] : []);
    setDisplayed(final);
    onSave(final);
    setOpen(false);
  };

  const handleOpen = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, left: rect.left });
    setDraft(raisons || []);
    setOpen(true);
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={triggerRef}
        onClick={handleOpen}
        style={{ cursor: 'pointer', display: 'flex', flexWrap: 'wrap', gap: 4, minWidth: 80, padding: '3px 6px', borderRadius: 6, border: '1px solid transparent', transition: 'border 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.border = '1px solid #E5E7EB'}
        onMouseLeave={e => !open && (e.currentTarget.style.border = '1px solid transparent')}
      >
        {displayed.length === 0
          ? <span style={{ color: '#D1D5DB', fontSize: 12 }}>—</span>
          : displayed.map(r => <span key={r} style={{ background: '#F3F4F6', color: '#374151', borderRadius: 4, padding: '2px 6px', fontSize: 11 }}>{r}</span>)}
      </div>
      {open && (
        <div ref={ref} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 12, minWidth: 260 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 8 }}>Raisons</div>
          {RAISONS_CATALOGUE.map(r => (
            <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', cursor: 'pointer', fontSize: 13, color: '#374151', borderRadius: 4 }}
              onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <input type="checkbox" checked={draft.includes(r)} onChange={() => toggle(r)} style={{ accentColor: '#1E2447' }} />
              {r}
            </label>
          ))}
          {draft.includes('Autre') && (
            <input autoFocus value={autre} onChange={e => setAutre(e.target.value)} placeholder="Précisez..."
              style={{ marginTop: 6, width: '100%', boxSizing: 'border-box', border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 8px', fontSize: 13, outline: 'none' }} />
          )}
          <button onClick={commit} style={{ marginTop: 10, width: '100%', background: '#1E2447', color: 'white', border: 'none', borderRadius: 6, padding: '7px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Valider</button>
        </div>
      )}
    </div>
  );
}

// ── Commentaire inline ────────────────────────────────────────────────────────
function CommentaireCell({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const commit = () => { onSave(draft); setEditing(false); };
  if (editing) return (
    <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      style={{ width: '100%', border: '1px solid #6366F1', borderRadius: 6, padding: '4px 8px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
    />
  );
  return (
    <div onClick={() => { setDraft(value || ''); setEditing(true); }}
      style={{ cursor: 'pointer', fontSize: 13, color: value ? '#374151' : '#D1D5DB', padding: '3px 6px', borderRadius: 6, border: '1px solid transparent', transition: 'border 0.15s', minWidth: 80 }}
      onMouseEnter={e => e.currentTarget.style.border = '1px solid #E5E7EB'}
      onMouseLeave={e => e.currentTarget.style.border = '1px solid transparent'}
    >{value || '—'}</div>
  );
}

// ── SAV inline ────────────────────────────────────────────────────────────────
function SavCell({ hasSav, onToggle }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, userSelect: 'none' }}>
      <input type="checkbox" checked={hasSav} onChange={e => onToggle(e.target.checked)} style={{ accentColor: '#EA580C', width: 15, height: 15 }} />
      {hasSav
        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#FFF7ED', color: '#EA580C', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}><Wrench size={10} /> SAV</span>
        : <span style={{ color: '#D1D5DB' }}>Non</span>}
    </label>
  );
}

// ── Icône tri ─────────────────────────────────────────────────────────────────
function SortIcon({ col, sortKey, sortDir }) {
  if (sortKey !== col) return <ArrowUpDown size={12} color="#D1D5DB" />;
  return sortDir === 'asc' ? <ArrowUp size={12} color="#6366F1" /> : <ArrowDown size={12} color="#6366F1" />;
}

// ── Sélecteur de période (dropdown style planning) ───────────────────────────
const PERIODE_PRESETS = [
  { key: 'last_q',    label: 'T-1' },
  { key: 'current_q', label: 'T actuel' },
  { key: '6',         label: '6 mois' },
  { key: '12',        label: '1 an' },
  { key: 'all',       label: 'Tout' },
];

function PeriodeDropdown({ filters, onChange }) {
  const [open, setOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(filters.dateFrom || '');
  const [tempTo, setTempTo]     = useState(filters.dateTo   || '');
  const ref = useRef();

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const currentLabel = PERIODE_PRESETS.find(p => p.key === filters.periode)?.label
    || (filters.periode === 'custom' ? 'Période perso.' : 'T-1');

  const applyCustom = () => {
    if (tempFrom && tempTo) {
      onChange('dateFrom', tempFrom);
      onChange('dateTo', tempTo);
      onChange('periode', 'custom');
      setOpen(false);
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)} style={{
        background: 'white', border: '1px solid #E5E7EB', borderRadius: 8,
        padding: '6px 12px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 8, color: '#374151',
        boxShadow: open ? '0 0 0 2px #E0E7FF' : 'none',
      }}>
        {currentLabel} <ChevronDown size={14} color="#9CA3AF" />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 90, background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', width: 220, padding: 4 }}>
          <div style={{ paddingBottom: 4, borderBottom: '1px solid #F3F4F6' }}>
            {PERIODE_PRESETS.map(o => (
              <div key={o.key} onClick={() => { onChange('periode', o.key); setOpen(false); }} style={{
                padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 4,
                background: filters.periode === o.key ? '#EFF6FF' : 'transparent',
                color: filters.periode === o.key ? '#2563EB' : '#374151',
                fontWeight: filters.periode === o.key ? 600 : 400,
              }}>{o.label}</div>
            ))}
          </div>
          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Période personnalisée</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
              <input type="date" value={tempFrom} onChange={e => setTempFrom(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #E5E7EB', borderRadius: 6, padding: '5px 8px', fontSize: 12, outline: 'none' }} />
              <input type="date" value={tempTo} onChange={e => setTempTo(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #E5E7EB', borderRadius: 6, padding: '5px 8px', fontSize: 12, outline: 'none' }} />
            </div>
            <button onClick={applyCustom} style={{ width: '100%', background: '#1E2447', color: 'white', border: 'none', borderRadius: 6, padding: '6px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Appliquer</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Panneau de filtres (toujours visible) ─────────────────────────────────────
function FilterPanel({ filters, onChange, managers, allRaisons, onReset }) {
  const selectStyle = { border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 10px', fontSize: 13, outline: 'none', background: 'white', color: '#374151' };
  const labelStyle  = { fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4, display: 'block' };

  return (
    <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end' }}>

      {/* Période */}
      <div>
        <label style={labelStyle}>Période (clôture)</label>
        <PeriodeDropdown filters={filters} onChange={onChange} />
      </div>

      {/* Service */}
      <div>
        <label style={labelStyle}>Service</label>
        <select style={selectStyle} value={filters.service} onChange={e => onChange('service', e.target.value)}>
          <option value="">Tous</option>
          <option value="conf">Confection</option>
          <option value="prepa">Préparation</option>
          <option value="pose">Pose</option>
        </select>
      </div>

      {/* Responsable */}
      <div>
        <label style={labelStyle}>Responsable</label>
        <select style={selectStyle} value={filters.manager} onChange={e => onChange('manager', e.target.value)}>
          <option value="">Tous</option>
          {managers.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Raison */}
      <div>
        <label style={labelStyle}>Raison</label>
        <select style={selectStyle} value={filters.raison} onChange={e => onChange('raison', e.target.value)}>
          <option value="">Toutes</option>
          {allRaisons.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Écart */}
      <div>
        <label style={labelStyle}>Écart</label>
        <select style={selectStyle} value={filters.ecart} onChange={e => onChange('ecart', e.target.value)}>
          <option value="">Tous</option>
          <option value="over">Dépassement uniquement</option>
          <option value="ok">Dans les temps</option>
        </select>
      </div>

      {/* Reset */}
      <button onClick={onReset} style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid #E5E7EB', background: 'white', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: '#9CA3AF' }}>
        <X size={12} /> Réinitialiser
      </button>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
const DEFAULT_FILTERS = { periode: 'last2_q', manager: '', raison: '', ecart: '', service: '', dateFrom: '', dateTo: '' };

export default function PerformanceDataTab({ projects, events, entries, onUpsertEntry, canEdit }) {
  const [expanded, setExpanded] = useState(new Set());
  const [sortKey, setSortKey]   = useState('archived_at');
  const [sortDir, setSortDir]   = useState('desc');
  const [search, setSearch]     = useState('');
  const [filters, setFilters]   = useState(DEFAULT_FILTERS);
  const [detailModal, setDetailModal] = useState(null);
  const [histoModal, setHistoModal]   = useState(null);

  const entryMap = useMemo(() => {
    const m = {};
    entries.forEach(e => { m[`${e.project_id}_${e.service}`] = e; });
    return m;
  }, [entries]);

  const toggleExpand = (id) => setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const cycleSort = (col) => { if (sortKey === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(col); setSortDir('asc'); } };
  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));
  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  // Projets archivés seulement, enrichis
  const enriched = useMemo(() => {
    return projects
      .filter(p => p.status === 'ARCHIVED')
      .map(p => {
        const realized = computeRealized(events, p.id, p.consumed_import);
        const totalAlloc = SERVICE_KEYS.reduce((s, k) => s + Number(p.budget?.[k] || 0), 0);
        const totalReal  = SERVICE_KEYS.reduce((s, k) => s + (realized[k] || 0), 0);
        const ecartPct   = totalAlloc > 0 ? Math.round(((totalReal - totalAlloc) / totalAlloc) * 100) : 0;
        const archivedAt = p.updated_at ? new Date(p.updated_at) : null;
        return { project: p, realized, totalAlloc, totalReal, ecartPct, archivedAt };
      });
  }, [projects, events]);

  // Listes pour les filtres
  const allManagers = useMemo(() => [...new Set(enriched.map(d => d.project.manager).filter(Boolean))].sort(), [enriched]);
  const allRaisons  = useMemo(() => {
    const s = new Set();
    entries.forEach(e => (e.raisons || []).forEach(r => s.add(r)));
    return [...s].sort();
  }, [entries]);

  // Filtrage
  const filtered = useMemo(() => {
    let list = enriched;

    // Période
    const { from, to } = getPeriodeCutoffs(filters);
    if (from) list = list.filter(d => d.archivedAt && d.archivedAt >= from);
    if (to)   list = list.filter(d => d.archivedAt && d.archivedAt <= to);

    // Responsable
    if (filters.manager) list = list.filter(d => d.project.manager === filters.manager);

    // Raison (au moins un service du projet a cette raison, sur le service filtré si applicable)
    if (filters.raison) {
      const svcsToCheck = filters.service ? [filters.service] : SERVICE_KEYS;
      list = list.filter(d => svcsToCheck.some(svc => {
        const entry = entryMap[`${d.project.id}_${svc}`];
        return entry?.raisons?.includes(filters.raison);
      }));
    }

    // Écart (calculé sur le service filtré si applicable)
    if (filters.ecart) {
      list = list.filter(d => {
        const alloc = filters.service
          ? Number(d.project.budget?.[filters.service] || 0)
          : d.totalAlloc;
        const real = filters.service
          ? (d.realized[filters.service] || 0)
          : d.totalReal;
        const pct = alloc > 0 ? ((real - alloc) / alloc) * 100 : 0;
        return filters.ecart === 'over' ? pct > 0 : pct <= 0;
      });
    }

    // Recherche texte
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d => (d.project.name || '').toLowerCase().includes(q) || (d.project.manager || '').toLowerCase().includes(q));
    }

    // Tri
    return [...list].sort((a, b) => {
      let va, vb;
      if (sortKey === 'name')        { va = a.project.name || ''; vb = b.project.name || ''; return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va); }
      if (sortKey === 'manager')     { va = a.project.manager || ''; vb = b.project.manager || ''; return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va); }
      if (sortKey === 'alloc')       { va = a.totalAlloc; vb = b.totalAlloc; }
      if (sortKey === 'real')        { va = a.totalReal;  vb = b.totalReal; }
      if (sortKey === 'ecart')       { va = a.ecartPct;   vb = b.ecartPct; }
      if (sortKey === 'archived_at') { va = a.archivedAt?.getTime() || 0; vb = b.archivedAt?.getTime() || 0; }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [enriched, filters, search, sortKey, sortDir, entryMap]);

  const saveField = async (project, service, field, value) => {
    const existing = entryMap[`${project.id}_${service}`] || {};
    await onUpsertEntry({
      id: existing.id,
      project_id: project.id,
      service,
      raisons:     existing.raisons     || [],
      commentaire: existing.commentaire || '',
      has_sav:     existing.has_sav     || false,
      heures_sav:  existing.heures_sav  || 0,
      [field]: value,
    });
  };

  const thBtn = (col, label) => (
    <button onClick={() => cycleSort(col)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: sortKey === col ? '#6366F1' : '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', padding: 0 }}>
      {label} <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
    </button>
  );

  return (
    <div>
      {/* Filtres en en-tête */}
      <FilterPanel filters={filters} onChange={setFilter} managers={allManagers} allRaisons={allRaisons} onReset={resetFilters} />

      {/* Barre supérieure */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>{filtered.length} projet{filtered.length > 1 ? 's' : ''} archivé{filtered.length > 1 ? 's' : ''}</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
          style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: '7px 12px', fontSize: 13, outline: 'none', width: 240, background: 'white' }}
        />
      </div>

      {/* Tableau */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
              <th style={{ ...TH, width: 32 }} />
              <th style={TH}>{thBtn('name', 'Projet')}</th>
              <th style={TH}>{thBtn('manager', 'Responsable')}</th>
              <th style={{ ...TH, textAlign: 'right' }}>{thBtn('alloc', 'Alloué')}</th>
              <th style={{ ...TH, textAlign: 'right' }}>{thBtn('real', 'Consommé')}</th>
              <th style={{ ...TH, textAlign: 'center' }}>{thBtn('ecart', 'Écart')}</th>
              <th style={TH}>SAV</th>
              <th style={TH}>Raisons</th>
              <th style={TH}>Commentaire</th>
              <th style={{ ...TH, textAlign: 'center', width: 80 }}>{thBtn('archived_at', 'Clôture')}</th>
              <th style={{ ...TH, textAlign: 'center', width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={11} style={{ padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
                {projects.filter(p => p.status === 'ARCHIVED').length === 0
                  ? 'Aucun projet archivé pour l\'instant.'
                  : 'Aucun projet ne correspond aux filtres.'}
              </td></tr>
            )}

            {filtered.map(({ project, realized, totalAlloc, totalReal, archivedAt }) => {
              const isExpanded = expanded.has(project.id);

              // Totaux affichés selon le filtre service
              const dispAlloc = filters.service ? Number(project.budget?.[filters.service] || 0) : totalAlloc;
              const dispReal  = filters.service ? (realized[filters.service] || 0) : totalReal;

              // Services affichés dans le détail
              const visibleServices = filters.service ? [filters.service] : SERVICE_KEYS;

              return (
                <React.Fragment key={project.id}>
                  {/* Ligne projet */}
                  <tr style={{ borderBottom: isExpanded ? 'none' : '1px solid #F3F4F6', background: isExpanded ? '#F8F9FF' : 'white', cursor: 'pointer' }}
                    onClick={() => toggleExpand(project.id)}>
                    <td style={{ padding: '12px 8px 12px 16px', color: '#9CA3AF' }}>
                      {isExpanded ? <ChevronDown size={16} color="#6366F1" /> : <ChevronRight size={16} />}
                    </td>
                    <td style={{ padding: '12px 4px' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{project.name || 'Sans nom'}</div>
                      {project.client && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{project.client}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>
                      {project.manager || <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 600, color: '#374151' }}>
                      {dispAlloc > 0 ? `${dispAlloc.toFixed(1)}h` : <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 600, color: '#374151' }}>
                      {dispAlloc > 0 ? `${dispReal.toFixed(1)}h` : <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {dispAlloc > 0 ? <EcartBadge alloc={dispAlloc} real={dispReal} /> : <span style={{ color: '#D1D5DB', fontSize: 12 }}>—</span>}
                    </td>
                    <td colSpan={3} style={{ padding: '12px 16px', fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>
                      {isExpanded ? 'Replier' : 'Voir le détail par service →'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, color: '#9CA3AF' }}>
                      {archivedAt ? archivedAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                    </td>
                    <td />
                  </tr>

                  {/* Lignes service */}
                  {isExpanded && visibleServices.map((svc, i) => {
                    const alloc = Number(project.budget?.[svc] || 0);
                    const real  = realized[svc] || 0;
                    const entry = entryMap[`${project.id}_${svc}`];
                    const isLast = i === visibleServices.length - 1;

                    return (
                      <tr key={`${project.id}_${svc}`} style={{ borderBottom: isLast ? '2px solid #E5E7EB' : '1px solid #F3F4F6', background: '#FAFBFF' }}>
                        <td style={{ padding: '9px 8px 9px 24px', color: '#C4B5FD', fontSize: 16 }}>└</td>
                        <td style={{ padding: '9px 4px', fontSize: 13, color: '#6B7280', fontWeight: 500 }}>{SERVICE_LABELS[svc]}</td>
                        <td style={{ padding: '9px 16px' }} />
                        <td style={{ padding: '9px 16px', textAlign: 'right', fontSize: 13, color: '#374151' }}>
                          {alloc > 0 ? `${alloc}h` : <span style={{ color: '#E5E7EB' }}>—</span>}
                        </td>
                        <td style={{ padding: '9px 16px', textAlign: 'right', fontSize: 13, color: '#374151' }}>
                          {alloc > 0 ? `${real.toFixed(1)}h` : <span style={{ color: '#E5E7EB' }}>—</span>}
                        </td>
                        <td style={{ padding: '9px 16px', textAlign: 'center' }}>
                          {alloc > 0 ? <EcartBadge alloc={alloc} real={real} small /> : <span style={{ color: '#E5E7EB', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ padding: '9px 16px' }} onClick={e => e.stopPropagation()}>
                          {alloc > 0 && <SavCell hasSav={entry?.has_sav || false} onToggle={val => saveField(project, svc, 'has_sav', val)} />}
                        </td>
                        <td style={{ padding: '9px 8px' }} onClick={e => e.stopPropagation()}>
                          {alloc > 0 && <RaisonsCell raisons={entry?.raisons || []} onSave={val => saveField(project, svc, 'raisons', val)} />}
                        </td>
                        <td style={{ padding: '9px 8px' }} onClick={e => e.stopPropagation()}>
                          {alloc > 0 && <CommentaireCell value={entry?.commentaire || ''} onSave={val => saveField(project, svc, 'commentaire', val)} />}
                        </td>
                        <td style={{ padding: '9px 16px' }} />
                        {/* Bouton Historique */}
                        <td style={{ padding: '9px 12px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          {alloc > 0 && (
                            <button
                              onClick={() => setHistoModal({ project, service: svc, entry })}
                              title="Voir l'historique de saisie"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid #E5E7EB', background: 'white', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer', color: '#6B7280' }}
                            >
                              <Clock size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {detailModal && (
        <PerformanceEntryModal project={detailModal.project} service={detailModal.service} existingEntry={detailModal.entry} onSave={onUpsertEntry} onClose={() => setDetailModal(null)} />
      )}
      {histoModal && (
        <PerformanceHistoriqueModal project={histoModal.project} service={histoModal.service} entry={histoModal.entry} onClose={() => setHistoModal(null)} />
      )}
    </div>
  );
}

const TH = {
  padding: '10px 16px',
  fontSize: 11, fontWeight: 700,
  color: '#9CA3AF', textTransform: 'uppercase',
  letterSpacing: '0.5px', textAlign: 'left',
};
