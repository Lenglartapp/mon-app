// Alertes de livraison des tissus (tableau de bord Inventaire). Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDeliveryAlerts, upcomingArrivals, fmtDay } from '../src/lib/stock/deliveryAlerts.js';

const TODAY = new Date(2026, 10, 10, 15, 30); // mardi 10/11/2026, l'heure ne compte pas
const P = { id: 'p1', name: 'MAISON A', status: 'IN_PROGRESS', deadline: '2026-12-15T00:00:00.000Z' };
const line = (o = {}) => ({
    odoo_id: 1, droitfil_project_id: 'p1', fournisseur: 'DEDAR', reference: 'Kemble', coloris: '03',
    type_produit: 'tissu', statut: 'commande_passee', quantite: 45, quantite_commandee: 45, quantite_recue: 0,
    unite: 'ml', date_livraison_estimee: null, removed_from_odoo: false, ...o,
});
const conf = (date, o = {}) => ({ type: 'atelier', meta: { projectId: 'p1', start: date, ...o } });
const run = (lines, { projects = [P], events = [] } = {}) => computeDeliveryAlerts({ lines, projects, events, today: TODAY });
const one = (l, opts) => run([l], opts).items[0];

test('DLE passée → En retard avec le nombre de jours ; DLE du jour → pas en retard', () => {
    const late = one(line({ date_livraison_estimee: '2026-11-07' }));
    assert.equal(late.level, 'late');
    assert.equal(late.text, '3 j de retard');
    assert.equal(one(line({ date_livraison_estimee: '2026-11-10' })).level, 'ok');
});

test('DLE avant le prochain créneau confection → À venir ; après → En tension avec l’écart', () => {
    const events = [conf('2026-11-20T08:00:00'), conf('2026-11-27T08:00:00')];
    assert.equal(one(line({ date_livraison_estimee: '2026-11-18' }), { events }).level, 'ok');
    const t = one(line({ date_livraison_estimee: '2026-11-26' }), { events });
    assert.equal(t.level, 'tension');
    assert.equal(t.text, 'arrive 6 j après le besoin');
    assert.equal(t.needSource, 'prochain créneau confection');
});

test('date de besoin : seuls les créneaux de confection comptent (pas le métrage / la pose)', () => {
    const events = [
        { type: 'rdv', meta: { projectId: 'p1', start: '2026-11-12T08:00:00' } },
        { type: 'pose', meta: { projectId: 'p1', start: '2026-11-13T08:00:00' } },
        { type: 'absence', meta: { projectId: 'p1', start: '2026-11-11T08:00:00' } },
        conf('2026-11-25T08:00:00'),
    ];
    assert.equal(one(line({ date_livraison_estimee: '2026-11-20' }), { events }).level, 'ok');
});

test('projet en plusieurs phases : les créneaux confection passés ne comptent plus', () => {
    const events = [conf('2026-10-05T08:00:00'), conf('2026-12-14T08:00:00')];
    const i = one(line({ date_livraison_estimee: '2026-12-10' }), { events });
    assert.equal(i.level, 'ok');
    assert.equal(fmtDay(i.need, TODAY), '14/12');
    // carte de la semaine en cours : besoin = aujourd'hui
    const wk = [{ resourceId: 'backlog_confection', type: 'conf', meta: { projectId: 'p1', start: '2026-11-09T00:00:00' } }];
    assert.equal(fmtDay(one(line(), { events: wk }).need, TODAY), '10/11');
});

test('carte du Programme semaine : besoin = lundi de sa semaine', () => {
    const events = [{ resourceId: 'backlog_confection', type: 'conf', meta: { projectId: 'p1', start: '2026-11-19T00:00:00', isBacklogMaster: true } }];
    const i = one(line({ date_livraison_estimee: '2026-11-17' }), { events });
    assert.equal(fmtDay(i.need, TODAY), '16/11');
    assert.equal(i.level, 'tension');
});

test('sans créneau : repli sur la livraison du projet ; sans rien : jamais En tension', () => {
    const viaDeadline = one(line({ date_livraison_estimee: '2026-12-20' }));
    assert.equal(viaDeadline.level, 'tension');
    assert.equal(viaDeadline.needSource, 'livraison projet');
    const none = one(line({ date_livraison_estimee: '2027-03-01' }), { projects: [{ ...P, deadline: null }] });
    assert.equal(none.level, 'ok');
});

test('sans DLE → Sans date (avec le délai du besoin) ; réception partielle → reste = commandé − reçu', () => {
    const nd = one(line(), { events: [conf('2026-11-14T08:00:00')] });
    assert.equal(nd.level, 'nodate');
    assert.equal(nd.text, 'pas de date, besoin dans 4 j');
    const part = one(line({ statut: 'reception_partielle', quantite_recue: 20 }));
    assert.equal(part.remaining, 25);
    assert.equal(part.ordered, 45);
    assert.ok(part.partial);
    // quantité commandée pas encore reliée (0) → quantité de la liste
    assert.equal(one(line({ quantite: 40, quantite_commandee: 0 })).remaining, 40);
});

test('ligne d’achat partagée par plusieurs lignes de courses : chaque ligne garde sa quantité, reçu au prorata', () => {
    const shared = one(line({ quantite: 110, quantite_commandee: 700, quantite_recue: 0 }));
    assert.equal(shared.ordered, 110);
    assert.equal(shared.remaining, 110);
    const part = one(line({ statut: 'reception_partielle', quantite: 500, quantite_commandee: 700, quantite_recue: 350 }));
    assert.equal(part.received, 250);
    assert.equal(part.remaining, 250);
    // commande réduite (commandé < liste) : le commandé fait foi
    assert.equal(one(line({ statut: 'reception_partielle', quantite: 3000, quantite_commandee: 2500, quantite_recue: 1800 })).remaining, 700);
});

test('ignorés : retiré d’Odoo, reçu, problème, à commander, vérifier stock, projet terminé, non-tissu, rien à recevoir', () => {
    const r = run([
        line({ odoo_id: 1, removed_from_odoo: true }),
        line({ odoo_id: 2, statut: 'receptionne' }),
        line({ odoo_id: 3, statut: 'probleme' }),
        line({ odoo_id: 4, statut: 'a_commander' }),
        line({ odoo_id: 5, statut: 'verifier_stock' }),
        line({ odoo_id: 6, droitfil_project_id: 'p2' }),
        line({ odoo_id: 7, type_produit: 'rail' }),
        line({ odoo_id: 8, quantite_recue: 45 }),
        line({ odoo_id: 9, type_produit: null }),
    ], { projects: [P, { id: 'p2', name: 'FINI', status: 'DONE' }] });
    assert.deepEqual(r.items.map((i) => i.id), [9]);
});

test('tri : retard, tension, sans date ; à égalité DLE puis besoin croissants ; compteurs et qualité des DLE', () => {
    const P2 = { id: 'p2', name: 'MAISON B', status: 'TODO', deadline: '2026-11-12' };
    const r = run([
        line({ odoo_id: 1 }),
        line({ odoo_id: 2, date_livraison_estimee: '2026-11-08' }),
        line({ odoo_id: 3, date_livraison_estimee: '2026-11-05', fournisseur: 'ROMO' }),
        line({ odoo_id: 4, droitfil_project_id: 'p2', date_livraison_estimee: '2026-11-20', fournisseur: 'ROMO' }),
        line({ odoo_id: 5, droitfil_project_id: 'p2', fournisseur: 'ROMO' }),
        line({ odoo_id: 6, date_livraison_estimee: '2026-11-25' }),
    ], { projects: [P, P2] });
    assert.deepEqual(r.items.map((i) => i.id), [3, 2, 4, 5, 1, 6]);
    assert.deepEqual(r.counts, { late: 2, tension: 1, nodate: 2, ok: 1 });
    assert.equal(r.alerts.length, 5);
    assert.deepEqual(r.quality.bySupplier.map((s) => [s.name, s.without, s.total]), [['DEDAR', 1, 3], ['ROMO', 1, 3]].sort((a, b) => a[0].localeCompare(b[0])));
    assert.deepEqual(r.quality.byProject.map((s) => [s.name, s.without, s.total]), [['MAISON B', 1, 2], ['MAISON A', 1, 4]]);
    assert.equal(r.quality.withoutDle, 2);
    assert.equal(r.quality.total, 6);
});

test('arrivées prochaines : horizon respecté, retards exclus, par jour (7) ou par semaine (14 / 30)', () => {
    const { items } = run([
        line({ odoo_id: 1, date_livraison_estimee: '2026-11-09' }),
        line({ odoo_id: 2, date_livraison_estimee: '2026-11-10', quantite_recue: 5 }),
        line({ odoo_id: 3, date_livraison_estimee: '2026-11-17' }),
        line({ odoo_id: 4, date_livraison_estimee: '2026-11-18' }),
        line({ odoo_id: 5, date_livraison_estimee: '2026-11-24' }),
        line({ odoo_id: 6 }),
    ]);
    const d7 = upcomingArrivals(items, { today: TODAY, horizon: 7 });
    assert.deepEqual(d7.map((g) => [g.label, g.count, g.ml]), [["Aujourd'hui 10/11", 1, 40], ['Mar. 17/11', 1, 45]]);
    const d14 = upcomingArrivals(items, { today: TODAY, horizon: 14 });
    assert.deepEqual(d14.map((g) => [g.label, g.count]), [['Semaine du 09/11', 1], ['Semaine du 16/11', 2], ['Semaine du 23/11', 1]]);
    assert.equal(upcomingArrivals(items, { today: TODAY, horizon: 30 }).reduce((s, g) => s + g.count, 0), 4);
});

test('dates : JJ/MM, avec l’année si elle diffère', () => {
    assert.equal(fmtDay('2026-01-05', TODAY), '05/01');
    assert.equal(fmtDay('2027-01-05', TODAY), '05/01/2027');
});
