// src/components/ui/RichTextEditor.jsx
// Zone d'écriture qui AFFICHE la mise en forme pendant la saisie (gras, italique, souligné,
// barré), « comme dans Word ». La valeur reste le texte en clair avec marques (**, _, __, ~~),
// rendu ensuite par renderRichText : rien de HTML n'est enregistré.
// Entrée = retour à la ligne ; Cmd/Ctrl+B/I/U = raccourcis du navigateur ; le collage est
// toujours en texte brut (pas de styles venus d'ailleurs).
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Bold, Italic, Underline, Strikethrough } from 'lucide-react';
import { marksToHtml, htmlToMarks } from '../../lib/utils/richTextHtml';

const COMMANDS = [
    { cmd: 'bold', title: 'Gras (Ctrl/Cmd+B)', Icon: Bold },
    { cmd: 'italic', title: 'Italique (Ctrl/Cmd+I)', Icon: Italic },
    { cmd: 'underline', title: 'Souligné (Ctrl/Cmd+U)', Icon: Underline },
    { cmd: 'strikeThrough', title: 'Barré', Icon: Strikethrough },
];

/** Barre de boutons ; `active` = commandes actives à l'emplacement du curseur. */
export function RichTextEditorToolbar({ onCommand, active = {}, style }) {
    return (
        <div style={{ display: 'flex', gap: 2, ...style }}>
            {COMMANDS.map(btn => (
                <button
                    key={btn.cmd}
                    type="button"
                    title={btn.title}
                    onMouseDown={e => e.preventDefault()} // garde le focus/sélection dans la zone
                    onClick={() => onCommand(btn.cmd)}
                    style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--df-border)', background: active[btn.cmd] ? 'var(--df-gray-bg)' : 'var(--df-bg)', borderRadius: 6, cursor: 'pointer', color: active[btn.cmd] ? 'var(--df-ink-2)' : 'var(--df-muted)' }}
                >
                    <btn.Icon size={14} />
                </button>
            ))}
        </div>
    );
}

/**
 * Zone éditable contrôlée. `editorRef` (optionnel) reçoit { exec(cmd) } pour une barre placée
 * ailleurs ; `onActiveChange` reçoit l'état des boutons quand le curseur bouge.
 */
export default function RichTextEditor({ value, onChange, placeholder, onKeyDown, onActiveChange, editorRef, style }) {
    const ref = useRef(null);
    // Dernière valeur émise : on ne réécrit le contenu que si la valeur change d'ailleurs
    // (ex. zone vidée après publication), sinon le curseur sauterait à chaque frappe.
    const lastEmitted = useRef(null);
    const [focused, setFocused] = useState(false);

    useLayoutEffect(() => {
        if (ref.current && value !== lastEmitted.current) {
            ref.current.innerHTML = marksToHtml(value);
            lastEmitted.current = value;
        }
    }, [value]);

    const emit = () => {
        const v = htmlToMarks(ref.current);
        lastEmitted.current = v;
        onChange(v);
    };

    const refreshActive = () => {
        if (!onActiveChange) return;
        const state = {};
        for (const { cmd } of COMMANDS) {
            try { state[cmd] = document.queryCommandState(cmd); } catch { state[cmd] = false; }
        }
        onActiveChange(state);
    };

    const exec = (cmd) => {
        ref.current?.focus();
        document.execCommand('styleWithCSS', false, false); // balises <b>/<i>… plutôt que des styles
        document.execCommand(cmd);
        emit();
        refreshActive();
    };

    useEffect(() => {
        if (editorRef) editorRef.current = { exec };
    });

    useEffect(() => {
        if (!focused) return undefined;
        document.addEventListener('selectionchange', refreshActive);
        return () => document.removeEventListener('selectionchange', refreshActive);
    });

    const handleKeyDown = (e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
            // Un vrai retour à la ligne (<br>) plutôt qu'un nouveau bloc.
            e.preventDefault();
            document.execCommand('insertLineBreak');
            emit();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
        emit();
    };

    return (
        <div style={{ position: 'relative', ...style }}>
            {!value && (
                <div style={{ position: 'absolute', inset: 0, padding: 'inherit', color: 'var(--df-faint-2)', pointerEvents: 'none' }}>
                    {placeholder}
                </div>
            )}
            <div
                ref={ref}
                role="textbox"
                aria-multiline="true"
                aria-label={placeholder}
                contentEditable
                suppressContentEditableWarning
                onInput={emit}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onFocus={() => { setFocused(true); refreshActive(); }}
                onBlur={() => setFocused(false)}
                style={{ outline: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word', minHeight: '1.45em', maxHeight: '11.6em', overflowY: 'auto' }}
            />
        </div>
    );
}
