import { useEffect } from 'react';
import { caretIndexAtOffset, offsetInCellText } from '../utils/caretFromPoint';

/**
 * Saisie à la Excel dans un tableau MUI DataGrid (Bibliothèque, Matériauthèque) :
 * un double-clic ouvre la case avec le curseur à l'endroit cliqué (au lieu de la fin).
 * Clic = sélection, frappe directe = remplace, Entrée = curseur en fin : comportement
 * natif du DataGrid, inchangé.
 *
 * @param {HTMLElement|null} el  conteneur du DataGrid (ref de rappel : dans une fenêtre,
 *                              il n'existe qu'un instant après l'ouverture)
 */
export function useExcelCaret(el) {
    useEffect(() => {
        if (!el) return undefined;
        let last = null;
        const onDbl = (e) => {
            const cell = e.target?.closest?.('.MuiDataGrid-cell');
            last = cell ? { dx: offsetInCellText(cell, e.clientX), t: Date.now() } : null;
        };
        const onFocusIn = (e) => {
            const input = e.target;
            if (!(input instanceof HTMLInputElement) || !input.closest('.MuiDataGrid-cell--editing')) return;
            if (!last || last.dx == null || Date.now() - last.t > 800) return;
            const { dx } = last;
            last = null;
            const place = () => {
                const at = caretIndexAtOffset(input, dx);
                try { input.setSelectionRange(at, at); } catch { /* champ sans sélection */ }
            };
            place();
            setTimeout(place, 0);
        };
        el.addEventListener('dblclick', onDbl, true);
        el.addEventListener('focusin', onFocusIn);
        return () => { el.removeEventListener('dblclick', onDbl, true); el.removeEventListener('focusin', onFocusIn); };
    }, [el]);
}

/** Pas de surbrillance au survol ; seule la ligne de la case cliquée est surlignée. */
export const FOCUS_ROW_SX = {
    '& .MuiDataGrid-row:hover': { backgroundColor: 'transparent' },
    '& .MuiDataGrid-row:has(.MuiDataGrid-cell:focus), & .MuiDataGrid-row:has(.MuiDataGrid-cell:focus-within)': { backgroundColor: '#EEF4FD' }, // bleu ciel ≠ gris des en-têtes
};
