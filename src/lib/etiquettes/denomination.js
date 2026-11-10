// src/lib/etiquettes/denomination.js
// Localisation affichée dans le bandeau de TOUTES les étiquettes (recto et verso rideau,
// stores bateaux) : une seule règle, partagée.
//   - Pièce ET Fenêtre remplies → Pièce + Fenêtre (la Zone n'est pas répétée) ;
//   - sinon → Zone + celle des deux qui est remplie ;
//   - Zone vide → jamais affichée ; plus de « — » ; rien de rempli → pas de bandeau.
// Exception validée : si la même pièce existe dans plusieurs zones du dossier
// (ex. « Chambre 101 » au Bât. A et au Bât. B), la Zone reste affichée pour lever l'ambiguïté.
// Un champ masqué via le menu « Champs » compte comme vide.

const clean = (x) => {
    const s = String(x ?? '').trim();
    return s === '—' ? '' : s;
};
const isHidden = (row, key) =>
    Array.isArray(row?.etiquette_hidden_fields) && row.etiquette_hidden_fields.includes(key);
const field = (row, key) => (isHidden(row, key) ? '' : clean(row?.[key]));
const pieceKey = (s) => s.toLowerCase().replace(/\s+/g, ' ');

/** Pièces (clé normalisée) présentes dans plusieurs zones différentes des lignes données. */
export function piecesInSeveralZones(rows) {
    const zonesByPiece = new Map();
    for (const r of rows || []) {
        const piece = clean(r?.piece), zone = clean(r?.zone);
        if (!piece || !zone) continue;
        const k = pieceKey(piece);
        if (!zonesByPiece.has(k)) zonesByPiece.set(k, new Set());
        zonesByPiece.get(k).add(pieceKey(zone));
    }
    return new Set([...zonesByPiece].filter(([, zones]) => zones.size > 1).map(([k]) => k));
}

/**
 * Éléments de localisation à afficher, dans l'ordre : [{ key, label, value }].
 * multiZonePieces = résultat de piecesInSeveralZones sur les lignes du dossier.
 */
export function denomination(row, multiZonePieces = new Set()) {
    const zone = field(row, 'zone'), piece = field(row, 'piece'), fenetre = field(row, 'fenetre');
    const both = piece && fenetre;
    const out = [];
    if (zone && (!both || multiZonePieces.has(pieceKey(piece)))) out.push({ key: 'zone', label: 'ZONE', value: zone });
    if (piece) out.push({ key: 'piece', label: 'PIÈCE', value: piece });
    if (fenetre) out.push({ key: 'fenetre', label: 'FENÊTRE', value: fenetre });
    return out;
}

/** Version texte du bandeau : « ZONE x · PIÈCE y · FENÊTRE z » ("" si rien). */
export const denominationText = (row, multiZonePieces) =>
    denomination(row, multiZonePieces).map((d) => `${d.label} ${d.value}`).join(' · ');
