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
        width: 100,
        sortable: false,
        renderCell: (params) => '👁️',
    },

    // 1. Context & Produit
    createCol('zone', 'Zone', 80, 'text', autoCap),
    createCol('piece', 'Pièce', 100, 'text', autoCap),
    createCol('produit', 'Produit', 150, 'text', autoCap), // Free text input

    // 2. Dimensions
    createCol('largeur', 'Largeur', 80, 'number'),
    createCol('hauteur', 'Hauteur', 80, 'number'),

    // 3. Tissu 1
    createCol('tissu_1', 'Tissu 1', 180, 'catalog_item', { category: 'Tissu' }),
    createCol('ml_tissu_1', 'ML T1', 70, 'number'),
    createCol('pa_tissu_1', 'PA T1', 70, 'number'), // Auto-calc or Manual
    createCol('pv_tissu_1', 'PV T1', 70, 'number'),

    // 4. Tissu 2
    createCol('tissu_2', 'Tissu 2', 180, 'catalog_item', { category: 'Tissu' }),
    createCol('ml_tissu_2', 'ML T2', 70, 'number'),
    createCol('pa_tissu_2', 'PA T2', 70, 'number'),
    createCol('pv_tissu_2', 'PV T2', 70, 'number'),

    // 5. Mécanisme
    createCol('mecanisme', 'Mécanisme', 180, 'text'), // Free text
    createCol('pa_mecanisme', 'PA Méca', 80, 'number'),
    createCol('pv_mecanisme', 'PV Méca', 80, 'number'),

    // 6. Prestations Internal
    createCol('heures_prepa', 'H. Prépa', 80, 'number'),
    createCol('pv_prepa', 'PV Prépa', 80, 'number'),

    createCol('heures_pose', 'H. Pose', 80, 'number'),
    createCol('pv_pose', 'PV Pose', 80, 'number'),

    createCol('heures_confection', 'H. Conf', 80, 'number'),
    createCol('pv_confection', 'PV Conf', 80, 'number'),

    // 7. Sous-traitance
    createCol('st_conf_pa', 'ST Conf PA', 90, 'number'),
    createCol('st_conf_pv', 'ST Conf PV', 90, 'number'),

    createCol('st_pose_pa', 'ST Pose PA', 90, 'number'),
    createCol('st_pose_pv', 'ST Pose PV', 90, 'number'),

    // 8. Totaux
    createCol('unit_price', 'P.U.', 100, 'number'),
    createCol('quantite', 'Qté', 70, 'number'),
    createCol('total_price', 'Total', 100, 'number'),

].map(c => ({ ...c, key: c.field }));

export const AUTRES_PROD_SCHEMA = AUTRES_SCHEMA.filter(c => {
    const k = c.field;
    if (k.startsWith('pa_') || k.startsWith('pv_')) return false;
    if (['unit_price', 'total_price', 'livraison'].includes(k)) return false;
    if (k.startsWith('st_')) return false;
    if (k.startsWith('heures_')) return false;
    if (k.startsWith('ml_')) return false;
    return true;
});
