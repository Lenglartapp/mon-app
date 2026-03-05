// src/lib/schemas/chiffrage/stores_bateaux.js
// Schéma commercial pour le module "Stores" (Bateaux/Velum)

export const STORES_BATEAUX_SCHEMA = [
    // detail (button) : Détail
    { key: "detail", label: "Détail", type: "button", width: 100 },

    // zone (text) : Zone
    { key: "zone", label: "Zone", type: "text", width: 100 },

    // piece (text) : Pièce
    { key: "piece", label: "Pièce", type: "text", width: 100 },

    // produit (select) - Concerne uniquement Bateau / Velum
    {
        key: "produit",
        label: "Produit",
        type: "select",
        options: ['Store Bateau', 'Store Velum'],
        width: 140
    },

    // largeur (number) : Largeur
    { key: "largeur", label: "Largeur", type: "number", width: 90 },

    // hauteur_saisie (number) : Hauteur (Saisie Libre)
    { key: "hauteur", label: "Hauteur", type: "number", width: 90 },

    // toil_finition_1 (text/catalog) : Tissu 1 
    { key: "toile_finition_1", label: "Tissu 1", type: "catalog_item", category: "Tissu,Tissus", width: 150 },

    // laize_toile_finition_1 (number) : Laize toile finition 1 
    { key: "laize_toile_finition_1", label: "Laize TF1", type: "number", width: 90 },

    // raccord_v_toile_finition_1 (number) : Rac V. TF1 
    { key: "raccord_v_toile_finition_1", label: "Rac V. TF1", type: "number", width: 90 },

    // raccord_h_toile_finition_1 (number) : Rac H. TF1 
    { key: "raccord_h_toile_finition_1", label: "Rac H. TF1", type: "number", width: 90 },

    // ml_toile_finition_1 (number) : ML Toile finition 1 (Saisie manuelle) 
    { key: "ml_toile_finition_1", label: "ML TF1", type: "number", width: 100 },

    // pa_toile_finition_1 (number) : PA TF1 
    { key: "pa_toile_finition_1", label: "PA TF1", type: "number", width: 90 },

    // pv_toile_finition_1 (number) : PV TF1 
    { key: "pv_toile_finition_1", label: "PV TF1", type: "number", width: 90 },

    // doublure (text/catalog) : Doublure 
    { key: "doublure", label: "Doublure", type: "catalog_item", category: "Tissu,Tissus", width: 140 },

    // laize_doublure (number) : Laize D. 
    { key: "laize_doublure", label: "Laize D.", type: "number", width: 90 },

    // ml_doublure (number) : ML Doubl. (Saisie manuelle) 
    { key: "ml_doublure", label: "ML Doubl.", type: "number", width: 100 },

    // pa_doublure (number) : PA Doubl. 
    { key: "pa_doublure", label: "PA Doubl.", type: "number", width: 90 },

    // pv_doublure (number) : PV Doubl. 
    { key: "pv_doublure", label: "PV Doubl.", type: "number", width: 90 },

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

    // type_pose (select) : Type de pose
    { key: "type_pose", label: "Pose", type: "select", options: ['Mural', 'Ouvrant', 'Plafond'], width: 120 },

    // heures_pose (number) : H. Pose
    { key: "heures_pose", label: "H. Pose", type: "number", width: 80 },

    // pv_pose (number, readOnly) : PV Pose 
    { key: "pv_pose", label: "PV Pose", type: "number", width: 90 },

    // heures_confection (number) : H. Conf
    { key: "heures_confection", label: "H. Conf", type: "number", width: 80 },

    // pv_confection (number, readOnly) : PV Conf 
    { key: "pv_confection", label: "PV Conf", type: "number", width: 90 },

    { key: "st_pose_pa", label: "ST Pose PA", type: "number", width: 90 },

    // st_pose_pv (number, readOnly) : ST Pose PV 
    { key: "st_pose_pv", label: "ST Pose PV", type: "number", width: 90 },

    // livraison (number) : Livraison
    { key: "livraison", label: "Livraison", type: "number", width: 90 },

    // unit_price (number, readOnly) : P.U
    { key: "unit_price", label: "P.U", type: "number", width: 110, valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value) },

    // quantite (number) : Qté
    { key: "quantite", label: "Qté", type: "number", width: 70 },

    // total_price (number, readOnly) : Total
    { key: "total_price", label: "Total", type: "number", width: 120 },
];
