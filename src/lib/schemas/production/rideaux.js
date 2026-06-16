// src/lib/schemas/production/rideaux.js
import React from 'react';

// Helper to safely extract row from valueGetter args (MUI V5 vs V6 compat)
const getRow = (a, b) => {
    // V6: (value, row) -> b is row
    if (b && typeof b === 'object' && !b.api) return b;
    // AG Grid Community: (params) -> a.data is row
    if (a && a.data) return a.data;
    // MUI V5: (params) -> a.row is row
    if (a && a.row) return a.row;
    return {}; // Fallback
};

const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

// Round to 1 decimal place
const round1 = (v) => Math.round(v * 10) / 10;

// Round to nearest 0.05 (for ML in metres)

// ML tissu : calcul selon orientation (laize vs hauteur_coupe)
// aPlat, laize, hCoupe, hCoupeMotif en cm → résultat en m
const calcML = (aPlat, laize, hCoupe, hCoupeMotif) => {
    if (!laize || laize <= 0 || !aPlat || aPlat <= 0) return 0;
    if (laize >= hCoupe) {
        // Horizontal (tissu couché)
        return aPlat / 100;
    }
    // Vertical
    const nbLes = Math.ceil(aPlat / laize);
    return (nbLes * hCoupeMotif) / 100;
};

// ML passementerie selon application (I/U/L/-)
// aPlat, hCoupe en cm → résultat en m
const calcPassML = (app, aPlat, hCoupe, isPaire) => {
    if (!app || !aPlat || !hCoupe) return 0;
    const L_Pan = isPaire ? aPlat / 2 : aPlat;
    let res = 0;
    if (app === 'I') res = hCoupe;
    else if (app === 'U') res = (hCoupe * 2) + L_Pan;
    else if (app === 'L') res = hCoupe + L_Pan;
    else if (app === '-') res = L_Pan;
    else return 0;
    return (isPaire ? res * 2 : res) / 100;
};

// Helper for complex calculations
const getters = {
    largeur_finie: (row) => {
        const L = toNum(row.largeur);
        const croisement = toNum(row.croisement);
        const coeff = L >= 200 ? 1.06 : 1.10;
        const isOnePanel = (row.paire_ou_un_seul_pan || "").startsWith("Un seul pan") || (row.pair_un || "").startsWith("Un seul pan");

        let val = 0;
        if (!isOnePanel) {
            val = (L / 2 * coeff) + croisement;
        } else {
            val = L * coeff;
        }
        return Math.ceil(val);
    },

    a_plat: (row) => {
        const lFinie = getters.largeur_finie(row);
        const ampleur = toNum(row.ampleur) || 1;
        const vOurlets = toNum(row.v_ourlets_de_cotes || row.val_ourlet_cote);

        let val = 0;
        const isOnePanel = (row.paire_ou_un_seul_pan || "").startsWith("Un seul pan") || (row.pair_un || "").startsWith("Un seul pan");

        if (!isOnePanel) {
            val = (lFinie * ampleur) + (vOurlets * 4);
        } else {
            val = (lFinie * ampleur) + (vOurlets * 2);
        }
        return Math.ceil(val);
    },

    hauteur_finie_droite: (row) => {
        const H = toNum(row.hspf_droite);
        const ded = toNum(row.valeur_deduction || row.val_ded_rail);
        const fBas = toNum(row.finition_bas || row.f_bas);
        return round1(H - ded + fBas);
    },

    hauteur_finie_gauche: (row) => {
        const H = toNum(row.hspf_gauche);
        const ded = toNum(row.valeur_deduction || row.val_ded_rail);
        const fBas = toNum(row.finition_bas || row.f_bas);
        return round1(H - ded + fBas);
    },

    hauteur_finie_milieu: (row) => {
        const H = toNum(row.hspf_milieu);
        const ded = toNum(row.valeur_deduction || row.val_ded_rail);
        const fBas = toNum(row.finition_bas || row.f_bas);
        return round1(H - ded + fBas);
    },

    hauteur_coupe: (row) => {
        const hFinieD = getters.hauteur_finie_droite(row);
        const hFinieG = getters.hauteur_finie_gauche(row);
        const hFinie = Math.max(hFinieD, hFinieG);

        const laize = toNum(row.laize_tissu1 || row.laize_tissu_deco1);
        const aPlat = getters.a_plat(row);

        if (laize > (hFinie + 50)) {
            return round1(aPlat);
        }
        return round1(hFinie + 50);
    },

    hauteur_coupe_motif: (row) => {
        const hCoupe = getters.hauteur_coupe(row);
        const rV = toNum(row.raccord_v_tissu1);
        if (rV > 0) return Math.ceil(hCoupe / rV) * rV;
        return hCoupe;
    },

    hauteur_coupe_doublure: (row) => {
        const hFinieD = getters.hauteur_finie_droite(row);
        const hFinieG = getters.hauteur_finie_gauche(row);
        const hFinie = Math.max(hFinieD, hFinieG);
        const laizeD = toNum(row.laize_doublure);
        const aPlat = getters.a_plat(row);
        if (laizeD > (hFinie + 50)) return aPlat;
        return hFinie + 50;
    },

    nombre_les: (row) => {
        const aPlat = getters.a_plat(row);
        const laize = toNum(row.laize_tissu1);
        if (laize <= 0) return 0;
        return Math.max(1, Math.floor(aPlat / laize));
    },

    reste_les: (row) => {
        const aPlat = getters.a_plat(row);
        const laize = toNum(row.laize_tissu1);
        if (laize <= 0) return 0;
        const fraction = (aPlat / laize) - Math.floor(aPlat / laize);
        return round1(fraction * laize);
    },

    nb_glisseurs: (row) => {
        const lFinie = getters.largeur_finie(row);
        if (!lFinie) return 0;

        let divider = 10;
        const typeConf = (row.type_confection || "").toLowerCase();

        if (typeConf.includes("wave 60")) {
            divider = 6;
        } else if (typeConf.includes("wave 80")) {
            divider = 8;
        }

        const roundToEven = (num) => {
            const ceil = Math.ceil(num);
            return (ceil % 2 === 0) ? ceil : ceil + 1;
        };

        const rawVal = (lFinie / divider) + 2;
        const glidersPerPanel = roundToEven(rawVal);

        const isOnePanel = (row.paire_ou_un_seul_pan || "").startsWith("Un seul pan") || (row.pair_un || "").startsWith("Un seul pan");

        if (isOnePanel) {
            return glidersPerPanel;
        } else {
            return glidersPerPanel * 2;
        }
    }
};

// ─── Export des getters pour les étiquettes (clés = field keys du schema) ─────
export const RIDEAUX_GETTERS = {
    largeur_finie:         getters.largeur_finie,
    a_plat:                getters.a_plat,
    hauteur_finie_droite:  getters.hauteur_finie_droite,
    hauteur_finie_milieu:  getters.hauteur_finie_milieu,
    hauteur_finie_gauche:  getters.hauteur_finie_gauche,
    hauteur_coupe:         getters.hauteur_coupe,
    hauteur_coupe_motif:   getters.hauteur_coupe_motif,
    hauteur_coupe_doublure:getters.hauteur_coupe_doublure,
    nombre_les:            getters.nombre_les,
    reste_les:             getters.reste_les,
    nombre_glisseur:       getters.nb_glisseurs,
};


export const RIDEAUX_PROD_SCHEMA = [
    // A. Saisies Générales & Identité
    { key: "sel", label: "Sel.", type: "checkbox", width: 50 },
    { key: "detail", label: "Détail", type: "button", width: 130 }, // Keep existing UI trigger
    { key: "zone", label: "Zone", type: "text", width: 120, editable: true },
    { key: "piece", label: "Pièce", type: "text", width: 120, editable: true },
    { key: "produit", label: "Produit", type: "select", options: ["Rideau", "Voilage"], width: 125, editable: true },
    { key: "type_confection", label: "Type Conf.", type: "select", options: ["Pli Flamand", "Pli Creux", "Pli Plat", "Tripli", "Wave 80", "Wave 60", "Pli Couteau", "Pli Rabattu Cousu", "A Plat"], width: 150, editable: true },
    { key: "hauteur_renfort_tete", label: "H/Renfort Têtes", type: "text", width: 155, editable: true },
    { key: "paire_ou_un_seul_pan", label: "Paire ou un Pan", type: "select", options: ["Paire", "Un seul pan", "Un seul pan (Rapatriement Droit)", "Un seul pan (Rapatriement Gauche)"], width: 260, editable: true },
    { key: "largeur_gorge", label: "Largeur Gorge (cm)", type: "number", width: 155, editable: true },
    { key: "profondeur_gorge", label: "Profondeur Gorge (cm)", type: "number", width: 175, editable: true },
    { key: "ampleur", label: "Ampleur", type: "number", width: 110, editable: true },
    { key: "largeur_mecanisme", label: "L. Méca (cm)", type: "number", width: 130, editable: true },
    { key: "largeur", label: "Largeur (cm)", type: "number", width: 130, editable: true },

    // B. Calculs de Largeur
    {
        key: "largeur_finie",
        label: "L. Finie",
        type: "number",
        width: 110,
        readOnly: true,
        tooltip: "Si L < 200 cm → coeff 1,10 ; si L ≥ 200 cm → coeff 1,06. Paire : (L/2 × coeff) + croisement. Pan unique : L × coeff",
        valueGetter: (v, r) => getters.largeur_finie(getRow(v, r))
    },
    {
        key: "a_plat",
        label: "A Plat",
        type: "number",
        width: 110,
        readOnly: true,
        tooltip: "Tissu à plat avant confection. Paire : (L_finie × ampleur) + 4 × ourlets côtés. Pan unique : (L_finie × ampleur) + 2 × ourlets côtés",
        valueGetter: (v, r) => getters.a_plat(getRow(v, r))
    },
    {
        key: "nombre_les",
        label: "Nb Lés",
        type: "number",
        width: 100,
        readOnly: true,
        tooltip: "Nombre de lés entiers : À Plat ÷ laize tissu 1, arrondi à l'inférieur (minimum 1)",
        valueGetter: (v, r) => {
            const row = getRow(v, r);
            const aPlat = getters.a_plat(row);
            const laize = toNum(row.laize_tissu1);
            if (laize <= 0) return 0;
            return Math.max(1, Math.floor(aPlat / laize));
        }
    },
    {
        key: "reste_les",
        label: "Apiècement cm",
        type: "number",
        width: 130,
        readOnly: true,
        tooltip: "Partie fractionnaire × laize T1 : reste de tissu après les lés entiers",
        valueGetter: (v, r) => getters.reste_les(getRow(v, r))
    },
    { key: "v_ourlets_de_cotes", label: "Ourlets Côtés", type: "number", width: 130, editable: true },
    { key: "piquage_ourlet", label: "Piquage Ourlet", type: "select", options: ["Apparent", "Invisible", "Surfil + Invisible", "Double + Invisible"], width: 145, editable: true },


    // C. Hauteurs & Coupe
    { key: "hspf_droite", label: "HSPF Droit", type: "number", width: 120, editable: true },
    { key: "hspf_milieu", label: "HSPF Milieu", type: "number", width: 125, editable: true },
    { key: "hspf_gauche", label: "HSPF Gauche", type: "number", width: 125, editable: true },
    {
        key: "statut_cotes",
        label: "Statut Côtes",
        type: "select",
        options: ['Cote non prenable', 'Déduction restante à faire', 'Définitive', 'Validé par chef de projet'],
        width: 200,
        editable: true
    },
    { key: "valeur_deduction", label: "Val. Déduc.", type: "number", width: 120, editable: true },
    { key: "finition_bas", label: "Cassant / Rasant", type: "number", width: 140, editable: true },
    {
        key: "hauteur_finie_droite",
        label: "H. Finie Droite",
        type: "number",
        width: 135,
        readOnly: true,
        tooltip: "HSPF droit − déduction rail + finition bas",
        valueGetter: (v, r) => getters.hauteur_finie_droite(getRow(v, r))
    },
    {
        key: "hauteur_finie_milieu",
        label: "H. Finie Milieu",
        type: "number",
        width: 140,
        readOnly: true,
        tooltip: "HSPF milieu − déduction rail + finition bas",
        valueGetter: (v, r) => getters.hauteur_finie_milieu(getRow(v, r))
    },
    {
        key: "hauteur_finie_gauche",
        label: "H. Finie Gauche",
        type: "number",
        width: 140,
        readOnly: true,
        tooltip: "HSPF gauche − déduction rail + finition bas",
        valueGetter: (v, r) => getters.hauteur_finie_gauche(getRow(v, r))
    },
    {
        key: "hauteur_coupe",
        label: "H. Coupe",
        type: "number",
        width: 120,
        readOnly: true,
        tooltip: "Si laize > H_finie + 50 cm : utilise la valeur À Plat (tissu couché). Sinon : H_finie + 50 cm de marge de coupe",
        valueGetter: (v, r) => getters.hauteur_coupe(getRow(v, r))
    },
    {
        key: "hauteur_coupe_motif",
        label: "H. Coupe Motif",
        type: "number",
        width: 140,
        readOnly: true,
        tooltip: "H. Coupe arrondie au raccord motif vertical supérieur : ceil(H_coupe ÷ raccord_V) × raccord_V",
        valueGetter: (v, r) => {
            const row = getRow(v, r);
            const hCoupe = getters.hauteur_coupe(row);
            const rV = toNum(row.raccord_v_tissu1);
            if (rV > 0) return Math.ceil(hCoupe / rV) * rV;
            return hCoupe;
        }
    },
    {
        key: "hauteur_coupe_doublure",
        label: "H. Coupe Doubl.",
        type: "number",
        width: 150,
        readOnly: true,
        tooltip: "Même logique que H. Coupe mais basée sur la laize de doublure",
        valueGetter: (v, r) => {
            const row = getRow(v, r);
            const hFinieD = getters.hauteur_finie_droite(row);
            const hFinieG = getters.hauteur_finie_gauche(row);
            const hFinie = Math.max(hFinieD, hFinieG);

            const laizeD = toNum(row.laize_doublure);
            const aPlat = getters.a_plat(row);
            if (laizeD > (hFinie + 50)) return aPlat;
            return hFinie + 50;
        }
    },

    { key: "deduction_doublure", label: "Déd. Doublure", type: "number", width: 140, editable: true },

    // D. Détails Confection
    { key: "piquage_ourlets_du_bas", label: "Piq. Bas", type: "number", width: 115, editable: true },
    { key: "piquage_ourlets_bas_doublure", label: "Piq. Bas Doubl.", type: "number", width: 145, editable: true },
    { key: "doublure_finition_bas", label: "Doubl. Fin. Bas", type: "number", width: 145, editable: true },
    { key: "finition_champs", label: "Fin. Chant", type: "number", width: 120, editable: true },
    { key: "poids", label: "Poids", type: "select", options: ["Oui", "Non"], width: 90, editable: true },

    // Onglets: Non / Régulier / Irrégulier
    { key: "onglets", label: "Onglets", type: "select", options: ["Non", "Régulier", "Irrégulier"], width: 120, editable: true },

    { key: "bride", label: "Bride", type: "select", options: ["Oui", "Non"], width: 90, editable: true },

    // Crochets: Américain / Escargot
    { key: "type_crochets", label: "Crochets", type: "select", options: ['Crochet Américain', 'Crochet Escargot'], width: 165, editable: true },

    // Point Chausson: Oui / Non
    { key: "point_chausson", label: "Point Chausson", type: "select", options: ["Oui", "Non"], width: 140, editable: true },

    // E. Matériaux
    { key: "tissu_deco1", label: "Tissu 1", type: "text", width: 160, editable: true },
    { key: "laize_tissu1", label: "Laize T1", type: "number", width: 110, editable: true },
    { key: "raccord_v_tissu1", label: "Raccord V T1", type: "number", width: 125, editable: true },
    { key: "raccord_h_tissu1", label: "Raccord H T1", type: "number", width: 125, editable: true },
    {
        key: "ml_tissu1",
        label: "ML T1",
        type: "number",
        width: 100,
        readOnly: true,
        tooltip: "ML Tissu 1 calculé depuis les cotes BPF. Horizontal si laize ≥ H.Coupe : À Plat ÷ 100. Vertical : Nb lés × H.Coupe Motif ÷ 100",
        valueGetter: (v, r) => {
            const row = getRow(v, r);
            return calcML(getters.a_plat(row), toNum(row.laize_tissu1), getters.hauteur_coupe(row),
                (() => { const hC = getters.hauteur_coupe(row); const rV = toNum(row.raccord_v_tissu1); return rV > 0 ? Math.ceil(hC / rV) * rV : hC; })());
        }
    },
    { key: "tissu_deco2", label: "Tissu 2", type: "text", width: 160, editable: true },
    { key: "laize_tissu2", label: "Laize T2", type: "number", width: 110, editable: true },
    { key: "raccord_v_tissu2", label: "Raccord V T2", type: "number", width: 125, editable: true },
    { key: "raccord_h_tissu2", label: "Raccord H T2", type: "number", width: 125, editable: true },
    {
        key: "ml_tissu2",
        label: "ML T2",
        type: "number",
        width: 100,
        readOnly: true,
        tooltip: "ML Tissu 2 calculé depuis les cotes BPF (tissu uni, sans raccord motif)",
        valueGetter: (v, r) => {
            const row = getRow(v, r);
            const hC = getters.hauteur_coupe(row);
            return calcML(getters.a_plat(row), toNum(row.laize_tissu2), hC, hC);
        }
    },
    { key: "doublure", label: "Doublure", type: "text", width: 160, editable: true },
    { key: "laize_doublure", label: "Laize D.", type: "number", width: 110, editable: true },
    {
        key: "ml_doublure",
        label: "ML Doubl.",
        type: "number",
        width: 110,
        readOnly: true,
        tooltip: "ML Doublure calculé depuis les cotes BPF (utilise H.Coupe Doublure)",
        valueGetter: (v, r) => {
            const row = getRow(v, r);
            const hCD = (() => {
                const hFinieD = getters.hauteur_finie_droite(row);
                const hFinieG = getters.hauteur_finie_gauche(row);
                const hFinie = Math.max(hFinieD, hFinieG);
                const laizeD = toNum(row.laize_doublure);
                const aPlat = getters.a_plat(row);
                return laizeD > (hFinie + 50) ? aPlat : hFinie + 50;
            })();
            return calcML(getters.a_plat(row), toNum(row.laize_doublure), hCD, hCD);
        }
    },
    { key: "inter_doublure", label: "Interdoublure", type: "text", width: 160 },
    { key: "laize_inter", label: "Laize Interdoublure", type: "number", width: 175 },
    {
        key: "ml_inter_doublure",
        label: "ML Interdoubl.",
        type: "number",
        width: 120,
        readOnly: true,
        tooltip: "ML Interdoublure calculé depuis les cotes BPF",
        valueGetter: (v, r) => {
            const row = getRow(v, r);
            const hC = getters.hauteur_coupe(row);
            return calcML(getters.a_plat(row), toNum(row.laize_inter), hC, hC);
        }
    },
    { key: "passementerie1", label: "Pass. 1", type: "text", width: 160, editable: true },
    { key: "application_passementerie1", label: "Appli Pass. 1", type: "select", options: ["I", "U", "L", "-"], width: 140, editable: true },
    {
        key: "ml_pass1",
        label: "ML Pass. 1",
        type: "number",
        width: 110,
        readOnly: true,
        tooltip: "ML Pass. 1 selon application : I = 1 côté | U = périmètre | L = 3 côtés | - = largeur seule",
        valueGetter: (v, r) => {
            const row = getRow(v, r);
            const isPaire = (row.paire_ou_un_seul_pan || "").startsWith("Paire");
            return calcPassML(row.application_passementerie1, getters.a_plat(row), getters.hauteur_coupe(row), isPaire);
        }
    },
    { key: "passementerie2", label: "Pass. 2", type: "text", width: 160, editable: true },
    { key: "application_passementerie2", label: "Appli Pass. 2", type: "select", options: ["I", "U", "L", "-"], width: 140, editable: true },
    {
        key: "ml_pass2",
        label: "ML Pass. 2",
        type: "number",
        width: 110,
        readOnly: true,
        tooltip: "ML Pass. 2 selon application : I = 1 côté | U = périmètre | L = 3 côtés | - = largeur seule",
        valueGetter: (v, r) => {
            const row = getRow(v, r);
            const isPaire = (row.paire_ou_un_seul_pan || "").startsWith("Paire");
            return calcPassML(row.application_passementerie2, getters.a_plat(row), getters.hauteur_coupe(row), isPaire);
        }
    },

    // F. Finitions & Logistique Atelier
    { key: "croisement", label: "Croisement", type: "number", width: 120, editable: true },

    // Type de Croisement (NEW)
    {
        key: "type_croisement",
        label: "Type Croisement",
        type: "select",
        options: [
            "Croisement par chevauchement rail",
            "Patte de croisement devant derrière",
            "Patte de croisement double devant",
            "Croisement simple arrière gauche",
            "Croisement simple arrière droit"
        ],
        width: 230,
        editable: true
    },

    { key: "retour_gauche", label: "Retour G", type: "number", width: 110, editable: true },
    { key: "retour_droit", label: "Retour D", type: "number", width: 110, editable: true },
    { key: "type_retours", label: "Type Retours", type: "select", options: ['Élastique', 'Velcro', 'Piton'], width: 130, editable: true },
    { key: "hauteur_corniere_elastique", label: "H. Cornière / Élastique (cm)", type: "number", width: 200, editable: true },
    { key: "etiquette_lavage", label: "Etiq. Lavage", type: "select", options: ["Oui", "Non"], width: 125, editable: true },
    { key: "etiquette_lenglart", label: "Etiq. Lenglart", type: "select", options: ["Oui", "Non"], width: 130, editable: true, defaultValue: "Oui" },
    { key: "type_mecanisme", label: "Type Méca", type: "text", width: 130, editable: true },
    { key: "modele_mecanisme", label: "Modèle Méca", type: "text", width: 150, editable: true },
    { key: "couleur_mecanisme", label: "Couleur Méca", type: "text", width: 140, editable: true },
    { key: "meca_couvert", label: "Méca Couvert", type: "select", options: ["Couvert", "Mi-Couvert", "Découvert"], width: 135, editable: true },

    // Type de Commande (NEW)
    {
        key: "type_commande",
        label: "Type Commande",
        type: "select",
        options: [
            "Manuelle",
            "Télécommande/Radio",
            "Commande murale Radio",
            "Commande murale Sec",
            "Fourni par le client"
        ],
        width: 180,
        editable: true
    },

    {
        key: "nombre_glisseur",
        label: "Nb Glisseurs",
        type: "number",
        width: 120,
        readOnly: true,
        tooltip: "Wave 60 : L_finie/6 + 2. Wave 80 : L_finie/8 + 2. Autre : L_finie/10 + 2. Arrondi au pair supérieur. × 2 pour une paire",
        valueGetter: (v, row) => getters.nb_glisseurs(getRow(v, row))
    },

    { key: "couleur_glisseur", label: "Couleur Glisseur", type: "text", width: 145, editable: true },
    { key: "piton", label: "Piton", type: "text", width: 110, editable: true },
    { key: "embout_meca", label: "Embout Méca", type: "text", width: 130, editable: true, withLink: true },
    { key: "embout_meca_link", label: "Embout Méca (lien)", type: "text", width: 0, editable: true, hidden: true },
    { key: "support", label: "Support", type: "text", width: 120, editable: true, withLink: true },
    { key: "support_link", label: "Support (lien)", type: "text", width: 0, editable: true, hidden: true },
    {
        key: "equerre",
        label: "Equerre",
        type: "select",
        options: ["5", "8", "12", "18", "F7,5", "F10"],
        width: 100,
        editable: true
    },

    // G. Suivi & Statuts
    { key: "commentaire_confection", label: "Commentaire Confection", type: "textarea", width: 260, editable: true },
    { key: "type_pose", label: "Type Pose", type: "select", options: ["Mural", "Plafond", "Grande hauteur", "Suspente", "Naissance", "Encastrée"], width: 145, editable: true },
    { key: "heures_confection", label: "H. Conf.", type: "number", width: 115, editable: true },
    { key: "statut_pose", label: "Statut Pose", type: "select", options: ['Non démarré', 'Méca posé', 'Accroché', 'Terminé', 'Reprise'], width: 155, editable: true },
    { key: "statut_prepa", label: "Statut Prépa", type: "select", options: ['Non démarré', 'En cours', 'Terminé'], width: 150, editable: true },
    { key: "statut_conf", label: "Statut Conf", type: "select", options: ['Non démarré', 'Coupé', 'Assemblé', 'Plis terminés', 'Emballé'], width: 170, editable: true },
    // PRESERVED COMPONENTS
    { key: "schema_principe", label: "Schéma Principe", type: "photo", width: 150 },
    { key: "photos_sur_site", label: "Photo sur site", type: "photo", width: 150 },
];
