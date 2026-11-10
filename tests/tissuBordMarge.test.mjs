// Retrait d'un tissu, Finition OB « Bord/bord » (+ 3 cm), marge machine pour tout nouveau projet.
// Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearRemovedMatiere, fieldsToClearOnRemove } from '../src/lib/utils/matiereClear.js';
import { RIDEAUX_GETTERS as G, RIDEAUX_PROD_SCHEMA } from '../src/lib/schemas/production/rideaux.js';
import { RIDEAUX_SCHEMA } from '../src/lib/schemas/chiffrage/rideaux.js';
import { STORES_BATEAUX_PROD_SCHEMA } from '../src/lib/schemas/production/stores_bateaux.js';
import { COUSSINS_SCHEMA } from '../src/lib/schemas/chiffrage/coussins.js';
import { PLAID_PROD_SCHEMA } from '../src/lib/schemas/production/plaid.js';
import { FINITION_OC_OPTIONS, FINITION_OB_RIDEAUX_OPTIONS, coefOurletCoteRideau } from '../src/lib/constants/rideauxFields.js';
import { coefOurletCote } from '../src/lib/formulas/storesBateauxMetrage.js';
import { buildProjectFromMinute } from '../src/lib/import/projectFromMinute.js';

const val = (schema, key, row) => {
    const col = schema.find(c => c.key === key);
    return col.valueGetter ? col.valueGetter(undefined, row) : row[key];
};

// ── 1. Retirer un tissu ──────────────────────────────────────────────────────

const RIDEAU = {
    paire_ou_un_seul_pan: 'Paire', largeur: 400, hspf_droite: 250, formules_metrage: 3,
    hauteur_renfort_tete: '8 cm', piquage_ourlets_du_bas: 10,
    tissu_deco1: 'Lin', laize_tissu1: 140, raccord_v_tissu1: 64, raccord_h_tissu1: 32,
    tissu_deco2: 'Velours', laize_tissu2: 140, raccord_v_tissu2: 20, raccord_h_tissu2: 10, ml_tissu2: 3.5,
    doublure: 'Satin', laize_doublure: 280, inter_doublure: 'Molleton', laize_inter: 140,
    __cellFormulas: { laize_tissu2: '140', ml_tissu2: '3.5', laize_tissu1: '140' },
};

test('production : vider Tissu 2 vide laize, raccords, métrage T2 et leurs surcharges', () => {
    const { row, cleared } = clearRemovedMatiere({ ...RIDEAU, tissu_deco2: '' }, 'tissu_deco2', 'Velours', '', RIDEAUX_PROD_SCHEMA);
    assert.deepEqual(cleared.sort(), ['laize_tissu2', 'ml_tissu2', 'raccord_h_tissu2', 'raccord_v_tissu2']);
    for (const k of cleared) assert.equal(row[k], null);
    assert.deepEqual(row.__cellFormulas, { laize_tissu1: '140' });
    assert.equal(G.nombre_les_t2(row) || 0, 0);
});

test('production : vider Tissu 1 garde H. Coupe T1 et la doublure ; ML T1 à 0', () => {
    const before = G.hauteur_coupe(RIDEAU);
    const { row, cleared } = clearRemovedMatiere({ ...RIDEAU, tissu_deco1: null }, 'tissu_deco1', 'Lin', null, RIDEAUX_PROD_SCHEMA);
    assert.deepEqual(cleared.sort(), ['laize_tissu1', 'raccord_h_tissu1', 'raccord_v_tissu1']);
    assert.equal(G.hauteur_coupe(row), before);
    assert.equal(G.hauteur_coupe_doublure(row), before);
    assert.equal(row.laize_doublure, 280);
    assert.equal(Number(val(RIDEAUX_PROD_SCHEMA, 'ml_tissu1', row)) || 0, 0);
});

test('production : vider doublure puis interdoublure vide leur laize', () => {
    assert.deepEqual(fieldsToClearOnRemove('doublure', 'Satin', '', RIDEAUX_PROD_SCHEMA, RIDEAU), ['laize_doublure']);
    assert.deepEqual(fieldsToClearOnRemove('inter_doublure', 'Molleton', '', RIDEAUX_PROD_SCHEMA, RIDEAU), ['laize_inter']);
});

test('remplacer un tissu par un autre ne vide rien', () => {
    assert.deepEqual(fieldsToClearOnRemove('tissu_deco1', 'Lin', 'Soie', RIDEAUX_PROD_SCHEMA, RIDEAU), []);
    assert.deepEqual(fieldsToClearOnRemove('tissu_deco1', '', '', RIDEAUX_PROD_SCHEMA, RIDEAU), []);
});

test('chiffrage : vider un tissu vide aussi PA / PV (et le métrage T2 saisi)', () => {
    const t1 = fieldsToClearOnRemove('tissu_deco1', 'Lin', '', RIDEAUX_SCHEMA, {});
    assert.deepEqual(t1.sort(), ['laize_tissu1', 'pa_tissu1', 'pv_tissu1', 'raccord_h_tissu1', 'raccord_v_tissu1']);
    const t2 = fieldsToClearOnRemove('tissu_deco2', 'Velours', '', RIDEAUX_SCHEMA, {});
    assert.ok(['ml_tissu2', 'pa_tissu2', 'pv_tissu2', 'laize_tissu2'].every(k => t2.includes(k)));
    assert.deepEqual(fieldsToClearOnRemove('embrasse', 'Gland', '', RIDEAUX_SCHEMA, {}), ['pa_embrasse', 'pv_embrasse']);
    // PV embrasse calculé automatiquement : pas vidé (il retombe seul)
    assert.deepEqual(fieldsToClearOnRemove('embrasse', 'Gland', '', RIDEAUX_SCHEMA, { pv_embrasse_auto: true }), ['pa_embrasse']);
    assert.deepEqual(fieldsToClearOnRemove('passementerie1', 'Galon', '', RIDEAUX_SCHEMA, {}).sort(), ['application_passementerie1', 'pa_pass1', 'pv_pass1']);
});

test('stores bateaux, coussins, plaids : mêmes règles', () => {
    // Store en métrage automatique : le ML est calculé, pas vidé
    assert.deepEqual(fieldsToClearOnRemove('toile_finition_1', 'Lin', '', STORES_BATEAUX_PROD_SCHEMA, { formules_stores: 2 }).sort(),
        ['laize_toile_finition_1', 'raccord_h_toile_finition_1', 'raccord_v_toile_finition_1']);
    // Store ancien (métrage saisi à la main) : le ML saisi est vidé aussi
    assert.ok(fieldsToClearOnRemove('toile_finition_1', 'Lin', '', STORES_BATEAUX_PROD_SCHEMA, {}).includes('ml_toile_finition_1'));
    assert.deepEqual(fieldsToClearOnRemove('doublure', 'Satin', '', STORES_BATEAUX_PROD_SCHEMA, { formules_stores: 2 }), ['laize_doublure']);
    assert.deepEqual(fieldsToClearOnRemove('doublure', 'Satin', '', STORES_BATEAUX_PROD_SCHEMA, {}).sort(), ['laize_doublure', 'ml_doublure']);
    assert.deepEqual(fieldsToClearOnRemove('tissu_1', 'Lin', '', COUSSINS_SCHEMA, {}).sort(), ['laize_tissu_1', 'ml_tissu_1', 'pa_tissu_1', 'pv_tissu_1']);
    assert.deepEqual(fieldsToClearOnRemove('molleton', 'M', '', PLAID_PROD_SCHEMA, {}).sort(), ['laize_molleton', 'ml_molleton']);
});

// ── 2. Bord/bord ─────────────────────────────────────────────────────────────

test('« Bord/bord » proposé en Finition OB et OC, sans effet sur les ourlets de côté', () => {
    assert.ok(FINITION_OC_OPTIONS.includes('Bord/bord'));
    assert.ok(FINITION_OB_RIDEAUX_OPTIONS.includes('Bord/bord'));
    assert.equal(coefOurletCoteRideau('Bord/bord'), 2);
    assert.equal(coefOurletCote('Bord/bord'), 4);
});

test('Finition OB Bord/bord : + 3 cm tissu 1 et doublure, T2 et inter inchangés', () => {
    const base = { ...RIDEAU, raccord_v_tissu1: 0, raccord_h_tissu1: 0 };
    const bb = { ...base, piquage_ourlet: 'bord/Bord' };
    assert.equal(G.hauteur_coupe(bb), G.hauteur_coupe(base) + 3);
    assert.equal(G.hauteur_coupe_doublure(bb), G.hauteur_coupe_doublure(base) + 3);
    assert.equal(G.hauteur_coupe_inter(bb), G.hauteur_coupe_inter(base));
    assert.equal(G.hauteur_coupe_t2(bb), G.hauteur_coupe_t2(base));
    // Sans raccord : H. Coupe Motif = H. Coupe (avec les 3 cm)
    assert.equal(G.hauteur_coupe_motif(bb), G.hauteur_coupe(bb));
    // « Fin. OB doublure » ne déclenche pas
    assert.equal(G.hauteur_coupe({ ...base, piquage_ourlets_bas_doublure: 'Bord/bord' }), G.hauteur_coupe(base));
});

test('Bord/bord historique : + 3 cm aussi sur la doublure', () => {
    const old = { paire_ou_un_seul_pan: 'Paire', largeur: 400, hspf_droite: 250, piquage_ourlets_bas_doublure: 5 };
    assert.equal(G.hauteur_coupe_doublure({ ...old, piquage_ourlet: 'Bord/bord' }), G.hauteur_coupe_doublure(old) + 3);
});

test('Bord/bord + raccord V 64 : H. Coupe Motif inchangée, jamais sous la H. Coupe', () => {
    const bb = { ...RIDEAU, piquage_ourlet: 'Bord/bord' };
    assert.equal(G.hauteur_coupe_motif(bb), G.hauteur_coupe_motif(RIDEAU));
    assert.equal(G.nb_raccords_motifs(bb), G.nb_raccords_motifs(RIDEAU));
    assert.ok(G.hauteur_coupe_motif(bb) >= G.hauteur_coupe(bb));
    // Cas limite : H. Coupe sans les 3 cm = multiple exact du raccord → la sécurité joue.
    const exact = { paire_ou_un_seul_pan: 'Paire', largeur: 400, hspf_droite: 206, raccord_v_tissu1: 64, piquage_ourlet: 'Bord/bord' };
    // historique : H. Coupe = 206 + 50 = 256 = 4 × 64 → motif 256, H. Coupe Bord/bord 259
    assert.equal(G.hauteur_coupe(exact), 259);
    assert.equal(G.hauteur_coupe_motif(exact), 259);
});

// ── 3. Marge machine pour tout nouveau projet ────────────────────────────────

test('projet depuis un chiffrage v2 : lignes rideaux en v3 (+ 10 cm), stores selon marqueur', () => {
    const minute = {
        id: 'm1', name: 'Test', params: [{ name: 'formules_metrage', value: 2 }, { name: 'formules_stores', value: 1 }],
        lines: [
            { id: 'r', produit: 'Rideau', formules_metrage: 2, paire_ou_un_seul_pan: 'Paire', largeur: 400, hspf_droite: 250 },
            { id: 's1', produit: 'Store bateau', formules_stores: 1 },
            { id: 's0', produit: 'Store bateau' },
        ],
    };
    const p = buildProjectFromMinute(minute);
    const byId = Object.fromEntries(p.rows.map(r => [r.id, r]));
    assert.equal(p.config.formules_metrage, 3);
    assert.equal(p.config.formules_stores, 2);
    assert.equal(byId.r.formules_metrage, 3);
    assert.equal(G.hauteur_coupe(byId.r), G.hauteur_coupe({ ...byId.r, formules_metrage: 2 }) + 10);
    assert.equal(byId.s1.formules_stores, 2);
    assert.ok(!byId.s0.formules_stores);
});
