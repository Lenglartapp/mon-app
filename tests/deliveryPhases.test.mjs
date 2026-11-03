// Phasage livraison : critères combinés, priorités, paires décentrées, heures.
// Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    GLOBAL, normalizePhases, buildOuvrages, resolveAll, ruleLabel, phaseGroups, sumHours,
    addRule, addOuvrages, removeOuvrages, resetOuvrages,
} from '../src/lib/deliveryPhases.js';

const row = (id, zone, produit, extra = {}) => ({ id, zone, piece: 'P', produit, heures_prepa: 1, heures_confection: 10, heures_pose: 2, ...extra });
const ROWS = [
    row('a', 'APT02', 'Rideau'), row('b', 'APT02', 'Store Bateau'),
    row('c', 'APT05', 'Rideau'), row('d', 'APT05', 'Voilage'), row('e', 'APT05 ', 'Store Bateau'),
];

test('anciennes phases nom + date : valides, aucun ouvrage rattaché', () => {
    const phases = normalizePhases([{ id: 'x', label: 'TETE DE SERIE', date: '2026-08-28' }]);
    assert.deepEqual(phases[0].rules, []);
    const res = resolveAll(buildOuvrages(ROWS), phases);
    assert.ok(Object.values(res).every((r) => r.phaseId === GLOBAL));
    assert.deepEqual(normalizePhases(null), []);
});

test('le critère le plus précis gagne ; valeurs comparées sans espaces parasites', () => {
    const phases = normalizePhases([
        { id: 'p1', rules: [{ zone: ['APT02', 'APT05'] }] },
        { id: 'p2', rules: [{ zone: ['APT05'], produit: ['Rideau', 'Voilage'] }] },
    ]);
    const res = resolveAll(buildOuvrages(ROWS), phases);
    assert.equal(res.a.phaseId, 'p1');
    assert.equal(res.c.phaseId, 'p2');
    assert.equal(res.d.phaseId, 'p2');
    assert.equal(res.e.phaseId, 'p1'); // « APT05 » saisi avec un espace
    assert.equal(res.c.conflict, null);
});

test('égalité entre deux phases = conflit ; ajout un par un prioritaire', () => {
    let phases = normalizePhases([
        { id: 'p1', rules: [{ zone: ['APT02'] }] },
        { id: 'p2', rules: [{ produit: ['Rideau'] }] },
    ]);
    let res = resolveAll(buildOuvrages(ROWS), phases);
    assert.deepEqual(res.a.conflict, ['p1', 'p2']);
    phases = addOuvrages(phases, 'p2', ['a']);
    res = resolveAll(buildOuvrages(ROWS), phases);
    assert.equal(res.a.phaseId, 'p2');
    assert.equal(res.a.source, 'manual');
    assert.equal(res.a.conflict, null);
});

test('ajouter un ouvrage à une phase le retire des autres ; retirer = exclure si un critère le vise', () => {
    const ouvrages = buildOuvrages(ROWS);
    let phases = normalizePhases([{ id: 'p1', rules: [{ zone: ['APT05'] }] }, { id: 'p2' }]);
    phases = addOuvrages(phases, 'p1', ['a']);
    phases = addOuvrages(phases, 'p2', ['a']);
    assert.deepEqual(phases[0].row_ids, []);
    assert.deepEqual(phases[1].row_ids, ['a']);
    phases = removeOuvrages(phases, 'p1', ['c'], ouvrages);
    let res = resolveAll(ouvrages, phases);
    assert.equal(res.c.phaseId, GLOBAL);
    assert.deepEqual(phases[0].excluded_ids, ['c']);
    phases = resetOuvrages(phases, ['c', 'a']);
    res = resolveAll(ouvrages, phases);
    assert.equal(res.c.phaseId, 'p1');
    assert.equal(res.a.phaseId, GLOBAL);
});

test('paire décentrée : un seul ouvrage, heures de toute la paire', () => {
    const rows = [
        { id: 'r', pair_role: 'parent', pair_id: 'k', zone: 'APT07', produit: 'Rideau', heures_prepa: 0.5, heures_pose: 2.5 },
        { id: 'g', pair_role: 'left', pair_id: 'k', zone: 'APT07', produit: 'Rideau', heures_confection: 7 },
        { id: 'd', pair_role: 'right', pair_id: 'k', zone: 'APT07', produit: 'Rideau', heures_confection: 7 },
    ];
    const ouvrages = buildOuvrages(rows);
    assert.equal(ouvrages.length, 1);
    assert.deepEqual(sumHours(ouvrages), { prepa: 0.5, conf: 14, pose: 2.5 });
});

test('libellés et regroupement d’une phase', () => {
    assert.equal(ruleLabel({ zone: ['APT05'], produit: ['Rideau', 'Voilage'] }), 'Rideaux, Voilages · APT05');
    assert.equal(ruleLabel({ zone: ['APT02', 'APT04'] }), 'APT02, APT04');
    assert.equal(ruleLabel({ piece: ['KITCHEN'], fenetre: ['a'] }), 'KITCHEN · fenêtre a');

    const ouvrages = buildOuvrages(ROWS);
    let phases = addRule(normalizePhases([{ id: 'p1' }]), 'p1', { zone: ['APT02'] });
    phases = addOuvrages(phases, 'p1', ['c']);
    const { ouvrages: mine, groups } = phaseGroups(phases[0], ouvrages, resolveAll(ouvrages, phases));
    assert.equal(mine.length, 3);
    assert.deepEqual(groups.map((g) => [g.label, g.ouvrages.length]), [['APT02', 2], ['Ajoutés un par un', 1]]);
    assert.deepEqual(sumHours(mine), { prepa: 3, conf: 30, pose: 6 });
});
