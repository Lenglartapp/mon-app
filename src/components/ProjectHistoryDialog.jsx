import React, { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { fetchProjectEvents } from '../lib/projectEvents';

// Historique du DOSSIER : comment le projet a été créé (vierge / import manuel / commande Odoo),
// puis ce qu'Odoo a déclenché (annulation, suppression, archivage…). Le fil des lignes reste
// dans l'onglet activité du projet.

const TONE = {
  created: { dot: '#1E2447', tag: 'Création' },
  odoo_linked: { dot: '#714B67', tag: 'Odoo' },
  archived: { dot: '#B91C1C', tag: 'Archivé' },
  restored: { dot: '#15803D', tag: 'Ressorti' },
};

const fmt = (d) => (d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

export default function ProjectHistoryDialog({ open, onClose, project }) {
  const [state, setState] = useState({ loading: true, events: [], missingTable: false });

  useEffect(() => {
    if (!open || !project?.id) return undefined;
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    fetchProjectEvents(project).then((r) => { if (alive) setState({ loading: false, ...r }); });
    return () => { alive = false; };
  }, [open, project?.id, project?.status]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"
      PaperProps={{ sx: { borderRadius: '12px', fontFamily: 'Roboto, system-ui, sans-serif', background: '#FFFFFF' } }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 10px' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500, color: '#111827' }}>Historique du dossier</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{project?.name}</div>
        </div>
        <IconButton onClick={onClose} size="small" aria-label="Fermer"><CloseIcon fontSize="small" /></IconButton>
      </div>
      <div style={{ padding: '6px 20px 20px' }}>
        {state.loading && <div style={{ color: '#9B9A97', fontSize: 13, padding: '12px 0' }}>Chargement…</div>}
        {!state.loading && state.events.map((e, i) => {
          const tone = TONE[e.type] || { dot: '#9B9A97', tag: e.type };
          const last = i === state.events.length - 1;
          return (
            <div key={e.id || i} style={{ display: 'flex', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 12, paddingTop: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: tone.dot, flexShrink: 0 }} />
                {!last && <span style={{ flex: 1, width: 1, background: '#E0DED9', marginTop: 4 }} />}
              </div>
              <div style={{ flex: 1, paddingBottom: last ? 0 : 16, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: tone.dot, background: '#F4F4F4', borderRadius: 99, padding: '1px 8px' }}>{tone.tag}</span>
                  <span style={{ fontSize: 12, color: '#9B9A97' }}>{fmt(e.created_at)}{e.user_name ? ` · ${e.user_name}` : ''}</span>
                </div>
                <div style={{ fontSize: 14, color: '#1F2937', marginTop: 4 }}>{e.label}</div>
                {e.guessed && <div style={{ fontSize: 12, color: '#9B9A97', marginTop: 2 }}>Origine reconstituée (projet créé avant l'historique).</div>}
              </div>
            </div>
          );
        })}
        {!state.loading && state.missingTable && (
          <div style={{ fontSize: 12, color: '#B45309', marginTop: 12 }}>Historique indisponible : la table project_events n'est pas encore créée.</div>
        )}
      </div>
    </Dialog>
  );
}
