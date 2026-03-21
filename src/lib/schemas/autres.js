// src/lib/schemas/autres.js
// Schéma pour le module "Autre" (Confection Générique)

const createCol = (key, label, width, type = 'text', options = {}) => ({
    field: key,
    headerName: label,
    width,
    type,
    editable: true,
    ...options
});

const autoCap = {
    valueParser: (value) => {
        if (!value || typeof value !== 'string') return value;
        return value.charAt(0).toUpperCase() + value.slice(1);
    }
};

export const AUTRES_SCHEMA = [
    // 0. Actions
    {
        field: 'detail',
        headerName: 'Détail',
        width: 130,
        sortable: false,
        renderCell: (params) => '👁️',
    },

    // 1. Context & Produit
    createCol('zone', 'Zone', 120, 'text', autoCap),
    createCol('piece', 'Pièce', 120, 'text', autoCap),
    createCol('produit', 'Produit', 125, 'text', autoCap),

    // 2. Dimensions
    createCol('largeur', 'Largeur', 130, 'number'),
    createCol('hauteur', 'Hauteur', 130, 'number'),

    // 3. Tissu 1
    createCol('tissu_1', 'Tissu 1', 180, 'catalog_item', { category: 'Tissu' }),
    createCol('ml_tissu_1', 'ML T1', 140, 'number'),
    createCol('pa_tissu_1', 'PA T1', 115, 'number'),
    createCol('pv_tissu_1', 'PV T1', 115, 'number'),

    // 4. Tissu 2
    createCol('tissu_2', 'Tissu 2', 180, 'catalog_item', { category: 'Tissu' }),
    createCol('ml_tissu_2', 'ML T2', 140, 'number'),
    createCol('pa_tissu_2', 'PA T2', 115, 'number'),
    createCol('pv_tissu_2', 'PV T2', 115, 'number'),

    // 5. Mécanisme
    createCol('mecanisme', 'Mécanisme', 180, 'text'),
    createCol('pa_mecanisme', 'PA Méca', 135, 'number'),
    createCol('pv_mecanisme', 'PV Méca', 135, 'number'),

    // 6. Prestations Internal
    createCol('heures_prepa', 'H. Prépa', 135, 'number'),
    createCol('pv_prepa', 'PV Prépa', 136, 'number'),

    createCol('heures_pose', 'H. Pose', 130, 'number'),
    createCol('pv_pose', 'PV Pose', 135, 'number'),

    createCol('heures_confection', 'H. Conf', 130, 'number'),
    createCol('pv_confection', 'PV Conf', 130, 'number'),

    // 7. Sous-traitance
    createCol('st_conf_pa', 'ST Conf PA', 150, 'number'),
    createCol('st_conf_pv', 'ST Conf PV', 150, 'number'),

    createCol('st_pose_pa', 'ST Pose PA', 150, 'number'),
    createCol('st_pose_pv', 'ST Pose PV', 150, 'number'),

    // 8. Totaux
    createCol('unit_price', 'P.U.', 115, 'number'),
    createCol('quantite', 'Qté', 115, 'number'),
    createCol('total_price', 'Total', 125, 'number'),

].map(c => ({ ...c, key: c.field }));

// Helper for conditional rendering (Hide 0)
const hideZero = (params) => {
    const val = (params && typeof params === 'object' && 'value' in params) ? params.value : params;
    if (!val || Number(val) === 0) return '';
    return val;
};

// Subcontracting Logic Helpers
const renderSubcontractorGeneric = (params, context, triggerField) => {
    // 1. Try context row
    let row = context;
    // 2. Try params.api
    if (!row && params && params.api) {
        row = params.api.getRow(params.id);
    }
    // 3. Try params.row
    if (!row && params && params.row) {
        row = params.row;
    }

    const stVal = Number(row?.[triggerField] || 0);
    const val = (params && typeof params === 'object' && 'value' in params) ? params.value : params;

    if (stVal <= 0) return '';
    return val;
};

export const AUTRES_PROD_SCHEMA = [
    'detail',
    'zone', 'piece', 'produit',
    'largeur', 'hauteur',
    'tissu_1', 'ml_tissu_1',
    'tissu_2', 'ml_tissu_2',
    'mecanisme',

    // HEURES (Hide if 0)
    { field: 'heures_prepa', valueFormatter: hideZero },
    { field: 'heures_pose', valueFormatter: hideZero },
    { field: 'heures_confection', valueFormatter: hideZero },

    // SOUS-TRAITANCE CONF
    {
        field: 'st_conf_par',
        headerName: 'ST Conf par',
        width: 150,
        editable: true,
        valueFormatter: (params, ctx) => renderSubcontractorGeneric(params, ctx, 'st_conf_pa')
    },

    // SOUS-TRAITANCE POSE
    {
        field: 'st_pose_par',
        headerName: 'ST Pose par',
        width: 150,
        editable: true,
        valueFormatter: (params, ctx) => renderSubcontractorGeneric(params, ctx, 'st_pose_pa')
    },

    'quantite'
    // NO TOTAL, NO PU requested
].map(def => {
    if (typeof def === 'string') {
        const found = AUTRES_SCHEMA.find(c => c.field === def || c.key === def);
        return found ? found : null;
    }
    if (!def.field && def.key) def.field = def.key;
    const base = AUTRES_SCHEMA.find(c => c.field === def.field);
    return base ? { ...base, ...def } : def;
}).filter(Boolean).map(c => ({ ...c, key: c.field || c.key }));
