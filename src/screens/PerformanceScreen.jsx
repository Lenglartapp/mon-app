import React, { useState } from 'react';
import { usePerformanceEntries, usePerformanceActions } from '../hooks/usePerformance';
import PerformanceDataTab from '../components/modules/Performance/PerformanceDataTab';
import PerformanceAnalyseTab from '../components/modules/Performance/PerformanceAnalyseTab';
import PerformanceActionsTab from '../components/modules/Performance/PerformanceActionsTab';
import { useAuth } from '../auth';
import { can } from '../lib/authz';

const TABS = [
  { key: 'data', label: 'Données' },
  { key: 'analyse', label: 'Analyse' },
  { key: 'actions', label: 'Actions' },
];

export default function PerformanceScreen({ projects, events, onBack }) {
  const { currentUser } = useAuth();
  const canEdit = can(currentUser, 'performance.edit');

  const [tabIndex, setTabIndex] = useState(0);

  const { entries, upsertEntry: _upsertEntry } = usePerformanceEntries();
  const upsertEntry = (entry) => _upsertEntry(entry, currentUser?.name || '');
  const { actions, addAction, updateAction, deleteAction } = usePerformanceActions();

  return (
    <div style={{ minHeight: '100vh', background: '#F9F7F2', padding: 24, display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: 1600, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', flex: 1 }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          {onBack && (
            <button onClick={onBack} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#6B7280', fontWeight: 600, fontSize: 13,
              marginBottom: 12, padding: 0, display: 'flex', alignItems: 'center', gap: 4,
            }}>
              ← Retour
            </button>
          )}
          <h1 style={{ fontSize: 32, fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.5px' }}>
            Performance
          </h1>
          <p style={{ fontSize: 14, color: '#6B7280', margin: '4px 0 0' }}>
            Suivi du budget temps alloué vs consommé par projet et par service
          </p>
        </div>

        {/* Navigation onglets (centré, style Inventaire) */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{
            background: 'white', borderRadius: 9999, padding: 4, display: 'flex', gap: 4,
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
            border: '1px solid rgba(0,0,0,0.05)',
          }}>
            {TABS.map((t, i) => (
              <button key={t.key} onClick={() => setTabIndex(i)} style={{
                padding: '8px 24px', borderRadius: 9999, fontSize: 14, fontWeight: 500,
                border: 'none', cursor: 'pointer',
                background: tabIndex === i ? '#1E2447' : 'transparent',
                color: tabIndex === i ? 'white' : '#4B5563',
                transition: 'all 0.2s',
                boxShadow: tabIndex === i ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                outline: 'none',
              }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contenu */}
        <div style={{ flex: 1 }}>
          {tabIndex === 0 && (
            <PerformanceDataTab
              projects={projects}
              events={events}
              entries={entries}
              onUpsertEntry={upsertEntry}
              canEdit={canEdit}
            />
          )}
          {tabIndex === 1 && (
            <PerformanceAnalyseTab
              projects={projects}
              events={events}
              entries={entries}
            />
          )}
          {tabIndex === 2 && (
            <PerformanceActionsTab
              actions={actions}
              projects={projects}
              onAdd={addAction}
              onUpdate={updateAction}
              onDelete={deleteAction}
              canEdit={canEdit}
            />
          )}
        </div>
      </div>
    </div>
  );
}
