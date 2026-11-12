// Capacités et ventilation par laize de l'entrepôt (lib/warehouse/occupancy). Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    capacityInRolls, totalCapacity, laizeCm, laizeClassOf, zoneLaizeType,
    laizeBreakdown, misplacedRolls, countRouleaux,
} from '../src/lib/warehouse/occupancy.js';

const tissu = (o = {}) => ({ id: 1, category: 'Tissu', qty: 30, unit: 'ml', pieces: [], laize: 300, location: 'B1', product: 'X', ...o });

test('laize : nombre extrait de la saisie, grande à partir de 250 cm, inconnue sinon', () => {
    assert.equal(laizeCm('300 cm'), 300);
    assert.equal(laizeCm(280), 280);
    assert.equal(laizeCm('142,5'), 142.5);
    assert.equal(laizeCm(''), null);
    assert.equal(laizeCm('n/a'), null);
    assert.equal(laizeClassOf({ laize: 250 }), 'grande');
    assert.equal(laizeClassOf({ laize: '249' }), 'petite');
    assert.equal(laizeClassOf({ laize: null }), null);
});

test('type de zone : mixte par défaut', () => {
    assert.equal(zoneLaizeType({}), 'mixte');
    assert.equal(zoneLaizeType({ laize_type: 'n’importe quoi' }), 'mixte');
    assert.equal(zoneLaizeType({ laize_type: 'grande' }), 'grande');
});

test('palette : 15 rouleaux en zone grande laize, 20 en petite ou mixte ; rouleaux tels quels', () => {
    assert.equal(capacityInRolls({ type: 'palettes', capacite: 2, laize_type: 'grande' }), 30);
    assert.equal(capacityInRolls({ type: 'palettes', capacite: 2, laize_type: 'petite' }), 40);
    assert.equal(capacityInRolls({ type: 'palettes', capacite: 2 }), 40);
    assert.equal(capacityInRolls({ type: 'rouleaux', capacite: 54, laize_type: 'grande' }), 54);
    assert.equal(capacityInRolls({ type: 'reception', capacite: 14 }), 14);
    assert.equal(capacityInRolls({ type: 'consommable', capacite: 5 }), null);
    assert.equal(totalCapacity([{ type: 'rouleaux', capacite: 54 }, { type: 'palettes', capacite: 2 }]), 94);
});

const ZONES = [
    { code: 'B1', type: 'rouleaux', capacite: 54, laize_type: 'grande' },
    { code: 'D1', type: 'rouleaux', capacite: 68, laize_type: 'petite' },
    { code: 'A1', type: 'rouleaux', capacite: 54, laize_type: 'mixte' },
    { code: 'B4', type: 'palettes', capacite: 2, laize_type: 'grande' },
    { code: 'ATELIER', type: 'structure', capacite: null },
];

test('ventilation : capacité et rouleaux par type de zone, somme = total', () => {
    const inv = [
        tissu({ id: 1, location: 'B1' }),
        tissu({ id: 2, location: 'D1', pieces: [{}, {}] }), // 2 rouleaux
        tissu({ id: 3, location: 'A1' }),
        tissu({ id: 4, location: 'B1, D1' }), // réparti
        tissu({ id: 5, location: 'ATELIER' }), // hors entrepôt
        tissu({ id: 6, location: 'À COMPLÉTER' }),
        tissu({ id: 7, location: '' }),
        tissu({ id: 8, location: 'B1', qty: 0 }), // épuisé
        { id: 9, category: 'Rail', qty: 3, location: 'B1' },
    ];
    const { rows, total } = laizeBreakdown(inv, ZONES);
    const by = Object.fromEntries(rows.map(r => [r.key, [r.rolls, r.capacity]]));
    assert.deepEqual(by, { grande: [1.5, 84], petite: [2.5, 68], none: [3, 54] });
    assert.equal(total.rolls, countRouleaux(inv));
    assert.equal(total.capacity, 206);
});

test('alerte de rangement : grande laize en zone petite et inversement, rien pour mixte ou laize inconnue', () => {
    const inv = [
        tissu({ id: 1, laize: 300, location: 'D1' }), // grande en petite
        tissu({ id: 2, laize: 140, location: 'B1' }), // petite en grande
        tissu({ id: 3, laize: 140, location: 'D1' }), // bien rangé
        tissu({ id: 4, laize: 300, location: 'A1' }), // mixte
        tissu({ id: 5, laize: null, location: 'D1' }), // laize inconnue
        tissu({ id: 6, laize: '300 cm', location: 'D1, A1' }), // moitié en petite
    ];
    const m = misplacedRolls(inv, ZONES);
    assert.deepEqual(m.entries.map(e => [e.item.id, e.code]), [[2, 'B1'], [1, 'D1'], [6, 'D1']]);
    assert.equal(m.grandeInPetite, 1.5);
    assert.equal(m.petiteInGrande, 1);
    assert.equal(m.rolls, 2.5);
});
