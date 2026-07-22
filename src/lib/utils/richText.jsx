// src/lib/utils/richText.jsx
// Rendu commun des textes libres saisis par les utilisateurs (commentaires de ligne,
// messages du mur, journal d'activité) : mentions @prénom + mise en forme légère.
//
// Le texte reste TOUJOURS stocké en clair : aucune balise HTML n'est enregistrée,
// donc rien à assainir, aucune migration, et un message sans marque s'affiche
// exactement comme avant.
//
// À utiliser avec `whiteSpace: 'pre-wrap'` côté conteneur pour conserver les
// retours à la ligne, espaces multiples et indentations tels qu'ils ont été saisis.
import React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';

// Marques reconnues. L'ordre compte : les marques doubles passent avant la
// simple (_italique_), sinon `__souligné__` serait lu comme deux italiques.
export const INLINE_MARKS = [
    { mark: '**', re: /\*\*([\s\S]+?)\*\*/, sx: { fontWeight: 700 } },
    { mark: '__', re: /__([\s\S]+?)__/, sx: { textDecoration: 'underline' } },
    { mark: '~~', re: /~~([\s\S]+?)~~/, sx: { textDecoration: 'line-through' } },
    { mark: '_', re: /_([^_\n]+?)_/, sx: { fontStyle: 'italic' } },
];

// Mentions @prénom → pastille bleue.
const renderMentions = (text, keyPrefix) => {
    if (!text) return [];
    return text.split(/(@\w+)/g).map((part, i) => {
        if (part.startsWith('@')) {
            return (
                <Chip
                    key={`${keyPrefix}-m${i}`}
                    label={part}
                    size="small"
                    sx={{
                        height: 20,
                        fontSize: 11,
                        bgcolor: '#DBEAFE',
                        color: '#1E40AF',
                        fontWeight: 600,
                        mx: 0.2,
                        '& .MuiChip-label': { px: 0.5 }
                    }}
                />
            );
        }
        return part;
    });
};

// Rend récursivement la marque qui apparaît le plus tôt, puis ce qui l'entoure :
// les imbrications (**gras avec _italique_ dedans**) fonctionnent sans cas dédié.
export function renderRichText(text, keyPrefix = 'r') {
    if (!text) return "";

    let best = null;
    INLINE_MARKS.forEach((entry, mi) => {
        const m = entry.re.exec(text);
        if (m && (best === null || m.index < best.m.index)) best = { m, entry, mi };
    });

    if (!best) return renderMentions(text, keyPrefix);

    const { m, entry, mi } = best;
    return [
        ...renderMentions(text.slice(0, m.index), `${keyPrefix}-a${mi}`),
        <Box component="span" key={`${keyPrefix}-f${mi}-${m.index}`} sx={entry.sx}>
            {renderRichText(m[1], `${keyPrefix}-in${mi}`)}
        </Box>,
        ...[].concat(renderRichText(text.slice(m.index + m[0].length), `${keyPrefix}-z${mi}`)),
    ];
}
