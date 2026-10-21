// src/components/ImportProjectsDialog.jsx
import React, { useState, useRef } from 'react';
import { Upload, Download, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { parseProjectsFromExcel, downloadProjectsTemplate } from '../lib/import/importProjectsFromExcel';

const STATUS_LABELS = {
  TODO: 'À commencer',
  IN_PROGRESS: 'En cours',
  DONE: 'Terminé',
  SAV: 'SAV',
  ARCHIVED: 'Archivé',
};

export default function ImportProjectsDialog({ open, onClose, onCreate, users = [] }) {
  const [preview, setPreview] = useState(null); // array of projects to create
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [doneCount, setDoneCount] = useState(null);
  const inputRef = useRef();

  if (!open) return null;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPreview(null);
    setDoneCount(null);
    setLoading(true);
    try {
      const projects = await parseProjectsFromExcel(file);
      if (!projects.length) {
        setError('Aucun projet trouvé dans le fichier. Vérifiez que les en-têtes correspondent au template.');
      } else {
        setPreview(projects);
      }
    } catch (err) {
      setError('Erreur lors de la lecture du fichier : ' + err.message);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleConfirm = async () => {
    if (!preview?.length || !onCreate) return;
    setImporting(true);
    let count = 0;
    const errors = [];
    for (const project of preview) {
      try {
        await onCreate(project);
        count++;
      } catch (err) {
        console.error('Erreur import projet', project.name, err);
        errors.push(project.name);
      }
    }
    setImporting(false);
    setPreview(null);
    if (count === 0) {
      setError(`Échec de l'import : aucun projet créé. Erreur Supabase : ${errors.length} projet(s) en erreur. Vérifiez la console.`);
    } else {
      setDoneCount(count);
      if (errors.length > 0) {
        setError(`${errors.length} projet(s) n'ont pas pu être créés : ${errors.join(', ')}`);
      }
    }
  };

  const handleClose = () => {
    setPreview(null);
    setError(null);
    setDoneCount(null);
    setLoading(false);
    setImporting(false);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300,
    }}>
      <div style={{
        background: 'var(--df-bg)', borderRadius: 12, width: '90%', maxWidth: 860,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid var(--df-border-2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Upload size={20} color="var(--df-primary-text)" />
            <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--df-text-1b)' }}>Import de projets</span>
          </div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--df-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Succès */}
          {doneCount !== null && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 12, padding: '32px 0', color: '#10B981',
            }}>
              <CheckCircle2 size={48} />
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--df-text-1b)', margin: 0 }}>
                {doneCount} projet{doneCount > 1 ? 's' : ''} créé{doneCount > 1 ? 's' : ''} avec succès
              </p>
              <button onClick={handleClose} style={{
                marginTop: 8, background: 'var(--df-primary)', color: 'white',
                border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontWeight: 600,
              }}>
                Fermer
              </button>
            </div>
          )}

          {doneCount === null && (
            <>
              {/* Actions fichier */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <button
                  onClick={() => downloadProjectsTemplate(users)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'var(--df-surface-2)', color: 'var(--df-text-2)', border: '1px solid var(--df-border-strong)',
                    borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 500, fontSize: 13,
                  }}
                >
                  <Download size={15} /> Télécharger le template
                </button>

                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={loading || importing}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'var(--df-primary)', color: 'white', border: 'none',
                    borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                    opacity: (loading || importing) ? 0.6 : 1,
                  }}
                >
                  <Upload size={15} /> {loading ? 'Lecture...' : 'Choisir un fichier Excel'}
                </button>
                <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
              </div>

              {/* Erreur */}
              {error && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  background: 'var(--df-danger-bg)', border: '1px solid var(--df-x-FECACA)', borderRadius: 8, padding: '12px 16px',
                  color: 'var(--df-danger-text)', fontSize: 13, marginBottom: 16,
                }}>
                  <AlertCircle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                  {error}
                </div>
              )}

              {/* Prévisualisation */}
              {preview && (
                <>
                  <p style={{ fontSize: 13, color: 'var(--df-muted)', marginBottom: 10 }}>
                    <strong style={{ color: 'var(--df-text-1b)' }}>{preview.length} projet{preview.length > 1 ? 's' : ''}</strong> à créer — vérifiez avant de confirmer :
                  </p>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'var(--df-surface)' }}>
                          {['Nom', 'Responsable', 'Statut', 'Livraison', 'Budget Prépa/Conf/Pose', 'Consommé Prépa/Conf/Pose', 'Modules', 'Lieu'].map(h => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--df-text-2)', fontWeight: 600, borderBottom: '2px solid var(--df-border-2)', whiteSpace: 'nowrap' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((p, i) => (
                          <tr key={p.id} style={{ borderBottom: '1px solid var(--df-surface-2)', background: i % 2 === 0 ? 'var(--df-bg)' : 'var(--df-surface-5)' }}>
                            <td style={{ padding: '7px 10px', fontWeight: 600, color: 'var(--df-text-1b)' }}>{p.name}</td>
                            <td style={{ padding: '7px 10px', color: 'var(--df-text-2)' }}>{p.manager || '—'}</td>
                            <td style={{ padding: '7px 10px' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: 'var(--df-blue-bg)', color: '#3B82F6' }}>
                                {STATUS_LABELS[p.status] || p.status}
                              </span>
                            </td>
                            <td style={{ padding: '7px 10px', color: 'var(--df-text-2)', whiteSpace: 'nowrap' }}>{p.deadline || '—'}</td>
                            <td style={{ padding: '7px 10px', color: 'var(--df-text-2)', whiteSpace: 'nowrap' }}>
                              {p.budget.prepa}h / {p.budget.conf}h / {p.budget.pose}h
                            </td>
                            <td style={{ padding: '7px 10px', color: 'var(--df-text-2)', whiteSpace: 'nowrap' }}>
                              {p.consumed_import.prepa}h / {p.consumed_import.conf}h / {p.consumed_import.pose}h
                            </td>
                            <td style={{ padding: '7px 10px', color: 'var(--df-text-2)' }}>
                              {p.rows.map(r => r.produit).join(', ') || '—'}
                            </td>
                            <td style={{ padding: '7px 10px', color: 'var(--df-muted)' }}>{p.location || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {preview && doneCount === null && (
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 10,
            padding: '14px 24px', borderTop: '1px solid var(--df-border-2)',
          }}>
            <button onClick={() => setPreview(null)} style={{
              background: 'none', border: '1px solid var(--df-border-strong)', borderRadius: 8,
              padding: '8px 18px', cursor: 'pointer', color: 'var(--df-text-2)', fontWeight: 500,
            }}>
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={importing}
              style={{
                background: 'var(--df-primary)', color: 'white', border: 'none', borderRadius: 8,
                padding: '8px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 14,
                opacity: importing ? 0.6 : 1,
              }}
            >
              {importing ? 'Création en cours...' : `Créer ${preview.length} projet${preview.length > 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
