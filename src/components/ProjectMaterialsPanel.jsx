import React, { useEffect, useMemo, useState } from 'react';
import Popover from '@mui/material/Popover';
import { DataGrid } from '@mui/x-data-grid';
import { frFR } from '@mui/x-data-grid/locales';
import { Plus, Trash2, Library } from 'lucide-react';
import DaDialog, { DaTabs } from './ui/DaDialog';
import { ToolbarSearch, ToolbarButton } from './ui/ToolbarControls';
import { DATAGRID_DA_SX, TABLE_FRAME_STYLE } from '../lib/constants/daStyles';
import { SCHEMA_64 } from '../lib/schemas/production';
import { uid } from '../lib/utils/uid';
import { useCatalog, useCatalogRail } from '../hooks/useSupabase';
import { supabase } from '../lib/supabaseClient';
import { buildUsage } from '../lib/catalogUsage';
import UsagePopover from './catalog/UsagePopover';
import { usageColumn } from './catalog/usageColumn';

const TABS = [
  { key: 'Tissu',         label: 'Tissus',        categories: ['Tissu', 'Tissus', 'Doublure', 'Doublures', 'Inter', 'Confection'] },
  { key: 'Rail',          label: 'Rails',          categories: ['Rail', 'Rails', 'Tringle', 'Mécanisme', 'Mecanisme'] },
  { key: 'Store',         label: 'Stores',         categories: ['Store', 'Stores', 'Mecanisme Store'] },
  { key: 'Passementerie', label: 'Passementerie',  categories: ['Passementerie'] },
];
const inTab = (tab, m) => tab.categories.some(c => c.toLowerCase() === (m.category || '').toLowerCase());

// Libellé de la colonne d'une ligne de projet qui référence l'article (« Tissu 1 »…).
const FIELD_LABELS = Object.fromEntries((SCHEMA_64 || []).map((c) => [c.key, c.label]));
const EXTRA_LABELS = { mecanisme_store: 'Méca Store', toile_finition_1: 'Toile', interdoublure: 'Interdoublure' };
const fieldLabel = (k) => FIELD_LABELS[k] || EXTRA_LABELS[k] || k;

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const nameFromParts = (r) => [r.provider, r.reference, r.color].map(clean).filter(Boolean).join(' ');

const parseDecimal = (value) => {
  const n = parseFloat(String(value ?? '').trim().replace(',', '.'));
  return Number.isNaN(n) ? value : n;
};

// ─── Ajout depuis le catalogue général ───────────────────────────────────────
function CatalogSearch({ globalCatalog, projectMaterials, activeTab, onAdd }) {
  const [search, setSearch] = useState('');
  const existing = useMemo(() => new Set(projectMaterials.map(m => m.name)), [projectMaterials]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [];
    return globalCatalog
      .filter(a => a.name?.toLowerCase().includes(q) && !existing.has(a.name) && inTab(activeTab, a))
      .slice(0, 10);
  }, [search, globalCatalog, existing, activeTab]);

  const pick = (article) => {
    onAdd({
      id: uid(),
      name: article.name,
      provider: clean(article.provider),
      reference: clean(article.reference),
      color: clean(article.color),
      category: activeTab.key,
      width: Number(article.width || article.laize || 0),
      motif: Boolean(article.motif),
      raccord_v: Number(article.raccord_v || 0),
      raccord_h: Number(article.raccord_h || 0),
    });
    setSearch('');
  };

  return (
    <div style={{ width: 420, padding: 12 }}>
      <ToolbarSearch value={search} onChange={setSearch} placeholder={`Rechercher (${activeTab.label.toLowerCase()})…`} width="100%" />
      {filtered.length > 0 && (
        <div style={{ marginTop: 6, border: '1px solid #E0DED9', borderRadius: 8, overflow: 'hidden' }}>
          {filtered.map((article, i) => (
            <div
              key={article.id || i}
              onClick={() => pick(article)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', cursor: 'pointer', fontSize: 13, background: '#fff', borderBottom: i < filtered.length - 1 ? '1px solid #E8E6E2' : 'none' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F7F7F5'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600, color: '#111827' }}>{article.name}</span>
                {article.width > 0 && <span style={{ marginLeft: 8, color: '#6B7280', fontSize: 12 }}>{article.width} cm</span>}
              </div>
              <Plus size={14} color="#1E2447" style={{ flexShrink: 0, marginLeft: 8 }} />
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 12, color: '#9CA3AF', padding: '6px 2px 0' }}>
        {search.trim() && filtered.length === 0 ? 'Aucun résultat dans le catalogue général.' : 'Cliquer un article pour l\'ajouter au projet.'}
      </div>
    </div>
  );
}

// ─── Matériauthèque du projet (même présentation que la Bibliothèque du chiffrage) ──
export default function ProjectMaterialsPanel({ open, onClose, materials = [], onMaterialsChange, rows = null, sourceMinuteId = null }) {
  const { catalog: globalCatalog } = useCatalog();
  const { catalogRails } = useCatalogRail();
  const [activeTabKey, setActiveTabKey] = useState('Tissu');
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState([]);
  const [usageAnchor, setUsageAnchor] = useState(null);
  const [catalogAnchor, setCatalogAnchor] = useState(null);
  const [minuteCatalog, setMinuteCatalog] = useState([]);

  // Fournisseur / référence / coloris : les articles repris d'un chiffrage ne portent
  // que leur nom complet. On les retrouve dans la bibliothèque du chiffrage d'origine
  // (à défaut, le catalogue général) ; ils sont enregistrés au premier changement.
  useEffect(() => {
    if (!open || !sourceMinuteId) return undefined;
    let alive = true;
    supabase.from('minutes').select('catalog').eq('id', sourceMinuteId).maybeSingle()
      .then(({ data }) => { if (alive && Array.isArray(data?.catalog)) setMinuteCatalog(data.catalog); });
    return () => { alive = false; };
  }, [open, sourceMinuteId]);

  const allGlobal = useMemo(() => [...(globalCatalog || []), ...(catalogRails || [])], [globalCatalog, catalogRails]);
  const infoByName = useMemo(() => {
    const map = new Map();
    [...allGlobal, ...minuteCatalog].forEach((a) => {
      if (a?.name && (a.provider || a.reference || a.color)) map.set(a.name, a);
    });
    return map;
  }, [allGlobal, minuteCatalog]);

  const activeTab = TABS.find(t => t.key === activeTabKey) || TABS[0];

  // Lignes affichées : article du projet complété (fournisseur / réf / coloris).
  const displayRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return materials
      .filter(m => m && inTab(activeTab, m))
      .map((m) => {
        const info = infoByName.get(m.name);
        const has = m.provider || m.reference || m.color;
        return {
          ...m,
          id: m.id || m.name,
          provider: clean(has ? m.provider : info?.provider),
          reference: clean(has ? m.reference : info?.reference),
          color: clean(has ? m.color : info?.color),
        };
      })
      .filter(r => !q || [r.name, r.provider, r.reference, r.color].join(' ').toLowerCase().includes(q));
  }, [materials, activeTab, infoByName, search]);

  const usage = useMemo(() => {
    if (!Array.isArray(rows)) return null;
    return buildUsage(rows, new Set(materials.map(m => m?.name).filter(Boolean)), fieldLabel);
  }, [rows, materials]);
  const usageList = usageAnchor ? (usage?.get(usageAnchor.name) || []) : [];

  const tabsWithCounts = TABS.map(t => {
    const n = materials.filter(m => m && inTab(t, m)).length;
    return { key: t.key, label: `${t.label}${n > 0 ? ` (${n})` : ''}` };
  });

  const handleAdd = (item) => { onMaterialsChange([...materials, item]); setCatalogAnchor(null); };

  const handleAddBlank = () => {
    onMaterialsChange([...materials, {
      id: uid(), name: 'Nouvel article (à compléter)', provider: '', reference: '', color: '',
      category: activeTab.key, width: 0, motif: false, raccord_v: 0, raccord_h: 0,
    }]);
  };

  const handleDelete = () => {
    const ids = new Set(selection);
    onMaterialsChange(materials.filter(m => !ids.has(m.id || m.name)));
    setSelection([]);
  };

  // Le NOM est la clé du lien article ↔ lignes ; un renommage est reporté sur les
  // lignes par l'appelant (applyCatalogRenames). Il est recomposé (Fournisseur +
  // Référence + Coloris, comme au chiffrage) quand l'un des trois change, SEULEMENT
  // s'il en était déjà la composition : un article saisi à la main (« ZIMMER & RHODE
  // Moon 1311 11 ») garde son nom quand on complète son fournisseur. Il reste
  // modifiable directement dans « Nom complet ».
  // La laize et les raccords se reportent d'eux-mêmes au prochain recalcul.
  const processRowUpdate = (newRow, oldRow) => {
    const partsChanged = ['provider', 'reference', 'color'].some(k => clean(newRow[k]) !== clean(oldRow[k]));
    const composed = clean(oldRow.name) === nameFromParts(oldRow);
    let name = oldRow.name;
    if (clean(newRow.name) && clean(newRow.name) !== clean(oldRow.name)) name = clean(newRow.name);
    else if (partsChanged && composed) name = nameFromParts(newRow) || oldRow.name;
    const rv = Number(newRow.raccord_v) || 0;
    const rh = Number(newRow.raccord_h) || 0;
    const updated = {
      ...newRow,
      name,
      provider: clean(newRow.provider),
      reference: clean(newRow.reference),
      color: clean(newRow.color),
      width: Number(newRow.width) || 0,
      raccord_v: rv,
      raccord_h: rh,
      motif: Boolean(newRow.motif) || rv > 0 || rh > 0,
    };
    onMaterialsChange(materials.map(m => ((m.id || m.name) === newRow.id ? { ...m, ...updated, id: m.id || updated.id } : m)));
    return updated;
  };

  const columns = useMemo(() => {
    const cols = [
      { field: 'provider', headerName: 'Fournisseur', width: 140, editable: true },
      { field: 'reference', headerName: 'Référence', width: 140, editable: true },
      { field: 'color', headerName: 'Coloris', width: 120, editable: true },
      { field: 'name', headerName: 'Nom complet', width: 250, editable: true, description: 'Nom utilisé dans les lignes (Fournisseur + Réf + Coloris). Le modifier met les lignes à jour.' },
    ];
    if (activeTabKey === 'Tissu') {
      cols.push(
        { field: 'width', headerName: 'Laize', description: 'Laize (cm)', width: 80, editable: true, type: 'number', valueParser: parseDecimal },
        { field: 'motif', headerName: 'Motif', description: 'Tissu à motif ?', width: 70, editable: true, type: 'boolean' },
        { field: 'raccord_v', headerName: 'Racc. V', description: 'Raccord vertical (cm)', width: 85, editable: true, type: 'number', valueParser: parseDecimal },
        { field: 'raccord_h', headerName: 'Racc. H', description: 'Raccord horizontal (cm)', width: 85, editable: true, type: 'number', valueParser: parseDecimal },
      );
    }
    if (usage) cols.push(usageColumn(usage, setUsageAnchor, 'du projet'));
    return cols.map(({ width, ...col }) => ({ ...col, flex: width, minWidth: 60 }));
  }, [activeTabKey, usage]);

  if (!open) return null;

  return (
    <DaDialog
      open
      onClose={onClose}
      title="Matériauthèque du projet"
      subtitle="Articles utilisés par ce dossier : la laize et les raccords se reportent sur les lignes."
      maxWidth="xl"
      height="90vh"
      bodyPadding="0"
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px 28px 20px', boxSizing: 'border-box', gap: 14 }}>
        {/* Barre : familles à gauche, actions à droite (comme la Bibliothèque du chiffrage) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <DaTabs tabs={tabsWithCounts} value={activeTabKey} onChange={(k) => { setActiveTabKey(k); setSelection([]); }} />
          <span style={{ flex: 1 }} />
          <ToolbarSearch value={search} onChange={setSearch} placeholder="Rechercher un article…" width={260} grow />
          {selection.length > 0 && (
            <ToolbarButton icon={<Trash2 size={15} />} onClick={handleDelete}>Supprimer ({selection.length})</ToolbarButton>
          )}
          <ToolbarButton icon={<Library size={15} />} onClick={(e) => setCatalogAnchor(e.currentTarget)}>Depuis le catalogue</ToolbarButton>
          <ToolbarButton primary icon={<Plus size={15} />} onClick={handleAddBlank}>Ajouter un article</ToolbarButton>
        </div>
        <div style={{ ...TABLE_FRAME_STYLE, flex: 1, minHeight: 0 }}>
          <DataGrid
            rows={displayRows}
            columns={columns}
            processRowUpdate={processRowUpdate}
            checkboxSelection
            disableRowSelectionOnClick
            rowSelectionModel={selection}
            onRowSelectionModelChange={setSelection}
            localeText={{ ...frFR.components.MuiDataGrid.defaultProps.localeText, noRowsLabel: 'Aucun article dans cette catégorie.' }}
            rowHeight={40}
            columnHeaderHeight={42}
            sx={{ ...DATAGRID_DA_SX, height: '100%', '& .MuiDataGrid-menuIcon': { overflow: 'hidden' } }}
          />
        </div>
        <div style={{ fontSize: 13, color: '#6B7280' }}>
          {materials.length} article{materials.length !== 1 ? 's' : ''} au total
        </div>
        <UsagePopover anchor={usageAnchor} list={usageList} onClose={() => setUsageAnchor(null)} where="du projet" />
        <Popover
          open={!!catalogAnchor}
          anchorEl={catalogAnchor}
          onClose={() => setCatalogAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{ sx: { borderRadius: '8px', border: '1px solid #E0DED9', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' } }}
        >
          <CatalogSearch globalCatalog={allGlobal} projectMaterials={materials} activeTab={activeTab} onAdd={handleAdd} />
        </Popover>
      </div>
    </DaDialog>
  );
}
