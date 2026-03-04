// src/lib/schemas/coussins.js
// Schéma spécifique pour le module "Coussins"

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

    // 1. Produit
    createCol('produit', 'Produit', 150, 'singleSelect', {
        valueOptions: ['Coussins']
    }),

    createCol('realise_par', 'Réalisé par', 120, 'singleSelect', {
        valueOptions: ['Lenglart', 'Sous-Traitant']
    }),

    // 2. Dimensions
    createCol('largeur', 'Largeur', 80, 'number'),
    createCol('hauteur', 'Hauteur', 80, 'number'),
    createCol('epaisseur', 'Épaisseur', 80, 'number'),

    createCol('largeur_coupe', 'Larg. Coupe', 100, 'number', {
        editable: false,
        readOnly: true,
        valueGetter: (value, row) => {
            const actualRow = row || value?.row || {};
            const l = Number(actualRow.largeur) || 0;
            const ep = Number(actualRow.epaisseur) || 0;
            if (ep <= 10) return l + 5;
            if (ep <= 15) return l + 6;
            return l + 8;
        }
    }),

    createCol('hauteur_coupe', 'Haut. Coupe', 100, 'number', {
        editable: false,
        readOnly: true,
        valueGetter: (value, row) => {
            const actualRow = row || value?.row || {};
            const h = Number(actualRow.hauteur) || 0;
            const ep = Number(actualRow.epaisseur) || 0;
            if (ep <= 10) return h + 5;
            if (ep <= 15) return h + 6;
            return h + 8;
        }
    }),

    // 3. MATIÈRES - Tissu 1
    createCol('tissu_1', 'Tissu 1', 180, 'catalog_item', { category: 'Tissu' }),
    createCol('laize_tissu_1', 'Laize 1', 70, 'number'),
    createCol('ml_tissu_1', 'ML T1', 70, 'number'),
    createCol('pa_tissu_1', 'PA T1', 70, 'number'),
    createCol('pv_tissu_1', 'PV T1', 70, 'number'),

    // 3b. Tissu 2
    createCol('tissu_2', 'Tissu 2', 180, 'catalog_item', { category: 'Tissu' }),
    createCol('laize_tissu_2', 'Laize 2', 70, 'number'),
    createCol('ml_tissu_2', 'ML T2', 70, 'number'),
    createCol('pa_tissu_2', 'PA T2', 70, 'number'),
    createCol('pv_tissu_2', 'PV T2', 70, 'number'),

    // 3c. Intérieur (Garniture)
    createCol('type_interieur', 'Intérieur', 150, 'singleSelect', {
        valueOptions: ['Mousse', 'Intérieur Plume', 'Intérieur Polyester']
    }),
    createCol('pa_interieur', 'PA Int.', 70, 'number'),
    createCol('pv_interieur', 'PV Int.', 70, 'number'),

    // 4. Passementerie 1
    createCol('passementerie_1', 'Passementerie 1', 180, 'catalog_item', { category: 'Passementerie' }),
    createCol('app_passementerie_1', 'Application Passementerie 1', 180, 'text'),
    createCol('ml_pass_1', 'ML P1', 70, 'number'),
    createCol('pa_pass_1', 'PA P1', 70, 'number'),
    createCol('pv_pass_1', 'PV P1', 70, 'number'),

    // 5. Passementerie 2
    createCol('passementerie_2', 'Passementerie 2', 180, 'catalog_item', { category: 'Passementerie' }),
    createCol('app_passementerie_2', 'Application Passementerie 2', 180, 'text'),
    createCol('ml_pass_2', 'ML P2', 70, 'number'),
    createCol('pa_pass_2', 'PA P2', 70, 'number'),
    createCol('pv_pass_2', 'PV P2', 70, 'number'),

    // 7. PRESTATIONS
    createCol('heures_confection', 'H. Conf', 80, 'number'),
    createCol('pv_confection', 'PV Conf', 80, 'number'),

    createCol('st_conf_pa', 'ST Conf PA', 90, 'number'),
    createCol('st_conf_pv', 'ST Conf PV', 90, 'number'),

    createCol('livraison', 'Livraison', 90, 'number'),

    // 8. TOTAUX
    createCol('unit_price', 'P.U.', 100, 'number'),
    createCol('quantite', 'Qté', 70, 'number'),
    createCol('total_price', 'Total', 100, 'number'),
].map(c => ({ ...c, key: c.field }));

const hideZero = (params) => {
    const val = (params && typeof params === 'object' && 'value' in params) ? params.value : params;
    if (!val || Number(val) === 0) return '';
    return val;
};

export const COUSSINS_PROD_SCHEMA = [
    'detail',
    'zone', 'piece', 'produit', 'realise_par',
    {
        field: 'nom_sous_traitant',
        headerName: 'Nom Sous-Traitant',
        width: 150,
        type: 'text',
        editable: true,
        readOnly: (row) => row?.realise_par !== 'Sous-Traitant'
    },
    'largeur', 'hauteur', 'epaisseur', 'largeur_coupe', 'hauteur_coupe',
    'tissu_1', 'laize_tissu_1', 'ml_tissu_1',
    'tissu_2', 'laize_tissu_2', 'ml_tissu_2',
    'type_interieur',
    'passementerie_1', 'app_passementerie_1', 'ml_pass_1',
    'passementerie_2', 'app_passementerie_2', 'ml_pass_2',
    { field: 'heures_confection', valueFormatter: hideZero },
    createCol('schema_photo', 'Schéma', 120, 'photo'),
    'quantite',
].map(def => {
    if (typeof def === 'string') return COUSSINS_SCHEMA.find(c => c.field === def || c.key === def) || { field: def, headerName: def };
    if (!def.field && def.key) def.field = def.key;
    const base = COUSSINS_SCHEMA.find(c => c.field === def.field);
    return base ? { ...base, ...def } : def;
}).filter(Boolean).map(c => ({ ...c, key: c.field || c.key }));
