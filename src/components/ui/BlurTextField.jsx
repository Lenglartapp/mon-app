import React, { useState, useEffect } from 'react';
import { TextField } from '@mui/material';

export default function BlurTextField({ value, onChange, ...props }) {
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleBlur = () => {
        console.log("BlurTextField Debug:", { localValue, value, changed: localValue !== value });
        if (localValue !== value) {
            onChange(localValue);
        }
    };

    const handleKeyDown = (e) => {
        // Champ multi-ligne : Entrée insère un retour à la ligne ; l'enregistrement se fait
        // à la perte de focus, comme pour les autres champs.
        if (e.key === 'Enter' && !props.multiline) {
            e.target.blur(); // Trigger blur to save
        }
    };

    return (
        <TextField
            {...props}
            value={localValue || ''}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
        />
    );
}
