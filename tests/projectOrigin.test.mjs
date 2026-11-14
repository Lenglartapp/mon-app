// Origine du projet (en-tête) et historique du devis masqué dans le projet.
// Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { originOf, sansTraceDuDevis, ligneSansHistoriqueDevis } from '../src/lib/projectOrigin.js';

test('origine : libellé court et détail selon le chemin', () => {
    assert.deepEqual(
        [originOf({ type: 'created', user_name: 'Audry', detail: { origin: 'blank' } }).short,
         originOf({ type: 'created', user_name: 'Audry', detail: { origin: 'import', minuteName: 'Hôtel X' } }).short,
         originOf({ type: 'created', user_name: 'Odoo', detail: { origin: 'odoo', orderName: 'S00123' } }).short],
        ['via projet vierge', 'via import du devis', 'via commande Odoo S00123'],
    );
    assert.equal(originOf({ type: 'created', user_name: 'Audry', detail: { origin: 'import', minuteName: 'Hôtel X' } }).detail,
        'Import manuel du devis « Hôtel X » par Audry');
    assert.equal(originOf({ type: 'created', user_name: 'Odoo', detail: { origin: 'odoo', orderName: 'S00123', minuteName: 'Hôtel X' } }).detail,
        'Créé automatiquement à la confirmation de la commande Odoo S00123 (devis « Hôtel X »)');
    assert.equal(originOf(null), null);
});

test('origine reconstituée (projets antérieurs au 8 octobre) : sans auteur, mention explicite', () => {
    const o = originOf({ type: 'created', guessed: true, label: 'Projet créé depuis une minute (import)' });
    assert.equal(o.short, 'via import du devis');
    assert.equal(o.detail, 'Import manuel du devis — origine reconstituée');
    assert.equal(originOf({ type: 'created', guessed: true, label: 'Projet créé — projet vierge' }).short, 'via projet vierge');
});

test('historique du devis masqué : tout ce qui précède la création du projet', () => {
    const creation = '2026-11-13T10:00:00.000Z';
    const entries = [
        { id: 1, type: 'log', author: 'Muriel', createdAt: '2026-10-12T09:00:00.000Z' },
        { id: 2, type: 'image', author: 'Angelina', date: Date.parse('2026-10-20T09:00:00Z') },
        { id: 3, type: 'log', author: 'David', createdAt: '2026-11-13T15:00:00.000Z' },
        { id: 4, text: 'sans date' },
    ];
    assert.deepEqual(sansTraceDuDevis(entries, creation).map((c) => c.id), [3, 4]);
    assert.equal(sansTraceDuDevis(entries, null), entries); // date de création inconnue : rien masqué
    assert.equal(sansTraceDuDevis(undefined, creation), undefined);
});

test('import du devis : ligne sans commentaires, photos, journal ni pointeur d’archive', () => {
    const r = ligneSansHistoriqueDevis({ id: 'a', zone: 'Salon', comments: [{ type: 'image' }, { type: 'log' }], history: [{}], __logArchive: [{ p: 'm', r: 'a' }] });
    assert.deepEqual(r, { id: 'a', zone: 'Salon', comments: [] });
});
