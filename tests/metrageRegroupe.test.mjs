// Rideaux couchés regroupés dans la laize + demi-lé pour tous (formules de métrage v4).
// Jeu de référence de l'équipe : 33 lignes, uni, laize 295, ampleur 1,5, non doublé, tête 14,
// OB 8, OC 3, finition bas 0, retours 0, Qté 1 → H. coupe = hauteur + 54, à plat = L. finie × 1,5 + 12.
// Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { regrouperCouche, metrageRegroupeLignes, texteRegroupe } from '../src/lib/formulas/metrageRegroupe.js';
import { computeFormulas } from '../src/lib/formulas/compute.js';
import { RIDEAUX_SCHEMA } from '../src/lib/schemas/chiffrage/rideaux.js';
import { RIDEAUX_PROD_SCHEMA, regrouperRideauxProduction } from '../src/lib/schemas/production/rideaux.js';
import { buildProjectFromMinute } from '../src/lib/import/projectFromMinute.js';
import { computeNeeds } from '../src/lib/stock/projectStock.js';

// [libellé, nombre de lignes, type, L. finie, hauteur, ML attendu par ligne (exceptions par n°)]
const JEU = [
    ['Séparation 1', 1, 'pan', 235.5, 120, 2.16],
    ['Séparation 2', 1, 'pan', 87.9, 162, 1.44],
    ['Séparation 3', 1, 'paire', 199.6, 210, 6.23],
    ['Hublot', 2, 'paire', 153.8, 130, 4.85],
    ['Lit identique', 8, 'paire', 154.3, 68.5, 2.44],
    ['Lit symétrique', 8, 'paire', 154.3, 66.5, 2.44, { 1: 2.71 }],
    ['Porte', 3, 'pan', 97.1, 210, 1.58],
    ['Babord arrière', 8, 'paire', 136.6, 65, 2.17, { 1: 2.29, 8: 3.25 }],
];

// ── 1. Placement pur (h, a donnés) ───────────────────────────────────────────
const lignesPures = () => {
    const out = [];
    JEU.forEach(([label, n, type, lF, haut, ml, exc = {}]) => {
        for (let i = 1; i <= n; i++) {
            out.push({ id: `${label} ${i}`, label: `${label} ${i}`, count: type === 'paire' ? 2 : 1, attendu: exc[i] ?? ml,
                matieres: { tissu1: { article: 'UNI', laize: 295, h: haut + 54, a: Math.round((lF * 1.5 + 12) * 10) / 10 } } });
        }
    });
    return out;
};

test('placement : 35 bandes, 82,068 m, ML attendu sur chaque ligne', () => {
    const lignes = lignesPures();
    const map = metrageRegroupeLignes(lignes);
    const any = map.get('Séparation 1 1').tissu1;
    assert.equal(any.nbBandes, 35);
    assert.equal(Math.round(any.total * 1000) / 1000, 82.068);
    lignes.forEach((l) => assert.equal(map.get(l.id).tissu1.ml, l.attendu, l.id));
    // Σ lignes ≈ ML total (écart = arrondis au centième de chaque ligne)
    const somme = lignes.reduce((s, l) => s + map.get(l.id).tissu1.ml, 0);
    assert.ok(Math.abs(somme - 82.068) < 0.1, String(somme));
});

test('placement : bande 1 = séparation 1 + 1 rideau du lit symétrique 1 (294,5 / 295) ; bandes partagées', () => {
    const pieces = lignesPures().flatMap((l) => Array.from({ length: l.count }, () => ({ ligneId: l.id, h: l.matieres.tissu1.h, a: l.matieres.tissu1.a })));
    const { bandes } = regrouperCouche(pieces, 295);
    assert.deepEqual(bandes[0].pieces.map((p) => p.ligneId), ['Séparation 1 1', 'Lit symétrique 1']);
    assert.equal(bandes[0].laizeUtilisee, 294.5);
    assert.equal(bandes[0].longueur, 365.3);
    const map = metrageRegroupeLignes(lignesPures());
    assert.match(texteRegroupe(map.get('Lit symétrique 8').tissu1), /avec Babord arrière 1/);
    assert.equal(texteRegroupe(map.get('Lit identique 1').tissu1), 'Couché regroupé : bande n° 4 (2 dans la laize)');
    assert.equal(map.get('Babord arrière 8').tissu1.bandes.at(-1).nb, 1); // dernier rideau seul
});

// ── 2. Chiffrage réel (recomputeRow + passe) ─────────────────────────────────
const CATALOG = [{ name: 'UNI', category: 'Tissu', laize: 295, buyPrice: 10, sellPrice: 20 }];
const ctx = (v) => ({ paramsMap: { formules_metrage: v }, catalog: CATALOG, settings: { taux_horaire: 135 } });
// Largeur saisie qui redonne la L. finie du jeu : L. finie = L/pan × 1,025 + 10.
const ligneChiffrage = (id, type, lF, haut, extra = {}) => ({
    id, produit: 'Rideau', zone: id, paire_ou_un_seul_pan: type === 'paire' ? 'Paire' : 'Un seul pan',
    largeur: Math.round(((lF - 10) / 1.025) * (type === 'paire' ? 2 : 1) * 1000) / 1000, hauteur: haut,
    ampleur: 1.5, hauteur_renfort_tete: 14, piquage_ourlets_du_bas: 8, v_ourlets_de_cotes: 3, finition_bas: 0,
    retour_gauche: 0, retour_droit: 0, croisement: 0, quantite: 1, tissu_deco1: 'UNI', ...extra,
});
const CATALOG_RACCORD = [{ ...CATALOG[0], raccord_v: 20 }];
const chiffrage = (v, extra, catalog = CATALOG) => {
    const rows = [];
    JEU.forEach(([label, n, type, lF, haut, ml, exc = {}]) => {
        for (let i = 1; i <= n; i++) rows.push({ ...ligneChiffrage(`${label} ${i}`, type, lF, haut, extra), __attendu: exc[i] ?? ml });
    });
    return computeFormulas(rows, RIDEAUX_SCHEMA, { ...ctx(v), catalog });
};

test('chiffrage v4 : mêmes ML par ligne, total ≈ 82,07 m, infobulle, prix = ML × prix', () => {
    const rows = chiffrage(4);
    rows.forEach((r) => {
        assert.equal(r.hauteur_coupe, r.hauteur + 54, r.id);
        assert.equal(r.ml_tissu1, r.__attendu, r.id);
        assert.equal(r.nb_les_tissu1, 0);
        assert.equal(r.pv_tissu1, r.ml_tissu1 * 20);
        assert.match(r.ml_regroupe_info.tissu1, /^Couché regroupé : bande n° \d+/);
    });
    const total = rows.reduce((s, r) => s + r.ml_tissu1, 0);
    assert.ok(Math.abs(total - 82.068) < 0.1, String(total));
});

test('non-régression : v3 → calcul actuel (144 m) ; raccord V → pas de regroupement', () => {
    const v3 = chiffrage(3);
    assert.equal(v3.reduce((s, r) => s + r.ml_tissu1, 0), 144);
    assert.ok(v3.every((r) => !r.ml_regroupe_info));
    const raccord = chiffrage(4, {}, CATALOG_RACCORD);
    const raccordV3 = chiffrage(3, {}, CATALOG_RACCORD);
    assert.equal(raccord[0].raccord_v_tissu1, 20);
    raccord.forEach((r, i) => assert.equal(r.ml_tissu1, raccordV3[i].ml_tissu1, r.id));
    assert.ok(raccord.every((r) => !r.ml_regroupe_info));
});

test('une ligne en lés debout ajoutée : hors bandes, sans effet sur les autres', () => {
    const base = chiffrage(4);
    const rows = computeFormulas([...base, ligneChiffrage('Grande', 'pan', 300, 400)], RIDEAUX_SCHEMA, ctx(4));
    const debout = rows.at(-1);
    assert.ok(debout.nb_les_tissu1 > 0);
    assert.ok(!debout.ml_regroupe_info);
    base.forEach((r, i) => assert.equal(rows[i].ml_tissu1, r.ml_tissu1, r.id));
});

test('demi-lé pour tous (v4) : un seul pan, laize 140, à plat 190, H. coupe 250 → 1,5 lé, 4 m (v3 : 2 lés, 5 m)', () => {
    const row = { ...ligneChiffrage('Pan', 'pan', 190, 196, { ampleur: 1, v_ourlets_de_cotes: 0 }), tissu_deco1: 'LIN', laize_tissu1: 140 };
    const [v4] = computeFormulas([row], RIDEAUX_SCHEMA, ctx(4));
    assert.equal(v4.a_plat, 190);
    assert.equal(v4.hauteur_coupe, 250);
    assert.equal(v4.nb_les_tissu1, 1.5);
    assert.equal(v4.ml_tissu1, 4);
    const [v3] = computeFormulas([row], RIDEAUX_SCHEMA, ctx(3));
    assert.equal(v3.nb_les_tissu1, 2);
    assert.equal(v3.ml_tissu1, 5);
});

// ── 3. Mise en projet : production et besoins ────────────────────────────────
test('mise en projet : mêmes ML par ligne en production, 82,5 m dans les besoins', () => {
    const lignes = chiffrage(4).map(({ __attendu, ...r }) => r); // eslint-disable-line no-unused-vars
    const attendus = Object.fromEntries(chiffrage(4).map((r) => [r.id, r.__attendu]));
    const projet = buildProjectFromMinute({ id: 'm', name: 'Bateau', params: [{ name: 'formules_metrage', value: 4 }], lines: lignes, catalog: CATALOG });
    const needs = computeNeeds(projet.rows, []);
    const uni = needs.find((n) => n.key === 'UNI');
    assert.equal(uni.total, 82.5);
    assert.ok(uni.arrondiRegroupe);
        // Production avec cotes de pose = cotes du plan : mêmes ML par ligne, à l'arrondi près
    // (la production arrondit la L. finie au cm supérieur : 199,6 → 200)
    const posees = projet.rows.map((r) => ({ ...r, hspf_droite: Number(r.hauteur) + Number(r.valeur_deduction || 0), hspf_milieu: Number(r.hauteur) + Number(r.valeur_deduction || 0), hspf_gauche: Number(r.hauteur) + Number(r.valeur_deduction || 0) }));
    const prod = regrouperRideauxProduction(posees);
    const ml = (r) => RIDEAUX_PROD_SCHEMA.find((c) => c.key === 'ml_tissu1').valueGetter(undefined, r);
    prod.forEach((r) => assert.ok(Math.abs(ml(r) - attendus[r.id]) <= 0.05, `${r.id} ${ml(r)}`));
    assert.ok(prod.every((r) => r.ml_regroupe?.tissu1 > 0 && /^Couché regroupé/.test(r.ml_regroupe_info.tissu1)));
});
