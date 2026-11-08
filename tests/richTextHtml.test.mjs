// Zone d'écriture du mur : passage texte marqué ↔ HTML affiché « comme dans Word ».
// Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marksToHtml, htmlToMarks } from '../src/lib/utils/richTextHtml.js';

// Mini-DOM suffisant pour htmlToMarks (nodeType, nodeName, childNodes, nodeValue, style).
const txt = (s) => ({ nodeType: 3, nodeName: '#text', nodeValue: s, childNodes: [] });
const el = (name, children = [], style = {}) => ({ nodeType: 1, nodeName: name, childNodes: children, style });

test('texte marqué → HTML', () => {
    assert.equal(marksToHtml('**Rendez-vous** client'), '<b>Rendez-vous</b> client');
    assert.equal(marksToHtml('a\n__b__ <c>'), 'a<br><u>b</u> &lt;c&gt;');
    assert.equal(marksToHtml('**gras _ita_**'), '<b>gras <i>ita</i></b>');
});

test('HTML → texte marqué', () => {
    assert.equal(htmlToMarks(el('DIV', [el('B', [txt('Rendez-vous')]), txt(' client')])), '**Rendez-vous** client');
    assert.equal(htmlToMarks(el('DIV', [txt('Ligne un'), el('DIV', [txt('Ligne deux')])])), 'Ligne un\nLigne deux');
    assert.equal(htmlToMarks(el('DIV', [txt('a'), el('DIV', [el('BR')]), el('DIV', [txt('b')])])), 'a\n\nb');
    assert.equal(htmlToMarks(el('DIV', [el('SPAN', [txt('x')], { fontWeight: '700' })])), '**x**');
    assert.equal(htmlToMarks(el('DIV', [el('B', [txt('a'), el('BR'), txt('b')])])), '**a**\n**b**');
    assert.equal(htmlToMarks(el('DIV', [txt('fin'), el('BR'), el('BR')])), 'fin');
});

test('aller-retour sans perte', () => {
    const v = '**gras** et __souligné__\n~~barré~~ _ita_';
    // reconstruit le mini-DOM correspondant au HTML produit
    const dom = el('DIV', [el('B', [txt('gras')]), txt(' et '), el('U', [txt('souligné')]), el('BR'), el('S', [txt('barré')]), txt(' '), el('I', [txt('ita')])]);
    assert.equal(marksToHtml(v), '<b>gras</b> et <u>souligné</u><br><s>barré</s> <i>ita</i>');
    assert.equal(htmlToMarks(dom), v);
});
