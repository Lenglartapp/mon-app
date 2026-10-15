import React from 'react';
import { useGridApiContext } from '@mui/x-data-grid';

// Champ de saisie TEXTE pour une colonne numérique du DataGrid : le champ « nombre »
// du navigateur ne permet pas de placer le curseur (saisie à la Excel), et refuse la
// virgule. Le texte tapé est gardé tel quel à l'écran ; la colonne le convertit en
// nombre (valueParser) pour l'enregistrement.
export default function TextNumberEditCell({ id, field, value, hasFocus }) {
    const apiRef = useGridApiContext();
    const inputRef = React.useRef(null);
    const [raw, setRaw] = React.useState(value == null ? '' : String(value).replace('.', ','));

    React.useLayoutEffect(() => {
        if (hasFocus) inputRef.current?.focus();
    }, [hasFocus]);

    const onChange = (e) => {
        setRaw(e.target.value);
        apiRef.current.setEditCellValue({ id, field, value: e.target.value }, e);
    };

    return (
        <input
            ref={inputRef}
            value={raw}
            onChange={onChange}
            inputMode="decimal"
            style={{ width: '100%', height: '100%', border: 'none', outline: 'none', padding: '0 10px', font: 'inherit', fontSize: 13, textAlign: 'right', background: 'transparent' }}
        />
    );
}
