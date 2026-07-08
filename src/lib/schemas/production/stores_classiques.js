// src/lib/schemas/production/stores_classiques.js
// Schéma atelier pour le module "Stores" (Classiques)

const STORE_BLOCKED_TYPES = [
    'Store Enrouleur',
    'Store Vénitien',
    'Store Bande Verticale',
    'Store Canishade'
];

const isBlocked = (row) => STORE_BLOCKED_TYPES.includes(row?.produit);

const BASE_STORES_CLASSIQUES_SCHEMA = [
    // detail (button) : Détail
    { key: "detail", label: "Détail", type: "button", width: 130 },

    // zone (text) : Zone
    { key: "zone", label: "Zone", type: "text", width: 120 },

    // piece (text) : Pièce
    { key: "piece", label: "Pièce", type: "text", width: 120 },

    // produit (select) - Filtré pour ne pas inclure Bateau/Velum
    {
        key: "produit",
        label: "Produit",
        type: "select",
        options: ['Store Enrouleur', 'Store Vénitien', 'Store Bande Verticale', 'Store Canishade', 'Store Coffre'],
        width: 160
    },

    // largeur (number) : Largeur
    { key: "largeur", label: "Largeur", type: "number", width: 130 },

    // hauteur (number) : Hauteur
    { key: "hauteur", label: "Hauteur", type: "number", width: 130 },

    // largeur_gorge (number) : Largeur Gorge
    { key: "largeur_gorge", label: "Largeur Gorge (cm)", type: "number", width: 155 },

    // profondeur_gorge (number) : Profondeur Gorge
    { key: "profondeur_gorge", label: "Profondeur Gorge (cm)", type: "number", width: 175 },

    // toil_finition_1 (text/catalog) : toile finition 1 -> BLOCKED
    { key: "toile_finition_1", label: "Toile 1", type: "catalog_item", category: "Tissu,Tissus", width: 180, readOnly: isBlocked },

    // laize_toile_finition_1 (number) : Laize toile finition 1 -> BLOCKED
    { key: "laize_toile_finition_1", label: "Laize TF1", type: "number", width: 120, readOnly: isBlocked },

    // ml_toile_finition_1 (number) : ML Toile finition 1 (Saisie manuelle) -> BLOCKED
    { key: "ml_toile_finition_1", label: "ML TF1", type: "number", width: 130, readOnly: isBlocked },

    // pa_toile_finition_1 (number) : PA TF1 -> BLOCKED
    { key: "pa_toile_finition_1", label: "PA TF1", type: "number", width: 100, readOnly: isBlocked },

    // pv_toile_finition_1 (number) : PV TF1 -> BLOCKED
    { key: "pv_toile_finition_1", label: "PV TF1", type: "number", width: 100, readOnly: isBlocked },

    // doublure (text/catalog) : Doublure -> BLOCKED
    { key: "doublure", label: "Doublure", type: "catalog_item", category: "Tissu,Tissus", width: 180, readOnly: isBlocked },

    // laize_doublure (number) : Laize D. -> BLOCKED
    { key: "laize_doublure", label: "Laize D.", type: "number", width: 120, readOnly: isBlocked },

    // ml_doublure (number) : ML Doubl. (Saisie manuelle) -> BLOCKED
    { key: "ml_doublure", label: "ML Doubl.", type: "number", width: 130, readOnly: isBlocked },

    // pa_doublure (number) : PA Doubl. -> BLOCKED
    { key: "pa_doublure", label: "PA Doubl.", type: "number", width: 100, readOnly: isBlocked },

    // pv_doublure (number) : PV Doubl. -> BLOCKED
    { key: "pv_doublure", label: "PV Doubl.", type: "number", width: 100, readOnly: isBlocked },

    // mecanisme_store (text/catalog) : Meca store
    { key: "mecanisme_store", label: "Méca Store", type: "catalog_item", category: "Store,Stores,Mecanisme Store", width: 150 },

    // cote_manoeuvre (select) : Côté Manœuvre
    { key: "cote_manoeuvre", label: "Côté Manœuvre", type: "select", options: ["Manœuvre gauche", "Manœuvre droite"], width: 165 },

    // hauteur_manoeuvre (number) : Hauteur Manœuvre
    { key: "hauteur_manoeuvre", label: "H. Manœuvre (cm)", type: "number", width: 155 },

    // type_pose (select) : Type de pose
    { key: "type_pose", label: "Type Pose", type: "select", options: ["Mural", "Plafond", "Grande hauteur", "Suspente", "Naissance", "Sur ouvrant", "Encastré"], width: 160 },

    // guidage_coulisse (select) : Guidage / Coulisse
    { key: "guidage_coulisse", label: "Guidage / Coulisse", type: "select", options: ["Guidé", "Pas guidé", "Coulisse"], width: 160 },

    // pa_mecanisme_store (number) : PA Méca
    { key: "pa_mecanisme_store", label: "PA Méca", type: "number", width: 100 },

    // pv_mecanisme_store (number) : PV Méca
    { key: "pv_mecanisme_store", label: "PV Méca", type: "number", width: 100 },

    // heures_prepa (number) : H. Prépa
    { key: "heures_prepa", label: "H. Prépa", type: "number", width: 120 },

    // pv_prepa (number, readOnly) : PV Prépa
    { key: "pv_prepa", label: "PV Prépa", type: "number", width: 100 },

    // heures_pose (number) : H. Pose
    { key: "heures_pose", label: "H. Pose", type: "number", width: 120 },

    // pv_pose (number, readOnly) : PV Pose
    { key: "pv_pose", label: "PV Pose", type: "number", width: 100 },

    // heures_confection (number) : H. Conf
    { key: "heures_confection", label: "H. Conf", type: "number", width: 120 },

    // pv_confection (number, readOnly) : PV Conf
    { key: "pv_confection", label: "PV Conf", type: "number", width: 100 },

    { key: "st_pose_pa", label: "ST Pose PA", type: "number", width: 150 },

    // st_pose_pv (number, readOnly) : ST Pose PV
    { key: "st_pose_pv", label: "ST Pose PV", type: "number", width: 150 },

    // livraison (number) : Livraison
    { key: "livraison", label: "Livraison", type: "number", width: 140 },

    // unit_price (number, readOnly) : P.U
    { key: "unit_price", label: "P.U", type: "number", width: 115, valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value) },

    // quantite (number) : Qté
    { key: "quantite", label: "Qté", type: "number", width: 70 },

    // total_price (number, readOnly) : Total
    { key: "total_price", label: "Total", type: "number", width: 125 },
];

const hideZero = (params) => {
    const val = (params && typeof params === 'object' && 'value' in params) ? params.value : params;
    if (!val || Number(val) === 0) return '';
    return val;
};

const mapSchema = (list) => list.map(def => {
    if (typeof def === 'string') {
        const found = BASE_STORES_CLASSIQUES_SCHEMA.find(c => c.key === def || c.field === def);
        return found ? found : null;
    }
    if (!def.key && def.field) def.key = def.field;
    const base = BASE_STORES_CLASSIQUES_SCHEMA.find(c => c.key === def.key);
    return base ? { ...base, ...def } : def;
}).filter(Boolean).map(c => ({ ...c, key: c.key || c.field }));

// Classic Stores Schema Production View
export const STORES_PROD_SCHEMA = [
    ...mapSchema([
        'detail',
        'zone', 'piece', 'produit',
        { key: "largeur", width: 130 },
        'hauteur',
        'largeur_gorge',
        'profondeur_gorge',
    ]),

    // EXCLUSIVE PROD FIELDS
    { key: "mecanisme_store", label: "Méca Store", type: "catalog_item", category: "Store,Stores,Mecanisme Store", width: 150 },
    { key: "type_commande", label: "Type Commande", type: "select", options: ["Manuelle", "Radio", "Commande murale", "Fourni par le client"], width: 180, editable: true },

    ...mapSchema([
        'cote_manoeuvre',
        'hauteur_manoeuvre',
        'type_pose',
        'guidage_coulisse',
    ]),

    // STATUTS
    {
        key: "statut_cotes",
        label: "Statut Côtes",
        type: "select",
        options: ['Cote non prenable', 'Déduction restante à faire', 'Définitive', 'Validé par chef de projet'],
        width: 200,
        editable: true
    },
    { key: "statut_prepa", label: "Statut Prépa", type: "select", options: ['Non démarré', 'En cours', 'Terminé'], width: 150, editable: true },
    { key: "statut_pose", label: "Statut Pose", type: "select", options: ['Non démarré', 'Méca posé', 'Accroché', 'Terminé', 'Reprise'], width: 155, editable: true },

    ...mapSchema([
        // TOTAUX
        'quantite'
    ]),

    // PHOTO SUR SITE
    { key: "photos_sur_site", label: "Photo sur site", type: "photo", width: 150 },
];
