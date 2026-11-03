// Ligne « Total » des tableaux (inventaire) : calculs par colonne, par unité.
// Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTotal } from '../src/lib/gridTotals.js';

const stock = [
    { value: 120.5, unit: 'm' }, { value: 30, unit: 'm' }, { value: 4, unit: 'u' }, { value: 6, unit: 'u' }, { value: 2, unit: 'm' },
];

test('aucun calcul choisi : case vide', () => {
    assert.equal(computeTotal('', stock, { numeric: true }), '');
    assert.equal(computeTotal(undefined, stock), '');
});

test('colonne à unité : un résultat par unité', () => {
    assert.equal(computeTotal('sum', stock, { numeric: true }), '152,5 m · 10 u');
    assert.equal(computeTotal('avg', stock, { numeric: true }), '50,83 m · 5 u');
    assert.equal(computeTotal('min', stock, { numeric: true }), '2 m · 4 u');
    assert.equal(computeTotal('max', stock, { numeric: true }), '120,5 m · 6 u');
    assert.equal(computeTotal('count', stock, { numeric: true }), '5');
});

test('colonne chiffrée sans unité, valeurs saisies en texte', () => {
    const laize = [{ value: '280' }, { value: '140,5' }, { value: '' }, { value: null }];
    assert.equal(computeTotal('sum', laize, { numeric: true }), '420,5');
    assert.equal(computeTotal('count', laize, { numeric: true }), '2');
    assert.equal(computeTotal('sum', [{ value: '' }], { numeric: true }), '—');
});

test('colonne texte : nombre, valeurs différentes, vides', () => {
    const fournisseurs = [{ value: 'Casamance' }, { value: 'casamance ' }, { value: 'Pierre Frey' }, { value: '' }, { value: null }];
    assert.equal(computeTotal('count', fournisseurs), '3');
    assert.equal(computeTotal('distinct', fournisseurs), '2');
    assert.equal(computeTotal('empty', fournisseurs), '2');
    assert.equal(computeTotal('sum', fournisseurs), '');
});
