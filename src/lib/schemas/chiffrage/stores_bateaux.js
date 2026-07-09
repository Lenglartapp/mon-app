// src/lib/schemas/chiffrage/stores_bateaux.js
// Schéma commercial pour le module "Stores" (Bateaux/Velum)

export const STORES_BATEAUX_SCHEMA = [
    // detail (button) : Détail
    { key: "detail", label: "Détail", type: "button", width: 130 },

    // zone (text) : Zone
    { key: "zone", label: "Zone", type: "text", width: 120 },

    // piece (text) : Pièce
    { key: "piece", label: "Pièce", type: "text", width: 120 },

    // produit (select) - Concerne uniquement Bateau / Velum
    {
        key: "produit",
        label: "Produit",
        type: "select",
        options: ['Store Bateau', 'Store Velum'],
        width: 125
    },

    // largeur (number) : Largeur
    { key: "largeur", label: "Largeur", type: "number", width: 130 },

    // hauteur_saisie (number) : Hauteur (Saisie Libre)
    { key: "hauteur", label: "Hauteur", type: "number", width: 130 },

    // toil_finition_1 (text/catalog) : Tissu 1
    { key: "toile_finition_1", label: "Tissu 1", type: "catalog_item", category: "Tissu,Tissus", width: 180 },

    // laize_toile_finition_1 (number) : Laize toile finition 1
    { key: "laize_toile_finition_1", label: "Laize TF1", type: "number", width: 135 },

    // raccord_v_toile_finition_1 (number) : Rac V. TF1
    { key: "raccord_v_toile_finition_1", label: "Rac V. TF1", type: "number", width: 125 },

    // raccord_h_toile_finition_1 (number) : Rac H. TF1
    { key: "raccord_h_toile_finition_1", label: "Rac H. TF1", type: "number", width: 125 },

    // ml_toile_finition_1 (number) : ML Toile finition 1 (Saisie manuelle)
    { key: "ml_toile_finition_1", label: "ML TF1", type: "number", width: 142 },

    // pa_toile_finition_1 (number) : PA TF1
    { key: "pa_toile_finition_1", label: "PA TF1", type: "number", width: 120 },

    // pv_toile_finition_1 (number) : PV TF1
    { key: "pv_toile_finition_1", label: "PV TF1", type: "number", width: 120 },

    // doublure (text/catalog) : Doublure
    { key: "doublure", label: "Doublure", type: "catalog_item", category: "Tissu,Tissus", width: 180 },

    // laize_doublure (number) : Laize D.
    { key: "laize_doublure", label: "Laize D.", type: "number", width: 135 },

    // ml_doublure (number) : ML Doubl. (Saisie manuelle)
    { key: "ml_doublure", label: "ML Doubl.", type: "number", width: 142 },

    // pa_doublure (number) : PA Doubl.
    { key: "pa_doublure", label: "PA Doubl.", type: "number", width: 140 },

    // pv_doublure (number) : PV Doubl.
    { key: "pv_doublure", label: "PV Doubl.", type: "number", width: 140 },

    // --- Passementerie 1 (réf. sourcée dans la biblio Passementerie ; ML manuel, PA/PV calculés) ---
    { key: "passementerie1", label: "Passement. 1", type: "catalog_item", category: "Passementerie", width: 150 },
    // Application : indicatif (n'entre pas dans le calcul pour l'instant) — "|  |" ou "U"
    { key: "application_passementerie1", label: "App. P1", type: "select", options: ["", "|  |", "U"], width: 100 },
    { key: "ml_pass1", label: "ML Pass 1", type: "number", width: 120 },
    { key: "pa_pass1", label: "PA Pass 1", type: "number", width: 110 },
    { key: "pv_pass1", label: "PV Pass 1", type: "number", width: 110 },

    // --- Passementerie 2 ---
    { key: "passementerie2", label: "Passement. 2", type: "catalog_item", category: "Passementerie", width: 150 },
    { key: "application_passementerie2", label: "App. P2", type: "select", options: ["", "|  |", "U"], width: 100 },
    { key: "ml_pass2", label: "ML Pass 2", type: "number", width: 120 },
    { key: "pa_pass2", label: "PA Pass 2", type: "number", width: 110 },
    { key: "pv_pass2", label: "PV Pass 2", type: "number", width: 110 },

    // mecanisme_store (text/catalog) : Meca store
    { key: "mecanisme_store", label: "Méca Store", type: "catalog_item", category: "Store,Stores,Mecanisme Store", width: 150 },

    // pa_mecanisme_store (number) : PA Méca
    { key: "pa_mecanisme_store", label: "PA Méca", type: "number", width: 140 },

    // pv_mecanisme_store (number) : PV Méca
    { key: "pv_mecanisme_store", label: "PV Méca", type: "number", width: 140 },

    // heures_prepa (number) : H. Prépa
    { key: "heures_prepa", label: "H. Prépa", type: "number", width: 135 },

    // pv_prepa (number, readOnly) : PV Prépa
    { key: "pv_prepa", label: "PV Prépa", type: "number", width: 136 },

    // type_pose (select) : Type de pose
    { key: "type_pose", label: "Type Pose", type: "select", options: ['Mural', 'Ouvrant', 'Plafond'], width: 160 },

    // heures_pose (number) : H. Pose
    { key: "heures_pose", label: "H. Pose", type: "number", width: 130 },

    // pv_pose (number, readOnly) : PV Pose
    { key: "pv_pose", label: "PV Pose", type: "number", width: 135 },

    // heures_confection (number) : H. Conf
    { key: "heures_confection", label: "H. Conf", type: "number", width: 130 },

    // pv_confection (number, readOnly) : PV Conf
    { key: "pv_confection", label: "PV Conf", type: "number", width: 130 },

    { key: "st_pose_pa", label: "ST Pose PA", type: "number", width: 150 },

    // st_pose_pv (number, readOnly) : ST Pose PV
    { key: "st_pose_pv", label: "ST Pose PV", type: "number", width: 150 },

    // livraison (number) : Livraison
    { key: "livraison", label: "Livraison", type: "number", width: 140 },

    // unit_price (number, readOnly) : P.U
    { key: "unit_price", label: "P.U", type: "number", width: 115, valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value) },

    { key: "quantite", label: "Qté", type: "number", width: 115, readOnly: true, defaultValue: 1 },

    // total_price (number, readOnly) : Total
    { key: "total_price", label: "Total", type: "number", width: 125 },
];
