// src/lib/schemas/production/rideaux.js
import React from 'react';
import { PAIRE_OPTIONS_BASE, paireOptionsForRow, PAIRE_DECENTREE } from '../../utils/pairDecentree';

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

// « Un seul pan » (toutes variantes) ET « Pan libre » comptent comme un pan unique
// pour les calculs de dimensions (largeur finie, à plat, …).
const isSinglePan = (row) => {
    const a = row.paire_ou_un_seul_pan || "";
    const b = row.pair_un || "";
    return a.startsWith("Un seul pan") || b.startsWith("Un seul pan") || a === "Pan libre" || b === "Pan libre";
};

// Pattes de croisement : libellés du select + nombre de crochets ajoutés à la
// formule "Nb Crochets par pan" lorsqu'une patte est sélectionnée.
export const PATTE_CROISEMENT_CROCHETS = {
    "KS Master Carrier": 2,
    "NDL 20 Projekt": 2,
    "FMS Underlap": 2,
    "FMS Overlap": 2,
    "CCS/FMS Master Carrier": 2,
    "Easyflex master carrier 90": 2,
    "Helicopter": 2,
    "ELEKTRO": 3,
};
export const PATTE_CROISEMENT_OPTIONS = ["", ...Object.keys(PATTE_CROISEMENT_CROCHETS)];

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
        const isOnePanel = isSinglePan(row);

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

        // Retour : on retient la plus grande des deux valeurs gauche / droite.
        const retourMax = Math.max(toNum(row.retour_gauche), toNum(row.retour_droit));

        // Plus de distinction pan unique / paire : deux côtés, chacun pesant 2×.
        // Chaque côté utilise sa finition si elle est renseignée (> 0),
        // sinon il retombe sur l'ourlet côté.
        // → Fin. Chant / Fin. Retour vides   : 4 × ourlet côté
        // → Fin. Chant renseignée            : 2 × Fin. Chant  + 2 × ourlet côté
        // → Fin. Retour renseignée           : 2 × ourlet côté + 2 × Fin. Retour
        // → les deux renseignées             : 2 × Fin. Chant  + 2 × Fin. Retour
        const side = (fin) => (toNum(fin) > 0 ? toNum(fin) : vOurlets);
        const ourletPart = (2 * side(row.finition_champs)) + (2 * side(row.finition_retour));

        const val = (lFinie * ampleur) + ourletPart + retourMax;
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
        const hFinieM = getters.hauteur_finie_milieu(row);
        const hFinieG = getters.hauteur_finie_gauche(row);
        const hFinie = Math.max(hFinieD, hFinieM, hFinieG);

        const laize = toNum(row.laize_tissu1 || row.laize_tissu_deco1);
        const aPlat = getters.a_plat(row);

        if (laize > (hFinie + 50)) {
            return round1(aPlat);
        }
        const piquageBas = toNum(row.piquage_ourlets_du_bas || row.ourlet_bas);
        return round1(hFinie + 50 + piquageBas);
    },

    nb_raccords_motifs: (row) => {
        const hCoupe = getters.hauteur_coupe(row);
        const rV = toNum(row.raccord_v_tissu1);
        return rV > 0 ? Math.ceil(hCoupe / rV) : 0;
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

    // H. Coupe T2 : même logique que hauteur_coupe, mais sur la laize du tissu 2.
    // Vide ("") si aucun tissu 2 renseigné (pas de tissu_deco2 ni de laize_tissu2).
    hauteur_coupe_t2: (row) => {
        if (!String(row.tissu_deco2 || "").trim() && !toNum(row.laize_tissu2)) return "";
        const hFinie = Math.max(
            getters.hauteur_finie_droite(row),
            getters.hauteur_finie_milieu(row),
            getters.hauteur_finie_gauche(row)
        );
        const laize = toNum(row.laize_tissu2);
        const aPlat = getters.a_plat(row);
        if (laize > (hFinie + 50)) return round1(aPlat);
        const piquageBas = toNum(row.piquage_ourlets_du_bas || row.ourlet_bas);
        return round1(hFinie + 50 + piquageBas);
    },

    // H. Coupe Motif T2 : H. Coupe T2 arrondie au raccord vertical du tissu 2.
    hauteur_coupe_motif_t2: (row) => {
        const hCoupe = getters.hauteur_coupe_t2(row);
        if (hCoupe === "" || hCoupe == null) return "";
        const rV = toNum(row.raccord_v_tissu2);
        if (rV > 0) return Math.ceil(hCoupe / rV) * rV;
        return hCoupe;
    },

    // H. Coupe Inter. : même logique que hauteur_coupe_doublure, mais sur la laize inter.
    // Vide ("") si aucune interdoublure renseignée.
    hauteur_coupe_inter: (row) => {
        if (!String(row.inter_doublure || "").trim() && !toNum(row.laize_inter)) return "";
        const hFinie = Math.max(getters.hauteur_finie_droite(row), getters.hauteur_finie_gauche(row));
        const laizeI = toNum(row.laize_inter);
        const aPlat = getters.a_plat(row);
        if (laizeI > (hFinie + 50)) return aPlat;
        return hFinie + 50;
    },

    nombre_les: (row) => {
        const aPlat = getters.a_plat(row);
        const laize = toNum(row.laize_tissu1);
        if (laize <= 0) return 0;
        return Math.max(1, Math.floor(aPlat / laize));
    },

    reste_les: (row) => {
        const laize = toNum(row.laize_tissu1);
        if (laize <= 0) return 0;

        // Si le rideau rentre dans la laize (hauteur finie max + 50 < laize T1),
        // on coupe dans le sens de la laize : pas de lés à jointer → pas d'appiècement.
        const hFinieMax = Math.max(
            getters.hauteur_finie_droite(row),
            getters.hauteur_finie_gauche(row)
        );
        if ((hFinieMax + 50) < laize) return "";

        const aPlat = getters.a_plat(row);
        const fraction = (aPlat / laize) - Math.floor(aPlat / laize);
        return round1(fraction * laize);
    },

    // Appiècement T2 / Doublure / Interdoublure : même formule que reste_les (T1),
    // mais sur la laize du tissu concerné. Vide ("") si le tissu n'est pas renseigné.
    reste_les_t2: (row) => {
        if (!String(row.tissu_deco2 || "").trim() && !toNum(row.laize_tissu2)) return "";
        const laize = toNum(row.laize_tissu2);
        if (laize <= 0) return "";
        const hFinieMax = Math.max(getters.hauteur_finie_droite(row), getters.hauteur_finie_gauche(row));
        if ((hFinieMax + 50) < laize) return "";
        const aPlat = getters.a_plat(row);
        const fraction = (aPlat / laize) - Math.floor(aPlat / laize);
        return round1(fraction * laize);
    },

    reste_les_doublure: (row) => {
        if (!String(row.doublure || "").trim() && !toNum(row.laize_doublure)) return "";
        const laize = toNum(row.laize_doublure);
        if (laize <= 0) return "";
        const hFinieMax = Math.max(getters.hauteur_finie_droite(row), getters.hauteur_finie_gauche(row));
        if ((hFinieMax + 50) < laize) return "";
        const aPlat = getters.a_plat(row);
        const fraction = (aPlat / laize) - Math.floor(aPlat / laize);
        return round1(fraction * laize);
    },

    reste_les_inter: (row) => {
        if (!String(row.inter_doublure || "").trim() && !toNum(row.laize_inter)) return "";
        const laize = toNum(row.laize_inter);
        if (laize <= 0) return "";
        const hFinieMax = Math.max(getters.hauteur_finie_droite(row), getters.hauteur_finie_gauche(row));
        if ((hFinieMax + 50) < laize) return "";
        const aPlat = getters.a_plat(row);
        const fraction = (aPlat / laize) - Math.floor(aPlat / laize);
        return round1(fraction * laize);
    },

    // Nb Glisseurs PAR PAN : base par pan (sans × 2 paire) + 1 si « Pan libre ».
    nb_glisseurs: (row) => {
        const lFinie = getters.largeur_finie(row);
        if (!lFinie) return 0;

        let divider = 10;
        const typeConf = (row.type_confection || "").toLowerCase();
        if (typeConf.includes("wave 60")) divider = 6;
        else if (typeConf.includes("wave 80")) divider = 8;

        const roundToEven = (num) => {
            const ceil = Math.ceil(num);
            return (ceil % 2 === 0) ? ceil : ceil + 1;
        };

        // Base PAR PAN, arrondie au pair supérieur (pas de × 2 paire).
        let total = roundToEven((lFinie / divider) + 2);

        // + 1 si « Pan libre »
        if ((row.paire_ou_un_seul_pan || "") === "Pan libre") total += 1;

        return total;
    },

    nb_crochets_par_pan: (row) => {
        const lFinie = getters.largeur_finie(row);
        if (!lFinie) return 0;

        let divider = 10;
        const typeConf = (row.type_confection || "").toLowerCase();
        if (typeConf.includes("wave 60")) divider = 6;
        else if (typeConf.includes("wave 80")) divider = 8;

        const roundToEven = (num) => {
            const ceil = Math.ceil(num);
            return (ceil % 2 === 0) ? ceil : ceil + 1;
        };

        // Base : formule glisseurs PAR PAN (sans le × 2 de la paire), arrondie au pair sup.
        let total = roundToEven((lFinie / divider) + 2);

        // + 2 si cache moteur = "oui"
        if (String(row.cache_moteur || "").toLowerCase() === "oui") total += 2;

        // + 1 si au moins un retour est rempli (gauche ou droit) — reste +1 même si les deux
        if (toNum(row.retour_gauche) > 0 || toNum(row.retour_droit) > 0) total += 1;

        // + valeur de la patte de croisement sélectionnée (0 si aucune)
        total += PATTE_CROISEMENT_CROCHETS[row.patte_de_croisement] || 0;

        // Le total n'est PAS ré-arrondi : il peut être impair.
        return total;
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
    nb_raccords_motifs:    getters.nb_raccords_motifs,
    hauteur_coupe_motif:   getters.hauteur_coupe_motif,
    hauteur_coupe_t2:      getters.hauteur_coupe_t2,
    hauteur_coupe_motif_t2:getters.hauteur_coupe_motif_t2,
    hauteur_coupe_doublure:getters.hauteur_coupe_doublure,
    hauteur_coupe_inter:   getters.hauteur_coupe_inter,
    nombre_les:            getters.nombre_les,
    reste_les:             getters.reste_les,
    reste_les_t2:          getters.reste_les_t2,
    reste_les_doublure:    getters.reste_les_doublure,
    reste_les_inter:       getters.reste_les_inter,
    nombre_glisseur:       getters.nb_glisseurs,
    nb_crochets_par_pan:   getters.nb_crochets_par_pan,
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
    { key: "paire_ou_un_seul_pan", label: "Paire ou un Pan", type: "select", options: PAIRE_OPTIONS_BASE, optionsFn: paireOptionsForRow, width: 260, editable: true },
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
        tooltip: "Tissu à plat avant confection : (L_finie × ampleur) + 4 × ourlets côtés, puis + retour max (G/D). Si Fin. Chant est renseignée elle remplace l'ourlet d'un côté (2 × Fin. Chant), de même Fin. Retour pour l'autre côté (2 × Fin. Retour).",
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
        label: "Appiècement cm",
        type: "number",
        width: 130,
        readOnly: true,
        tooltip: "Partie fractionnaire × laize T1 : reste de tissu après les lés entiers. Vide si le rideau rentre dans la laize (hauteur finie max + 50 cm < laize T1) : coupe dans le sens de la laize, pas d'appiècement.",
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
        label: "H. Coupe T1",
        type: "number",
        width: 120,
        readOnly: true,
        tooltip: "Si laize T1 > H_finie + 50 cm : utilise la valeur À Plat (tissu couché). Sinon : H_finie + 50 cm de marge de coupe",
        valueGetter: (v, r) => getters.hauteur_coupe(getRow(v, r))
    },
    {
        key: "nb_raccords_motifs",
        label: "Nb Raccords Motifs",
        type: "number",
        width: 155,
        readOnly: true,
        tooltip: "Nombre de raccords motif : ceil(H. Coupe ÷ Raccord V T1). Zéro si pas de raccord.",
        valueGetter: (v, r) => getters.nb_raccords_motifs(getRow(v, r))
    },
    {
        key: "hauteur_coupe_motif",
        label: "H. Coupe Motif T1",
        type: "number",
        width: 150,
        readOnly: true,
        tooltip: "H. Coupe T1 arrondie au raccord motif vertical supérieur : ceil(H_coupe ÷ raccord_V T1) × raccord_V T1",
        valueGetter: (v, r) => {
            const row = getRow(v, r);
            const hCoupe = getters.hauteur_coupe(row);
            const rV = toNum(row.raccord_v_tissu1);
            if (rV > 0) return Math.ceil(hCoupe / rV) * rV;
            return hCoupe;
        }
    },
    {
        key: "hauteur_coupe_t2",
        label: "H. Coupe T2",
        type: "number",
        width: 120,
        readOnly: true,
        tooltip: "Même logique que H. Coupe T1, basée sur la laize du tissu 2. Vide s'il n'y a pas de tissu 2.",
        valueGetter: (v, r) => getters.hauteur_coupe_t2(getRow(v, r))
    },
    {
        key: "hauteur_coupe_motif_t2",
        label: "H. Coupe Motif T2",
        type: "number",
        width: 150,
        readOnly: true,
        tooltip: "H. Coupe T2 arrondie au raccord motif vertical du tissu 2 : ceil(H_coupe T2 ÷ raccord_V T2) × raccord_V T2",
        valueGetter: (v, r) => getters.hauteur_coupe_motif_t2(getRow(v, r))
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
    {
        key: "hauteur_coupe_inter",
        label: "H. Coupe Inter.",
        type: "number",
        width: 150,
        readOnly: true,
        tooltip: "Même logique que H. Coupe Doubl., basée sur la laize de l'interdoublure. Vide s'il n'y a pas d'interdoublure.",
        valueGetter: (v, r) => getters.hauteur_coupe_inter(getRow(v, r))
    },

    { key: "deduction_doublure", label: "Déd. Doublure", type: "number", width: 140, editable: true },

    // D. Détails Confection
    { key: "piquage_ourlets_du_bas", label: "Piq. Bas", type: "number", width: 115, editable: true },
    { key: "piquage_ourlets_bas_doublure", label: "Piq. Bas Doubl.", type: "number", width: 145, editable: true },
    { key: "doublure_finition_bas", label: "Doubl. Fin. Bas", type: "number", width: 145, editable: true },
    { key: "finition_champs", label: "Fin. Chant", type: "number", width: 120, editable: true },
    { key: "finition_retour", label: "Fin. Retour", type: "number", width: 120, editable: true, tooltip: "Rideau doublé : l'À Plat utilise 2 × Fin. Chant + 2 × Fin. Retour (au lieu de 4 × ourlet côté)." },
    { key: "poids", label: "Poids", type: "select", options: ["Oui", "Non"], width: 90, editable: true },

    // Onglets: Non / Régulier / Irrégulier
    { key: "onglets", label: "Onglets", type: "select", options: ["Non", "Régulier", "Irrégulier"], width: 120, editable: true },

    { key: "bride", label: "Bride", type: "select", options: ["Oui", "Non"], width: 90, editable: true },

    // Crochets: Américain / Escargot (plastique/métal) / Agrafe à coudre
    { key: "type_crochets", label: "Crochets", type: "select", options: ['Crochet américain', 'Crochet escargot plastique', 'Crochet escargot métal', 'Agrafe à coudre'], width: 165, editable: true },

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
    {
        key: "reste_les_t2",
        label: "Appiècement T2 cm",
        type: "number",
        width: 140,
        readOnly: true,
        tooltip: "Reste de tissu après les lés entiers, sur la laize du tissu 2. Vide s'il n'y a pas de tissu 2, ou si le rideau rentre dans la laize (hauteur finie max + 50 cm < laize T2).",
        valueGetter: (v, r) => getters.reste_les_t2(getRow(v, r))
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
    {
        key: "reste_les_doublure",
        label: "Appiècement Doublure cm",
        type: "number",
        width: 160,
        readOnly: true,
        tooltip: "Reste de tissu après les lés entiers, sur la laize de doublure. Vide s'il n'y a pas de doublure, ou si le rideau rentre dans la laize (hauteur finie max + 50 cm < laize doublure).",
        valueGetter: (v, r) => getters.reste_les_doublure(getRow(v, r))
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
    {
        key: "reste_les_inter",
        label: "Appiècement Inter. cm",
        type: "number",
        width: 150,
        readOnly: true,
        tooltip: "Reste de tissu après les lés entiers, sur la laize d'interdoublure. Vide s'il n'y a pas d'interdoublure, ou si le rideau rentre dans la laize (hauteur finie max + 50 cm < laize inter).",
        valueGetter: (v, r) => getters.reste_les_inter(getRow(v, r))
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
            const isPaire = (row.paire_ou_un_seul_pan || "").startsWith("Paire") && row.paire_ou_un_seul_pan !== PAIRE_DECENTREE;
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
            const isPaire = (row.paire_ou_un_seul_pan || "").startsWith("Paire") && row.paire_ou_un_seul_pan !== PAIRE_DECENTREE;
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

    // Patte de Croisement (NEW) — alimente la formule "Nb Crochets par pan"
    {
        key: "patte_de_croisement",
        label: "Patte de Croisement",
        type: "select",
        options: PATTE_CROISEMENT_OPTIONS,
        width: 220,
        editable: true,
        tooltip: "Référence de patte de croisement. Ajoute des crochets au calcul \"Nb Crochets par pan\" (ELEKTRO : +3, autres : +2)."
    },

    { key: "retour_gauche", label: "Retour G", type: "number", width: 110, editable: true },
    { key: "retour_droit", label: "Retour D", type: "number", width: 110, editable: true },
    { key: "type_retours", label: "Type Retours", type: "select", options: ['Élastique', 'Velcro', 'Piton'], width: 130, editable: true },
    { key: "hauteur_corniere_elastique", label: "H. Cornière / Élastique (cm)", type: "number", width: 200, editable: true },
    { key: "etiquette_lavage", label: "Etiq. Lavage", type: "select", options: ["Oui", "Non"], width: 125, editable: true },
    { key: "etiquette_lenglart", label: "Etiq. Lenglart", type: "select", options: ["Non", "Ne pas laver", "Lavage à 30°", "Voilage"], width: 130, editable: true, defaultValue: "Non" },
    { key: "type_mecanisme", label: "Type Méca", type: "text", width: 130, editable: true },
    { key: "modele_mecanisme", label: "Modèle Méca", type: "text", width: 150, editable: true },
    { key: "couleur_mecanisme", label: "Couleur Méca", type: "text", width: 140, editable: true },
    { key: "meca_couvert", label: "Méca Couvert", type: "select", options: ["Couvert", "Mi-Couvert", "Découvert"], width: 135, editable: true },
    { key: "cache_moteur", label: "Cache Moteur", type: "select", options: ["non", "oui"], width: 125, editable: true, defaultValue: "non", tooltip: "Si \"oui\" : +2 crochets dans le calcul \"Nb Crochets par pan\"." },

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
        label: "Nb Glisseurs par pan",
        type: "number",
        width: 150,
        readOnly: true,
        tooltip: "Base PAR PAN : Wave 60 → L_finie/6 + 2 ; Wave 80 → L_finie/8 + 2 ; autre → L_finie/10 + 2. Arrondi au pair supérieur. + 1 si « Pan libre ». (Pas de × 2 pour une paire.)",
        valueGetter: (v, row) => getters.nb_glisseurs(getRow(v, row))
    },

    {
        key: "nb_crochets_par_pan",
        label: "Nb Crochets / pan",
        type: "number",
        width: 145,
        readOnly: true,
        tooltip: "Base glisseurs PAR PAN (sans × 2 paire), arrondie au pair sup. + 2 si cache moteur \"oui\" + 1 si un retour rempli + valeur patte de croisement. Total possiblement impair.",
        valueGetter: (v, row) => getters.nb_crochets_par_pan(getRow(v, row))
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
