// Rôle « Tablette atelier » et droits fins de l'Inventaire : les autres rôles gardent leurs droits.
// Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can } from '../src/lib/authz.js';

const as = (role) => ({ role });

test('tablette : Inventaire et Logistique seulement', () => {
    const t = as('tablette');
    for (const p of ['nav.inventory', 'nav.logistique', 'inventory.view', 'inventory.edit', 'logistique.edit']) assert.equal(can(t, p), true, p);
    for (const p of ['nav.chiffrage', 'nav.production', 'nav.performance', 'nav.settings', 'planning.view',
        'inventory.dashboard', 'inventory.map', 'inventory.export', 'inventory.import', 'inventory.create', 'inventory.status']) assert.equal(can(t, p), false, p);
});

test('autres rôles : tableau de bord, plan et export comme avant ; import et création = inventory.edit', () => {
    for (const r of ['sales', 'ordo', 'ordo_conf', 'op', 'prepa', 'pose', 'conf', 'compta']) {
        const u = as(r);
        for (const p of ['inventory.dashboard', 'inventory.map', 'inventory.export']) assert.equal(can(u, p), true, `${r} ${p}`);
        for (const p of ['inventory.import', 'inventory.create']) assert.equal(can(u, p), can(u, 'inventory.edit'), `${r} ${p}`);
        assert.equal(can(u, 'nav.settings'), true, `${r} nav.settings`);
    }
    assert.equal(can(as('admin'), 'inventory.import'), true);
});
