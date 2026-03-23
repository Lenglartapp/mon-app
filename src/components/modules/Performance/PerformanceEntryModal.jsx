import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Wrench } from 'lucide-react';

export const RAISONS_CATALOGUE = [
  'Sous-estimation au chiffrage',
  'Modification client en cours de fabrication',
  'Retard / erreur fournisseur',
  'Matière non conforme (reprise)',
  'Panne machine / problème technique',
  'Erreur de fabrication (refaire)',
  'Manque de personnel',
  'Conception plus complexe que prévue',
  'Autre',
];

const SERVICE_LABELS = {
  conf: 'Atelier / Confection',
  prepa: 'Préparation & Métrage',
  pose: 'Pose & Logistique',
};

function Checkbox({ checked, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: '#374151' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#1E2447' }} />
      {label}
    </label>
  );
}

export default function PerformanceEntryModal({ project, service, existingEntry, onSave, onClose }) {
  const [raisons, setRaisons] = useState(existingEntry?.raisons || []);
  const [raisonAutre, setRaisonAutre] = useState('');
  const [commentaire, setCommentaire] = useState(existingEntry?.commentaire || '');
  const [hasSav, setHasSav] = useState(existingEntry?.has_sav || false);
  const [heuresSav, setHeuresSav] = useState(existingEntry?.heures_sav || 0);
  const [saving, setSaving] = useState(false);

  // Si "Autre" était déjà dans les raisons, pré-remplir le champ libre
  useEffect(() => {
    const autreRaison = (existingEntry?.raisons || []).find(r => !RAISONS_CATALOGUE.slice(0, -1).includes(r));
    if (autreRaison) {
      setRaisonAutre(autreRaison);
      // Marquer "Autre" comme coché
      if (!raisons.includes('Autre')) setRaisons(prev => [...prev, 'Autre']);
    }
  }, []);

  const toggleRaison = (r) => {
    setRaisons(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };

  const handleSave = async () => {
    setSaving(true);
    // Construire la liste finale des raisons (remplacer "Autre" par le texte libre si renseigné)
    const finalRaisons = raisons
      .filter(r => r !== 'Autre')
      .concat(raisons.includes('Autre') && raisonAutre.trim() ? [raisonAutre.trim()] : []);

    await onSave({
      id: existingEntry?.id,
      project_id: project.id,
      service,
      raisons: finalRaisons,
      commentaire,
      has_sav: hasSav,
      heures_sav: hasSav ? Number(heuresSav) : 0,
    });
    setSaving(false);
    onClose();
  };

  const serviceLabel = SERVICE_LABELS[service] || service;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#fff', borderRadius: 16, width: 'min(560px, 95vw)',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>Bilan performance</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
              {project?.name} — <span style={{ fontWeight: 600, color: '#1E2447' }}>{serviceLabel}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Raisons */}
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={15} color="#F59E0B" />
              Raisons du dépassement
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {RAISONS_CATALOGUE.map(r => (
                <Checkbox key={r} checked={raisons.includes(r)} onChange={() => toggleRaison(r)} label={r} />
              ))}
            </div>
            {raisons.includes('Autre') && (
              <input
                autoFocus
                value={raisonAutre}
                onChange={e => setRaisonAutre(e.target.value)}
                placeholder="Précisez la raison..."
                style={{
                  marginTop: 8, width: '100%', boxSizing: 'border-box',
                  border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 12px',
                  fontSize: 14, color: '#374151', outline: 'none',
                }}
              />
            )}
          </div>

          {/* Commentaire */}
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 8 }}>Commentaire</div>
            <textarea
              value={commentaire}
              onChange={e => setCommentaire(e.target.value)}
              placeholder="Détails supplémentaires, contexte, actions déjà prises..."
              rows={4}
              style={{
                width: '100%', boxSizing: 'border-box',
                border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px',
                fontSize: 14, color: '#374151', resize: 'vertical',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>

          {/* SAV */}
          <div style={{ background: '#FFF7ED', borderRadius: 10, padding: '14px 16px', border: '1px solid #FED7AA' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: hasSav ? 12 : 0 }}>
              <Wrench size={15} color="#EA580C" />
              <Checkbox checked={hasSav} onChange={setHasSav} label="SAV sur ce service" />
            </div>
            {hasSav && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <span style={{ fontSize: 13, color: '#92400E' }}>Heures SAV :</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={heuresSav}
                  onChange={e => setHeuresSav(e.target.value)}
                  style={{
                    width: 80, border: '1px solid #FED7AA', borderRadius: 6,
                    padding: '4px 8px', fontSize: 14, color: '#374151', outline: 'none',
                    background: 'white',
                  }}
                />
                <span style={{ fontSize: 13, color: '#92400E' }}>h</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{
            border: '1px solid #E5E7EB', background: 'white', borderRadius: 8,
            padding: '8px 18px', fontSize: 14, cursor: 'pointer', color: '#374151', fontWeight: 500,
          }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{
            background: '#1E2447', color: 'white', border: 'none', borderRadius: 8,
            padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  );
}
