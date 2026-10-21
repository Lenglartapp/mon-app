export const INITIAL_GROUPS_CONFIG = {
    prepa: {
        id: 'prepa',
        label: 'Préparation',
        bg: 'var(--df-surface)',
        members: [] // Sera rempli dynamiquement
    },
    conf: {
        id: 'conf',
        label: 'Confection',
        bg: 'var(--df-surface)',
        members: [
            { id: 'backlog_confection', first_name: 'BACKLOG', last_name: 'SEMAINE' } // Ressource Virtuelle
        ]
    },
    pose: {
        id: 'pose',
        label: 'Pose',
        bg: 'var(--df-surface)',
        members: []
    }
};

// Palette de couleurs distinctes assignées par projet (via hash du projectId)
const PROJECT_COLOR_PALETTE = [
    { bg: 'var(--df-blue-bg-2)', border: '#3B82F6', text: 'var(--df-x-1E40AF)' }, // Bleu
    { bg: 'var(--df-green-bg-2)', border: '#16A34A', text: 'var(--df-chip-status)' }, // Vert
    { bg: 'var(--df-yellow-bg)', border: '#CA8A04', text: 'var(--df-x-854D0E)' }, // Jaune
    { bg: 'var(--df-rose-hover)', border: '#DB2777', text: 'var(--df-x-9D174D)' }, // Rose
    { bg: 'var(--df-violet-bg-2)', border: '#7C3AED', text: 'var(--df-x-5B21B6)' }, // Violet
    { bg: 'var(--df-orange-bg)', border: '#EA580C', text: 'var(--df-chip-owner)' }, // Orange
    { bg: 'var(--df-x-CFFAFE)', border: '#0891B2', text: 'var(--df-x-155E75)' }, // Cyan
    { bg: 'var(--df-success-bg)', border: '#059669', text: 'var(--df-green-strong)' }, // Émeraude
    { bg: 'var(--df-danger-bg)', border: '#DC2626', text: 'var(--df-x-7F1D1D)' }, // Rouge vif
    { bg: 'var(--df-violet-bg)', border: '#6D28D9', text: 'var(--df-x-4C1D95)' }, // Indigo
    { bg: 'var(--df-chip-owner-bg)', border: 'var(--df-x-C2410C)', text: 'var(--df-x-7C2D12)' }, // Ambre
    { bg: 'var(--df-chip-status-bg)', border: 'var(--df-x-15803D)', text: 'var(--df-x-14532D)' }, // Vert foncé
    { bg: 'var(--df-blue-bg)', border: 'var(--df-x-1D4ED8)', text: 'var(--df-blue-strong)' }, // Bleu roi
    { bg: 'var(--df-x-FDF2F8)', border: '#A21CAF', text: 'var(--df-x-701A75)' }, // Fuchsia
    { bg: 'var(--df-x-F0FDFA)', border: '#0D9488', text: 'var(--df-x-134E4A)' }, // Teal
    { bg: 'var(--df-chip-adv-bg)', border: '#D97706', text: 'var(--df-x-78350F)' }, // Miel
];

function _hashProjectId(projectId) {
    const str = String(projectId);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    return Math.abs(hash);
}

export function getProjectColor(projectId) {
    if (!projectId) return null;
    return PROJECT_COLOR_PALETTE[_hashProjectId(projectId) % PROJECT_COLOR_PALETTE.length];
}

export const PLANNING_COLORS = {
    pose: { bg: 'var(--df-green-bg-2)', border: '#4ADE80', text: 'var(--df-chip-status)' },  // Vert
    conf: { bg: 'var(--df-blue-bg-2)', border: "#60A5FA", text: "var(--df-x-1E40AF)" },  // Bleu
    prepa: { bg: 'var(--df-yellow-bg)', border: "#FACC15", text: "var(--df-x-854D0E)" }, // Jaune
    absence: { bg: "var(--df-danger-border)", border: "var(--df-danger)", text: "var(--df-x-991B1B)", pattern: true }, // Rouge
    default: { bg: 'var(--df-surface-2)', border: "var(--df-faint)", text: "var(--df-text-2)" } // Gris
};

// CONSTANTES DIMENSION
export const ROW_HEIGHT = 70;
export const PROGRAMME_ROW_HEIGHT = 160;
export const HEADER_HEIGHT_1 = 36;
export const HEADER_HEIGHT_2 = 40;
export const WORK_START_HOUR = 8; // 8h00
export const WORK_END_HOUR = 17;   // 17h00
export const TOTAL_WORK_MINUTES = (WORK_END_HOUR - WORK_START_HOUR) * 60; // 9h = 540 min

// Temps contractuel travaillé par jour et par personne
export const DEFAULT_DAILY_HOURS = 8;      // Pose et défaut
export const ATELIER_HOURS_PER_DAY = 7.8;  // Confection & préparation (atelier)

// Heures contractuelles par jour selon le service
export const dailyHoursForGroup = (groupKey) =>
    (groupKey === 'conf' || groupKey === 'prepa') ? ATELIER_HOURS_PER_DAY : DEFAULT_DAILY_HOURS;

// --- CONTRATS (CDI / CDD / Intérim) ---
export const CONTRACT_TYPES = ['CDI', 'CDD', 'Intérim'];

// Date de fin effective d'un membre : fin de contrat, ou date d'archivage si archivé.
export const memberEndDate = (m) =>
    m.contract_end_date || (m.archived_at ? String(m.archived_at).slice(0, 10) : null);

// Le membre est-il présent (sous contrat, non archivé) un jour donné 'yyyy-MM-dd' ?
export const isMemberActiveOnDay = (m, dayStr) => {
    const start = m.contract_start_date;
    const end = memberEndDate(m);
    if (start && dayStr < start) return false;
    if (end && dayStr > end) return false;
    return true;
};

// La fenêtre de contrat du membre chevauche-t-elle la période [rangeStart, rangeEnd] ?
export const memberContractOverlaps = (m, rangeStart, rangeEnd) => {
    const start = m.contract_start_date;
    const end = memberEndDate(m);
    if (start && start > rangeEnd) return false;
    if (end && end < rangeStart) return false;
    return true;
};
