// Étiquette stores bateaux / velum : même grille que l'étiquette rideau, valeurs calculées.
// Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    layoutFor, cellText, htText, sideLines, ETIQUETTE_STORES_BATEAUX_FIELDS, STORES_BATEAUX_SECTIONS,
} from '../src/lib/etiquettes/storesBateauxLabel.js';
import { RIDEAUX_V2_SECTIONS } from '../src/lib/etiquettes/rideauxLabelLayout.js';

// Store de 112 de large (LF), HF 107, quantité 2, laize 160, OC 1,5 — nouveau métrage v1.
const STORE = {
    formules_stores: 1, produit: 'Store Bateau', type_store_bateau: 'Freel',
    largeur: 111, hauteur_finie: 107, quantite: 2, ourlet_de_cote: 1.5,
    toile_finition_1: 'Lin naturel', laize_toile_finition_1: 160,
};

// Position (section, ligne, colonne) de chaque clé dans une grille.
const positions = (sections) => {
    const pos = {};
    sections.forEach((s) => s.groups.forEach((g, gi) => g.rows.forEach((r, ri) => r.forEach((c, ci) => {
        if (c) pos[c[0]] = { section: s.name, frame: g.frame || null, gi, ri, ci };
    }))));
    return pos;
};
const cell = (layout, key) => {
    for (const s of layout) for (const g of s.groups) for (const r of g.rows) {
        const ci = r.findIndex((c) => c?.key === key);
        if (ci >= 0) return { section: s.name, frame: g.frame || null, row: r, ci, ...r[ci] };
    }
    return null;
};

test('exemple atelier : à plat 118, H. coupe 143, « 2 HT 118 × 160 », 5 intervalles de 21,4 cm', () => {
    assert.equal(cellText(STORE, 'largeur_finie'), '112 cm');
    assert.equal(cellText(STORE, 'a_plat'), '118 cm');
    assert.equal(cellText(STORE, 'hauteur_coupe'), '143 cm');
    assert.equal(cellText(STORE, 'ourlet_de_cote'), '1,5 cm');
    assert.equal(cellText(STORE, 'ht_t1'), '2 HT 118 × 160');
    assert.equal(cellText(STORE, 'cas_coupe_txt'), 'Couché');
    assert.equal(sideLines(STORE)[0].text, '5 intervalles de 21,4 cm');
});

test('Coupe selon la façon de couper : debout, bandes couchées, motif', () => {
    // Debout : la largeur tient dans la laize, pas la hauteur.
    assert.equal(htText({ ...STORE, hauteur_finie: 200, laize_toile_finition_1: 140 }), '2 HT 248');
    // Velum en bandes couchées (laize 140 ≤ 140 → lé entier) : n × nbBandes HT à plat × laize.
    const velum = { ...STORE, produit: 'Store Velum', largeur: 300, hauteur_finie: 200, laize_toile_finition_1: 140, quantite: 1 };
    // à plat 301 + 6 = 307 ; H. coupe 200 + 5×7 + 20 = 255 → 255/140 → 2 bandes
    assert.equal(htText(velum), '2 HT 307 × 140');
    assert.match(cellText(velum, 'cas_coupe_txt'), /Bandes couchées × 2/);
    // Motif (raccord 64) : n × nbLes HT H. coupe motif = 2 × 1 HT (⌈143/64⌉+1)×64.
    assert.equal(htText({ ...STORE, raccord_v_toile_finition_1: 64 }), '2 HT 256');
});

test('store doublé : cadre Doublure, Coupe doublure en colonne 3 ; sans doublure : cadre retiré, rien ne bouge', () => {
    const double = { ...STORE, doublure: 'Satin', laize_doublure: 280 };
    const ht = cell(layoutFor(double), 'ht_doubl');
    assert.equal(ht.frame, 'Doublure');
    assert.equal(ht.ci, 2);
    assert.match(ht.text, /^2 HT /);
    const sans = layoutFor(STORE);
    assert.equal(cell(sans, 'ht_doubl'), null);
    assert.equal(cell(sans, 'hauteur_coupe_doublure'), null);
    for (const key of ['ht_t1', 'a_plat', 'ourlet_de_cote', 'largeur_finie', 'hauteur_finie', 'mecanisme_store']) {
        const a = cell(layoutFor(double), key), b = cell(sans, key);
        if (a || b) assert.equal(a?.ci, b?.ci, key);
    }
});

test('case masquée ou vide = case blanche à sa place ; ligne toute blanche retirée', () => {
    const masque = { ...STORE, etiquette_hidden_fields: ['laize_toile_finition_1'] };
    const laize = cell(layoutFor(masque), 'laize_toile_finition_1');
    assert.equal(laize.ci, 1);
    assert.equal(laize.text, '');
    assert.equal(cell(layoutFor(masque), 'hauteur_coupe').ci, 2);
    // Sans mécanisme ni commande ni manœuvre : la ligne Méca disparaît, HF reste en colonne 1.
    const hf = cell(layoutFor(STORE), 'hauteur_finie');
    assert.equal(hf.section, 'PRÉPARATION');
    assert.equal(hf.ci, 0);
    assert.equal(cell(layoutFor(STORE), 'mecanisme_store'), null);
    // « Non » (étiquette de lavage par défaut) = case blanche.
    assert.equal(cellText({ ...STORE, etiquette_lavage: 'Non' }, 'etiquette_lavage'), '');
});

test('pas d\'ourlet du bas sur un store', () => {
    const keys = ETIQUETTE_STORES_BATEAUX_FIELDS.map((f) => f.key);
    assert.ok(!keys.includes('picage_bas'));
    assert.ok(!keys.includes('piquage_ourlet'));
});

test('mêmes emplacements que l\'étiquette rideau (LF, HF, OC / Fin. OC, Coupe, Méca, Tissu / Laize / H. coupe / H. motif)', () => {
    const S = positions(STORES_BATEAUX_SECTIONS), R = positions(RIDEAUX_V2_SECTIONS);
    const pairs = [
        ['toile_finition_1', 'tissu_deco1'], ['laize_toile_finition_1', 'laize_tissu1'],
        ['hauteur_coupe', 'hauteur_coupe'], ['hauteur_coupe_motif', 'hauteur_coupe_motif'],
        ['ht_t1', 'ht_t1'], ['ht_doubl', 'ht_doubl'],
        ['ourlet_de_cote', 'v_ourlets_de_cotes'], ['finition_oc', 'finition_oc'],
        ['etiquette_lavage', 'etiquette_lenglart'], ['a_plat', 'a_plat'],
        ['mecanisme_store', 'type_mecanisme'], ['hauteur_finie', 'hauteur_finie_gauche'],
        ['largeur_finie', 'largeur_finie'],
    ];
    for (const [s, r] of pairs) {
        assert.equal(S[s].section, R[r].section, s);
        assert.equal(S[s].ci, R[r].ci, `${s} colonne`);
    }
});
