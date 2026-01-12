// src/lib/schemas/decors.js
// Schéma spécifique pour le module "Décors de lit" et Tapissier

const createCol = (key, label, width, type = 'text', options = {}) => ({
    field: key,
    headerName: label,
    width, // Allow manual width overrides
    type,
    editable: true,
    ...options
});

// Helper for dynamic readOnly based on product
// Returns TRUE if locked (readOnly), FALSE if editable
const isRegionBlocked = (row) => {
    const p = (row.produit || '').toLowerCase();
    const isCacheSommier = p.includes('cache-sommier');
    const isAutre = p === 'autre' || p === '';

    // Block if NOT Cache Sommier AND NOT "Autre" (or empty)
    // Strictly: Only Cache Sommier has Height editable.
    // User phrase: "sauf pour le Cache-Sommier".
    if (!isCacheSommier && !isAutre) return true; // Locked
    return false; // Editable
};

// Generic readOnly wrapper no longer needed if we use functional readOnly property directly

// Helper for calculated readOnly fields (never editable)
const readOnly = { editable: false };

const autoCap = {
    valueParser: (value) => {
        if (!value || typeof value !== 'string') return value;
        return value.charAt(0).toUpperCase() + value.slice(1);
    }
};

export const DECORS_SCHEMA = [
    // 0. Actions / Context
    {
        field: 'detail',
        headerName: 'Détail',
        width: 100,
        sortable: false,
        renderCell: (params) => '👁️', // Placeholder, Grid controls button 
    },
    createCol('zone', 'Zone', 80, 'text', autoCap),
    createCol('piece', 'Pièce', 100, 'text', autoCap),

    // 1. Produit
    createCol('produit', 'Produit', 150, 'singleSelect', {
        valueOptions: ['Cache-Sommier', 'Coussins', 'Plaid', 'Tête de Lit', 'Tenture Murale', 'Autre']
    }),

    createCol('type_confection', 'Confection', 150, 'text', autoCap),

    // 2. Dimensions
    createCol('largeur', 'Largeur', 80, 'number'),
    createCol('longueur', 'Longueur', 80, 'number'),
    // HAUTEUR: Use direct readOnly function for InputCell styling
    createCol('hauteur', 'Hauteur', 80, 'number', {
        readOnly: (row) => isRegionBlocked(row)
    }),

    // 3. MATIÈRES - Tissu 1 (Renamed from tissu_deco1)
    createCol('tissu_1', 'Tissu 1', 180, 'catalog_item', { category: 'Tissu' }),
    createCol('laize_tissu_1', 'Laize 1', 70, 'number'),
    createCol('ml_tissu_1', 'ML T1', 70, 'number'), // Manuel
    createCol('pa_tissu_1', 'PA T1', 70, 'number'), // Unblocked
    createCol('pv_tissu_1', 'PV T1', 70, 'number'), // Unblocked

    // 3b. Tissu 2 (NEW)
    createCol('tissu_2', 'Tissu 2', 180, 'catalog_item', { category: 'Tissu' }),
    createCol('laize_tissu_2', 'Laize 2', 70, 'number'),
    createCol('ml_tissu_2', 'ML T2', 70, 'number'), // Manuel
    createCol('pa_tissu_2', 'PA T2', 70, 'number'), // Unblocked
    createCol('pv_tissu_2', 'PV T2', 70, 'number'), // Unblocked

    // 3c. Intérieur (Garniture) - NEW
    createCol('type_interieur', 'Intérieur', 150, 'singleSelect', {
        valueOptions: ['Ouate', 'Mousse', 'Intérieur Plume', 'Intérieur Polyester']
    }),
    createCol('pa_interieur', 'PA Int.', 70, 'number'),
    createCol('pv_interieur', 'PV Int.', 70, 'number'),

    // 4. Passementerie 1
    createCol('passementerie_1', 'Passementerie 1', 180, 'catalog_item', { category: 'Passementerie' }),
    createCol('app_passementerie_1', 'Application Passementerie 1', 180, 'text'),
    createCol('ml_pass_1', 'ML P1', 70, 'number'), // Manuel

    createCol('pa_pass_1', 'PA P1', 70, 'number'), // Unblocked
    createCol('pv_pass_1', 'PV P1', 70, 'number'), // Unblocked

    // 5. Passementerie 2 (Kept per Excel)
    createCol('passementerie_2', 'Passementerie 2', 180, 'catalog_item', { category: 'Passementerie' }),
    createCol('app_passementerie_2', 'Application Passementerie 2', 180, 'text'),
    createCol('ml_pass_2', 'ML P2', 70, 'number'), // Manuel
    createCol('pa_pass_2', 'PA P2', 70, 'number'), // Unblocked
    createCol('pv_pass_2', 'PV P2', 70, 'number'), // Unblocked


    // 6. Technique / Mecanisme (Mecanisme Fourniture)
    createCol('mecanisme_fourniture', 'Méca/Fourniture', 180, 'text'),
    createCol('pa_mecanisme', 'PA Méca', 80, 'number'), // Unblocked
    createCol('pv_mecanisme', 'PV Méca', 80, 'number'), // Unblocked

    // 7. PRESTATIONS
    createCol('heures_prepa', 'H. Prépa', 80, 'number'),
    createCol('pv_prepa', 'PV Prépa', 80, 'number'), // Unblocked

    createCol('heures_pose', 'H. Pose', 80, 'number'),
    createCol('pv_pose', 'PV Pose', 80, 'number'), // Unblocked

    createCol('heures_confection', 'H. Conf', 80, 'number'),
    createCol('pv_confection', 'PV Conf', 80, 'number'), // Unblocked

    createCol('st_pose_pa', 'ST Pose PA', 90, 'number'),
    createCol('st_pose_pv', 'ST Pose PV', 90, 'number'), // Unblocked

    createCol('livraison', 'Livraison', 90, 'number'),

    // 8. TOTAUX
    // UNBLOCKED PER USER REQUEST (No ReadOnly)
    createCol('unit_price', 'P.U.', 100, 'number'),
    createCol('quantite', 'Qté', 70, 'number'),
    createCol('total_price', 'Total', 100, 'number'),
].map(c => ({ ...c, key: c.field })); // Ensure 'key' prop exists for internal logic compatibility

// Schema Production (No PA/PV, Hours, Prices)
export const DECORS_PROD_SCHEMA = DECORS_SCHEMA.filter(c => {
    const k = c.field;
    // Exclude PA, PV, Hours, Delivery, Prices
    if (k.startsWith('pa_') || k.startsWith('pv_')) return false;
    if (k.startsWith('heures_')) return false;
    if (k.startsWith('st_')) return false; // Subcontracting costs usually hidden too? User said "PA PV", ST has PA/PV.
    if (['livraison', 'unit_price', 'total_price'].includes(k)) return false;
    return true;
});
