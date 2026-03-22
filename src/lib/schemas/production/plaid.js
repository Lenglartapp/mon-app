// src/lib/schemas/production/plaid.js
// Schéma atelier pour le module "Plaid"

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

const BASE_PLAID_SCHEMA = [
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
        valueOptions: ['Plaid']
    }),

    createCol('realise_par', 'Réalisé par', 130, 'singleSelect', {
        valueOptions: ['Lenglart', 'Sous-Traitant']
    }),

    createCol('largeur', 'Largeur', 130, 'number'),
    createCol('hauteur', 'Hauteur', 130, 'number'),

    createCol('tissu_1', 'Tissu 1', 180, 'catalog_item', { category: 'Tissu' }),
    createCol('laize_tissu_1', 'Laize 1', 120, 'number'),
    createCol('ml_tissu_1', 'ML T1', 130, 'number'),
    createCol('pa_tissu_1', 'PA T1', 100, 'number'),
    createCol('pv_tissu_1', 'PV T1', 100, 'number'),

    createCol('tissu_2', 'Tissu 2', 180, 'catalog_item', { category: 'Tissu' }),
    createCol('laize_tissu_2', 'Laize 2', 120, 'number'),
    createCol('ml_tissu_2', 'ML T2', 130, 'number'),
    createCol('pa_tissu_2', 'PA T2', 100, 'number'),
    createCol('pv_tissu_2', 'PV T2', 100, 'number'),

    createCol('passementerie_1', 'Passementerie 1', 180, 'catalog_item', { category: 'Passementerie' }),
    createCol('app_passementerie_1', 'Application Passementerie 1', 180, 'text'),
    createCol('ml_pass_1', 'ML P1', 130, 'number'),
    createCol('pa_pass_1', 'PA P1', 100, 'number'),
    createCol('pv_pass_1', 'PV P1', 100, 'number'),

    createCol('passementerie_2', 'Passementerie 2', 180, 'catalog_item', { category: 'Passementerie' }),
    createCol('app_passementerie_2', 'Application Passementerie 2', 180, 'text'),
    createCol('ml_pass_2', 'ML P2', 130, 'number'),
    createCol('pa_pass_2', 'PA P2', 100, 'number'),
    createCol('pv_pass_2', 'PV P2', 100, 'number'),

    createCol('molleton', 'Molleton', 180, 'catalog_item', { category: 'Tissu' }),
    createCol('laize_molleton', 'Laize Mol.', 120, 'number'),
    createCol('ml_molleton', 'ML Mol.', 130, 'number'),
    createCol('pa_molleton', 'PA Mol.', 100, 'number'),
    createCol('pv_molleton', 'PV Mol.', 100, 'number'),

    createCol('heures_confection', 'H. Conf', 120, 'number'),
    createCol('pv_confection', 'PV Conf', 100, 'number'),

    createCol('st_conf_pa', 'ST Conf PA', 150, 'number'),
    createCol('st_conf_pv', 'ST Conf PV', 150, 'number'),

    createCol('livraison', 'Livraison', 140, 'number'),

    createCol('unit_price', 'P.U.', 115, 'number'),
    createCol('quantite', 'Qté', 70, 'number'),
    createCol('total_price', 'Total', 125, 'number'),
].map(c => ({ ...c, key: c.field }));

const hideZero = (params) => {
    const val = (params && typeof params === 'object' && 'value' in params) ? params.value : params;
    if (!val || Number(val) === 0) return '';
    return val;
};

export const PLAID_PROD_SCHEMA = [
    'detail',
    'zone', 'piece', 'produit', 'realise_par',
    {
        field: 'nom_sous_traitant',
        headerName: 'Nom Sous-Traitant',
        width: 170,
        type: 'text',
        editable: true,
        readOnly: (row) => row?.realise_par !== 'Sous-Traitant'
    },
    'largeur', 'hauteur',
    createCol('largeur_coupe', 'Larg. Coupe', 120, 'number', {
        editable: false,
        readOnly: true,
        valueGetter: (value, row) => {
            const r = row || value?.row || {};
            const l = Number(r.largeur) || 0;
            return l + 5;
        }
    }),
    createCol('hauteur_coupe', 'Haut. Coupe', 125, 'number', {
        editable: false,
        readOnly: true,
        valueGetter: (value, row) => {
            const r = row || value?.row || {};
            const h = Number(r.hauteur) || 0;
            return h + 5;
        }
    }),
    'tissu_1', 'laize_tissu_1', 'ml_tissu_1',
    'tissu_2', 'laize_tissu_2', 'ml_tissu_2',
    'molleton', 'laize_molleton', 'ml_molleton',
    'passementerie_1', 'app_passementerie_1', 'ml_pass_1',
    'passementerie_2', 'app_passementerie_2', 'ml_pass_2',
    { field: 'heures_confection', valueFormatter: hideZero },
    createCol('schema_photo', 'Schéma', 120, 'photo'),
    createCol('photos_sur_site', 'Photo sur site', 150, 'photo'),
    'quantite',
].map(def => {
    if (typeof def === 'string') return BASE_PLAID_SCHEMA.find(c => c.field === def || c.key === def) || { field: def, headerName: def };
    if (!def.field && def.key) def.field = def.key;
    const base = BASE_PLAID_SCHEMA.find(c => c.field === def.field);
    return base ? { ...base, ...def } : def;
}).filter(Boolean).map(c => ({ ...c, key: c.field || c.key }));
