import React, { useState } from 'react';
import { Check, Download } from 'lucide-react';
import DaDialog from '../ui/DaDialog';
import { ToolbarButton } from '../ui/ToolbarControls';
import { detectPlatform, promptInstall, useInstallState } from '../../lib/install';

// Marche à suivre quand le navigateur ne propose pas l'installation en un clic.
const STEPS = {
    'mac-safari': {
        title: 'Installer Droitfil sur votre Mac (Safari)',
        steps: [
            'Dans la barre de menus, ouvrez « Fichier ».',
            'Choisissez « Ajouter au Dock… ».',
            'Validez : Droitfil apparaît dans le Dock et s’ouvre dans sa propre fenêtre.',
        ],
    },
    ios: {
        title: 'Installer Droitfil sur votre iPhone ou iPad',
        steps: [
            'Touchez le bouton Partager (le carré avec une flèche vers le haut).',
            'Choisissez « Sur l’écran d’accueil ».',
            'Touchez « Ajouter ».',
        ],
    },
    android: {
        title: 'Installer Droitfil sur votre téléphone',
        steps: ['Ouvrez le menu ⋮ de Chrome.', 'Choisissez « Installer l’application » (ou « Ajouter à l’écran d’accueil »).'],
    },
    firefox: {
        title: 'Firefox ne sait pas installer d’applications web',
        steps: ['Ouvrez Droitfil dans Chrome, Edge ou Safari.', 'Revenez ici et cliquez sur « Installer Droitfil ».'],
    },
    chromium: {
        title: 'Installer Droitfil (Chrome / Edge)',
        steps: [
            'Cliquez sur l’icône d’installation à droite de la barre d’adresse (un écran avec une flèche).',
            'Ou ouvrez le menu ⋮ → « Caster, enregistrer et partager » → « Installer la page en tant qu’application ».',
            'Sur Edge : menu … → « Applications » → « Installer Droitfil ».',
        ],
    },
    other: {
        title: 'Installer Droitfil',
        steps: ['Utilisez Chrome, Edge ou Safari pour installer Droitfil comme une application.', 'Sur Mac avec Safari : Fichier → « Ajouter au Dock ».'],
    },
};

function InstallHelp({ onClose }) {
    const help = STEPS[detectPlatform()] || STEPS.other;
    return (
        <DaDialog open onClose={onClose} title={help.title} maxWidth="xs"
            footer={<><span style={{ flex: 1 }} /><ToolbarButton primary onClick={onClose}>Compris</ToolbarButton></>}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <img src="/icon-192.png" alt="" width={48} height={48} style={{ borderRadius: 10, flexShrink: 0 }} />
                <ol style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: 'var(--df-text-2)', lineHeight: 1.6 }}>
                    {help.steps.map((s) => <li key={s}>{s}</li>)}
                </ol>
            </div>
            <div style={{ fontSize: 13, color: 'var(--df-muted)', marginTop: 14 }}>Une fois installé, Droitfil se met à jour tout seul.</div>
        </DaDialog>
    );
}

/**
 * Bouton « Installer Droitfil » : installation en un clic quand le navigateur le permet
 * (Chrome, Edge), sinon la marche à suivre. Déjà installé : simple mention.
 */
export default function InstallApp() {
    const { installed, canPrompt } = useInstallState();
    const [help, setHelp] = useState(false);

    if (installed) {
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--df-text-2)' }}>
                <Check size={15} color="#16A34A" /> Installé sur cet appareil
            </span>
        );
    }

    const onClick = async () => {
        if (canPrompt && (await promptInstall())) return;
        if (!canPrompt) setHelp(true);
    };

    return (
        <>
            <ToolbarButton primary icon={<Download size={15} />} onClick={onClick}>Installer Droitfil</ToolbarButton>
            {help && <InstallHelp onClose={() => setHelp(false)} />}
        </>
    );
}
