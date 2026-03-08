// src/lib/schemas/chiffrage/plaid.js
// Schéma commercial pour le module "Plaid"

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

export const PLAID_SCHEMA = [
    {
        field: 'detail',
        headerName: 'Détail',
        width: 100,
        sortable: false,
        renderCell: (params) => '👁️',
    },
    createCol('zone', 'Zone', 80, 'text', autoCap),
    createCol('piece', 'Pièce', 100, 'text', autoCap),

    createCol('produit', 'Produit', 150, 'singleSelect', {
        valueOptions: ['Plaid']
    }),

    createCol('largeur', 'Largeur', 80, 'number'),
    createCol('hauteur', 'Hauteur', 80, 'number'),

    createCol('tissu_1', 'Tissu 1', 180, 'catalog_item', { category: 'Tissu' }),
    createCol('laize_tissu_1', 'Laize 1', 70, 'number'),
    createCol('ml_tissu_1', 'ML T1', 70, 'number'),
    createCol('pa_tissu_1', 'PA T1', 70, 'number'),
    createCol('pv_tissu_1', 'PV T1', 70, 'number'),

    createCol('tissu_2', 'Tissu 2', 180, 'catalog_item', { category: 'Tissu' }),
    createCol('laize_tissu_2', 'Laize 2', 70, 'number'),
    createCol('ml_tissu_2', 'ML T2', 70, 'number'),
    createCol('pa_tissu_2', 'PA T2', 70, 'number'),
    createCol('pv_tissu_2', 'PV T2', 70, 'number'),

    createCol('passementerie_1', 'Passement. 1', 180, 'catalog_item', { category: 'Passementerie', hide: true }),
    createCol('app_passementerie_1', 'App. P1', 100, 'text', { hide: true }),
    createCol('ml_pass_1', 'ML Pass 1', 70, 'number', { hide: true }),
    createCol('pa_pass_1', 'PA Pass 1', 70, 'number', { hide: true }),
    createCol('pv_pass_1', 'PV Pass 1', 70, 'number', { hide: true }),

    createCol('passementerie_2', 'Passement. 2', 180, 'catalog_item', { category: 'Passementerie', hide: true }),
    createCol('app_passementerie_2', 'App. P2', 100, 'text', { hide: true }),
    createCol('ml_pass_2', 'ML Pass 2', 70, 'number', { hide: true }),
    createCol('pa_pass_2', 'PA Pass 2', 70, 'number', { hide: true }),
    createCol('pv_pass_2', 'PV Pass 2', 70, 'number', { hide: true }),

    createCol('molleton', 'Molleton', 180, 'catalog_item', { category: 'Tissu' }),
    createCol('laize_molleton', 'Laize Mol.', 70, 'number'),
    createCol('ml_molleton', 'ML Mol.', 70, 'number'),
    createCol('pa_molleton', 'PA Mol.', 70, 'number'),
    createCol('pv_molleton', 'PV Mol.', 70, 'number'),

    createCol('heures_confection', 'H. Conf', 80, 'number'),
    createCol('pv_confection', 'PV Conf', 80, 'number'),

    createCol('st_conf_pa', 'ST Conf PA', 90, 'number'),
    createCol('st_conf_pv', 'ST Conf PV', 90, 'number'),

    createCol('livraison', 'Livraison', 90, 'number'),

    createCol('unit_price', 'P.U.', 100, 'number', { valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value) }),
    createCol('quantite', 'Qté', 70, 'number', { editable: false, defaultValue: 1 }),
    createCol('total_price', 'Total', 100, 'number'),
].map(c => ({ ...c, key: c.field }));
