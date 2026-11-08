// src/hooks/useRichTextMarks.js
// Mise en forme légère d'un textarea contrôlé : marques en clair (**gras**, _italique_,
// __souligné__, ~~barré~~), rendues à l'affichage par lib/utils/richText.
import { useRef, useCallback, useLayoutEffect } from 'react';

// Raccourcis Ctrl/Cmd + lettre (mêmes marques que les boutons de RichTextToolbar).
const SHORTCUTS = { b: '**', i: '_', u: '__' };

/**
 * Logique de mise en forme d'un textarea contrôlé : applyMark entoure la sélection des
 * marques, onKeyDown gère Ctrl/Cmd+B/I/U. Partagé par RichTextArea et le mur du projet.
 */
export function useRichTextMarks(ref, value, onChange) {
    // Après un onChange programmatique, on doit restaurer la sélection nous-mêmes
    // (le textarea est contrôlé) : on mémorise l'intervalle à replacer.
    const pendingSelection = useRef(null);

    const applyMark = useCallback((mark) => {
        const el = ref.current;
        if (!el) return;
        const { selectionStart: start, selectionEnd: end } = el;
        const v = value || '';
        const selected = v.slice(start, end);
        onChange(v.slice(0, start) + mark + selected + mark + v.slice(end));
        // Curseur placé à l'intérieur des marques, sélection conservée.
        pendingSelection.current = [start + mark.length, start + mark.length + selected.length];
    }, [ref, value, onChange]);

    useLayoutEffect(() => {
        if (pendingSelection.current && ref.current) {
            const [a, b] = pendingSelection.current;
            pendingSelection.current = null;
            ref.current.focus();
            ref.current.setSelectionRange(a, b);
        }
    });

    const onKeyDown = (e) => {
        if (e.metaKey || e.ctrlKey) {
            const mark = SHORTCUTS[e.key.toLowerCase()];
            if (mark) { e.preventDefault(); applyMark(mark); }
        }
    };

    return { applyMark, onKeyDown };
}
