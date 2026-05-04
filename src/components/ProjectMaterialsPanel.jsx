import React, { useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, IconButton, TextField, Tooltip,
} from '@mui/material';
import { X, Plus, Trash2, Package } from 'lucide-react';
import { uid } from '../lib/utils/uid';
import { useCatalog, useCatalogRail } from '../hooks/useSupabase';

const TABS = [
  { key: 'Tissu',         label: 'Tissus',        categories: ['Tissu', 'Tissus', 'Doublure', 'Doublures', 'Inter', 'Confection'] },
  { key: 'Rail',          label: 'Rails',          categories: ['Rail', 'Rails', 'Tringle', 'Mécanisme', 'Mecanisme'] },
  { key: 'Store',         label: 'Stores',         categories: ['Store', 'Stores', 'Mecanisme Store'] },
  { key: 'Passementerie', label: 'Passementerie',  categories: ['Passementerie'] },
];

const BLANK_FORM = { fournisseur: '', reference: '', coloris: '', width: '', raccord_v: '', raccord_h: '' };

function buildName(fournisseur, reference, coloris) {
  const parts = [
    fournisseur.trim().toUpperCase(),
    reference.trim(),
    coloris.trim(),
  ].filter(Boolean);
  return parts.join(' ');
}

// ─── Tab bar (single capsule) ────────────────────────────────────────────────
function TabBar({ tabs, activeKey, materials, onChange }) {
  return (
    <div style={{
      display: 'flex', padding: '10px 20px',
      borderBottom: '1px solid #E5E7EB', background: '#fff',
    }}>
      <div style={{
        display: 'flex', gap: 2,
        background: '#F3F4F6', borderRadius: 99,
        padding: '3px',
      }}>
        {tabs.map(tab => {
          const count = materials.filter(m =>
            tab.categories.some(c => c.toLowerCase() === (m.category || '').toLowerCase())
          ).length;
          const isActive = tab.key === activeKey;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              style={{
                padding: '5px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                background: isActive ? '#111827' : 'transparent',
                color: isActive ? '#fff' : '#6B7280',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}{count > 0 ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Catalog search ──────────────────────────────────────────────────────────
function CatalogSearch({ globalCatalog, projectMaterials, activeTab, onAdd }) {
  const [search, setSearch] = useState('');

  const existing = useMemo(() => new Set(projectMaterials.map(m => m.name)), [projectMaterials]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [];
    return globalCatalog
      .filter(a => {
        if (!a.name?.toLowerCase().includes(q)) return false;
        if (existing.has(a.name)) return false;
        const cat = (a.category || '').trim();
        return activeTab.categories.some(c => c.toLowerCase() === cat.toLowerCase());
      })
      .slice(0, 10);
  }, [search, globalCatalog, existing, activeTab]);

  const handlePick = (article) => {
    onAdd({
      id: uid(),
      name: article.name,
      category: activeTab.key,
      width: Number(article.width || article.laize || 0),
      motif: Boolean(article.motif),
      raccord_v: Number(article.raccord_v || 0),
      raccord_h: Number(article.raccord_h || 0),
    });
    setSearch('');
  };

  return (
    <div>
      <TextField
        size="small" fullWidth variant="outlined"
        placeholder={`Rechercher dans le catalogue global (${activeTab.label})…`}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      {filtered.length > 0 && (
        <div style={{ marginTop: 4, border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
          {filtered.map((article, i) => (
            <div
              key={article.id || i}
              onClick={() => handlePick(article)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                background: '#fff',
                borderBottom: i < filtered.length - 1 ? '1px solid #F3F4F6' : 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600, color: '#111827' }}>{article.name}</span>
                {article.width > 0 && (
                  <span style={{ marginLeft: 8, color: '#6B7280', fontSize: 12 }}>
                    {article.width} cm
                    {article.raccord_v > 0 && ` · Rv ${article.raccord_v}`}
                    {article.raccord_h > 0 && ` · Rh ${article.raccord_h}`}
                  </span>
                )}
              </div>
              <Plus size={14} color="#3B82F6" style={{ flexShrink: 0, marginLeft: 8 }} />
            </div>
          ))}
        </div>
      )}
      {search.trim() && filtered.length === 0 && (
        <div style={{ fontSize: 12, color: '#9CA3AF', padding: '4px 0' }}>
          Aucun résultat dans le catalogue global.
        </div>
      )}
    </div>
  );
}

// ─── Manual add form ─────────────────────────────────────────────────────────
function ManualForm({ activeTab, onAdd, onCancel }) {
  const [form, setForm] = useState(BLANK_FORM);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const isFabric = activeTab.key === 'Tissu';
  const namePreview = buildName(form.fournisseur, form.reference, form.coloris);
  const canSubmit = form.fournisseur.trim() || form.reference.trim();

  const handleSubmit = () => {
    if (!canSubmit) return;
    onAdd({
      id: uid(),
      name: namePreview || form.reference.trim(),
      category: activeTab.key,
      width: Number(form.width) || 0,
      motif: Number(form.raccord_v) > 0 || Number(form.raccord_h) > 0,
      raccord_v: Number(form.raccord_v) || 0,
      raccord_h: Number(form.raccord_h) || 0,
    });
    setForm(BLANK_FORM);
  };

  return (
    <div style={{
      background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8,
      padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Name preview */}
      {namePreview && (
        <div style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic', marginBottom: -2 }}>
          → <strong style={{ color: '#111827' }}>{namePreview}</strong>
        </div>
      )}
      {/* Fournisseur / Référence / Coloris */}
      <div style={{ display: 'flex', gap: 8 }}>
        <TextField size="small" label="Fournisseur" value={form.fournisseur}
          onChange={e => set('fournisseur', e.target.value)}
          style={{ flex: 1 }}
          inputProps={{ style: { textTransform: 'uppercase' } }}
        />
        <TextField size="small" label="Référence" value={form.reference}
          onChange={e => set('reference', e.target.value)} style={{ flex: 1 }} />
        <TextField size="small" label="Coloris" value={form.coloris}
          onChange={e => set('coloris', e.target.value)} style={{ flex: 1 }} />
      </div>
      {/* Laize + Raccords — tissus et passementeries seulement */}
      {isFabric && (
        <div style={{ display: 'flex', gap: 8 }}>
          <TextField size="small" label="Laize (cm)" type="number" value={form.width}
            onChange={e => set('width', e.target.value)} style={{ flex: 1 }} />
          <TextField size="small" label="Raccord V (cm)" type="number" value={form.raccord_v}
            onChange={e => set('raccord_v', e.target.value)} style={{ flex: 1 }} />
          <TextField size="small" label="Raccord H (cm)" type="number" value={form.raccord_h}
            onChange={e => set('raccord_h', e.target.value)} style={{ flex: 1 }} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button size="small" onClick={onCancel}>Annuler</Button>
        <Button size="small" variant="contained" onClick={handleSubmit} disabled={!canSubmit}>
          Ajouter
        </Button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ProjectMaterialsPanel({ open, onClose, materials = [], onMaterialsChange }) {
  const { catalog: globalCatalog } = useCatalog();
  const { catalogRails } = useCatalogRail();
  const [activeTabKey, setActiveTabKey] = useState('Tissu');
  const [showForm, setShowForm] = useState(false);

  const allGlobal = useMemo(() => [...(globalCatalog || []), ...(catalogRails || [])], [globalCatalog, catalogRails]);
  const activeTab = TABS.find(t => t.key === activeTabKey) || TABS[0];

  const tabMaterials = useMemo(
    () => materials.filter(m => activeTab.categories.some(c => c.toLowerCase() === (m.category || '').toLowerCase())),
    [materials, activeTab]
  );

  const handleAdd = (item) => { onMaterialsChange([...materials, item]); setShowForm(false); };
  const handleDelete = (id) => { onMaterialsChange(materials.filter(m => m.id !== id)); };
  const handleTabChange = (key) => { setActiveTabKey(key); setShowForm(false); };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 18 }}>
          <Package size={20} />
          Matériauthèque du projet
        </div>
        <IconButton size="small" onClick={onClose}><X size={18} /></IconButton>
      </DialogTitle>

      <DialogContent dividers style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>

        <TabBar tabs={TABS} activeKey={activeTabKey} materials={materials} onChange={handleTabChange} />

        <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

          <CatalogSearch
            globalCatalog={allGlobal}
            projectMaterials={materials}
            activeTab={activeTab}
            onAdd={handleAdd}
          />

          {showForm ? (
            <ManualForm activeTab={activeTab} onAdd={handleAdd} onCancel={() => setShowForm(false)} />
          ) : (
            <button
              onClick={() => setShowForm(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'none', border: '1px dashed #D1D5DB', borderRadius: 8,
                padding: '7px 12px', cursor: 'pointer', fontSize: 13, color: '#6B7280',
                fontFamily: 'inherit', fontWeight: 500,
              }}
            >
              <Plus size={14} />
              Ajouter manuellement
            </button>
          )}

          {tabMaterials.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
              Aucun article dans cette catégorie.
            </div>
          ) : (
            <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
              {tabMaterials.map((mat, i) => (
                <div
                  key={mat.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                    borderBottom: i < tabMaterials.length - 1 ? '1px solid #F3F4F6' : 'none',
                    background: '#fff',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {mat.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                      {[
                        mat.width > 0 && `Laize : ${mat.width} cm`,
                        mat.raccord_v > 0 && `Raccord V : ${mat.raccord_v} cm`,
                        mat.raccord_h > 0 && `Raccord H : ${mat.raccord_h} cm`,
                      ].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </div>
                  <Tooltip title="Supprimer">
                    <IconButton size="small" onClick={() => handleDelete(mat.id)} style={{ color: '#EF4444' }}>
                      <Trash2 size={14} />
                    </IconButton>
                  </Tooltip>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>

      <DialogActions style={{ padding: '12px 20px' }}>
        <div style={{ flex: 1, fontSize: 12, color: '#9CA3AF' }}>
          {materials.length} article{materials.length !== 1 ? 's' : ''} au total
        </div>
        <Button onClick={onClose} variant="contained">Fermer</Button>
      </DialogActions>
    </Dialog>
  );
}
