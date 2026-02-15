
// src/lib/schemas/stores.js
// Schéma spécifique pour le module "Stores" (Refonte V2)

const STORE_BLOCKED_TYPES = [
    'Store Enrouleur',
    'Store Vénitien',
    'Store Californien',
    'Store Canishade'
];

const isBlocked = (row) => STORE_BLOCKED_TYPES.includes(row?.produit);

export const STORES_SCHEMA = [
    // detail (button) : Détail
    { key: "detail", label: "Détail", type: "button", width: 100 },

    // zone (text) : Zone
    { key: "zone", label: "Zone", type: "text", width: 100 },

    // piece (text) : Pièce
    { key: "piece", label: "Pièce", type: "text", width: 100 },

    // produit (select)
    {
        key: "produit",
        label: "Produit",
        type: "select",
        options: ['Store Bateau', 'Store Enrouleur', 'Store Vénitien', 'Store Californien', 'Store Velum', 'Store Canishade', 'Autre'],
        width: 140
    },

    // largeur (number) : Largeur
    { key: "largeur", label: "Largeur", type: "number", width: 90 },

    // a_plat (number, readOnly) : À Plat  -> BLOCKED if Enrouleur etc
    { key: "a_plat", label: "À Plat", type: "number", width: 100, readOnly: (row) => true }, // Prompt says readOnly. AND Blocked implies readOnly.

    // hauteur (number) : Hauteur
    { key: "hauteur", label: "Hauteur", type: "number", width: 90 },

    // hauteur_coupe (number, readOnly) : H. Coupe -> BLOCKED
    { key: "hauteur_coupe", label: "H. Coupe", type: "number", width: 100, readOnly: (row) => true },

    // hauteur_coupe_motif (number, readOnly) : H. Motif -> BLOCKED
    { key: "hauteur_coupe_motif", label: "H. Motif", type: "number", width: 100, readOnly: (row) => true },

    // toil_finition_1 (text/catalog) : toile finition 1 -> BLOCKED
    // Using catalog_item as agreed
    { key: "toile_finition_1", label: "Toile 1", type: "catalog_item", category: "Tissu,Tissus", width: 150, readOnly: isBlocked },

    // laize_toile_finition_1 (number) : Laize toile finition 1 -> BLOCKED
    { key: "laize_toile_finition_1", label: "Laize TF1", type: "number", width: 90, readOnly: isBlocked },

    // raccord_v_toile_finition_1 (number) : Rac V. TF1 -> BLOCKED
    { key: "raccord_v_toile_finition_1", label: "Rac V. TF1", type: "number", width: 90, readOnly: isBlocked },

    // raccord_h_toile_finition_1 (number) : Rac H. TF1 -> BLOCKED
    { key: "raccord_h_toile_finition_1", label: "Rac H. TF1", type: "number", width: 90, readOnly: isBlocked },

    // nb_les_toile_finition_1 (number, readOnly) : Nb Lés 1 -> BLOCKED
    { key: "nb_les_toile_finition_1", label: "Nb Lés 1", type: "number", width: 90, readOnly: (row) => true }, // Always readOnly per prompt

    // ml_toile_finition_1 (number) : ML Toile finition 1 (Saisie manuelle) -> BLOCKED
    { key: "ml_toile_finition_1", label: "ML TF1", type: "number", width: 100, readOnly: isBlocked },

    // pa_toile_finition_1 (number) : PA TF1 -> BLOCKED
    { key: "pa_toile_finition_1", label: "PA TF1", type: "number", width: 90, readOnly: isBlocked },

    // pv_toile_finition_1 (number) : PV TF1 -> BLOCKED
    { key: "pv_toile_finition_1", label: "PV TF1", type: "number", width: 90, readOnly: isBlocked },

    // doublure (text/catalog) : Doublure -> BLOCKED
    { key: "doublure", label: "Doublure", type: "catalog_item", category: "Tissu,Tissus", width: 140, readOnly: isBlocked },

    // laize_doublure (number) : Laize D. -> BLOCKED
    { key: "laize_doublure", label: "Laize D.", type: "number", width: 90, readOnly: isBlocked },

    // nb_les_doublure (number, readOnly) : Nb Lés D. -> BLOCKED
    { key: "nb_les_doublure", label: "Nb Lés D.", type: "number", width: 90, readOnly: (row) => true },

    // ml_doublure (number) : ML Doubl. (Saisie manuelle) -> BLOCKED
    { key: "ml_doublure", label: "ML Doubl.", type: "number", width: 100, readOnly: isBlocked },

    // pa_doublure (number) : PA Doubl. -> BLOCKED
    { key: "pa_doublure", label: "PA Doubl.", type: "number", width: 90, readOnly: isBlocked },

    // pv_doublure (number) : PV Doubl. -> BLOCKED
    { key: "pv_doublure", label: "PV Doubl.", type: "number", width: 90, readOnly: isBlocked },

    // mecanisme_store (text/catalog) : Meca store -> NOT BLOCKED (No mention specifically? Prompt says "BLOQUER... st_pose_pv" ending list. Meca not in list.)
    // Prompt list of blocked: ... pv_doublure, st_pose_pa, st_pose_pv.
    // Wait, prompt says: "BLOQUER... pa_toile..., doublure..., pv_doublure, st_pose_pa, st_pose_pv".
    // It does NOT mention `mecanisme_store` in the BLOCK list.
    // So Meca remains editable even for Enrouleur?
    // "Store Enrouleur" IS a mechanism basically. So user likely wants to select the Mechanism.
    // So I will Keep it Editable.
    { key: "mecanisme_store", label: "Méca Store", type: "catalog_item", category: "Store,Stores,Mecanisme Store", width: 140 },

    // pa_mecanisme_store (number) : PA Méca
    { key: "pa_mecanisme_store", label: "PA Méca", type: "number", width: 90 },

    // pv_mecanisme_store (number) : PV Méca
    { key: "pv_mecanisme_store", label: "PV Méca", type: "number", width: 90 },

    // heures_prepa (number) : H. Prépa
    { key: "heures_prepa", label: "H. Prépa", type: "number", width: 80 },

    // pv_prepa (number, readOnly) : PV Prépa -> UNLOCKED
    { key: "pv_prepa", label: "PV Prépa", type: "number", width: 90 },

    // type_pose (select)
    { key: "type_pose", label: "Pose", type: "select", options: ['Mural', 'Plafond', 'Tableau', 'Grande hauteur'], width: 120 },

    // heures_pose (number) : H. Pose
    { key: "heures_pose", label: "H. Pose", type: "number", width: 80 },

    // pv_pose (number, readOnly) : PV Pose -> UNLOCKED
    { key: "pv_pose", label: "PV Pose", type: "number", width: 90 },

    // heures_confection (number) : H. Conf
    { key: "heures_confection", label: "H. Conf", type: "number", width: 80 },

    // pv_confection (number, readOnly) : PV Conf -> UNLOCKED
    { key: "pv_confection", label: "PV Conf", type: "number", width: 90 },

    // st_pose_pa (number) : ST Pose PA -> BLOCKED if Enrouleur? User said "ST Pose... ne pas griser".
    // So UNLOCK ST Pose PA even if blocked?
    // User list: "PV Prépa, Pv Pose, Pv Conf, ST Pose, P.U, Total... ne sont pas à griser".
    // So ST Pose PA explicitly unlocked? "ST Pose" matches label "ST Pose PA".
    { key: "st_pose_pa", label: "ST Pose PA", type: "number", width: 90 },

    // st_pose_pv (number, readOnly) : ST Pose PV -> UNLOCKED
    { key: "st_pose_pv", label: "ST Pose PV", type: "number", width: 90 },

    // livraison (number) : Livraison
    { key: "livraison", label: "Livraison", type: "number", width: 90 },

    // unit_price (number, readOnly) : P.U -> UNLOCKED
    { key: "unit_price", label: "P.U", type: "number", width: 110, valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value) },

    // quantite (number) : Qté
    { key: "quantite", label: "Qté", type: "number", width: 70 },

    // total_price (number, readOnly) : Total -> UNLOCKED (Should be calc usually but request says no grey)
    { key: "total_price", label: "Total", type: "number", width: 120 },
];

// Helper for conditional rendering (Hide 0)
const hideZero = (params) => {
    // Robust handle: params might be value itself or object
    const val = (params && typeof params === 'object' && 'value' in params) ? params.value : params;
    if (!val || Number(val) === 0) return '';
    return val;
};

export const STORES_PROD_SCHEMA = [
    'zone', 'piece', 'produit',
    'a_plat', // Largeur à plat
    'hauteur', 'hauteur_coupe', 'hauteur_coupe_motif',

    // TOILE 1
    'toile_finition_1',
    'nb_les_toile_finition_1', // Lés 1
    'raccord_v_toile_finition_1', // Raccord VTF1
    'raccord_h_toile_finition_1', // Raccord HDF1
    'laize_toile_finition_1', // Nom de LTF1 (Confirmed as Laize)
    'ml_toile_finition_1', // MLTF1

    // DOUBLURE
    'doublure',
    'laize_doublure', // Lest doublure (Confirmed as Laize)
    'nb_les_doublure', // Nombre de doublures
    'ml_doublure', // M doublure

    // MECANISME
    'mecanisme_store', // M Castor

    // HEURES (Hide if 0)
    { key: 'heures_prepa', valueFormatter: hideZero },
    { key: 'heures_pose', valueFormatter: hideZero },
    { key: 'heures_confection', valueFormatter: hideZero },

    // SOUS-TRAITANCE
    'st_pose_pa', // ST POSE PA

    // TOTAUX
    'quantite',
    'total_price'
].map(def => {
    // If string, find in main schema
    if (typeof def === 'string') {
        const found = STORES_SCHEMA.find(c => c.key === def);
        return found ? found : null;
    }
    // If object, find and merge
    const base = STORES_SCHEMA.find(c => c.key === def.key);
    return { ...base, ...def }; // Merge overrides
}).filter(Boolean).map(c => ({ ...c, key: c.key || c.field })); // Ensure key exists (STORES uses 'key', Decors used 'field', normalizing)
