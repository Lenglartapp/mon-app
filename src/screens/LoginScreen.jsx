// Écran de connexion : même DA que le reste de Droitfil (Roboto, champs à libellé au-dessus,
// trait #E0DED9, bouton bleu nuit, pas de majuscules). Photo de l'atelier à gauche sur ordinateur.
import React, { useState } from 'react';
import { TextField, InputAdornment, IconButton, CircularProgress } from '@mui/material';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../auth';
import { DaField } from '../components/ui/DaForm';
import { DA_FIELD_SX } from '../lib/constants/daStyles';

const ROBOTO = 'Roboto, system-ui, sans-serif';

// Champs un peu plus hauts que dans l'appli (écran d'entrée, souvent sur tablette / téléphone)
const FIELD_SX = {
    ...DA_FIELD_SX,
    '& .MuiOutlinedInput-root': { ...DA_FIELD_SX['& .MuiOutlinedInput-root'], height: 44, fontSize: 15 },
};

export default function LoginScreen() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await login(email, password);
        } catch (err) {
            console.error(err);
            setError('E-mail ou mot de passe incorrect.');
            setLoading(false);
        }
    };

    const canSubmit = !loading && !!email && !!password;

    return (
        <div className="df-login" style={{ minHeight: '100vh', display: 'flex', background: 'var(--df-bg)', fontFamily: ROBOTO }}>
            <style>{`
                .df-login-photo { display: none; }
                @media (min-width: 900px) { .df-login-photo { display: block; } }
            `}</style>

            {/* Photo de l'atelier (ordinateur / tablette paysage) */}
            <div className="df-login-photo" style={{ flex: '1 1 52%', padding: 16 }}>
                <div style={{ position: 'relative', height: '100%', minHeight: 560, borderRadius: 12, overflow: 'hidden', background: '#111827' }}>
                    <img src="/atelier-lenglart.jpg" alt="Atelier Lenglart"
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(17,24,39,0.82) 0%, rgba(17,24,39,0.15) 55%, transparent 100%)' }} />
                    <div style={{ position: 'absolute', left: 40, right: 40, bottom: 40, color: '#FFFFFF' }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.75)' }}>L'excellence au bout du fil</div>
                        <div style={{ fontSize: 40, fontWeight: 300, lineHeight: 1.15, marginTop: 8, letterSpacing: -0.5 }}>
                            Faire du beau<br />et du durable
                        </div>
                    </div>
                </div>
            </div>

            {/* Formulaire */}
            <div style={{ flex: '1 1 48%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px 24px' }}>
                <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <img className="df-logo" src="/logo.png" alt="Droitfil" style={{ height: 40, objectFit: 'contain', alignSelf: 'flex-start', marginBottom: 12, marginLeft: -26 /* marge blanche intégrée à l'image */ }} />

                    <div>
                        <h1 style={{ fontSize: 32, fontWeight: 400, color: 'var(--df-text)', margin: 0 }}>Connexion</h1>
                        <div style={{ fontSize: 14, color: 'var(--df-muted)', marginTop: 6 }}>Accédez à votre espace Droitfil.</div>
                    </div>

                    {error && (
                        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--df-danger-border)', background: 'var(--df-danger-bg)', color: 'var(--df-danger-text)', fontSize: 13 }}>
                            <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
                        </div>
                    )}

                    <DaField label="E-mail">
                        <TextField
                            type="email" fullWidth autoFocus autoComplete="username"
                            value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading}
                            placeholder="prenom.nom@lenglart.com" sx={FIELD_SX}
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><Mail size={17} color="var(--df-faint)" /></InputAdornment>,
                            }}
                        />
                    </DaField>

                    <DaField label="Mot de passe">
                        <TextField
                            type={showPassword ? 'text' : 'password'} fullWidth autoComplete="current-password"
                            value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading}
                            sx={FIELD_SX}
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><Lock size={17} color="var(--df-faint)" /></InputAdornment>,
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton onClick={() => setShowPassword((v) => !v)} edge="end" size="small"
                                            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                                            {showPassword ? <EyeOff size={17} color="var(--df-muted)" /> : <Eye size={17} color="var(--df-muted)" />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </DaField>

                    <button type="submit" disabled={!canSubmit} style={{
                        marginTop: 6, height: 44, borderRadius: 8, border: 'none', fontFamily: ROBOTO, fontSize: 14, fontWeight: 600,
                        background: 'var(--df-primary)', color: '#FFFFFF', cursor: canSubmit ? 'pointer' : 'not-allowed',
                        opacity: canSubmit || loading ? 1 : 0.45, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                        {loading ? <><CircularProgress size={16} color="inherit" /> Connexion…</> : 'Se connecter'}
                    </button>

                    <div style={{ fontSize: 12, color: 'var(--df-faint)', marginTop: 24 }}>© {new Date().getFullYear()} Lenglart</div>
                </form>
            </div>
        </div>
    );
}
