// Bandeau des étiquettes : dénomination zone / pièce / fenêtre.
// Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { denomination, denominationText, piecesInSeveralZones } from '../src/lib/etiquettes/denomination.js';

const t = (row, multi) => denominationText(row, multi);

test('les 7 cas de la règle', () => {
    assert.equal(t({ zone: 'A', piece: 'Salon', fenetre: 'F1' }), 'PIÈCE Salon · FENÊTRE F1');
    assert.equal(t({ piece: 'Salon', fenetre: 'F1' }), 'PIÈCE Salon · FENÊTRE F1');
    assert.equal(t({ zone: 'A', piece: 'Salon' }), 'ZONE A · PIÈCE Salon');
    assert.equal(t({ zone: 'A', fenetre: 'F1' }), 'ZONE A · FENÊTRE F1');
    assert.equal(t({ piece: 'Salon' }), 'PIÈCE Salon');
    assert.equal(t({ fenetre: 'F1' }), 'FENÊTRE F1');
    assert.equal(t({ zone: 'A' }), 'ZONE A');
    assert.equal(t({}), '');
    assert.deepEqual(denomination({ zone: '—', piece: ' ', fenetre: null }), []);
});

test('champ masqué = vide', () => {
    assert.equal(t({ zone: 'A', piece: 'Salon', fenetre: 'F1', etiquette_hidden_fields: ['fenetre'] }), 'ZONE A · PIÈCE Salon');
    assert.equal(t({ zone: 'A', piece: 'Salon', etiquette_hidden_fields: ['zone'] }), 'PIÈCE Salon');
});

test('même pièce dans plusieurs zones : la zone reste affichée', () => {
    const rows = [
        { zone: 'Bât. A', piece: 'Chambre 101' }, { zone: 'Bât. B', piece: 'chambre  101' },
        { zone: 'Bât. A', piece: 'Salon' }, { zone: 'bât. a', piece: 'Salon' },
    ];
    const multi = piecesInSeveralZones(rows);
    assert.deepEqual([...multi], ['chambre 101']);
    assert.equal(t({ zone: 'Bât. B', piece: 'Chambre 101', fenetre: 'F2' }, multi), 'ZONE Bât. B · PIÈCE Chambre 101 · FENÊTRE F2');
    assert.equal(t({ zone: 'Bât. A', piece: 'Salon', fenetre: 'F1' }, multi), 'PIÈCE Salon · FENÊTRE F1');
});
