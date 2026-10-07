import React, { useMemo, useState } from 'react';
import { Button, IconButton, TextField, Tooltip } from '@mui/material';
import { Plus, Trash2, Pencil, Check } from 'lucide-react';
import DaDialog, { DaTabs } from './ui/DaDialog';
import { ToolbarSearch, ToolbarButton } from './ui/ToolbarControls';
import { uid } from '../lib/utils/uid';
import { useCatalog, useCatalogRail } from '../hooks/useSupabase';

const TABS = [
  { key: 'Tissu',         label: 'Tissus',        categories: ['Tissu', 'Tissus', 'Doublure', 'Doublures', 'Inter', 'Confection'] },
  { key: 'Rail',          label: 'Rails',          categories: ['Rail', 'Rails', 'Tringle', 'Mécanisme', 'Mecanisme'] },
  { key: 'Store',         label: 'Stores',         categories: ['Store', 'Stores', 'Mecanisme Store'] },
  { key: 'Passementerie', label: 'Passementerie',  categories: ['Passementerie'] },
];

// Boutons des formulaires (DA) : action principale bleu nuit, secondaire blanche à trait fin
const BTN_PRIMARY = { textTransform: 'none', fontWeight: 600, borderRadius: '8px', bgcolor: '#1E2447', '&:hover': { bgcolor: '#2A3260' } };
const BTN_GHOST = { textTransform: 'none', fontWeight: 600, borderRadius: '8px', color: '#374151', border: '1px solid #E5E7EB', bgcolor: 'white', px: 1.5 };

const BLANK_FORM = { fournisseur: '', reference: '', coloris: '', width: '', raccord_v: '', raccord_h: '' };

function buildName(fournisseur, reference, coloris) {
  const parts = [
    fournisseur.trim().toUpperCase(),
    reference.trim(),
    coloris.trim(),
  ].filter(Boolean);
  return parts.join(' ');
}

// ─── Onglets (pastilles de la DA, nombre d'articles par catégorie) ─────────
function TabBar({ tabs, activeKey, materials, onChange }) {
  const withCounts = tabs.map(tab => {
    const count = materials.filter(m => tab.categories.some(c => c.toLowerCase() === (m.category || '').toLowerCase())).length;
    return { key: tab.key, label: `${tab.label}${count > 0 ? ` (${count})` : ''}` };
  });
  return <DaTabs tabs={withCounts} value={activeKey} onChange={onChange} />;
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
      <ToolbarSearch
        value={search}
        onChange={setSearch}
        placeholder={`Rechercher dans le catalogue global (${activeTab.label.toLowerCase()})…`}
        width="100%"
      />
      {filtered.length > 0 && (
        <div style={{ marginTop: 6, border: '1px solid #E0DED9', borderRadius: 8, overflow: 'hidden' }}>
          {filtered.map((article, i) => (
            <div
              key={article.id || i}
              onClick={() => handlePick(article)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                background: '#fff',
                borderBottom: i < filtered.length - 1 ? '1px solid #E8E6E2' : 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#F7F7F5'}
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
              <Plus size={14} color="#1E2447" style={{ flexShrink: 0, marginLeft: 8 }} />
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
// Édition en place d'un article déjà présent dans la matériauthèque.
// On repart du nom complet (et non de fournisseur/référence/coloris, que les
// articles importés ne portent pas toujours) pour ne rien perdre à l'édition.
function EditRow({ material, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: material.name || '',
    width: material.width ?? '',
    raccord_v: material.raccord_v ?? '',
    raccord_h: material.raccord_h ?? '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const renamed = form.name.trim() !== (material.name || '').trim();

  const save = () => {
    const name = form.name.trim();
    if (!name) return;
    onSave({
      ...material,
      name,
      width: Number(form.width) || 0,
      raccord_v: Number(form.raccord_v) || 0,
      raccord_h: Number(form.raccord_h) || 0,
      motif: Number(form.raccord_v) > 0 || Number(form.raccord_h) > 0,
    });
  };

  return (
    <div style={{ padding: '12px', background: '#F7F7F5', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <TextField
        size="small" label="Nom de l'article" value={form.name}
        onChange={(e) => set('name', e.target.value)} fullWidth autoFocus
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <TextField size="small" label="Laize (cm)" type="number" value={form.width}
          onChange={(e) => set('width', e.target.value)} style={{ flex: 1 }} />
        <TextField size="small" label="Raccord V (cm)" type="number" value={form.raccord_v}
          onChange={(e) => set('raccord_v', e.target.value)} style={{ flex: 1 }} />
        <TextField size="small" label="Raccord H (cm)" type="number" value={form.raccord_h}
          onChange={(e) => set('raccord_h', e.target.value)} style={{ flex: 1 }} />
      </div>
      {renamed && (
        <div style={{ fontSize: 11.5, color: '#92400E', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 6, padding: '6px 9px' }}>
          Le nom change : les lignes qui utilisent cet article seront mises à jour pour rester liées.
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button size="small" onClick={onCancel} sx={BTN_GHOST}>Annuler</Button>
        <Button size="small" variant="contained" disableElevation onClick={save} disabled={!form.name.trim()}
          startIcon={<Check size={14} />} sx={BTN_PRIMARY}>Enregistrer</Button>
      </div>
    </div>
  );
}

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
      background: '#F7F7F5', border: '1px solid #E0DED9', borderRadius: 8,
      padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
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
        <Button size="small" onClick={onCancel} sx={BTN_GHOST}>Annuler</Button>
        <Button size="small" variant="contained" disableElevation onClick={handleSubmit} disabled={!canSubmit} sx={BTN_PRIMARY}>
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
  const [editingId, setEditingId] = useState(null);

  const allGlobal = useMemo(() => [...(globalCatalog || []), ...(catalogRails || [])], [globalCatalog, catalogRails]);
  const activeTab = TABS.find(t => t.key === activeTabKey) || TABS[0];

  const tabMaterials = useMemo(
    () => materials.filter(m => activeTab.categories.some(c => c.toLowerCase() === (m.category || '').toLowerCase())),
    [materials, activeTab]
  );

  const handleAdd = (item) => { onMaterialsChange([...materials, item]); setShowForm(false); };
  const handleDelete = (id) => { onMaterialsChange(materials.filter(m => m.id !== id)); };

  // Édition d'un article. La laize et les raccords se propagent d'eux-mêmes aux
  // lignes au prochain recalcul (fillFromCatalog réécrit ces valeurs sur toute
  // ligne portant ce nom) — c'est bien ici qu'on corrige une laize, pas à la main
  // dans le tableau, où la saisie serait écrasée.
  // Le NOM, lui, est la clé du lien : c'est l'appelant qui doit propager un
  // renommage sur les lignes (voir applyCatalogRenames).
  const handleUpdate = (updated) => {
    onMaterialsChange(materials.map(m => (m.id === updated.id ? updated : m)));
    setEditingId(null);
  };
  const handleTabChange = (key) => { setActiveTabKey(key); setShowForm(false); setEditingId(null); };

  return (
    <DaDialog
      open={open}
      onClose={onClose}
      title="Matériauthèque du projet"
      subtitle="Articles utilisés par ce dossier : la laize et les raccords se reportent sur les lignes."
      maxWidth="sm"
      tabs={<TabBar tabs={TABS} activeKey={activeTabKey} materials={materials} onChange={handleTabChange} />}
      footer={<>
        <div style={{ flex: 1, fontSize: 13, color: '#6B7280' }}>
          {materials.length} article{materials.length !== 1 ? 's' : ''} au total
        </div>
        <ToolbarButton primary onClick={onClose}>Fermer</ToolbarButton>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <CatalogSearch
          globalCatalog={allGlobal}
          projectMaterials={materials}
          activeTab={activeTab}
          onAdd={handleAdd}
        />

        {showForm ? (
          <ManualForm activeTab={activeTab} onAdd={handleAdd} onCancel={() => setShowForm(false)} />
        ) : (
          <div>
            <ToolbarButton icon={<Plus size={16} />} onClick={() => setShowForm(true)}>Ajouter manuellement</ToolbarButton>
          </div>
        )}

        {tabMaterials.length === 0 ? (
          <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
            Aucun article dans cette catégorie.
          </div>
        ) : (
          <div style={{ border: '1px solid #E0DED9', borderRadius: 8, overflow: 'hidden' }}>
            {tabMaterials.map((mat, i) => (
              editingId === mat.id ? (
                <div key={mat.id} style={{ borderBottom: i < tabMaterials.length - 1 ? '1px solid #E8E6E2' : 'none' }}>
                  <EditRow material={mat} onSave={handleUpdate} onCancel={() => setEditingId(null)} />
                </div>
              ) : (
              <div
                key={mat.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                  borderBottom: i < tabMaterials.length - 1 ? '1px solid #E8E6E2' : 'none',
                  background: '#fff',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {mat.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                    {[
                      mat.width > 0 && `Laize ${mat.width} cm`,
                      mat.raccord_v > 0 && `Raccord V ${mat.raccord_v} cm`,
                      mat.raccord_h > 0 && `Raccord H ${mat.raccord_h} cm`,
                    ].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <Tooltip title="Modifier">
                  <IconButton size="small" onClick={() => setEditingId(mat.id)} style={{ color: '#6B7280' }}>
                    <Pencil size={15} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Supprimer">
                  <IconButton size="small" onClick={() => handleDelete(mat.id)} style={{ color: '#9CA3AF' }}>
                    <Trash2 size={15} />
                  </IconButton>
                </Tooltip>
              </div>
              )
            ))}
          </div>
        )}
      </div>
    </DaDialog>
  );
}
