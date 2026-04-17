// src/lib/schemas/production/stores_bateaux.js
// Schéma atelier pour le module "Stores" (Bateaux/Velum)

const hideZero = (params) => {
    const val = (params && typeof params === 'object' && 'value' in params) ? params.value : params;
    if (!val || Number(val) === 0) return '';
    return val;
};

// Base definitions for mapSchema
const BASE_STORES_BATEAUX_SCHEMA = [
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

    // largeur_finie (number) : Largeur Finie -> For Stores Bateaux, it's (Largeur + 1)
    {
        key: "largeur_finie",
        label: "L. Finie",
        type: "number",
        width: 110,
        readOnly: true,
        valueGetter: (value, row) => {
            const actualRow = row || value?.row || {}; // MUI V5/V6 fallback
            const l = Number(actualRow.largeur) || 0;
            return Math.round((l + 1) * 10) / 10;
        }
    },

    // ourlet_de_cote (number) : Ourlet de côté
    { key: "ourlet_de_cote", label: "Ourlet Côté", type: "number", width: 120 },

    // a_plat (number, readOnly) : À Plat -> Largeur Finie + (Ourlet * 2)
    {
        key: "a_plat",
        label: "À Plat",
        type: "number",
        width: 110,
        readOnly: true,
        valueGetter: (value, row) => {
            const actualRow = row || value?.row || {};
            const L = Number(actualRow.largeur) || 0;
            const lFinie = L + 1; // Formula applies
            const ourlet = Number(actualRow.ourlet_de_cote) || 0;
            return Math.round((lFinie + (ourlet * 2)) * 10) / 10;
        }
    },

    // hauteur_finie (number) : Hauteur Finie
    { key: "hauteur_finie", label: "H. Finie", type: "number", width: 115 },

    // statut_cotes (select) : Statut Côtes
    {
        key: "statut_cotes",
        label: "Statut Côtes",
        type: "select",
        options: ["Cote non prenable", "Déduction restante à faire", "Définitive", "Validé par chef de projet"],
        width: 200
    },

    // hauteur_coupe (number, readOnly) : H. Coupe
    {
        key: "hauteur_coupe",
        label: "H. Coupe",
        type: "number",
        width: 125,
        readOnly: true,
        valueGetter: (value, row) => {
            const actualRow = row || value?.row || {};
            const hFinie = Number(actualRow.hauteur_finie) || 0;
            const laize = Number(actualRow.laize_toile_finition_1) || 0; // Using TF1 Laize as reference
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
        width: 145,
        readOnly: true,
        valueGetter: (value, row) => {
            const actualRow = row || value?.row || {};
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
        width: 155,
        readOnly: true,
        valueGetter: (value, row) => {
            const actualRow = row || value?.row || {};
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
    { key: "picage_bas", label: "Picage bas", type: "text", width: 130 },

    // finition_chant_et_retour (text)
    { key: "finition_chant_et_retour", label: "Finition Chant et Retour", type: "text", width: 200 },

    // TOILE 1
    { key: "toile_finition_1", label: "Toile 1", type: "catalog_item", category: "Tissu,Tissus", width: 180 },
    { key: "laize_toile_finition_1", label: "Laize TF1", type: "number", width: 120 },
    { key: "raccord_v_toile_finition_1", label: "Rac V. TF1", type: "number", width: 125 },
    { key: "raccord_h_toile_finition_1", label: "Rac H. TF1", type: "number", width: 125 },
    { key: "ml_toile_finition_1", label: "ML TF1", type: "number", width: 120 },

    // DOUBLURE
    { key: "doublure", label: "Doublure", type: "catalog_item", category: "Tissu,Tissus", width: 180 },
    { key: "laize_doublure", label: "Laize D.", type: "number", width: 120 },
    { key: "ml_doublure", label: "ML Doubl.", type: "number", width: 120 },

    // GORGE
    { key: "largeur_gorge", label: "Largeur Gorge (cm)", type: "number", width: 155 },
    { key: "profondeur_gorge", label: "Profondeur Gorge (cm)", type: "number", width: 175 },

    // HEURES & STATUTS
    { key: "heures_prepa", label: "H. Prépa", type: "number", width: 120 },
    { key: "heures_pose", label: "H. Pose", type: "number", width: 120 },
    { key: "heures_confection", label: "H. Conf", type: "number", width: 120 },

    { key: "statut_pose", label: "Statut Pose", type: "select", options: ['Non démarré', 'Méca posé', 'Accroché', 'Terminé', 'Reprise'], width: 155 },
    { key: "statut_prepa", label: "Statut Prépa", type: "select", options: ['Non démarré', 'En cours', 'Terminé'], width: 150 },
    { key: "statut_conf", label: "Statut Conf", type: "select", options: ['Non démarré', 'Ourlet fait', 'Fourreau terminé', 'Ficelle terminée', 'Emballé'], width: 175, editable: true },

    { key: "photos_sur_site", label: "Photo sur site", type: "photo", width: 150 },
    { key: "quantite", label: "Qté", type: "number", width: 70 },
];

const mapSchema = (list) => list.map(def => {
    if (typeof def === 'string') {
        const found = BASE_STORES_BATEAUX_SCHEMA.find(c => c.key === def || c.field === def);
        return found ? found : null;
    }
    if (!def.key && def.field) def.key = def.field;
    const base = BASE_STORES_BATEAUX_SCHEMA.find(c => c.key === def.key);
    return base ? { ...base, ...def } : def;
}).filter(Boolean).map(c => ({ ...c, key: c.key || c.field }));

// Stores Bateaux Schema Production View
export const STORES_BATEAUX_PROD_SCHEMA = [
    ...mapSchema([
        'detail',
        'zone', 'piece', 'produit',
        'largeur', 'largeur_finie', 'ourlet_de_cote',
        'a_plat',
        'hauteur_finie', 'statut_cotes', 'hauteur_coupe', 'hauteur_coupe_motif', 'hauteur_coupe_doublure',
        'picage_bas', 'finition_chant_et_retour',

        // TOILE 1
        { key: 'toile_finition_1', label: 'Tissu 1' },
        'raccord_v_toile_finition_1',
        'raccord_h_toile_finition_1',
        'laize_toile_finition_1',
        'ml_toile_finition_1',

        // DOUBLURE
        'doublure',
        'laize_doublure',
        'ml_doublure',

        // GORGE
        'largeur_gorge',
        'profondeur_gorge',
    ]),

    // EXCLUSIVE PROD FIELDS (Mechanism)
    { key: "etiquette_lavage", label: "Étiq. Lavage", type: "select", options: ["Oui", "Non"], width: 125 },
    { key: "mecanisme_store", label: "Méca Store", type: "catalog_item", category: "Store,Stores,Mecanisme Store", width: 180 },
    { key: "couleur_mecanisme", label: "Couleur Méca", type: "text", width: 145 },
    { key: "type_commande", label: "Type Commande", type: "select", options: ["Manuelle", "Télécommande", "Commande murale", "Fourni par le client"], width: 180 },
    { key: "type_moteur", label: "Type Moteur", type: "text", width: 130 },
    { key: "cote_manoeuvre", label: "Côté Manœuvre", type: "select", options: ["Droite", "Gauche"], width: 130 },
    { key: "methode_manoeuvre", label: "Méthode Manœuvre", type: "select", options: ["Cabestan", "Freel", "Cordon", "Chaînette"], width: 160 },
    { key: "equerre_support", label: "Équerre Support", type: "text", width: 140 },
    {
        key: "nombre_anneaux_largeur",
        label: "Nb Anneaux Larg.",
        type: "number",
        width: 155,
        readOnly: true,
        valueGetter: (v, row) => {
            const actualRow = row || v?.row || {};
            const L = Number(actualRow.largeur) || 0;
            const lFinie = L + 1;
            return Math.round(lFinie / 50) + 1;
        }
    },
    { key: "deportation_premier_anneau", label: "Déport 1er Anneau", type: "text", width: 175 },
    { key: "valeur_velcro", label: "Valeur Velcro", type: "select", options: ["2", "2.5", "5"], width: 130 },
    {
        key: "nombre_intervalles",
        label: "Nb Intervalles",
        type: "number",
        width: 130,
        readOnly: true,
        valueGetter: (v, row) => {
            const actualRow = row || v?.row || {};
            const hFinie = Number(actualRow.hauteur_finie) || 0;
            const vIntervalle = Number(actualRow.valeur_intervalle) || 0;
            if (vIntervalle <= 0) return 0;
            return Math.max(0, Math.round(hFinie / vIntervalle));
        }
    },
    { key: "valeur_intervalle", label: "Val. Intervalle", type: "number", width: 130 },
    { key: "croquis_intervalle", label: "Croquis Int.", type: "photo", width: 130 },
    { key: "barre_de_charge", label: "Barre Charge", type: "text", width: 130 },
    { key: "longueur_barre_de_charge", label: "Long. Barre Ch.", type: "number", width: 150 },
    { key: "longueur_tigette", label: "Long. Tigette", type: "number", width: 135 },
    {
        key: "nombre_de_tigettes",
        label: "Nb Tigettes",
        type: "number",
        width: 120,
        readOnly: true,
        valueGetter: (v, row) => {
            const actualRow = row || v?.row || {};
            const hFinie = Number(actualRow.hauteur_finie) || 0;
            const vIntervalle = Number(actualRow.valeur_intervalle) || 0;
            if (vIntervalle <= 0) return 0;
            const nbInt = Math.max(0, Math.round(hFinie / vIntervalle));
            return Math.max(0, nbInt - 1);
        }
    },

    { key: "espace_ouverture_fenetre", label: "Espace Ouv. Fenêtre", type: "number", width: 175 },
    { key: "guidage", label: "Guidage", type: "select", options: ["Guidé", "Pas guidé"], width: 130 },
    { key: "cable_intermediaire", label: "Câble Intermédiaire", type: "select", options: ["1", "2", "3"], width: 165, readOnly: (row) => row?.produit === 'Store Bateau' },
    { key: "type_pose", label: "Pose", type: "select", options: ['Mural', 'Plafond', 'Grande hauteur', 'Naissance', 'Sur ouvrant', 'Encastré'], width: 145 },

    { key: "commentaire_confection", label: "Commentaire Confection", type: "textarea", width: 260, editable: true },

    ...mapSchema([
        // HEURES (Hide if 0)
        { key: 'heures_prepa', valueFormatter: hideZero },
        { key: 'heures_confection', valueFormatter: hideZero },

        // STATUTS
        'statut_prepa',
        'statut_conf',
        'statut_pose',

        // TOTAUX
        'photos_sur_site',
        'quantite'
    ])
];
