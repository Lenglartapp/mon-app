// Installation de Droitfil comme application (Dock sur Mac, menu Démarrer sur Windows,
// écran d'accueil sur téléphone), même principe que Trame.
// Chrome / Edge proposent l'installation via l'événement « beforeinstallprompt » : on le
// garde de côté pour le déclencher depuis notre bouton. Ailleurs (Safari, Firefox), on
// explique la marche à suivre.
import { useSyncExternalStore } from 'react';

let deferred = null;
let justInstalled = false;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

// Importé tôt (main.jsx) : l'événement arrive dès le chargement de la page.
if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferred = e;
        emit();
    });
    window.addEventListener('appinstalled', () => {
        deferred = null;
        justInstalled = true;
        emit();
    });
}

/** 'ios' | 'android' | 'mac-safari' | 'firefox' | 'chromium' | 'other' */
export function detectPlatform() {
    const ua = navigator.userAgent;
    const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (iOS) return 'ios';
    if (/Firefox\//.test(ua)) return 'firefox';
    if (/Android/.test(ua)) return 'android';
    const chromium = /Chrome\/|Chromium\/|Edg\//.test(ua);
    if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !chromium) return 'mac-safari';
    if (chromium) return 'chromium';
    return 'other';
}

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

let snapshot = { installed: false, canPrompt: false };
function read() {
    const next = { installed: justInstalled || isStandalone(), canPrompt: deferred !== null };
    if (next.installed !== snapshot.installed || next.canPrompt !== snapshot.canPrompt) snapshot = next;
    return snapshot;
}
function subscribe(cb) {
    listeners.add(cb);
    const mq = window.matchMedia('(display-mode: standalone)');
    mq.addEventListener('change', cb);
    return () => { listeners.delete(cb); mq.removeEventListener('change', cb); };
}

/** { installed, canPrompt } — se met à jour tout seul. */
export function useInstallState() {
    return useSyncExternalStore(subscribe, read);
}

/** Ouvre la fenêtre d'installation du navigateur. Renvoie false si elle n'est pas disponible. */
export async function promptInstall() {
    if (!deferred) return false;
    const event = deferred;
    await event.prompt();
    const { outcome } = await event.userChoice;
    deferred = null;
    emit();
    return outcome === 'accepted';
}
