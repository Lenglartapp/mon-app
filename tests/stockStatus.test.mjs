// Statut du stock et familles de la Ventilation du stock (tableau de bord inventaire).
// Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stockGroupOf, stockStatusOf } from '../src/lib/inventory/stockStatus.js';

const projects = [
    { name: 'A', status: 'TODO' }, { name: 'B', status: 'IN_PROGRESS' }, { name: 'C', status: 'SAV' },
    { name: 'D', status: 'DONE' }, { name: 'E', status: 'ARCHIVED' }, { name: 'F', status: 'En cours' },
];

test('Réservé = dossier pas commencé, En cours = production ou SAV', () => {
    assert.equal(stockGroupOf('A', projects), 'reserved');
    assert.equal(stockGroupOf('B', projects), 'active');
    assert.equal(stockGroupOf('C', projects), 'active');
    assert.equal(stockGroupOf('F', projects), 'active');
});

test('Stock mort = libre, reliquat, archivé ou dossier inconnu (« ? »)', () => {
    assert.equal(stockGroupOf('', projects), 'dead');
    assert.equal(stockGroupOf('D', projects), 'dead');
    assert.equal(stockGroupOf('E', projects), 'dead');
    assert.equal(stockGroupOf('Inconnu', projects), 'dead');
    assert.equal(stockStatusOf('Inconnu', projects).label, '?');
});
