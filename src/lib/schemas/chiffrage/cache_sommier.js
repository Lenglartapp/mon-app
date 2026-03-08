// src/lib/schemas/chiffrage/cache_sommier.js
// Schéma commercial pour le module "Cache-Sommier"

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

export const CACHE_SOMMIER_SCHEMA = [
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
        valueOptions: ['Cache-Sommier']
    }),

    createCol('type_confection', 'Confection', 150, 'singleSelect', {
        valueOptions: ['Confection boîte', 'Plis Dior']
    }),

    createCol('largeur', 'Largeur', 80, 'number'),
    createCol('longueur', 'Longueur', 80, 'number'),
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

    createCol('passementerie_1', 'Passementerie 1', 180, 'catalog_item', { category: 'Passementerie', hide: true }),
    createCol('app_passementerie_1', 'Application Passementerie 1', 180, 'text', { hide: true }),
    createCol('ml_pass_1', 'ML P1', 70, 'number', { hide: true }),
    createCol('pa_pass_1', 'PA P1', 70, 'number', { hide: true }),
    createCol('pv_pass_1', 'PV P1', 70, 'number', { hide: true }),

    createCol('passementerie_2', 'Passementerie 2', 180, 'catalog_item', { category: 'Passementerie', hide: true }),
    createCol('app_passementerie_2', 'Application Passementerie 2', 180, 'text', { hide: true }),
    createCol('ml_pass_2', 'ML P2', 70, 'number', { hide: true }),
    createCol('pa_pass_2', 'PA P2', 70, 'number', { hide: true }),
    createCol('pv_pass_2', 'PV P2', 70, 'number', { hide: true }),

    createCol('heures_confection', 'H. Conf', 80, 'number'),
    createCol('pv_confection', 'PV Conf', 80, 'number'),

    createCol('st_conf_pa', 'ST Conf PA', 90, 'number'),
    createCol('st_conf_pv', 'ST Conf PV', 90, 'number'),

    createCol('livraison', 'Livraison', 90, 'number'),

    createCol('unit_price', 'P.U.', 100, 'number', { valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value) }),
    createCol('quantite', 'Qté', 70, 'number', { editable: false, defaultValue: 1 }),
    createCol('total_price', 'Total', 100, 'number')
].map(c => ({ ...c, key: c.field }));
