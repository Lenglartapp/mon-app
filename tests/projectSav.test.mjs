// Statut projet SAV automatique + part SAV des heures (comprise dans le budget).
// Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncProjectSavStatus } from '../src/lib/projectSavStatus.js';
import { computeProjectHours } from '../src/lib/projectMetrics.js';

const P = (status, config = {}) => ({ id: 'p1', status, config });
const L = (o = {}) => ({ statut_prepa: 'Terminé', statut_conf: 'Terminé', statut_pose: 'Terminé', ...o });

test('une ligne passe en SAV → projet en SAV, statut d\'avant mémorisé', () => {
    const patch = syncProjectSavStatus(P('DONE', { tables_ajoutees: ['x'] }), [L(), L({ statut_pose: 'SAV' })]);
    assert.deepEqual(patch, { status: 'SAV', config: { tables_ajoutees: ['x'], status_avant_sav: 'DONE' } });
});

test('plus aucune ligne en SAV → retour au statut d\'avant', () => {
    const patch = syncProjectSavStatus(P('SAV', { status_avant_sav: 'IN_PROGRESS', tables_ajoutees: ['x'] }), [L(), L()]);
    assert.deepEqual(patch, { status: 'IN_PROGRESS', config: { tables_ajoutees: ['x'] } });
});

test('deux lignes en SAV, une seule repasse en Terminé → reste en SAV', () => {
    const p = P('SAV', { status_avant_sav: 'DONE' });
    assert.equal(syncProjectSavStatus(p, [L({ statut_conf: 'SAV' }), L()]), null);
});

test('SAV posé à la main (rien de mémorisé) : jamais retiré tout seul ; archivé : pas touché', () => {
    assert.equal(syncProjectSavStatus(P('SAV'), [L()]), null);
    assert.equal(syncProjectSavStatus(P('ARCHIVED'), [L({ statut_prepa: 'SAV' })]), null);
});

test('rien à changer sans SAV', () => {
    assert.equal(syncProjectSavStatus(P('IN_PROGRESS'), [L({ statut_pose: 'Accroché' })]), null);
    assert.equal(syncProjectSavStatus({ id: 'p', config: null }, []), null);
});

test('heures : le SAV reste dans le budget, détaillé à part', () => {
    const at = (d, h1, h2) => ({ start: `2026-11-${d}T${h1}:00:00`, end: `2026-11-${d}T${h2}:00:00` });
    const events = [
        { type: 'pose', meta: { projectId: 'p1', status: 'validated', ...at('02', '08', '12') } },              // 4 h
        { type: 'pose', meta: { projectId: 'p1', status: 'validated', sav: true, ...at('03', '08', '11') } },   // 3 h SAV
        { type: 'pose', meta: { projectId: 'p1', status: 'pending', sav: true, ...at('20', '08', '10') } },     // 2 h SAV planifiées
        { resourceId: 'backlog_confection', type: 'default', meta: { projectId: 'p1', isBacklogMaster: true, budgetHours: 6, sav: true, ...at('16', '08', '17') } },
    ];
    const h = computeProjectHours({ id: 'p1', budget: { pose: 10, conf: 20 } }, events);
    assert.equal(h.consumed.pose, 7);
    assert.equal(h.remaining.pose, 3);
    assert.equal(h.planned.pose, 2);
    assert.equal(h.planned.conf, 6);
    assert.deepEqual(h.sav.consumed, { prepa: 0, conf: 0, pose: 3 });
    assert.deepEqual(h.sav.planned, { prepa: 0, conf: 6, pose: 2 });
});
