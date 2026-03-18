export const INITIAL_GROUPS_CONFIG = {
    prepa: {
        id: 'prepa',
        label: 'PRÉPARATION',
        bg: '#FFF7ED',
        members: [] // Sera rempli dynamiquement
    },
    conf: {
        id: 'conf',
        label: 'ATELIER CONFECTION',
        bg: '#F8FAFC',
        members: [
            { id: 'backlog_confection', first_name: 'BACKLOG', last_name: 'SEMAINE' } // Ressource Virtuelle
        ]
    },
    pose: {
        id: 'pose',
        label: 'ÉQUIPES DE POSE',
        bg: '#F0FDF4',
        members: []
    }
};

// Palette de couleurs distinctes assignées par projet (via hash du projectId)
const PROJECT_COLOR_PALETTE = [
    { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF' }, // Bleu
    { bg: '#DCFCE7', border: '#16A34A', text: '#166534' }, // Vert
    { bg: '#FEF9C3', border: '#CA8A04', text: '#854D0E' }, // Jaune
    { bg: '#FCE7F3', border: '#DB2777', text: '#9D174D' }, // Rose
    { bg: '#EDE9FE', border: '#7C3AED', text: '#5B21B6' }, // Violet
    { bg: '#FFEDD5', border: '#EA580C', text: '#9A3412' }, // Orange
    { bg: '#CFFAFE', border: '#0891B2', text: '#155E75' }, // Cyan
    { bg: '#ECFDF5', border: '#059669', text: '#064E3B' }, // Émeraude
    { bg: '#FEF2F2', border: '#DC2626', text: '#7F1D1D' }, // Rouge vif
    { bg: '#F5F3FF', border: '#6D28D9', text: '#4C1D95' }, // Indigo
    { bg: '#FFF7ED', border: '#C2410C', text: '#7C2D12' }, // Ambre
    { bg: '#F0FDF4', border: '#15803D', text: '#14532D' }, // Vert foncé
    { bg: '#EFF6FF', border: '#1D4ED8', text: '#1E3A8A' }, // Bleu roi
    { bg: '#FDF2F8', border: '#A21CAF', text: '#701A75' }, // Fuchsia
    { bg: '#F0FDFA', border: '#0D9488', text: '#134E4A' }, // Teal
    { bg: '#FFFBEB', border: '#D97706', text: '#78350F' }, // Miel
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
    pose: { bg: '#DCFCE7', border: '#4ADE80', text: '#166534' },  // Vert
    conf: { bg: '#DBEAFE', border: "#60A5FA", text: "#1E40AF" },  // Bleu
    prepa: { bg: '#FEF9C3', border: "#FACC15", text: "#854D0E" }, // Jaune
    absence: { bg: "#FEE2E2", border: "#EF4444", text: "#991B1B", pattern: true }, // Rouge
    default: { bg: '#F3F4F6', border: "#9CA3AF", text: "#374151" } // Gris
};

// CONSTANTES DIMENSION
export const ROW_HEIGHT = 70;
export const PROGRAMME_ROW_HEIGHT = 130;
export const HEADER_HEIGHT_1 = 36;
export const HEADER_HEIGHT_2 = 40;
export const WORK_START_HOUR = 8; // 8h00
export const WORK_END_HOUR = 17;   // 17h00
export const TOTAL_WORK_MINUTES = (WORK_END_HOUR - WORK_START_HOUR) * 60; // 9h = 540 min
