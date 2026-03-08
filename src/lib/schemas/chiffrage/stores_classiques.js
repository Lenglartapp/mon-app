// src/lib/schemas/chiffrage/stores_classiques.js
// Schéma commercial pour le module "Stores" (Classiques)

const STORE_BLOCKED_TYPES = [
    'Store Enrouleur',
    'Store Vénitien',
    'Store Californien',
    'Store Canishade'
];

const isBlocked = (row) => STORE_BLOCKED_TYPES.includes(row?.produit);

export const STORES_CLASSIQUES_SCHEMA = [
    // detail (button) : Détail
    { key: "detail", label: "Détail", type: "button", width: 100 },

    // zone (text) : Zone
    { key: "zone", label: "Zone", type: "text", width: 100 },

    // piece (text) : Pièce
    { key: "piece", label: "Pièce", type: "text", width: 100 },

    // produit (select) - Filtré pour ne pas inclure Bateau/Velum
    {
        key: "produit",
        label: "Produit",
        type: "select",
        options: ['Store Enrouleur', 'Store Vénitien', 'Store Californien', 'Store Canishade', 'Autre'],
        width: 140
    },

    // largeur (number) : Largeur
    { key: "largeur", label: "Largeur", type: "number", width: 90 },

    // hauteur (number) : Hauteur 
    { key: "hauteur", label: "Hauteur", type: "number", width: 90 },

    // mecanisme_store (text/catalog) : Meca store
    { key: "mecanisme_store", label: "Méca Store", type: "catalog_item", category: "Store,Stores,Mecanisme Store", width: 140 },

    // pa_mecanisme_store (number) : PA Méca
    { key: "pa_mecanisme_store", label: "PA Méca", type: "number", width: 90 },

    // pv_mecanisme_store (number) : PV Méca
    { key: "pv_mecanisme_store", label: "PV Méca", type: "number", width: 90 },

    // heures_prepa (number) : H. Prépa
    { key: "heures_prepa", label: "H. Prépa", type: "number", width: 80 },

    // pv_prepa (number, readOnly) : PV Prépa 
    { key: "pv_prepa", label: "PV Prépa", type: "number", width: 90 },

    // heures_pose (number) : H. Pose
    { key: "heures_pose", label: "H. Pose", type: "number", width: 80 },

    // pv_pose (number, readOnly) : PV Pose 
    { key: "pv_pose", label: "PV Pose", type: "number", width: 90 },

    { key: "st_pose_pa", label: "ST Pose PA", type: "number", width: 90 },

    // st_pose_pv (number, readOnly) : ST Pose PV 
    { key: "st_pose_pv", label: "ST Pose PV", type: "number", width: 90 },

    // livraison (number) : Livraison
    { key: "livraison", label: "Livraison", type: "number", width: 90 },

    // unit_price (number, readOnly) : P.U
    { key: "unit_price", label: "P.U", type: "number", width: 110, valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value) },

    { key: "quantite", label: "Qté", type: "number", width: 70, readOnly: true, defaultValue: 1 },

    // total_price (number, readOnly) : Total
    { key: "total_price", label: "Total", type: "number", width: 120 },
];
