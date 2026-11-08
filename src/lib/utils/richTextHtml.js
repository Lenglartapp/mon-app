// src/lib/utils/richTextHtml.js
// Passerelle entre le texte stocké EN CLAIR avec marques (**gras**, _italique_, __souligné__,
// ~~barré~~ — voir lib/utils/richText) et le HTML d'une zone d'écriture « comme dans Word ».
// On affiche la mise en forme pendant la saisie, mais on enregistre toujours le texte marqué.

// Même ordre que INLINE_MARKS (richText.jsx) : les marques doubles avant la simple.
const MARKS = [
    { mark: '**', re: /\*\*([\s\S]+?)\*\*/, tag: 'b' },
    { mark: '__', re: /__([\s\S]+?)__/, tag: 'u' },
    { mark: '~~', re: /~~([\s\S]+?)~~/, tag: 's' },
    { mark: '_', re: /_([^_\n]+?)_/, tag: 'i' },
];
const TAG_MARK = { B: '**', STRONG: '**', U: '__', S: '~~', STRIKE: '~~', DEL: '~~', I: '_', EM: '_' };
const BLOCKS = new Set(['DIV', 'P', 'LI']);

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Texte marqué → HTML (même lecture que renderRichText : la marque la plus tôt d'abord). */
export function marksToHtml(text) {
    const t = String(text || '');
    let best = null;
    for (const entry of MARKS) {
        const m = entry.re.exec(t);
        if (m && (!best || m.index < best.m.index)) best = { m, entry };
    }
    const plain = (s) => escapeHtml(s).replace(/\n/g, '<br>');
    if (!best) return plain(t);
    const { m, entry } = best;
    return plain(t.slice(0, m.index))
        + `<${entry.tag}>${marksToHtml(m[1])}</${entry.tag}>`
        + marksToHtml(t.slice(m.index + m[0].length));
}

// Marque portée par un élément (balise, ou style posé par certains navigateurs).
function markOf(el) {
    if (TAG_MARK[el.nodeName]) return TAG_MARK[el.nodeName];
    const st = el.style || {};
    if (st.fontWeight === 'bold' || Number(st.fontWeight) >= 600) return '**';
    if (st.fontStyle === 'italic') return '_';
    if (/underline/.test(st.textDecoration || st.textDecorationLine || '')) return '__';
    if (/line-through/.test(st.textDecoration || st.textDecorationLine || '')) return '~~';
    return null;
}

// Entoure chaque ligne non vide (l'italique ne traverse pas les retours à la ligne).
const wrapLines = (s, mark) => s.split('\n').map((l) => (l.trim() ? mark + l + mark : l)).join('\n');

function serialize(node, active) {
    if (node.nodeType === 3) return node.nodeValue.replace(/\u00a0/g, ' ');
    if (node.nodeType !== 1) return '';
    if (node.nodeName === 'BR') return '\n';
    const mark = markOf(node);
    const inner = active.has(mark) || !mark ? active : new Set([...active, mark]);
    let out = '';
    for (const child of node.childNodes) {
        // Un bloc (Entrée dans Chrome/Safari = <div>) commence sur une nouvelle ligne.
        if (child.nodeType === 1 && BLOCKS.has(child.nodeName) && out && !out.endsWith('\n')) out += '\n';
        out += serialize(child, inner);
    }
    return mark && !active.has(mark) ? wrapLines(out, mark) : out;
}

/** HTML de la zone d'écriture (élément DOM) → texte marqué, sans retours à la ligne en fin. */
export function htmlToMarks(root) {
    return serialize(root, new Set()).replace(/\n+$/, '');
}
