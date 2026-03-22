// src/lib/schemas/chiffrage/tenture_murale.js
// Schéma commercial pour le module "Tenture Murale"

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

export const TENTURE_MURALE_SCHEMA = [
    {
        field: 'detail',
        headerName: 'Détail',
        width: 130,
        sortable: false,
        renderCell: (params) => '👁️',
    },
    createCol('zone', 'Zone', 120, 'text', autoCap),
    createCol('piece', 'Pièce', 120, 'text', autoCap),

    createCol('produit', 'Produit', 125, 'singleSelect', {
        valueOptions: ['Tenture Murale']
    }),

    createCol('largeur', 'Largeur', 130, 'number'),
    createCol('hauteur', 'Hauteur', 130, 'number'),

    createCol('tissu_1', 'Tissu 1', 180, 'catalog_item', { category: 'Tissu' }),
    createCol('laize_tissu_1', 'Laize 1', 120, 'number'),
    createCol('ml_tissu_1', 'ML T1', 140, 'number'),
    createCol('pa_tissu_1', 'PA T1', 115, 'number'),
    createCol('pv_tissu_1', 'PV T1', 115, 'number'),

    createCol('molleton', 'Molleton', 180, 'catalog_item', { category: 'Tissu' }),
    createCol('ml_molleton', 'ML Mol.', 140, 'number'),
    createCol('pa_molleton', 'PA Mol.', 115, 'number'),
    createCol('pv_molleton', 'PV Mol.', 115, 'number'),

    createCol('passementerie_1', 'Passementerie 1', 170, 'catalog_item', { category: 'Passementerie' }),
    createCol('app_passementerie_1', 'Application Passementerie 1', 180, 'text'),
    createCol('ml_pass_1', 'ML P1', 140, 'number'),
    createCol('pa_pass_1', 'PA P1', 140, 'number'),
    createCol('pv_pass_1', 'PV P1', 140, 'number'),

    createCol('baguette_1', 'Baguette 1', 180, 'catalog_item', { category: 'Rail' }),
    createCol('ml_baguette_1', 'ML B1', 140, 'number'),
    createCol('pa_baguette_1', 'PA B1', 115, 'number'),
    createCol('pv_baguette_1', 'PV B1', 115, 'number'),

    createCol('baguette_2', 'Baguette 2', 180, 'catalog_item', { category: 'Rail' }),
    createCol('ml_baguette_2', 'ML B2', 140, 'number'),
    createCol('pa_baguette_2', 'PA B2', 115, 'number'),
    createCol('pv_baguette_2', 'PV B2', 115, 'number'),

    createCol('heures_pose', 'H. Pose', 130, 'number'),
    createCol('pv_pose', 'PV Pose', 135, 'number'),

    createCol('heures_confection', 'H. Conf', 130, 'number'),
    createCol('pv_confection', 'PV Conf', 130, 'number'),

    createCol('st_pose_pa', 'ST Pose PA', 150, 'number'),
    createCol('st_pose_pv', 'ST Pose PV', 150, 'number'),

    createCol('livraison', 'Livraison', 140, 'number'),

    createCol('unit_price', 'P.U.', 115, 'number', { valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value) }),
    createCol('quantite', 'Qté', 115, 'number', { editable: false, defaultValue: 1 }),
    createCol('total_price', 'Total', 125, 'number'),
].map(c => ({ ...c, key: c.field }));
