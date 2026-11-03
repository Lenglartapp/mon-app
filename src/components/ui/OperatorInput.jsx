import React, { useMemo } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { useAuth } from '../../auth';
import { useOperators } from '../../hooks/useOperators';
import { operatorSuggestions, OPERATOR_REQUIRED_MESSAGE } from '../../lib/operators';

// Opérateur d'une action (Inventaire + Logistique) — un seul champ pour toute l'appli.
// À l'ouverture : la liste partagée (stock_operators). À la frappe : aussi les comptes actifs de
// l'équipe (lecture seule, ex. « Adrie » → Adrien). Un nom inconnu est accepté tel quel ; il est
// mémorisé dans la liste par l'écran qui enregistre l'action (rememberOperator).
// Champ vide : message sous le champ, le bouton d'enregistrement de l'écran reste grisé.

// `label={null}` : pas de libellé dans le champ (il est posé au-dessus, cf. DaField) ; `fieldSx` : style du champ.
export default function OperatorInput({ value, onChange, sx, label = 'Opérateur', fieldSx, showRequired = true }) {
    const list = useOperators();
    const { users = [] } = useAuth();
    const team = useMemo(
        () => users.filter((u) => !u.archived_at && u.role !== 'tablette').map((u) => u.name).filter(Boolean),
        [users]
    );
    const text = value || '';
    const options = useMemo(() => operatorSuggestions(text, list, team), [text, list, team]);
    const empty = !text.trim();

    return (
        <Autocomplete
            freeSolo
            openOnFocus
            fullWidth
            size="small"
            options={options}
            filterOptions={(o) => o} // déjà filtrées (sans accents, comptes de l'équipe)
            value={text || null}
            inputValue={text}
            onInputChange={(e, val) => onChange(val)}
            onChange={(e, val) => onChange(val || '')}
            sx={sx}
            slotProps={{ listbox: { sx: { '& .MuiAutocomplete-option': { minHeight: 44 } } } }}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label ?? undefined}
                    placeholder="Qui ? (ou tape un nom)"
                    required={label != null}
                    error={showRequired && empty}
                    helperText={showRequired && empty ? OPERATOR_REQUIRED_MESSAGE : undefined}
                    sx={fieldSx}
                    onFocus={(e) => e.target.scrollIntoView?.({ block: 'center', behavior: 'smooth' })}
                />
            )}
        />
    );
}
