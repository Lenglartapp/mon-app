// Confection et étiquette rideau — corrections groupées (cassant/rasant, Larg. coupe,
// renfort tête 12/20, finitions Triple). Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCassantRasant, cassantRasantText, cassantRasantNum } from '../src/lib/formulas/cassantRasant.js';
import { RIDEAUX_GETTERS as G } from '../src/lib/schemas/production/rideaux.js';
import { metrageStore, coefOurletCote } from '../src/lib/formulas/storesBateauxMetrage.js';
import {
    HAUTEUR_RENFORT_TETE_OPTIONS, FINITION_OC_OPTIONS, FINITION_OB_OPTIONS, FINITION_OB_RIDEAUX_OPTIONS,
} from '../src/lib/constants/rideauxFields.js';
import { RIDEAUX_V2_SECTIONS } from '../src/lib/etiquettes/rideauxLabelLayout.js';

test('cassant / rasant : lecture des nombres et du texte saisi', () => {
    assert.equal(parseCassantRasant(7), 7);
    assert.equal(parseCassantRasant('7,5'), 7.5);
    assert.equal(parseCassantRasant('-3'), -3);
    assert.equal(parseCassantRasant('CASSANT 7'), 7);
    assert.equal(parseCassantRasant('Rasant 2'), -2);
    assert.equal(parseCassantRasant('rasant -2'), -2);
    assert.equal(parseCassantRasant('cassànt 4,5 cm'), 4.5);
    assert.equal(parseCassantRasant('4 cm'), 4);
    assert.equal(parseCassantRasant('à voir'), 'à voir');
    assert.equal(parseCassantRasant(''), null);
    assert.equal(parseCassantRasant(null), null);
    assert.equal(parseCassantRasant(undefined), null);
});

test('case « Bas » de l\'étiquette', () => {
    assert.equal(cassantRasantText('CASSANT 7'), 'cassant 7 cm');
    assert.equal(cassantRasantText(7), 'cassant 7 cm');
    assert.equal(cassantRasantText(-3), 'rasant 3 cm');
    assert.equal(cassantRasantText(0), 'rasant 0 cm');
    assert.equal(cassantRasantText(''), '');
    assert.equal(cassantRasantText(null), '');
    assert.equal(cassantRasantNum('à voir'), 0);
});

test('valeurs texte réelles de la base : tolérance et mot-clé seul', () => {
    // « +/- x » est une tolérance de pose : rasant 0, hauteur finie inchangée.
    assert.equal(cassantRasantNum('Rasant +/- 0.5 cm'), 0);
    assert.equal(cassantRasantNum('Rasant +/-1 cm'), 0);
    assert.equal(cassantRasantText('Rasant +/- 0.5 cm'), 'rasant 0 cm (± 0,5)');
    assert.equal(cassantRasantText('Rasant +/-1 cm'), 'rasant 0 cm (± 1)');
    assert.equal(cassantRasantText('Rasant'), 'rasant 0 cm');
    assert.equal(cassantRasantNum('Rasant'), 0);
    assert.equal(cassantRasantText('NON'), 'NON');
    assert.equal(cassantRasantNum('CASSANT 7'), 7);
});

test('hauteur finie : « CASSANT 7 » compte + 7', () => {
    const row = { hspf_gauche: 250, hspf_milieu: 250, hspf_droite: 250, valeur_deduction: 2, finition_bas: 'CASSANT 7' };
    assert.equal(G.hauteur_finie_gauche(row), 255);
    assert.equal(G.hauteur_finie_milieu(row), 255);
    assert.equal(G.hauteur_finie_droite(row), 255);
    assert.equal(G.hauteur_finie_droite({ ...row, finition_bas: -3 }), 245);
});

test('rideau : OC Triple → 3 × OC par côté (+ 18 au lieu de + 12 pour OC 3)', () => {
    const base = { paire_ou_un_seul_pan: 'Un seul pan', largeur: 200, v_ourlets_de_cotes: 3 };
    const double = G.a_plat({ ...base, finition_oc: 'Double + apparente' });
    const vide = G.a_plat(base);
    const triple = G.a_plat({ ...base, finition_oc: 'Triple + apparente' });
    assert.equal(double, vide);
    assert.equal(triple - double, 6);
    // Côté dont la finition est renseignée : garde 2 × sa propre valeur.
    const chant = G.a_plat({ ...base, finition_oc: 'Triple + invisible', finition_champs: 2 });
    assert.equal(triple - chant, 9 - 4);
});

test('store : OC Triple → OC × 6 au lieu de OC × 4', () => {
    assert.equal(coefOurletCote('Triple + apparente'), 6);
    assert.equal(coefOurletCote('Double + apparente'), 4);
    assert.equal(coefOurletCote(''), 4);
    assert.equal(coefOurletCote('Surfil + Invisible'), 2);
    assert.equal(coefOurletCote('Point Bourdon + Invisible'), 2);
    const p = { largeur: 100, hauteurFinie: 100, ourletCote: 3, laize: 300 };
    assert.equal(metrageStore({ ...p, finitionOC: 'Triple + invisible' }).aPlat - metrageStore({ ...p, finitionOC: 'Double + Invisible' }).aPlat, 6);
});

test('listes : Triple partout, Bord/bord proposé, En sac absent, renfort tête 12 et 20 cm', () => {
    for (const list of [FINITION_OC_OPTIONS, FINITION_OB_OPTIONS, FINITION_OB_RIDEAUX_OPTIONS]) {
        assert.ok(list.includes('Triple + apparente'));
        assert.ok(list.includes('Triple + invisible'));
        assert.ok(list.includes('Bord/bord'));
        assert.ok(!list.some((o) => /en sac/i.test(o)));
    }
    assert.equal(FINITION_OB_OPTIONS.at(-1), 'Pastille Velcro');
    assert.equal(FINITION_OB_RIDEAUX_OPTIONS.at(-1), 'Assemblage finette');
    assert.deepEqual(HAUTEUR_RENFORT_TETE_OPTIONS, [
        '8 cm', '10 cm', '12 cm', '14 cm', '20 cm',
        '8 cm thermocollant', '10 cm thermocollant', '12 cm thermocollant', '14 cm thermocollant', '20 cm thermocollant',
    ]);
});

test('renfort tête 20 cm : hauteur de coupe + 6 cm par rapport à 14 cm (doublé, formules v2)', () => {
    const row = { formules_metrage: 2, hspf_droite: 250, doublure: 'Satin', hauteur_renfort_tete: '14 cm' };
    assert.equal(G.hauteur_coupe({ ...row, hauteur_renfort_tete: '20 cm thermocollant' }) - G.hauteur_coupe(row), 6);
    assert.equal(G.hauteur_coupe({ ...row, hauteur_renfort_tete: '12 cm' }) - G.hauteur_coupe(row), -2);
});

test('étiquette : « Larg. coupe » à la place de « Côté appièc. », 4ᵉ case de la ligne Lés de chaque cadre', () => {
    const coupe = RIDEAUX_V2_SECTIONS.find((s) => s.name === 'COUPE');
    const keys = RIDEAUX_V2_SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.rows.flat().map((c) => c[0])));
    assert.ok(!keys.includes('cote'));
    const attendu = { 'Tissu 1': 'lc_t1', 'Tissu 2': 'lc_t2', 'Doublure': 'lc_doubl', 'Interdoublure': 'lc_inter' };
    for (const [frame, key] of Object.entries(attendu)) {
        const g = coupe.groups.find((x) => x.frame === frame);
        assert.equal(g.rows[1][3][0], key, frame);
        assert.equal(g.rows[1][3][1], 'Larg. coupe');
        assert.equal(g.rows[1][2][0].startsWith('ht_'), true, `${frame} : Coupe reste en colonne 3`);
    }
});
