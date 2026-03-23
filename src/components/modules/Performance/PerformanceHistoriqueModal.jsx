import React from 'react';
import { X, Clock, User, Tag, MessageSquare, Wrench } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const SERVICE_LABELS = { conf: 'Confection', prepa: 'Préparation', pose: 'Pose' };

function Row({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
      <Icon size={14} color="#9CA3AF" style={{ marginTop: 2, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, minWidth: 90, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#374151', flex: 1 }}>{value}</span>
    </div>
  );
}

export default function PerformanceHistoriqueModal({ project, service, entry, onClose }) {
  const serviceLabel = SERVICE_LABELS[service] || service;

  const formatDate = (d) => {
    if (!d) return null;
    try { return format(new Date(d), "d MMM yyyy 'à' HH:mm", { locale: fr }); }
    catch { return d; }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#fff', borderRadius: 16, width: 'min(480px, 95vw)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={16} color="#6366F1" /> Historique de saisie
            </div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>
              {project?.name} — <span style={{ fontWeight: 600, color: '#6366F1' }}>{serviceLabel}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
            <X size={18} />
          </button>
        </div>

        {/* Corps */}
        <div style={{ padding: '16px 24px 20px' }}>
          {!entry ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#9CA3AF', fontSize: 13 }}>
              Aucune donnée saisie pour ce service.
            </div>
          ) : (
            <>
              {/* Méta */}
              <div style={{ background: '#F8F9FF', borderRadius: 10, padding: '10px 14px', marginBottom: 16, border: '1px solid #E0E7FF' }}>
                <Row icon={User} label="Saisi par" value={entry.updated_by || 'Inconnu'} />
                <Row icon={Clock} label="Dernière modif." value={formatDate(entry.updated_at)} />
                <Row icon={Clock} label="Créé le" value={formatDate(entry.created_at)} />
              </div>

              {/* Contenu saisi */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                Données enregistrées
              </div>

              <Row
                icon={Tag}
                label="Raisons"
                value={entry.raisons?.length ? entry.raisons.join(', ') : 'Aucune'}
              />
              <Row
                icon={MessageSquare}
                label="Commentaire"
                value={entry.commentaire || 'Aucun'}
              />
              <Row
                icon={Wrench}
                label="SAV"
                value={entry.has_sav
                  ? `Oui${entry.heures_sav > 0 ? ` — ${entry.heures_sav}h` : ''}`
                  : 'Non'}
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            background: '#F3F4F6', border: 'none', borderRadius: 8,
            padding: '8px 20px', fontSize: 14, cursor: 'pointer', color: '#374151', fontWeight: 500,
          }}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
