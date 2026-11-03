// Champ Opérateur partagé (Inventaire + Logistique) : suggestions et doublons.
// Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { operatorKey, operatorSuggestions, isKnownOperator, uniqueOperatorNames } from '../src/lib/operators.js';

const list = ['David Vergel', 'Emilie David', 'Lucie Jaulin'];
const team = ['Adrien Lenglart', 'Aristide Lenglart', 'david vergel'];

test('comparaison sans casse, accents ni espaces superflus', () => {
    assert.equal(operatorKey('  Émilie   DAVID '), 'emilie david');
    assert.equal(isKnownOperator('emilie  david', list), true);
    assert.equal(isKnownOperator('Adrien', list), false);
});

test('champ ouvert sans frappe : la liste partagée seulement', () => {
    assert.deepEqual(operatorSuggestions('', list, team), ['David Vergel', 'Emilie David', 'Lucie Jaulin']);
});

test('à la frappe : aussi les comptes de l\'équipe, sans doublon', () => {
    assert.deepEqual(operatorSuggestions('Adrie', list, team), ['Adrien Lenglart']);
    assert.deepEqual(operatorSuggestions('david', list, team), ['David Vergel', 'Emilie David']);
    assert.deepEqual(operatorSuggestions('emilie', list, team), ['Emilie David']);
    assert.deepEqual(operatorSuggestions('Inconnu', list, team), []);
});

test('liste sans doublon et triée', () => {
    assert.deepEqual(uniqueOperatorNames(['Thomas  Bonnet', 'thomas bonnet', 'Alain Houdemont']), ['Alain Houdemont', 'Thomas Bonnet']);
});
