import React, { useState } from 'react';
import { useAuth } from '../auth';
import {
    Box,
    TextField,
    Button,
    CircularProgress,
    Alert,
    Typography,
    Container,
    Paper,
    InputAdornment,
    IconButton
} from '@mui/material';
import { Visibility, VisibilityOff, Lock, Mail } from '@mui/icons-material';

export default function LoginScreen() {
    const { login } = useAuth();

    // Etats du formulaire
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
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
            setError("Email ou mot de passe incorrect.");
            setLoading(false);
        }
    };

    return (
        <Box sx={{
            minHeight: '100vh',
            width: '100%',
            bgcolor: '#F3F4F6', // Fond gris clair
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2
        }}>
            <Paper
                elevation={6}
                sx={{
                    width: '100%',
                    maxWidth: 1000,
                    height: { xs: 'auto', md: 600 }, // Hauteur fixe sur desktop
                    borderRadius: '24px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: { xs: 'column-reverse', md: 'row' }, // Stack vertical sur mobile
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)'
                }}
            >
                {/* --- LEFT: Image & Catchline (Hidden/Small on Mobile) --- */}
                <Box sx={{
                    flex: 1.1, // Un peu plus large que le form
                    position: 'relative',
                    bgcolor: '#111827',
                    display: { xs: 'none', md: 'block' } // Masqué sur mobile comme demandé
                }}>
                    <Box
                        component="img"
                        src="/atelier-lenglart.jpg"
                        alt="Atelier Lenglart"
                        sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            opacity: 0.7 // Pour assombrir l'image
                        }}
                    />

                    {/* Overlay Text */}
                    <Box sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        width: '100%',
                        p: 6,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
                        color: 'white'
                    }}>
                        <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 2, color: 'rgba(255,255,255,0.8)' }}>
                            L'excellence au bout du fil
                        </Typography>
                        <Typography variant="h3" sx={{
                            fontFamily: 'Roboto, sans-serif',
                            fontWeight: 900,
                            lineHeight: 1.1,
                            mt: 1,
                            textTransform: 'uppercase'
                        }}>
                            Faire du beau<br />et du durable
                        </Typography>
                    </Box>
                </Box>

                {/* --- RIGHT: Login Form --- */}
                <Box sx={{
                    flex: 1,
                    p: { xs: 4, md: 6 },
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    bgcolor: 'white'
                }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4, width: '100%' }}>
                        <img
                            src="/logo.png"
                            alt="LENGLART"
                            style={{ height: 48, marginBottom: 24 }}
                        />
                        <Typography variant="h5" sx={{ fontWeight: 800, color: '#111827', mb: 1 }}>
                            Connexion
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#6B7280', fontWeight: 500 }}>
                            Accédez à votre espace production
                        </Typography>
                    </Box>

                    {error && (
                        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <form onSubmit={handleLogin}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                            <TextField
                                label="Email"
                                type="email"
                                fullWidth
                                variant="outlined"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={loading}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <Mail size={20} color="#9CA3AF" />
                                        </InputAdornment>
                                    ),
                                    sx: { borderRadius: 3 }
                                }}
                            />

                            <TextField
                                label="Mot de passe"
                                type={showPassword ? "text" : "password"}
                                fullWidth
                                variant="outlined"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <Lock size={20} color="#9CA3AF" />
                                        </InputAdornment>
                                    ),
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                onClick={() => setShowPassword(!showPassword)}
                                                edge="end"
                                            >
                                                {showPassword ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                    sx: { borderRadius: 3 }
                                }}
                            />

                            <Button
                                type="submit"
                                variant="contained"
                                size="large"
                                disabled={loading || !email || !password}
                                sx={{
                                    mt: 2,
                                    py: 1.5,
                                    borderRadius: 3,
                                    fontWeight: 700,
                                    bgcolor: '#111827',
                                    fontSize: 15,
                                    textTransform: 'none',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                    '&:hover': { bgcolor: 'black', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }
                                }}
                            >
                                {loading ? <CircularProgress size={24} color="inherit" /> : 'Se connecter'}
                            </Button>
                        </Box>
                    </form>

                    <Box sx={{ mt: 4, textAlign: 'center' }}>
                        <Typography variant="caption" sx={{ color: '#9CA3AF' }}>
                            © 2024 Lenglart - Production 1.0
                        </Typography>
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
}