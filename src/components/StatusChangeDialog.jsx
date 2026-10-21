import React from 'react';
import DaDialog from './ui/DaDialog';
import { ToolbarButton } from './ui/ToolbarControls';

const eur = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);
const fmtH = (n) => `${(Math.round((Number(n) || 0) * 10) / 10).toLocaleString('fr-FR')} h`;

const CONFIG = {
  PENDING_APPROVAL: {
    title: 'Demander la validation',
    text: 'Adrien et Aristide recevront une notification pour valider ce devis.',
    label: 'Message (facultatif)',
    placeholder: 'Contexte, points à regarder…',
    button: 'Envoyer la demande',
  },
  VALIDATED: {
    title: 'Valider le devis',
    text: "Le montant ci-dessous est gardé dans l'historique. Si le prix du devis change ensuite, il repassera « En cours » et devra être revalidé.",
    label: 'Commentaire (facultatif)',
    placeholder: '',
  },
  REVISE: {
    title: 'Mettre « À reprendre »',
    text: 'Le motif est envoyé à la personne qui a demandé la validation et gardé dans l’historique.',
    label: 'Motif (obligatoire)',
    placeholder: 'Ce qu’il faut reprendre…',
    button: 'Mettre à reprendre',
    required: true,
  },
};

/** Fenêtre de changement de statut du circuit de validation (demande, validation, à reprendre). */
export default function StatusChangeDialog({ to, minuteName, figures = {}, requester, onConfirm, onCancel }) {
  const [comment, setComment] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const cfg = CONFIG[to];
  if (!cfg) return null;
  const canConfirm = !busy && (!cfg.required || comment.trim().length > 0);
  const confirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try { await onConfirm(comment.trim()); } finally { setBusy(false); }
  };

  const rows = [
    ['Prix de vente HT', eur(figures.ca), true],
    figures.achats != null && ['Achats matières', eur(figures.achats)],
    figures.heures != null && ['Heures', fmtH(figures.heures)],
    requester && to !== 'PENDING_APPROVAL' && ['Demandé par', requester],
  ].filter(Boolean);

  return (
    <DaDialog
      open
      onClose={onCancel}
      title={cfg.title}
      subtitle={minuteName}
      maxWidth="xs"
      footer={(
        <>
          <span style={{ flex: 1 }} />
          <ToolbarButton onClick={onCancel}>Annuler</ToolbarButton>
          <ToolbarButton primary disabled={!canConfirm} onClick={confirm}>
            {busy ? 'Envoi…' : (cfg.button || `Valider à ${eur(figures.ca)} HT`)}
          </ToolbarButton>
        </>
      )}
    >
      <div style={{ fontSize: 13, color: 'var(--df-muted)', lineHeight: 1.5 }}>{cfg.text}</div>
      <div style={{ marginTop: 16, display: 'grid', gap: 0 }}>
        {rows.map(([label, value, strong]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid var(--df-border-soft)', fontSize: 13 }}>
            <span style={{ color: 'var(--df-text-2)' }}>{label}</span>
            <span style={{ color: 'var(--df-text)', fontWeight: strong ? 500 : 400 }}>{value}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--df-muted)', marginBottom: 6 }}>{cfg.label}</div>
        <textarea
          autoFocus={!!cfg.required}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={cfg.placeholder}
          rows={3}
          style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid var(--df-border)', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
        />
      </div>
    </DaDialog>
  );
}
