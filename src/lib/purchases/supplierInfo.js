// Fournisseur / référence / coloris des articles d'achat (lus dans la bibliothèque), filtres
// et copie pour demande de prix — partagés par la Liste Achats et la Moulinette.

export const formatQty = (q) => Number(q).toLocaleString('fr-FR', { maximumFractionDigits: 2 });

// Colonnes filtrables (en haut de la liste ET dans l'en-tête de chaque tableau).
export const FILTER_FIELDS = [
    { key: 'fournisseur', label: 'Fournisseur' },
    { key: 'reference', label: 'Référence' },
    { key: 'coloris', label: 'Coloris' },
];
export const EMPTY_VALUE = '(vide)';
export const valueOf = (item, key) => String(item[key] || '').trim() || EMPTY_VALUE;

/**
 * Article de la liste → fournisseur / référence / coloris / laize, lus dans la bibliothèque
 * du chiffrage (l'article y est retrouvé par son nom complet ; « — motif » éventuel en plus).
 * Article hors bibliothèque (saisie libre, sous-traitance) : son libellé tient lieu de référence.
 */
export function withCatalogInfo(item, byName) {
    const exact = byName.get(item.label);
    const [name, ...motif] = String(item.label || '').split(' — ');
    const cat = exact || byName.get(name);
    const suffix = !exact && cat && motif.length ? motif.join(' — ') : '';
    // Espaces en trop fréquents dans la bibliothèque (« COPENHAGUE   ») : nettoyés.
    const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
    return {
        ...item,
        fournisseur: clean(cat?.provider),
        reference: clean(cat ? (cat.reference || cat.name) : item.label),
        coloris: [clean(cat?.color), clean(suffix)].filter(Boolean).join(' — '),
        laize: cat?.width || cat?.laize || '',
        qtyLabel: `${formatQty(item.qty)} ${item.unit || ''}`.trim(), // valeur du filtre « Quantité »
    };
}

/** Copie un fragment HTML via une sélection temporaire (repli sans l'API presse-papier). */
function copyHtmlBySelection(html) {
    const box = document.createElement('div');
    box.contentEditable = 'true';
    box.innerHTML = html;
    Object.assign(box.style, { position: 'fixed', left: '-9999px', top: '0', opacity: '0' });
    document.body.appendChild(box);
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(box);
    sel.removeAllRanges();
    sel.addRange(range);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    sel.removeAllRanges();
    box.remove();
    return ok;
}

/**
 * Copie pour une demande de prix : une LISTE À PUCES (une ligne par article, SANS prix),
 * prête à coller dans un e-mail. Ex. « • SCHUMACHER – GOLDEN HILLS – Burgundy (laize 137 cm) : 100,5 ml ».
 * Renvoie true si la copie a réussi.
 */
export async function copyItemsForSupplier(items) {
    const lines = items.map(it => {
        const name = [it.fournisseur, it.reference, it.coloris].filter(Boolean).join(' – ');
        const laize = it.laize ? ` (laize ${it.laize} cm)` : '';
        return `${name}${laize} : ${formatQty(it.qty)} ${it.unit || ''}`.trim();
    });
    const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const html = `<ul style="font-family:Arial,sans-serif;font-size:13px">${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`;
    const text = lines.map(l => `• ${l}`).join('\n');
    try {
        if (window.ClipboardItem && navigator.clipboard?.write) {
            await navigator.clipboard.write([new window.ClipboardItem({
                'text/html': new Blob([html], { type: 'text/html' }),
                'text/plain': new Blob([text], { type: 'text/plain' }),
            })]);
            return true;
        }
    } catch { /* accès au presse-papier refusé : méthode de secours ci-dessous */ }
    // Secours (navigateur qui refuse l'accès direct) : la liste est sélectionnée en
    // coulisse puis copiée comme un Cmd+C — elle garde ses puces dans l'e-mail.
    return copyHtmlBySelection(html);
}

/** Un article passe les filtres : { champ: Set des valeurs retenues } (absent / null = tout). */
export const passes = (item, filters) => Object.entries(filters || {}).every(([k, set]) => !set || set.has(valueOf(item, k)));

/** Tri par défaut des tableaux d'achats : la plus grande quantité d'abord (ordre d'importance). */
export const DEFAULT_SORT = { key: 'qty', dir: 'desc' };

/** Trie les articles : { key, dir: 'asc' | 'desc' } — quantité en nombre, le reste en texte. */
export const sortItems = (items, sort = DEFAULT_SORT) => {
    if (!sort?.key) return items;
    const sign = sort.dir === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
        if (sort.key === 'qty') return sign * ((Number(a.qty) || 0) - (Number(b.qty) || 0));
        return sign * String(a[sort.key] || '').localeCompare(String(b[sort.key] || ''), 'fr', { numeric: true });
    });
};

