import React, { useMemo, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { LOC_A_COMPLETER, splitLocations } from '../../../lib/inventory/stockFields';

// Emplacement(s) d'une réception : un ou plusieurs codes (« B3, C1 »), jamais par pièce.
// Le texte tapé sans Entrée est validé en quittant le champ (donc aussi au clic sur Enregistrer).
// La sentinelle « À COMPLÉTER » ne se saisit pas : elle disparaît dès qu'un vrai code est mis.

const cleanLocs = (list) => [...new Set(list.map((v) => String(v).trim()).filter((v) => v && v !== LOC_A_COMPLETER))];

export default function LocationInput({ value, onChange, zones = [], label = 'Emplacement', helperText, required, placeholder = 'ex. B3 (plusieurs possibles)' }) {
  const [input, setInput] = useState('');
  const zoneByCode = useMemo(() => new Map(zones.filter((z) => z.code).map((z) => [z.code, z])), [zones]);

  const commitInput = () => {
    if (!input.trim()) return;
    onChange(cleanLocs([...value, ...splitLocations(input)]));
    setInput('');
  };

  return (
    <Autocomplete
      multiple
      freeSolo
      size="small"
      options={[...zoneByCode.keys()]}
      renderOption={(props, code) => {
        const z = zoneByCode.get(code);
        const desc = z?.label_carte || z?.description;
        return <li {...props} key={code}>{code}{desc ? ` – ${desc}` : ''}</li>;
      }}
      value={value}
      onChange={(e, val) => { onChange(cleanLocs(val)); setInput(''); }}
      inputValue={input}
      onInputChange={(e, val, reason) => { if (reason !== 'reset') setInput(val); }}
      onBlur={commitInput}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          placeholder={value.length ? '' : placeholder}
          helperText={helperText}
        />
      )}
    />
  );
}
