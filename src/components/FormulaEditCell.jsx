import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { GridEditInputCell, useGridApiContext } from '@mui/x-data-grid';
import Popper from '@mui/material/Popper';
import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ClickAwayListener from '@mui/material/ClickAwayListener';

export default function FormulaEditCell(props) {
    const { id, field, row, value, defaultFormula, schema } = props;
    const apiRef = useGridApiContext();
    // Ensure value is string
    const [inputValue, setInputValue] = useState(String(value ?? ''));
    const [anchorEl, setAnchorEl] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [cursorPos, setCursorPos] = useState(0);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const inputRef = useRef(null);
    const initialized = useRef(false);

    // Initialize value from override or default formula ONLY ONCE
    useLayoutEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        const override = row?.__cellFormulas?.[field];
        let initialValue = '';

        if (override) {
            initialValue = `=${override}`;
        } else if (defaultFormula) {
            initialValue = `=${defaultFormula}`;
        }

        if (initialValue) {
            setInputValue(initialValue);
            apiRef.current.setEditCellValue({ id, field, value: initialValue });
        }
    }, []); // Empty dependency array to run only on mount

    const handleChange = (event) => {
        const newValue = event.target.value;
        setInputValue(newValue);
        apiRef.current.setEditCellValue({ id, field, value: newValue });

        setCursorPos(event.target.selectionStart);
        setAnchorEl(event.currentTarget);
        setHighlightedIndex(0); // Reset highlight on typing
    };

    const handleSelect = (suggestion) => {
        const textBeforeCursor = inputValue.slice(0, cursorPos);
        const textAfterCursor = inputValue.slice(cursorPos);

        const match = textBeforeCursor.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
        if (match) {
            const prefix = textBeforeCursor.slice(0, match.index);
            const newValue = prefix + suggestion.key + textAfterCursor;

            setInputValue(newValue);
            apiRef.current.setEditCellValue({ id, field, value: newValue });
            setSuggestions([]);

            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                    const newCursorPos = prefix.length + suggestion.key.length;
                    inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
                }
            }, 0);
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
                    event.stopPropagation(); // Prevent grid from saving/closing
                    handleSelect(suggestions[highlightedIndex]);
                }
            } else if (event.key === 'Escape') {
                setSuggestions([]);
                event.preventDefault(); // Prevent grid from cancelling edit
                event.stopPropagation();
            }
        }
    };

    const handleClick = (event) => {
        setCursorPos(event.target.selectionStart);
        setAnchorEl(event.currentTarget);
    };

    const handleKeyUp = (event) => {
        setCursorPos(event.target.selectionStart);
        setAnchorEl(event.currentTarget);
    };

    // Autocomplete logic
    useEffect(() => {
        if (!inputValue || !schema) {
            setSuggestions([]);
            return;
        }

        const textBeforeCursor = inputValue.slice(0, cursorPos);
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
    }, [inputValue, cursorPos, schema, field]);

    const open = suggestions.length > 0;

    return (
        <div style={{ width: '100%', position: 'relative' }}>
            <GridEditInputCell
                {...props}
                value={inputValue}
                onChange={handleChange}
                type="text"
                inputProps={{
                    onKeyDown: handleKeyDown,
                    onKeyUp: handleKeyUp,
                    onClick: handleClick,
                    autoComplete: "off",
                    ref: inputRef,
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
}
