import React from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';

// Opérateur d'un mouvement de stock : liste de l'équipe filtrée à la frappe,
// ou saisie libre (prénom) si la personne n'y figure pas. Le texte tapé compte
// tel quel, sans avoir à le valider.

export const OPERATORS = [
    'Elisa Laprune', 'Guillaume Mailly', 'David Vergel', 'Lucie Jaulin', 'Maelane Poulaud',
    'Thomas Bonnet', 'Delphine Butez', 'Catherine Bosse', 'Thierry Menant', 'Alain Houdemont',
    'Nicolas Podyma', 'Audry Papin', 'Julie Rabin', 'Alison Gloaguen', 'Samuel Blandin',
    'Emilie David', 'Emmanuel Peltier', 'Malcolm Jeantal', 'Florence Gobbe'
].sort();

// `label={null}` : pas de libellé dans le champ (il est posé au-dessus, cf. DaField) ; `fieldSx` : style du champ.
export default function OperatorInput({ value, onChange, sx, label = 'Opérateur', fieldSx }) {
    return (
        <Autocomplete
            freeSolo
            fullWidth
            size="small"
            options={OPERATORS}
            value={value || null}
            inputValue={value}
            onInputChange={(e, val) => onChange(val)}
            onChange={(e, val) => onChange(val || '')}
            sx={sx}
            renderInput={(params) => (
                <TextField {...params} label={label ?? undefined} placeholder="Qui ? (ou tape un prénom)" required={label != null} error={label != null && !value.trim()} sx={fieldSx} />
            )}
        />
    );
}
