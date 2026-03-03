// src/lib/schemas/mobilier.js

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

export const MOBILIER_SCHEMA = [
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
        valueOptions: ['Tête de Lit']
    }),

    createCol('realise_par', 'Réalisé par', 120, 'singleSelect', {
        valueOptions: ['Lenglart', 'Sous-Traitant']
    }),

    createCol('largeur', 'Largeur', 80, 'number'),
    createCol('hauteur', 'Hauteur', 80, 'number'),
    createCol('epaisseur', 'Épaisseur', 80, 'number'),

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

    createCol('passementerie_1', 'Passementerie 1', 180, 'catalog_item', { category: 'Passementerie' }),
    createCol('app_passementerie_1', 'Application Passementerie 1', 180, 'text'),
    createCol('ml_pass_1', 'ML P1', 70, 'number'),
    createCol('pa_pass_1', 'PA P1', 70, 'number'),
    createCol('pv_pass_1', 'PV P1', 70, 'number'),

    createCol('heures_pose', 'H. Pose', 80, 'number'),
    createCol('pv_pose', 'PV Pose', 80, 'number'),

    createCol('heures_confection', 'H. Conf', 80, 'number'),
    createCol('pv_confection', 'PV Conf', 80, 'number'),

    createCol('st_pose_pa', 'ST Pose PA', 90, 'number'),
    createCol('st_pose_pv', 'ST Pose PV', 90, 'number'),

    createCol('st_conf_pa', 'ST Conf PA', 90, 'number'),
    createCol('st_conf_pv', 'ST Conf PV', 90, 'number'),

    createCol('livraison', 'Livraison', 90, 'number'),

    createCol('unit_price', 'P.U.', 100, 'number'),
    createCol('quantite', 'Qté', 70, 'number'),
    createCol('total_price', 'Total', 100, 'number'),
].map(c => ({ ...c, key: c.field }));

const hideZero = (params) => {
    const val = (params && typeof params === 'object' && 'value' in params) ? params.value : params;
    if (!val || Number(val) === 0) return '';
    return val;
};

const renderSubcontractor = (params, context) => {
    let row = context;
    if (!row && params && params.api) row = params.api.getRow(params.id);
    if (!row && params && params.row) row = params.row;
    const stVal = Number(row?.st_conf_pa || 0) + Number(row?.st_pose_pa || 0); // Simplified for safety
    const val = (params && typeof params === 'object' && 'value' in params) ? params.value : params;
    if (stVal <= 0) return '';
    return val;
};

export const MOBILIER_PROD_SCHEMA = [
    'detail',
    'zone', 'piece', 'produit', 'realise_par',
    'largeur', 'hauteur', 'epaisseur', // longueur was historically repurposed as epaisseur, but we use strict epaisseur now
    'tissu_1', 'laize_tissu_1', 'ml_tissu_1',
    'tissu_2', 'laize_tissu_2', 'ml_tissu_2',
    'passementerie_1', 'app_passementerie_1', 'ml_pass_1',
    { field: 'heures_pose', valueFormatter: hideZero },
    { field: 'heures_confection', valueFormatter: hideZero },
    'quantite',
    // We add schema_photo only for Prod
    createCol('schema_photo', 'Schéma', 120, 'photo'),
    {
        field: 'sous_traite_par',
        headerName: 'Sous-traité par',
        width: 150,
        editable: true,
        valueFormatter: renderSubcontractor
    }
].map(def => {
    if (typeof def === 'string') return MOBILIER_SCHEMA.find(c => c.field === def || c.key === def) || { field: def, headerName: def };
    if (!def.field && def.key) def.field = def.key;
    const base = MOBILIER_SCHEMA.find(c => c.field === def.field);
    return base ? { ...base, ...def } : def;
}).filter(Boolean).map(c => ({ ...c, key: c.field || c.key }));
