import React, { useState } from 'react';
import { X } from 'lucide-react';
import { RAISONS_CATALOGUE } from './PerformanceEntryModal';

const STATUT_OPTIONS = [
  { key: 'A_FAIRE', label: 'À faire', color: '#6B7280', bg: '#F3F4F6' },
  { key: 'EN_COURS', label: 'En cours', color: '#2563EB', bg: '#DBEAFE' },
  { key: 'TERMINE', label: 'Terminé', color: '#059669', bg: '#D1FAE5' },
];

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 12px',
  fontSize: 14, color: '#374151', outline: 'none', fontFamily: 'inherit',
};

const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280',
  textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6,
};

export default function ActionFicheModal({ action, projects, onSave, onClose }) {
  const isEdit = Boolean(action?.id);
  const [form, setForm] = useState({
    titre: action?.titre || '',
    description: action?.description || '',
    linked_project_id: action?.linked_project_id || '',
    linked_raison: action?.linked_raison || '',
    responsable: action?.responsable || '',
    statut: action?.statut || 'A_FAIRE',
    date_cible: action?.date_cible || '',
    notes: action?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.titre.trim()) return;
    setSaving(true);
    await onSave({ ...form, id: action?.id, linked_project_id: form.linked_project_id || null });
    setSaving(false);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#fff', borderRadius: 16, width: 'min(600px, 95vw)',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>
            {isEdit ? 'Modifier la fiche' : 'Nouvelle fiche d\'action'}
          </span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Titre */}
          <div>
            <label style={labelStyle}>Titre <span style={{ color: '#EF4444' }}>*</span></label>
            <input
              autoFocus
              style={inputStyle}
              placeholder="Ex: Mettre en place un brief de lancement systématique"
              value={form.titre}
              onChange={e => set('titre', e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
              placeholder="Contexte, problème observé, objectif de l'action..."
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          {/* Ligne : Lien projet + Lien raison */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Projet lié (optionnel)</label>
              <select style={inputStyle} value={form.linked_project_id} onChange={e => set('linked_project_id', e.target.value)}>
                <option value="">— Aucun projet —</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name || `Projet #${String(p.id).slice(-4)}`}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Raison liée (optionnel)</label>
              <select style={inputStyle} value={form.linked_raison} onChange={e => set('linked_raison', e.target.value)}>
                <option value="">— Aucune raison —</option>
                {RAISONS_CATALOGUE.filter(r => r !== 'Autre').map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
                <option value="__custom__">Raison personnalisée...</option>
              </select>
              {form.linked_raison === '__custom__' && (
                <input
                  style={{ ...inputStyle, marginTop: 8 }}
                  placeholder="Précisez..."
                  value={form.linked_raison_custom || ''}
                  onChange={e => set('linked_raison_custom', e.target.value)}
                />
              )}
            </div>
          </div>

          {/* Ligne : Responsable + Date cible + Statut */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Responsable</label>
              <input
                style={inputStyle}
                placeholder="Nom ou équipe"
                value={form.responsable}
                onChange={e => set('responsable', e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Date cible</label>
              <input
                type="date"
                style={inputStyle}
                value={form.date_cible}
                onChange={e => set('date_cible', e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Statut</label>
              <select style={inputStyle} value={form.statut} onChange={e => set('statut', e.target.value)}>
                {STATUT_OPTIONS.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}>Notes de suivi</label>
            <textarea
              style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
              placeholder="Avancement, points de blocage, décisions prises..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{
            border: '1px solid #E5E7EB', background: 'white', borderRadius: 8,
            padding: '8px 18px', fontSize: 14, cursor: 'pointer', color: '#374151', fontWeight: 500,
          }}>Annuler</button>
          <button onClick={handleSave} disabled={saving || !form.titre.trim()} style={{
            background: '#1E2447', color: 'white', border: 'none', borderRadius: 8,
            padding: '8px 20px', fontSize: 14, fontWeight: 600,
            cursor: (saving || !form.titre.trim()) ? 'not-allowed' : 'pointer',
            opacity: (saving || !form.titre.trim()) ? 0.6 : 1,
          }}>{saving ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Créer la fiche'}</button>
        </div>
      </div>
    </div>
  );
}
