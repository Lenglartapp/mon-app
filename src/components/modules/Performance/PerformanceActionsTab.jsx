import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, CheckCircle, Clock, Circle, CalendarDays, Link, Tag } from 'lucide-react';
import ActionFicheModal from './ActionFicheModal';

const STATUT_CONFIG = {
  A_FAIRE: { label: 'À faire', color: '#6B7280', bg: '#F3F4F6', Icon: Circle },
  EN_COURS: { label: 'En cours', color: '#2563EB', bg: '#DBEAFE', Icon: Clock },
  TERMINE: { label: 'Terminé', color: '#059669', bg: '#D1FAE5', Icon: CheckCircle },
};

function StatutPill({ statut }) {
  const cfg = STATUT_CONFIG[statut] || STATUT_CONFIG.A_FAIRE;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: cfg.bg, color: cfg.color,
      borderRadius: 99, padding: '3px 10px', fontSize: 12, fontWeight: 600,
    }}>
      <cfg.Icon size={12} />
      {cfg.label}
    </span>
  );
}

function ActionCard({ action, projects, onEdit, onDelete, canEdit }) {
  const linkedProject = projects.find(p => String(p.id) === String(action.linked_project_id));
  const isOverdue = action.date_cible && action.statut !== 'TERMINE' && new Date(action.date_cible) < new Date();

  return (
    <div style={{
      background: 'white', borderRadius: 12, border: '1px solid #E5E7EB',
      padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
      borderLeft: `4px solid ${STATUT_CONFIG[action.statut]?.color || '#E5E7EB'}`,
    }}>
      {/* Header carte */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#111827', flex: 1 }}>{action.titre}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <StatutPill statut={action.statut} />
          {canEdit && (
            <>
              <button onClick={() => onEdit(action)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}>
                <Edit2 size={14} />
              </button>
              <button onClick={() => onDelete(action.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#EF4444', padding: 4 }}>
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Description */}
      {action.description && (
        <p style={{ fontSize: 13, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>{action.description}</p>
      )}

      {/* Tags : projet + raison */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {linkedProject && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#EFF6FF', color: '#1D4ED8', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>
            <Link size={11} /> {linkedProject.name}
          </span>
        )}
        {action.linked_raison && action.linked_raison !== '__custom__' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FFFBEB', color: '#92400E', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>
            <Tag size={11} /> {action.linked_raison}
          </span>
        )}
      </div>

      {/* Pied de carte */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#6B7280' }}>
          {action.responsable && <span>👤 {action.responsable}</span>}
          {action.date_cible && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: isOverdue ? '#EF4444' : '#6B7280', fontWeight: isOverdue ? 600 : 400 }}>
              <CalendarDays size={12} />
              {new Date(action.date_cible).toLocaleDateString('fr-FR')}
              {isOverdue && ' ⚠️'}
            </span>
          )}
        </div>
      </div>

      {/* Notes */}
      {action.notes && (
        <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#6B7280', borderLeft: '3px solid #E5E7EB' }}>
          {action.notes}
        </div>
      )}
    </div>
  );
}

export default function PerformanceActionsTab({ actions, projects, onAdd, onUpdate, onDelete, canEdit }) {
  const [modal, setModal] = useState(null); // null | 'new' | action object
  const [statutFilter, setStatutFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = actions;
    if (statutFilter !== 'all') list = list.filter(a => a.statut === statutFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        (a.titre || '').toLowerCase().includes(q) ||
        (a.linked_raison || '').toLowerCase().includes(q) ||
        (a.responsable || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [actions, statutFilter, search]);

  const handleSave = async (data) => {
    if (data.id) {
      await onUpdate(data.id, data);
    } else {
      await onAdd(data);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Supprimer cette fiche d\'action ?')) onDelete(id);
  };

  // Compteurs par statut
  const counts = useMemo(() => ({
    A_FAIRE: actions.filter(a => a.statut === 'A_FAIRE').length,
    EN_COURS: actions.filter(a => a.statut === 'EN_COURS').length,
    TERMINE: actions.filter(a => a.statut === 'TERMINE').length,
  }), [actions]);

  const STATUT_TABS = [
    { key: 'all', label: `Toutes (${actions.length})` },
    { key: 'A_FAIRE', label: `À faire (${counts.A_FAIRE})` },
    { key: 'EN_COURS', label: `En cours (${counts.EN_COURS})` },
    { key: 'TERMINE', label: `Terminées (${counts.TERMINE})` },
  ];

  return (
    <div>
      {/* Barre de contrôles */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', background: 'white', borderRadius: 9999, padding: 3, gap: 3, border: '1px solid #E5E7EB' }}>
          {STATUT_TABS.map(t => (
            <button key={t.key} onClick={() => setStatutFilter(t.key)} style={{
              padding: '6px 14px', borderRadius: 9999, fontSize: 13, fontWeight: 500,
              border: 'none', cursor: 'pointer',
              background: statutFilter === t.key ? '#1E2447' : 'transparent',
              color: statutFilter === t.key ? 'white' : '#4B5563',
              transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 12px', fontSize: 13, outline: 'none', width: 180 }}
          />
          {canEdit && (
            <button onClick={() => setModal('new')} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#1E2447', color: 'white', border: 'none',
              borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              <Plus size={16} /> Nouvelle fiche
            </button>
          )}
        </div>
      </div>

      {/* Grille de fiches */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF', fontSize: 14 }}>
          {actions.length === 0
            ? 'Aucune fiche d\'action. Créez-en une pour suivre vos plans d\'amélioration.'
            : 'Aucune fiche correspondant aux filtres.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {filtered.map(action => (
            <ActionCard
              key={action.id}
              action={action}
              projects={projects}
              onEdit={(a) => setModal(a)}
              onDelete={handleDelete}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <ActionFicheModal
          action={modal === 'new' ? null : modal}
          projects={projects}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
