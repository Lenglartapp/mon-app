// Position du curseur de texte dans un <input> à partir d'un double-clic, comme Excel :
// double-cliquer au milieu d'un mot place le curseur à cet endroit. Les navigateurs ne
// donnent pas cette position pour un <input> : on mesure le texte avec la police réelle
// du champ, à la même distance du début du texte que le clic dans la case affichée.

let canvas = null;

/**
 * @param {HTMLInputElement} input
 * @param {number} offsetX  distance (px) entre le début du texte et le point cliqué
 */
export function caretIndexAtOffset(input, offsetX) {
    const value = String(input?.value ?? '');
    if (!value || !(offsetX > 0)) return 0;
    const style = getComputedStyle(input);
    canvas = canvas || document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return value.length;
    ctx.font = style.font || `${style.fontSize} ${style.fontFamily}`;
    return nearestIndex(value, offsetX, (str) => ctx.measureText(str).width);
}

/** Distance entre le début du texte affiché d'une case (AG Grid) et un point cliqué. */
export function offsetInCellText(cellEl, clientX) {
    const span = cellEl?.querySelector('.ag-cell-value') || cellEl;
    if (!span || !span.textContent) return null;
    const range = document.createRange();
    range.selectNodeContents(span);
    const rect = range.getBoundingClientRect();
    if (!rect.width) return null;
    return clientX - rect.left;
}

function nearestIndex(value, x, width) {
    if (x <= 0) return 0;
    const total = width(value);
    if (x >= total) return value.length;
    let prev = 0;
    for (let i = 1; i <= value.length; i++) {
        const w = width(value.slice(0, i));
        if (w >= x) return (x - prev) < (w - x) ? i - 1 : i;
        prev = w;
    }
    return value.length;
}
