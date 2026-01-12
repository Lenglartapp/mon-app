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
        members: []
    },
    pose: {
        id: 'pose',
        label: 'ÉQUIPES DE POSE',
        bg: '#F0FDF4',
        members: []
    }
};

export const PLANNING_COLORS = {
    pose: { bg: '#DCFCE7', border: '#4ADE80', text: '#166534' },  // Vert
    conf: { bg: '#DBEAFE', border: "#60A5FA", text: "#1E40AF" },  // Bleu
    prepa: { bg: '#FEF9C3', border: "#FACC15", text: "#854D0E" }, // Jaune
    absence: { bg: "#FEE2E2", border: "#EF4444", text: "#991B1B", pattern: true }, // Rouge
    default: { bg: '#F3F4F6', border: "#9CA3AF", text: "#374151" } // Gris
};

// CONSTANTES DIMENSION
export const ROW_HEIGHT = 70;
export const HEADER_HEIGHT_1 = 36;
export const HEADER_HEIGHT_2 = 40;
export const WORK_START_HOUR = 8; // 8h00
export const WORK_END_HOUR = 17;   // 17h00
export const TOTAL_WORK_MINUTES = (WORK_END_HOUR - WORK_START_HOUR) * 60; // 9h = 540 min
