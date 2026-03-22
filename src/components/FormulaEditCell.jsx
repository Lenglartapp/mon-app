import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import Popper from '@mui/material/Popper';
import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ClickAwayListener from '@mui/material/ClickAwayListener';

/**
 * AG Grid custom cell editor — supporte la saisie de formules (=expr) avec autocomplétion.
 *
 * INPUT NON-CONTRÔLÉ (defaultValue) — critique pour AG Grid v35.
 * Avec un input contrôlé (value=state), React ne commite pas le state update de façon
 * synchrone. Quand AG Grid appelle getValue() dans le même cycle événement (ex: keydown Enter),
 * inputRef.current.value retourne toujours la valeur initiale (state pas encore mis à jour).
 * Avec defaultValue + input non-contrôlé, le DOM est immédiatement à jour à chaque frappe.
 */
const FormulaEditCell = forwardRef((props, ref) => {
    const { value, data, colDef } = props;
    const field = colDef?.field;
    const row = data;
    const defaultFormula = colDef?.defaultFormula ?? props.defaultFormula;
    const schema = colDef?.schema ?? props.schema;

    // Valeur initiale calculée une seule fois (ref, pas state — on ne contrôle pas l'input)
    const initialValue = useRef(() => {
        const override = row?.__cellFormulas?.[field];
        if (override) return `=${override}`;
        if (defaultFormula) return `=${defaultFormula}`;
        return String(value ?? '');
    }).current();

    // État uniquement pour l'autocomplétion (ne contrôle PAS la valeur de l'input)
    const [suggestions, setSuggestions] = useState([]);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [anchorEl, setAnchorEl] = useState(null);

    const inputRef = useRef(null);

    // Interface AG Grid — getValue() lit toujours depuis le DOM (synchrone)
    useImperativeHandle(ref, () => ({
        getValue() {
            const domVal = inputRef.current ? inputRef.current.value : null;
            console.log('[FormulaEditCell.getValue]', {
                inputRefExists: !!inputRef.current,
                domValue: domVal,
                initialValue,
                returning: domVal ?? initialValue,
            });
            return domVal ?? initialValue;
        },
        isCancelBeforeStart() {
            return false;
        },
        afterGuiAttached() {
            if (inputRef.current) {
                inputRef.current.focus();
                inputRef.current.select();
            }
        },
    }));

    const updateSuggestions = (currentValue, cursorPos) => {
        if (!currentValue || !schema || !String(currentValue).startsWith('=')) {
            setSuggestions([]);
            return;
        }
        const textBeforeCursor = currentValue.slice(0, cursorPos);
        const match = textBeforeCursor.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
        if (match) {
            const query = match[1].toLowerCase();
            const matches = schema
                .filter(col => col.key.toLowerCase().includes(query) && col.key !== field)
                .map(col => ({ key: col.key, label: col.label || col.key }));
            setSuggestions(matches);
        } else {
            setSuggestions([]);
        }
    };

    const handleInput = (event) => {
        // Input non-contrôlé : on ne met PAS à jour un state qui contrôle value.
        // On met seulement à jour les suggestions d'autocomplétion.
        setAnchorEl(event.currentTarget);
        updateSuggestions(event.target.value, event.target.selectionStart);
        setHighlightedIndex(0);
    };

    const handleSelect = (suggestion) => {
        if (!inputRef.current) return;
        const currentVal = inputRef.current.value;
        const cursorPos = inputRef.current.selectionStart;
        const textBeforeCursor = currentVal.slice(0, cursorPos);
        const textAfterCursor = currentVal.slice(cursorPos);
        const match = textBeforeCursor.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
        if (match) {
            const prefix = textBeforeCursor.slice(0, match.index);
            const newValue = prefix + suggestion.key + textAfterCursor;
            // Mettre à jour le DOM directement (input non-contrôlé)
            inputRef.current.value = newValue;
            setSuggestions([]);
            const newCursorPos = prefix.length + suggestion.key.length;
            inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
            inputRef.current.focus();
        }
    };

    const handleKeyDown = (event) => {
        if (suggestions.length > 0) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setHighlightedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setHighlightedIndex((prev) => Math.max(prev - 1, 0));
            } else if (event.key === 'Enter' || event.key === 'Tab') {
                if (suggestions[highlightedIndex]) {
                    event.preventDefault();
                    event.stopPropagation();
                    handleSelect(suggestions[highlightedIndex]);
                }
            } else if (event.key === 'Escape') {
                setSuggestions([]);
                event.preventDefault();
                event.stopPropagation();
            }
        }
    };

    const open = suggestions.length > 0;

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <input
                ref={inputRef}
                defaultValue={initialValue}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onKeyUp={(e) => { setAnchorEl(e.currentTarget); updateSuggestions(e.target.value, e.target.selectionStart); }}
                onClick={(e) => { setAnchorEl(e.currentTarget); }}
                autoComplete="off"
                style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    outline: 'none',
                    padding: '0 8px',
                    fontSize: '14px',
                    background: 'var(--ag-input-focus-border-color, #fff)',
                    color: 'inherit',
                }}
            />
            <Popper open={open} anchorEl={anchorEl} placement="bottom-start" style={{ zIndex: 99999 }}>
                <ClickAwayListener onClickAway={() => setSuggestions([])}>
                    <Paper elevation={3} style={{ maxHeight: 200, overflow: 'auto', minWidth: 200, border: '1px solid #ccc' }}>
                        <List dense>
                            {suggestions.map((s, index) => (
                                <ListItemButton
                                    key={s.key}
                                    onClick={() => handleSelect(s)}
                                    selected={index === highlightedIndex}
                                >
                                    <ListItemText primary={s.key} secondary={s.label !== s.key ? s.label : null} />
                                </ListItemButton>
                            ))}
                        </List>
                    </Paper>
                </ClickAwayListener>
            </Popper>
        </div>
    );
});

FormulaEditCell.displayName = 'FormulaEditCell';
export default FormulaEditCell;
