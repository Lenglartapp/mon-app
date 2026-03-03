
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

    // largeur_finie (number) : Largeur Finie -> For Stores Bateaux, it's (Largeur + 1)
    {
        key: "largeur_finie",
        label: "L. Finie",
        type: "number",
        width: 100,
        readOnly: true,
        valueGetter: (value, row) => {
            const actualRow = row || value?.row || {}; // MUI V5/V6 fallback
            const l = Number(actualRow.largeur) || 0;
            return Math.round((l + 1) * 10) / 10;
        }
    },

    // ourlet_de_cote (number) : Ourlet de côté
    { key: "ourlet_de_cote", label: "Ourlet Côté", type: "number", width: 100 },

    // a_plat (number, readOnly) : À Plat  -> BLOCKED if Enrouleur etc. For Bateaux: Largeur Finie + (Ourlet * 2)
    {
        key: "a_plat",
        label: "À Plat",
        type: "number",
        width: 100,
        readOnly: (row) => true,
        valueGetter: (value, row) => {
            const actualRow = row || value?.row || {};
            if (!/bateau|velum/i.test(actualRow.produit || '')) return actualRow.a_plat;
            const L = Number(actualRow.largeur) || 0;
            const lFinie = L + 1; // Formula applies
            const ourlet = Number(actualRow.ourlet_de_cote) || 0;
            return Math.round((lFinie + (ourlet * 2)) * 10) / 10;
        }
    },

    // hauteur (number) : Hauteur (Pour Stores classiques)
    { key: "hauteur", label: "Hauteur", type: "number", width: 90 },

    // hauteur_finie (number) : Hauteur Finie
    { key: "hauteur_finie", label: "H. Finie", type: "number", width: 90 },

    // statut_cotes (select) : Statut Côtes
    {
        key: "statut_cotes",
        label: "Statut Côtes",
        type: "select",
        options: ["Définitive", "Déduction restante à faire", "Non exploitable"],
        width: 150
    },

    // hauteur_coupe (number, readOnly) : H. Coupe
    {
        key: "hauteur_coupe",
        label: "H. Coupe",
        type: "number",
        width: 100,
        readOnly: (row) => true,
        valueGetter: (value, row) => {
            const actualRow = row || value?.row || {};
            if (!/bateau|velum/i.test(actualRow.produit || '')) return actualRow.hauteur_coupe;
            const hFinie = Number(actualRow.hauteur_finie) || 0;
            const laize = Number(actualRow.laize_toile_finition_1) || 0; // Using TF1 Laize as reference
            // Also need "a_plat" value. We must re-calculate it to stand independently from the Grid's dependency tree
            const L = Number(actualRow.largeur) || 0;
            const lFinie = L + 1;
            const ourlet = Number(actualRow.ourlet_de_cote) || 0;
            const aPlat = (lFinie + (ourlet * 2));

            let val = 0;
            if (hFinie < 400) {
                if (laize > (hFinie + 50)) {
                    val = aPlat;
                } else {
                    val = hFinie + 50;
                }
            } else {
                if (laize > (hFinie + 80)) {
                    val = aPlat;
                } else {
                    val = hFinie + 80;
                }
            }
            return Math.round(val * 10) / 10;
        }
    },

    // hauteur_coupe_motif (number, readOnly) : H. Coupe Motif
    {
        key: "hauteur_coupe_motif",
        label: "H. Coupe Motif",
        type: "number",
        width: 130,
        readOnly: (row) => true,
        valueGetter: (value, row) => {
            const actualRow = row || value?.row || {};
            if (!/bateau|velum/i.test(actualRow.produit || '')) return actualRow.hauteur_coupe_motif;
            // Re-calculate H. Coupe for scope
            const hFinie = Number(actualRow.hauteur_finie) || 0;
            const laize = Number(actualRow.laize_toile_finition_1) || 0;
            const L = Number(actualRow.largeur) || 0;
            const lFinie = L + 1;
            const ourlet = Number(actualRow.ourlet_de_cote) || 0;
            const aPlat = (lFinie + (ourlet * 2));

            let hCoupe = 0;
            if (hFinie < 400) {
                hCoupe = (laize > (hFinie + 50)) ? aPlat : (hFinie + 50);
            } else {
                hCoupe = (laize > (hFinie + 80)) ? aPlat : (hFinie + 80);
            }

            const raccordV = Number(actualRow.raccord_v_toile_finition_1) || 0;
            if (raccordV === 0) return 0; // Prevent division by zero if not set

            const val = (Math.ceil(hCoupe / raccordV) * raccordV) + raccordV;
            return Math.round(val * 10) / 10;
        }
    },

    // hauteur_coupe_doublure (number, readOnly) : H. Coupe Doublure
    {
        key: "hauteur_coupe_doublure",
        label: "H. Coupe Doublure",
        type: "number",
        width: 140,
        readOnly: (row) => true,
        valueGetter: (value, row) => {
            const actualRow = row || value?.row || {};
            if (!/bateau|velum/i.test(actualRow.produit || '')) return actualRow.hauteur_coupe_doublure;
            const hFinie = Number(actualRow.hauteur_finie) || 0;
            const laizeDouble = Number(actualRow.laize_doublure) || 0;
            const L = Number(actualRow.largeur) || 0;
            const lFinie = L + 1;
            const ourlet = Number(actualRow.ourlet_de_cote) || 0;
            const aPlat = (lFinie + (ourlet * 2));

            let val = 0;
            if (hFinie < 400) {
                if (laizeDouble > (hFinie + 50)) {
                    val = aPlat;
                } else {
                    val = hFinie + 50;
                }
            } else {
                if (laizeDouble > (hFinie + 80)) {
                    val = aPlat;
                } else {
                    val = hFinie + 80;
                }
            }
            return Math.round(val * 10) / 10;
        }
    },

    // picage_bas (text)
    { key: "picage_bas", label: "Picage bas", type: "text", width: 150 },

    // finition_chant_et_retour (text)
    { key: "finition_chant_et_retour", label: "Finition Chant et Retour", type: "text", width: 180 },

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
    // etiquette_lavage (select)
    { key: "etiquette_lavage", label: "Étiq. Lavage", type: "select", options: ["Oui", "Non"], width: 100 },

    // mecanisme_store (text/catalog) : Meca store
    { key: "mecanisme_store", label: "Méca Store", type: "catalog_item", category: "Store,Stores,Mecanisme Store", width: 140 },

    // couleur_mecanisme (text)
    { key: "couleur_mecanisme", label: "Couleur Méca", type: "text", width: 140 },

    // type_commande (select)
    { key: "type_commande", label: "Type Commande", type: "select", options: ["Télécommande", "Commande murale", "Fourni par le client"], width: 150 },

    // type_moteur (text)
    { key: "type_moteur", label: "Type Moteur", type: "text", width: 120 },

    // cote_manoeuvre (select)
    { key: "cote_manoeuvre", label: "Côté Manœuvre", type: "select", options: ["Droite", "Gauche"], width: 120 },

    // methode_manoeuvre (select)
    { key: "methode_manoeuvre", label: "Méthode Manœuvre", type: "select", options: ["Cabestan", "Freel", "Cordon", "Chaînette"], width: 140 },

    // equerre_support (text)
    { key: "equerre_support", label: "Équerre Support", type: "text", width: 130 },

    // nombre_anneaux_largeur (number)
    {
        key: "nombre_anneaux_largeur",
        label: "Nb Anneaux Larg.",
        type: "number",
        width: 140,
        readOnly: true,
        valueGetter: (v, row) => {
            const actualRow = row || v?.row || {};
            if (!/bateau|velum/i.test(actualRow.produit || '')) return actualRow.nombre_anneaux_largeur;
            const L = Number(actualRow.largeur) || 0;
            const lFinie = L + 1;
            return Math.round(lFinie / 50) + 1;
        }
    },

    // deportation_premier_anneau (text)
    { key: "deportation_premier_anneau", label: "Déport 1er Anneau", type: "text", width: 150 },

    // valeur_velcro (select)
    { key: "valeur_velcro", label: "Valeur Velcro", type: "select", options: ["2", "2.5", "5"], width: 120 },

    // nombre_intervalles (number)
    {
        key: "nombre_intervalles",
        label: "Nb Intervalles",
        type: "number",
        width: 120,
        readOnly: true,
        valueGetter: (v, row) => {
            const actualRow = row || v?.row || {};
            if (!/bateau|velum/i.test(actualRow.produit || '')) return actualRow.nombre_intervalles;
            const hFinie = Number(actualRow.hauteur_finie) || 0;
            const vIntervalle = Number(actualRow.valeur_intervalle) || 0;
            if (vIntervalle <= 0) return 0;
            return Math.max(0, Math.round(hFinie / vIntervalle));
        }
    },

    // valeur_intervalle (number)
    { key: "valeur_intervalle", label: "Val. Intervalle", type: "number", width: 120 },

    // croquis_intervalle (photo)
    { key: "croquis_intervalle", label: "Croquis Int.", type: "photo", width: 120 },

    // barre_de_charge (text)
    { key: "barre_de_charge", label: "Barre Charge", type: "text", width: 120 },

    // longueur_barre_de_charge (number)
    { key: "longueur_barre_de_charge", label: "Long. Barre Ch.", type: "number", width: 130 },

    // longueur_tigette (number)
    { key: "longueur_tigette", label: "Long. Tigette", type: "number", width: 120 },

    // nombre_de_tigettes (number)
    {
        key: "nombre_de_tigettes",
        label: "Nb Tigettes",
        type: "number",
        width: 110,
        readOnly: true,
        valueGetter: (v, row) => {
            const actualRow = row || v?.row || {};
            if (!/bateau|velum/i.test(actualRow.produit || '')) return actualRow.nombre_de_tigettes;
            const hFinie = Number(actualRow.hauteur_finie) || 0;
            const vIntervalle = Number(actualRow.valeur_intervalle) || 0;
            if (vIntervalle <= 0) return 0;
            const nbInt = Math.max(0, Math.round(hFinie / vIntervalle));
            return Math.max(0, nbInt - 1);
        }
    },

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

    // statut_pose (select)
    { key: "statut_pose", label: "Statut Pose", type: "select", options: ['Non démarré', 'Méca posé', 'Accroché', 'Terminé', 'Reprise'], width: 140 },

    // statut_prepa (select)
    { key: "statut_prepa", label: "Statut Prépa", type: "select", options: ['Non démarré', 'En cours', 'Terminé'], width: 140 },

    // statut_conf (select)
    { key: "statut_conf", label: "Statut Conf", type: "select", options: ['Non démarré', 'En cours', 'Terminé'], width: 140 },

    // unit_price (number, readOnly) : P.U -> UNLOCKED
    { key: "unit_price", label: "P.U", type: "number", width: 110, valueFormatter: (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value) },

    // quantite (number) : Qté
    { key: "quantite", label: "Qté", type: "number", width: 70 },

    // photo (photo/file)
    { key: "photo", label: "Photo sur site", type: "photo", width: 150 },

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

const mapSchema = (list) => list.map(def => {
    if (typeof def === 'string') {
        const found = STORES_SCHEMA.find(c => c.key === def || c.field === def);
        return found ? found : null;
    }
    if (!def.key && def.field) def.key = def.field;
    const base = STORES_SCHEMA.find(c => c.key === def.key);
    return base ? { ...base, ...def } : def;
}).filter(Boolean).map(c => ({ ...c, key: c.key || c.field }));

// Classic Stores Schema
export const STORES_PROD_SCHEMA = mapSchema([
    'detail',
    'zone', 'piece', 'produit',
    { key: "largeur", width: 100 }, // Ensure it appears, but without the special width overrides if any
    'a_plat', // Largeur à plat
    'hauteur', 'hauteur_coupe',
    { key: "hauteur_coupe_motif", label: "H. Motif", width: 100 }, // Classic label

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
    'quantite'
]);

// Stores Bateaux Schema
export const STORES_BATEAUX_PROD_SCHEMA = mapSchema([
    'detail',
    'zone', 'piece', 'produit',
    'largeur', 'largeur_finie', 'ourlet_de_cote',
    'a_plat', // Largeur à plat
    'hauteur_finie', 'statut_cotes', 'hauteur_coupe', 'hauteur_coupe_motif', 'hauteur_coupe_doublure',
    'picage_bas', 'finition_chant_et_retour',

    // TOILE 1
    { key: 'toile_finition_1', label: 'Tissu 1' },
    'raccord_v_toile_finition_1', // Raccord VTF1
    'raccord_h_toile_finition_1', // Raccord HDF1
    'laize_toile_finition_1', // Nom de LTF1 (Confirmed as Laize)

    // DOUBLURE
    'doublure',
    'laize_doublure', // Lest doublure (Confirmed as Laize)

    // MECANISME
    'etiquette_lavage',
    'mecanisme_store', // M Castor
    'couleur_mecanisme',
    'type_commande',
    'type_moteur',
    'cote_manoeuvre',
    'methode_manoeuvre',
    'equerre_support',
    'nombre_anneaux_largeur',
    'deportation_premier_anneau',
    'valeur_velcro',
    'nombre_intervalles',
    'valeur_intervalle',
    'croquis_intervalle',
    'barre_de_charge',
    'longueur_barre_de_charge',
    'longueur_tigette',
    'nombre_de_tigettes',

    // POSE
    'type_pose',

    // HEURES (Hide if 0)
    { key: 'heures_prepa', valueFormatter: hideZero },
    { key: 'heures_pose', valueFormatter: hideZero },
    { key: 'heures_confection', valueFormatter: hideZero },

    // STATUTS
    'statut_prepa',
    'statut_conf',
    'statut_pose',

    // TOTAUX
    'photo',
    'quantite'
]);
