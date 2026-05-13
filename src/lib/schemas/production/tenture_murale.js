// src/lib/schemas/production/tenture_murale.js
// Schéma atelier pour le module "Tenture Murale"

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

const BASE_TENTURE_MURALE_SCHEMA = [
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
        valueOptions: ['Tenture Murale'],
        editable: false,
        readOnly: true,
    }),

    createCol('largeur', 'Largeur', 130, 'number'),
    createCol('hauteur', 'Hauteur', 130, 'number'),

    createCol('tissu_1', 'Tissu 1', 180, 'catalog_item', { category: 'Tissu' }),
    createCol('laize_tissu_1', 'Laize 1', 120, 'number'),
    createCol('ml_tissu_1', 'ML T1', 130, 'number'),
    createCol('pa_tissu_1', 'PA T1', 100, 'number'),
    createCol('pv_tissu_1', 'PV T1', 100, 'number'),

    createCol('molleton', 'Molleton', 180, 'catalog_item', { category: 'Tissu' }),
    createCol('ml_molleton', 'ML Mol.', 130, 'number'),
    createCol('pa_molleton', 'PA Mol.', 100, 'number'),
    createCol('pv_molleton', 'PV Mol.', 100, 'number'),

    createCol('passementerie_1', 'Passementerie 1', 180, 'catalog_item', { category: 'Passementerie' }),
    createCol('app_passementerie_1', 'Application Passementerie 1', 180, 'text'),
    createCol('ml_pass_1', 'ML P1', 130, 'number'),
    createCol('pa_pass_1', 'PA P1', 100, 'number'),
    createCol('pv_pass_1', 'PV P1', 100, 'number'),

    createCol('baguette_1', 'Baguette 1', 180, 'catalog_item', { category: 'Rail' }),
    createCol('ml_baguette_1', 'ML B1', 130, 'number'),
    createCol('pa_baguette_1', 'PA B1', 100, 'number'),
    createCol('pv_baguette_1', 'PV B1', 100, 'number'),

    createCol('baguette_2', 'Baguette 2', 180, 'catalog_item', { category: 'Rail' }),
    createCol('ml_baguette_2', 'ML B2', 130, 'number'),
    createCol('pa_baguette_2', 'PA B2', 100, 'number'),
    createCol('pv_baguette_2', 'PV B2', 100, 'number'),

    createCol('heures_pose', 'H. Pose', 120, 'number'),
    createCol('pv_pose', 'PV Pose', 100, 'number'),

    createCol('heures_confection', 'H. Conf', 120, 'number'),
    createCol('pv_confection', 'PV Conf', 100, 'number'),

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

export const TENTURE_MURALE_PROD_SCHEMA = [
    'detail',
    'zone', 'piece', 'produit',
    'largeur', 'hauteur',
    createCol('largeur_coupe', 'Larg. Coupe', 120, 'number'),
    createCol('hauteur_coupe', 'Haut. Coupe', 125, 'number'),
    'tissu_1', 'laize_tissu_1', 'ml_tissu_1',
    'molleton', 'ml_molleton',
    'passementerie_1', 'app_passementerie_1', 'ml_pass_1',
    'baguette_1', 'ml_baguette_1',
    'baguette_2', 'ml_baguette_2',
    { field: 'heures_confection', valueFormatter: hideZero },
    {
        field: 'statut_conf',
        headerName: 'Statut Conf',
        type: 'select',
        width: 150,
        editable: true,
        options: ['Non démarré', 'En cours', 'Terminé'],
        readOnly: (row) => !(Number(row?.heures_confection) > 0),
    },
    createCol('schema_photo', 'Schéma', 120, 'photo'),
    createCol('photos_sur_site', 'Photo sur site', 150, 'photo'),
    'quantite',
].map(def => {
    if (typeof def === 'string') return BASE_TENTURE_MURALE_SCHEMA.find(c => c.field === def || c.key === def) || { field: def, headerName: def };
    if (!def.field && def.key) def.field = def.key;
    const base = BASE_TENTURE_MURALE_SCHEMA.find(c => c.field === def.field);
    return base ? { ...base, ...def } : def;
}).filter(Boolean).map(c => ({ ...c, key: c.field || c.key }));
