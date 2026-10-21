// Remplace les couleurs écrites en dur par les couleurs nommées (var(--df-…)).
// Usage : node scripts/theme-codemod.mjs fichier1.jsx fichier2.jsx …
// - uniquement dans les chaînes ('…', "…", `…`), jamais dans un attribut JSX (fill="#…")
// - blanc (#FFF, #FFFFFF, 'white') remplacé seulement comme FOND (background, bgcolor)
// - mode clair identique : chaque variable vaut en clair la couleur d'origine
import { readFileSync, writeFileSync } from 'node:fs';
import { HEX_TO_TOKEN } from '../src/theme/palette.js';

const files = process.argv.slice(2);
let total = 0;
for (const f of files) {
    let src = readFileSync(f, 'utf8');
    let n = 0;
    // 1) Fonds blancs : background / backgroundColor / bgcolor: 'white' | '#fff' | '#ffffff'
    src = src.replace(/\b(background(?:Color)?|bgcolor)(\s*:\s*)(['"])(white|#fff|#ffffff)\3/gi,
        (m, prop, sep, q) => { n++; return `${prop}${sep}${q}var(--df-bg)${q}`; });
    // …y compris dans un ternaire : background: cond ? 'x' : 'white'  (ou 'white' en 1re branche)
    src = src.replace(/\b(background(?:Color)?|bgcolor)(\s*:\s*[^,{}\n]*?\?\s*)([^,{}\n]*?)(\s*:\s*)([^,{}\n]*?)(?=\s*[,}\n])/g,
        (m, prop, a, yes, sep, no) => {
            const fix = (v) => v.replace(/^(['"])(white|#fff|#ffffff)\1$/i, (x, q) => { n++; return `${q}var(--df-bg)${q}`; });
            return `${prop}${a}${fix(yes.trim()) === yes.trim() ? yes : yes.replace(yes.trim(), fix(yes.trim()))}${sep}${fix(no)}`;
        });
    // …et dans une valeur CSS composée : 'background: white' / 'background-color: #fff' (gabarits CSS)
    src = src.replace(/\b(background(?:-color)?)(\s*:\s*)(white|#fff|#ffffff)\b(?![0-9a-f])/gi,
        (m, prop, sep) => { n++; return `${prop}${sep}var(--df-bg)`; });
    // 2) Couleurs nommées, dans les chaînes uniquement (pas après =, ni #FFF hors fond)
    src = src.replace(/(=?)(['"`])((?:\\.|(?!\2)[^\\\n])*)\2/g, (m, eq, q, body) => {
        if (eq) return m; // attribut JSX : fill="#…", color="#…"
        const out = body.replace(/#([0-9A-Fa-f]{6})(?![0-9A-Fa-f])/g, (h, hex) => {
            const tok = HEX_TO_TOKEN['#' + hex.toUpperCase()];
            if (!tok || tok === 'bg') return h; // le blanc n'est remplacé que comme fond (étape 1)
            n++; return `var(--df-${tok})`;
        });
        return `${eq}${q}${out}${q}`;
    });
    // 3) Feuilles CSS : couleurs nommées aussi hors chaînes (propriétés CSS)
    if (f.endsWith('.css')) {
        src = src.replace(/(:[^;{}]*?)#([0-9A-Fa-f]{6})(?![0-9A-Fa-f])/g, (m, before, hex) => {
            const tok = HEX_TO_TOKEN['#' + hex.toUpperCase()];
            if (!tok || tok === 'bg' || /--df-|--text|--muted/.test(before)) return m;
            n++; return `${before}var(--df-${tok})`;
        });
    }
    // 4) Attributs JSX de couleur (icônes, graphiques SVG) : color="#…", fill="#…", stroke="#…"
    src = src.replace(/\b(color|fill|stroke|stopColor)=(["'])#([0-9A-Fa-f]{6})\2/g, (m, attr, q, hex) => {
        const tok = HEX_TO_TOKEN['#' + hex.toUpperCase()];
        if (!tok || tok === 'bg') return m;
        n++; return `${attr}=${q}var(--df-${tok})${q}`;
    });
    if (n) writeFileSync(f, src);
    total += n;
    console.log(`${n}\t${f}`);
}
console.log(`${total} remplacements`);
