// src/lib/schemas/chiffrage/coussins.js
// Schéma commercial pour le module "Coussins"

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

export const COUSSINS_SCHEMA = [
    // 0. Actions / Context
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
        valueOptions: ['Coussins']
    }),

    // 2. Dimensions
    createCol('largeur', 'Largeur', 80, 'number'),
    createCol('hauteur', 'Hauteur', 80, 'number'),
    createCol('epaisseur', 'Épaisseur', 80, 'number'),

    // 3. MATIÈRES - Tissu 1
    createCol('tissu_1', 'Tissu 1', 180, 'catalog_item', { category: 'Tissu' }),
    createCol('laize_tissu_1', 'Laize 1', 70, 'number'),
    createCol('ml_tissu_1', 'ML T1', 70, 'number'),
    createCol('pa_tissu_1', 'PA T1', 70, 'number'),
    createCol('pv_tissu_1', 'PV T1', 70, 'number'),

    // 3b. Tissu 2
    createCol('tissu_2', 'Tissu 2', 180, 'catalog_item', { category: 'Tissu', hide: true }),
    createCol('laize_tissu_2', 'Laize 2', 70, 'number', { hide: true }),
    createCol('ml_tissu_2', 'ML T2', 70, 'number', { hide: true }),
    createCol('pa_tissu_2', 'PA T2', 70, 'number', { hide: true }),
    createCol('pv_tissu_2', 'PV T2', 70, 'number', { hide: true }),

    // 3c. Intérieur (Garniture)
    createCol('type_interieur', 'Intérieur', 150, 'singleSelect', {
        valueOptions: ['Mousse', 'Intérieur Plume', 'Intérieur Polyester'], hide: true
    }),
    createCol('pa_interieur', 'PA Int.', 70, 'number', { hide: true }),
    createCol('pv_interieur', 'PV Int.', 70, 'number', { hide: true }),

    // 4. Passementerie 1
    createCol('passementerie_1', 'Passementerie 1', 180, 'catalog_item', { category: 'Passementerie' }),
    createCol('app_passementerie_1', 'Application Passementerie 1', 180, 'text'),
    createCol('ml_pass_1', 'ML P1', 70, 'number'),
    createCol('pa_pass_1', 'PA P1', 70, 'number'),
    createCol('pv_pass_1', 'PV P1', 70, 'number'),

    // 5. Passementerie 2
    createCol('passementerie_2', 'Passementerie 2', 180, 'catalog_item', { category: 'Passementerie', hide: true }),
    createCol('app_passementerie_2', 'Application Passementerie 2', 180, 'text', { hide: true }),
    createCol('ml_pass_2', 'ML P2', 70, 'number', { hide: true }),
    createCol('pa_pass_2', 'PA P2', 70, 'number', { hide: true }),
    createCol('pv_pass_2', 'PV P2', 70, 'number', { hide: true }),

    // 7. PRESTATIONS
    createCol('heures_confection', 'H. Conf', 80, 'number', { hide: true }),
    createCol('pv_confection', 'PV Conf', 80, 'number', { hide: true }),

    createCol('st_conf_pa', 'ST Conf PA', 90, 'number'),
    createCol('st_conf_pv', 'ST Conf PV', 90, 'number'),

    createCol('livraison', 'Livraison', 90, 'number'),

    // 8. TOTAUX
    createCol('unit_price', 'P.U.', 100, 'number', { valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value) }),
    createCol('quantite', 'Qté', 70, 'number', { editable: false, defaultValue: 1 }),
    createCol('total_price', 'Total', 100, 'number'),
].map(c => ({ ...c, key: c.field }));
