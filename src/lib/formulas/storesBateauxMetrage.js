// Métrage des stores bateaux et velums — calcul UNIQUE, partagé par le chiffrage
// (valeurs maximales fixes) et la production (valeurs réelles de la ligne).
//
// Ne s'applique qu'aux lignes portant le marqueur `formules_stores` (posé à la création
// du chiffrage / du projet, comme `formules_metrage` pour les rideaux) : les chiffrages
// et projets existants gardent leur métrage saisi à la main.
//
// Toutes les cotes sont en cm ; le ML renvoyé est en mètres, exact (sans arrondi :
// l'arrondi au demi-mètre se fait une seule fois par tissu, là où les besoins sont agrégés).

export const FORMULES_STORES_V1 = 1;
export const isStoresMetrageRow = (row) => Number(row?.formules_stores) >= FORMULES_STORES_V1;

export const isVelum = (produit) => /velum/i.test(String(produit || ''));

// Valeurs par défaut (et valeurs fixes du chiffrage).
export const STORE_DEFAULTS = {
    intervalle: 25,          // cm entre deux fourreaux
    ourletChiffrage: 3,      // ourlet de côté pris au chiffrage (× 4, doublé compris = maximum)
    surplusBateau: 4,        // cm de tissu par fourreau
    surplusVelum: 5,
    margeHauteur: 20,        // cm ajoutés à la hauteur de coupe
    demiLeAuDela: 140,       // laize > 140 cm → bandes au demi-lé ; ≤ 140 → lé entier
};

const num = (v) => {
    const n = parseFloat(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
};

export const surplusParDefaut = (produit) => (isVelum(produit) ? STORE_DEFAULTS.surplusVelum : STORE_DEFAULTS.surplusBateau);

/**
 * Coefficient de l'ourlet de côté selon sa finition :
 * « Double… » ou vide → 4 ; « Surfil… » ou « Point Bourdon… » → 2.
 */
export function coefOurletCote(finitionOC) {
    const f = String(finitionOC || '').trim().toLowerCase();
    if (!f || f.startsWith('double')) return 4;
    if (f.startsWith('surfil') || f.startsWith('point bourdon')) return 2;
    return 4;
}

/** Nombre de fourreaux (= tigettes) : ⌈hauteur finie ÷ intervalle⌉ − 1, minimum 0. */
export function nbFourreaux(hauteurFinie, intervalle) {
    const H = num(hauteurFinie);
    const I = num(intervalle) || STORE_DEFAULTS.intervalle;
    if (H <= 0) return 0;
    return Math.max(0, Math.ceil(H / I) - 1);
}

/**
 * Calcule le métrage d'UN tissu (toile ou doublure) d'un store.
 * @param {object} p
 *  - largeur, hauteurFinie (cm)
 *  - produit         : « Store Bateau » / « Store Velum » (surplus par défaut)
 *  - double          : store doublé (À Plat = largeur finie + 4, tissu ET doublure)
 *  - ourletCote      : valeur de l'ourlet de côté (cm) — ignorée si `chiffrage`
 *  - finitionOC      : finition de l'ourlet de côté (coefficient 4 ou 2)
 *  - chiffrage       : valeurs maximales fixes (ourlet 3 × 4, même doublé)
 *  - surplus, intervalle : fourreaux (défauts 4 / 5 et 25)
 *  - laize           : laize du tissu (vide ou 0 → ML 0)
 *  - raccordV, motif : tissu à motif (case « motif » du catalogue ou raccord V > 0)
 * @returns {{ largeurFinie, aPlat, nbFourreaux, hauteurCoupe, hauteurCoupeMotif, cas, nbBandes, ml }}
 *  cas : 'motif' | 'couche' | 'debout' | 'bandes' | 'sans_laize'
 */
export function metrageStore(p = {}) {
    const largeurFinie = num(p.largeur) + 1;

    // À plat : chiffrage = maximum fixe (ourlet 3 × 4) ; production : doublé → + 4,
    // sinon k × ourlet de côté (k selon la finition).
    let aPlat;
    if (p.chiffrage) aPlat = largeurFinie + 4 * STORE_DEFAULTS.ourletChiffrage;
    else if (p.double) aPlat = largeurFinie + 4;
    else aPlat = largeurFinie + coefOurletCote(p.finitionOC) * num(p.ourletCote);

    const fourreaux = nbFourreaux(p.hauteurFinie, p.intervalle);
    const surplus = p.surplus === '' || p.surplus == null ? surplusParDefaut(p.produit) : num(p.surplus);
    const hauteurCoupe = num(p.hauteurFinie) + surplus * fourreaux + STORE_DEFAULTS.margeHauteur;

    const rV = num(p.raccordV);
    const motif = !!p.motif || rV > 0;
    const hauteurCoupeMotif = rV > 0 ? (Math.ceil(hauteurCoupe / rV) + 1) * rV : hauteurCoupe;

    const laize = num(p.laize);
    const base = { largeurFinie, aPlat, nbFourreaux: fourreaux, hauteurCoupe, hauteurCoupeMotif };
    if (laize <= 0) return { ...base, cas: 'sans_laize', nbBandes: 0, ml: 0 };

    // Tissu à motif : jamais couché — lés debout à la hauteur de coupe motif.
    if (motif) {
        const nbLes = Math.ceil(aPlat / laize);
        return { ...base, cas: 'motif', nbBandes: nbLes, ml: (nbLes * hauteurCoupeMotif) / 100 };
    }
    // La hauteur tient dans la laize : coupe couchée, on prend l'à plat.
    if (hauteurCoupe <= laize) return { ...base, cas: 'couche', nbBandes: 1, ml: aPlat / 100 };
    // La largeur tient dans la laize : coupe debout, on prend la hauteur de coupe.
    if (aPlat <= laize) return { ...base, cas: 'debout', nbBandes: 1, ml: hauteurCoupe / 100 };
    // Les deux dépassent : bandes couchées superposées, au demi-lé pour les grandes laizes.
    const ratio = hauteurCoupe / laize;
    const nbBandes = laize > STORE_DEFAULTS.demiLeAuDela ? Math.ceil(ratio * 2) / 2 : Math.ceil(ratio);
    return { ...base, cas: 'bandes', nbBandes, ml: (nbBandes * aPlat) / 100 };
}

/** Libellé lisible du cas de coupe (affichage grille / infobulle). */
export const CAS_COUPE_LABEL = {
    motif: 'Motif (lés debout)',
    couche: 'Couché',
    debout: 'Debout',
    bandes: 'Bandes couchées',
    sans_laize: 'Laize manquante',
};
