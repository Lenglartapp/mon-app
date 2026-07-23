// src/components/ui/RichTextArea.jsx
// Zone de texte avec une petite barre de mise en forme (gras / italique / souligné /
// barré). Le texte reste stocké EN CLAIR avec des marques (**, _, __, ~~) — la même
// syntaxe que les commentaires de ligne (lib/utils/richText). Rien de HTML n'est
// enregistré : le rendu se fait à l'affichage via renderRichText.
import React, { useRef, useCallback, useLayoutEffect } from 'react';
import { Bold, Italic, Underline, Strikethrough } from 'lucide-react';

const BUTTONS = [
    { mark: '**', title: 'Gras (Ctrl/Cmd+B)', Icon: Bold, shortcut: 'b' },
    { mark: '_', title: 'Italique (Ctrl/Cmd+I)', Icon: Italic, shortcut: 'i' },
    { mark: '__', title: 'Souligné (Ctrl/Cmd+U)', Icon: Underline, shortcut: 'u' },
    { mark: '~~', title: 'Barré', Icon: Strikethrough },
];

export default function RichTextArea({ value, onChange, placeholder, minHeight = 96, textareaStyle }) {
    const ref = useRef(null);
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
    }, [value, onChange]);

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
            const m = BUTTONS.find(btn => btn.shortcut === e.key.toLowerCase());
            if (m) { e.preventDefault(); applyMark(m.mark); }
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: 2, marginBottom: 6 }}>
                {BUTTONS.map(btn => (
                    <button
                        key={btn.mark}
                        type="button"
                        title={btn.title}
                        onMouseDown={e => e.preventDefault()} // garde le focus/sélection dans le champ
                        onClick={() => applyMark(btn.mark)}
                        style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E5E7EB', background: 'white', borderRadius: 6, cursor: 'pointer', color: '#6B7280' }}
                    >
                        <btn.Icon size={14} />
                    </button>
                ))}
            </div>
            <textarea
                ref={ref}
                value={value}
                onChange={e => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                style={{ ...textareaStyle, minHeight, resize: 'vertical' }}
            />
        </div>
    );
}
