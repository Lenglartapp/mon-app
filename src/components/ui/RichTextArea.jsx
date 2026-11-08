// src/components/ui/RichTextArea.jsx
// Zone de texte avec une petite barre de mise en forme (gras / italique / souligné /
// barré). Le texte reste stocké EN CLAIR avec des marques (**, _, __, ~~) — la même
// syntaxe que les commentaires de ligne (lib/utils/richText). Rien de HTML n'est
// enregistré : le rendu se fait à l'affichage via renderRichText.
import React, { useRef } from 'react';
import { useRichTextMarks } from '../../hooks/useRichTextMarks';
import { Bold, Italic, Underline, Strikethrough } from 'lucide-react';

const BUTTONS = [
    { mark: '**', title: 'Gras (Ctrl/Cmd+B)', Icon: Bold, shortcut: 'b' },
    { mark: '_', title: 'Italique (Ctrl/Cmd+I)', Icon: Italic, shortcut: 'i' },
    { mark: '__', title: 'Souligné (Ctrl/Cmd+U)', Icon: Underline, shortcut: 'u' },
    { mark: '~~', title: 'Barré', Icon: Strikethrough },
];

/** Barre de boutons gras / italique / souligné / barré. */
export function RichTextToolbar({ onMark, style }) {
    return (
        <div style={{ display: 'flex', gap: 2, ...style }}>
            {BUTTONS.map(btn => (
                <button
                    key={btn.mark}
                    type="button"
                    title={btn.title}
                    onMouseDown={e => e.preventDefault()} // garde le focus/sélection dans le champ
                    onClick={() => onMark(btn.mark)}
                    style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--df-border)', background: 'var(--df-bg)', borderRadius: 6, cursor: 'pointer', color: 'var(--df-muted)' }}
                >
                    <btn.Icon size={14} />
                </button>
            ))}
        </div>
    );
}

export default function RichTextArea({ value, onChange, placeholder, minHeight = 96, textareaStyle }) {
    const ref = useRef(null);
    const { applyMark, onKeyDown } = useRichTextMarks(ref, value, onChange);

    return (
        <div>
            <RichTextToolbar onMark={applyMark} style={{ marginBottom: 6 }} />
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
