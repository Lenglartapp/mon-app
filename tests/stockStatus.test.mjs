// Statut du stock et familles de la Ventilation du stock (tableau de bord inventaire).
// Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stockGroupOf, stockStatusOf, itemGroupOf, itemStatusOf } from '../src/lib/inventory/stockStatus.js';

const projects = [
    { name: 'A', status: 'TODO' }, { name: 'B', status: 'IN_PROGRESS' }, { name: 'C', status: 'SAV' },
    { name: 'D', status: 'DONE' }, { name: 'E', status: 'ARCHIVED' }, { name: 'F', status: 'En cours' },
];

test('Réservé = pas commencé, En cours = production, Reliquat = terminé ou SAV', () => {
    assert.equal(stockGroupOf('A', projects), 'reserved');
    assert.equal(stockGroupOf('B', projects), 'active');
    assert.equal(stockGroupOf('F', projects), 'active');
    assert.equal(stockGroupOf('C', projects), 'remnant');
    assert.equal(stockGroupOf('D', projects), 'remnant');
});

test('Stock mort = libre, archivé ou dossier inconnu (« ? »)', () => {
    assert.equal(stockGroupOf('', projects), 'dead');
    assert.equal(stockGroupOf('E', projects), 'dead');
    assert.equal(stockGroupOf('Inconnu', projects), 'dead');
    assert.equal(stockStatusOf('Inconnu', projects).label, '?');
});

test('statut forcé par un admin : passe avant le dossier, vide = automatique', () => {
    assert.equal(itemStatusOf({ project: 'Inconnu', stock_status: 'IN_PROGRESS' }, projects).label, 'En cours');
    assert.equal(itemGroupOf({ project: 'B', stock_status: 'ARCHIVED' }, projects), 'dead');
    assert.equal(itemGroupOf({ project: 'B', stock_status: null }, projects), 'active');
    assert.equal(itemStatusOf({ project: '', stock_status: 'n importe quoi' }, projects).label, 'Libre');
});
