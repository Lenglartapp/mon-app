// Règles de coupe des rideaux (lés, appiècement, hauteurs à couper) — validées avec l'atelier.
// Lancer : npm test
// Lignes « anciennes formules » (hors v2) pour piloter précisément à plat et hauteur de coupe :
//   à plat (paire)  = ceil(L/2 × 1,06 + croisement), à plat (seul) = ceil(L × 1,06) + retour
//   hauteur de coupe = HSPF + 50 (tissu), HSPF + 30 + OB doublure (doublure)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RIDEAUX_GETTERS as G, RIDEAUX_PROD_SCHEMA, calcML } from '../src/lib/schemas/production/rideaux.js';
import { SCHEMA_64 } from '../src/lib/schemas/production.js';

const PAIRE = 'Paire';
const SEUL = 'Un seul pan';

const coupeT1 = (row) => ({
    aPlat: G.a_plat(row),
    hCoupe: G.hauteur_coupe(row),
    les: G.nombre_les(row),
    appiec: G.reste_les(row),
    hauteurs: G.nb_hauteur_a_couper(row),
});

const CAS = [
    // [nom, ligne, à plat, H. coupe, lés PAR RIDEAU, appièc., hauteurs à couper (ligne)]
    ['Paire couchée (C1)', { paire_ou_un_seul_pan: PAIRE, largeur: 500, laize_tissu1: 300, hspf_droite: 240 }, 265, 290, 1, '', 2],
    ['Paire, à plat < laize — Royal Monceau 506 (C2)', { paire_ou_un_seul_pan: PAIRE, largeur: 500, laize_tissu1: 300, hspf_droite: 286.5 }, 265, 336.5, 1, '', 2],
    ['Rideau seul, à plat < laize (C2)', { paire_ou_un_seul_pan: SEUL, largeur: 250, laize_tissu1: 300, hspf_droite: 286.5 }, 265, 336.5, 1, '', 1],
    ['Paire, appièc. ≤ laize/2 (C3)', { paire_ou_un_seul_pan: PAIRE, largeur: 600, croisement: 12, laize_tissu1: 140, hspf_droite: 254 }, 330, 304, 2, 50, 5],
    ['Paire, appièc. > laize/2 (C3)', { paire_ou_un_seul_pan: PAIRE, largeur: 400, croisement: 18, laize_tissu1: 140, hspf_droite: 254 }, 230, 304, 1, 90, 4],
    ['Rideau seul, multiple exact (C3)', { paire_ou_un_seul_pan: SEUL, largeur: 200, retour_droit: 68, laize_tissu1: 140, hspf_droite: 254 }, 280, 304, 2, '', 2],
];

for (const [nom, row, aPlat, hCoupe, les, appiec, hauteurs] of CAS) {
    test(nom, () => {
        assert.deepEqual(coupeT1(row), { aPlat, hCoupe, les, appiec, hauteurs });
    });
}

test('Doublure de la ligne Royal Monceau : 1 lé / rideau, pas d\'appièc., 2 hauteurs', () => {
    const row = {
        paire_ou_un_seul_pan: PAIRE, largeur: 500, laize_tissu1: 300, hspf_droite: 286.5,
        doublure: 'Doublure', laize_doublure: 300, piquage_ourlets_bas_doublure: 20,
    };
    assert.equal(G.hauteur_coupe_doublure(row), 336.5);
    assert.equal(G.nombre_les_doublure(row), 1);
    assert.equal(G.reste_les_doublure(row), '');
    assert.equal(G.nb_hauteur_a_couper_doublure(row), 2);
});

test('Pan libre avec appiècement : + 1 hauteur (comme un rideau seul)', () => {
    const row = { paire_ou_un_seul_pan: 'Pan libre', largeur: 300, laize_tissu1: 140, hspf_droite: 254 };
    // à plat = ceil(300 × 1,06) = 318 → 2 lés + appièc. 38
    assert.equal(G.a_plat(row), 318);
    assert.equal(G.nombre_les(row), 2);
    assert.equal(G.reste_les(row), 38);
    assert.equal(G.nb_hauteur_a_couper(row), 3);
});

test('Le métrage (ML) ne change pas', () => {
    // Royal Monceau : 1 lé par rideau × 3,365 m × 2 rideaux = 6,73 m (calcML inchangé)
    assert.equal(Math.round(calcML(265, 300, 336.5, 336.5, 2) * 100) / 100, 6.73);
    // Paire couchée : à plat × 2 rideaux = 5,30 m
    assert.equal(Math.round(calcML(265, 300, 290, 290, 2) * 100) / 100, 5.3);
});

test('Même Nb Lés partout : grille BPF, Suivi de projet (schéma générique) et getter', () => {
    const colBpf = RIDEAUX_PROD_SCHEMA.find((c) => c.key === 'nombre_les');
    const colSuivi = SCHEMA_64.find((c) => c.key === 'nombre_les');
    for (const [, row] of CAS) {
        const attendu = G.nombre_les(row);
        assert.equal(colBpf.valueGetter(null, row), attendu);
        assert.equal(colSuivi.valueGetter(null, row), attendu);
    }
});
