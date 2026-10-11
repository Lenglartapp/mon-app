// Première connexion par un lien d'invitation (ou de réinitialisation) : la personne est déjà
// connectée par le lien, il lui reste à choisir son mot de passe pour les fois suivantes.
import React, { useState } from 'react';
import { TextField } from '@mui/material';
import { supabase, MUST_SET_PASSWORD_KEY } from '../lib/supabaseClient';
import { DaField } from '../components/ui/DaForm';
import { ToolbarButton } from '../components/ui/ToolbarControls';
import { DA_FIELD_SX } from '../lib/constants/daStyles';

export default function SetPasswordScreen({ name, onDone }) {
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (pwd.length < 8) return setError('Au moins 8 caractères.');
    if (pwd !== pwd2) return setError('Les deux mots de passe ne correspondent pas.');
    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password: pwd });
    setSaving(false);
    if (err) return setError(err.message);
    try { sessionStorage.removeItem(MUST_SET_PASSWORD_KEY); } catch { /* rien */ }
    onDone();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', padding: 24, fontFamily: 'Roboto, system-ui, sans-serif' }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <img src="/logo.png" alt="Droitfil" style={{ height: 40, objectFit: 'contain', alignSelf: 'flex-start' }} />
        <h1 style={{ fontSize: 28, fontWeight: 400, color: '#111827', margin: '8px 0 0' }}>Bienvenue{name ? `, ${name.split(' ')[0]}` : ''}</h1>
        <div style={{ fontSize: 14, color: '#6B7280', marginTop: -8 }}>Choisissez votre mot de passe pour vos prochaines connexions.</div>
        <DaField label="Mot de passe" hint="Au moins 8 caractères.">
          <TextField type="password" fullWidth size="small" value={pwd} onChange={(e) => setPwd(e.target.value)} sx={DA_FIELD_SX} autoFocus />
        </DaField>
        <DaField label="Confirmer le mot de passe">
          <TextField type="password" fullWidth size="small" value={pwd2} onChange={(e) => setPwd2(e.target.value)} sx={DA_FIELD_SX} />
        </DaField>
        {error && <div style={{ fontSize: 13, color: '#B42318' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <ToolbarButton primary disabled={saving} onClick={submit}>{saving ? 'Enregistrement…' : 'Enregistrer et continuer'}</ToolbarButton>
        </div>
      </form>
    </div>
  );
}
