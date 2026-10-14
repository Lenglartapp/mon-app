import React from 'react';
import DaDialog from '../ui/DaDialog';
import { ToolbarButton, TonePill } from '../ui/ToolbarControls';
import { readProjectVersions } from '../../lib/projectVersions';

const MUTED = '#6B7280';
const REASONS = {
  auto: { label: 'Auto', tone: null },
  'shrink-guard': { label: 'Sécurité (chute)', tone: 2 },
  'pre-restore': { label: 'Avant restauration', tone: 4 },
};

const relative = (iso) => {
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "À l'instant";
  if (s < 3600) return `Il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `Il y a ${Math.floor(s / 3600)} h`;
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
};

/**
 * Versions des lignes d'un projet (comme l'historique de versions d'Office 365).
 * Une version = l'état des lignes AVANT une modification (au plus une toutes les 15 min).
 * « Revenir à cette version » remplace les lignes actuelles ; l'état actuel est gardé
 * juste avant (version « Avant restauration ») → la restauration s'annule de la même façon.
 */
export default function ProjectVersionsDialog({ project, currentCount, onClose, onRestore }) {
  const [versions, setVersions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [selected, setSelected] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    readProjectVersions(project?.id)
      .then((v) => { if (alive) setVersions(v); })
      .catch((e) => { if (alive) setError(/projects_history/.test(e.message || '') ? "L'historique des versions n'est pas encore activé (requête SQL à exécuter)." : e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [project?.id]);

  const restore = async (v) => {
    if (busy) return;
    const when = new Date(v.captured_at).toLocaleString('fr-FR');
    const question = v.reason === 'pre-restore'
      ? `Annuler cette restauration et remettre les lignes telles qu'elles étaient le ${when} ?`
      : `Revenir aux lignes du ${when} ?\nL'état actuel est gardé : la restauration pourra être annulée depuis cette même liste.`;
    if (!window.confirm(question)) return;
    setBusy(true);
    setError(null);
    try { await onRestore(v); onClose(); }
    catch (e) { setError(e.message || String(e)); }
    finally { setBusy(false); }
  };

  return (
    <DaDialog
      open
      onClose={onClose}
      title="Historique des versions"
      subtitle={`${project?.name || 'Projet'} · lignes du projet (${currentCount} actuellement)`}
      maxWidth="sm"
      height="80vh"
      bodyPadding="18px 28px"
    >
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 14, lineHeight: 1.5 }}>
        Une version est gardée automatiquement avant chaque modification (au plus une toutes les 15 minutes).
        Revenir à une version remplace les lignes du projet ; le journal et les infos du dossier ne changent pas.
        Chaque restauration est inscrite au journal du projet et peut être annulée.
      </div>
      {loading && <div style={{ color: '#9CA3AF', fontSize: 13 }}>Chargement des versions…</div>}
      {error && <div style={{ color: '#B91C1C', fontSize: 13, marginBottom: 10 }}>{error}</div>}
      {!loading && !error && versions.length === 0 && (
        <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '40px 0', fontSize: 13 }}>
          Aucune version pour l'instant.<br />Les versions se créent automatiquement au fil des modifications.
        </div>
      )}
      {versions[0]?.reason === 'pre-restore' && (
        <div style={{ border: '1px solid #1E2447', borderRadius: 8, padding: '10px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: '#EEF4FD' }}>
          <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: '#111827' }}>
            Dernière action : restauration{versions[0].author ? ` par ${versions[0].author}` : ''} ({relative(versions[0].captured_at).toLowerCase()}).
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Erreur ? Remettez les lignes telles qu'elles étaient juste avant.</div>
          </div>
          <ToolbarButton primary disabled={busy} onClick={() => restore(versions[0])}>Annuler cette restauration</ToolbarButton>
        </div>
      )}
      {versions.map((v) => {
        const r = REASONS[v.reason] || REASONS.auto;
        const isSel = selected === v.id;
        const isUndo = v.reason === 'pre-restore';
        const who = v.reason === 'pre-restore' ? (v.author ? `restauration par ${v.author}` : null) : (v.changed_by ? `modifié ensuite par ${v.changed_by}` : null);
        return (
          <div key={v.id} style={{ border: `1px solid ${isSel ? '#1E2447' : '#E8E6E2'}`, borderRadius: 8, marginBottom: 8, background: 'white', overflow: 'hidden' }}>
            <div onClick={() => setSelected(isSel ? null : v.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', cursor: 'pointer' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{relative(v.captured_at)}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                  {new Date(v.captured_at).toLocaleString('fr-FR')} · {v.nb_lignes ?? '—'} ligne(s){who ? ` · ${who}` : ''}
                </div>
              </div>
              <TonePill tone={r.tone}>{r.label}</TonePill>
            </div>
            {isSel && (
              <div style={{ borderTop: '1px solid #E8E6E2', padding: 12, background: '#F4F4F4', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: MUTED, flex: 1, minWidth: 200 }}>
                  {isUndo
                    ? `Remet les lignes telles qu'elles étaient juste avant cette restauration (${v.nb_lignes ?? '—'} ligne(s)).`
                    : `Les lignes reviennent à cet état (${v.nb_lignes ?? '—'} ligne(s)). L'état actuel est gardé avant.`}
                </span>
                <ToolbarButton primary disabled={busy} onClick={() => restore(v)}>{busy ? 'Restauration…' : (isUndo ? 'Annuler cette restauration' : 'Revenir à cette version')}</ToolbarButton>
              </div>
            )}
          </div>
        );
      })}
    </DaDialog>
  );
}
