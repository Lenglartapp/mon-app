// Mode clair / sombre de Droitfil.
// Choix par appareil (localStorage) : 'light' (défaut), 'dark' ou 'auto' (suit le système).
// Le thème est posé sur <html data-theme="…"> : les couleurs nommées (tokens.css) suivent.
import React, { useEffect, useMemo, useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ThemeModeContext } from './themeContext';

const KEY = 'df-theme';

const readMode = () => {
    try { const v = localStorage.getItem(KEY); return v === 'dark' || v === 'auto' ? v : 'light'; } catch { return 'light'; }
};
const systemDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export function ThemeModeProvider({ children }) {
    const [mode, setModeState] = useState(readMode);
    const [sysDark, setSysDark] = useState(systemDark);

    useEffect(() => {
        const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
        if (!mq) return undefined;
        const on = (e) => setSysDark(e.matches);
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, []);

    const resolved = mode === 'auto' ? (sysDark ? 'dark' : 'light') : mode;

    useEffect(() => {
        const root = document.documentElement;
        if (resolved === 'dark') root.setAttribute('data-theme', 'dark');
        else root.removeAttribute('data-theme');
        // Barre d'état du téléphone / fenêtre installée
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#191919' : '#ffffff');
    }, [resolved]);

    // Impression (étiquettes, PDF) : toujours en clair, sur papier blanc.
    useEffect(() => {
        if (resolved !== 'dark') return undefined;
        const before = () => document.documentElement.removeAttribute('data-theme');
        const after = () => document.documentElement.setAttribute('data-theme', 'dark');
        window.addEventListener('beforeprint', before);
        window.addEventListener('afterprint', after);
        return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
    }, [resolved]);

    const setMode = (m) => {
        setModeState(m);
        try { localStorage.setItem(KEY, m); } catch { /* navigation privée */ }
    };

    // Mode clair : thème MUI par défaut, strictement inchangé. Mode sombre : palette sombre MUI
    // calée sur nos couleurs (fonds, textes, traits).
    const muiTheme = useMemo(() => (resolved === 'dark'
        ? createTheme({
            palette: {
                mode: 'dark',
                background: { default: '#191919', paper: '#1F1F1F' },
                text: { primary: '#ECECEA', secondary: '#A0A09C' },
                divider: '#363636',
                primary: { main: '#5A78D8' },
            },
            // Pas de voile clair sur les fenêtres / menus (MUI éclaircit le fond selon l'élévation) :
            // les fenêtres restent dans nos gris, à peine plus clairs que la page.
            components: {
                MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
                // Initiales des avatars sans couleur propre : texte clair (MUI met le fond de page)
                MuiAvatar: { styleOverrides: { colorDefault: { color: '#ECECEA' } } },
            },
        })
        : createTheme()), [resolved]);

    const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved]);
    return (
        <ThemeModeContext.Provider value={value}>
            <ThemeProvider theme={muiTheme}>{children}</ThemeProvider>
        </ThemeModeContext.Provider>
    );
}

