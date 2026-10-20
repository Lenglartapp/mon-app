// Plan de l'entrepôt pour la vue 3D, relevé sur la maquette du responsable logistique
// (feuille Excel). Unité : 1 = 100 px de la maquette (~ 1 m). Axe x vers la droite (est),
// axe z vers le bas du plan (sud). Hauteurs en y.
//
// Rayonnages : D à H contre le mur nord, A à C contre le mur sud, J contre le mur est,
// étagère K (consommables) au sud-est. Les niveaux (D1 bas → D4 haut) sont empilés.
// Le reste (bureau, rails, portes) est du décor, pas inventorié pour l'instant.

export const BUILDING = { width: 16.13, depth: 8.35, wallHeight: 0.35 };

const NORTH_DEPTH = 1.25;   // profondeur des rayonnages
const SOUTH_DEPTH = 1.75;   // C, B, A : rouleaux en grande laize → rayonnages plus profonds
const LEVEL_H = 0.62;       // hauteur d'un niveau standard

/**
 * Rayonnage : position au sol (x, z = coin nord-ouest), largeur (le long du mur),
 * profondeur, sens de la face avant ('south' | 'north' | 'west'), niveaux du bas vers le haut.
 */
export const RACKS = [
    ...['D', 'E', 'F', 'G', 'H'].map((a, i) => ({
        aisle: a, x: [0, 1.38, 2.77, 4.15, 5.53][i], z: 0, width: 1.38, depth: NORTH_DEPTH, face: 'south', group: 'nord',
        levels: [1, 2, 3, 4].map(n => ({ code: `${a}${n}`, height: LEVEL_H })),
    })),
    ...['C', 'B', 'A'].map((a, i) => ({
        aisle: a, x: [0, 1.38, 2.77][i], z: BUILDING.depth - SOUTH_DEPTH, width: 1.38, depth: SOUTH_DEPTH, face: 'north', group: 'sud',
        levels: [1, 2, 3, 4].map(n => ({ code: `${a}${n}`, height: LEVEL_H })),
    })),
    // J : le long du mur est (J1 bas → J3 haut)
    {
        aisle: 'J', x: BUILDING.width - 1.1, z: 0, width: 4.3, depth: 1.1, face: 'west', group: 'j',
        levels: [1, 2, 3].map(n => ({ code: `J${n}`, height: 0.8 })),
    },
    // K : étagère des consommables (K1 bas → K5 haut), contre le mur sud
    {
        aisle: 'K', x: 11.05, z: BUILDING.depth - 1.0, width: 1.5, depth: 1.0, face: 'north', group: 'k',
        levels: [1, 2, 3, 4, 5].map(n => ({ code: `K${n}`, height: 0.45 })),
    },
];

/** Zones au sol avec stock (réception). */
export const FLOOR_ZONES = [
    { code: 'I1', label: 'Réception', x: 9.68, z: 0.15, width: 1.37, depth: 1.4, group: 'reception' },
];

/** Décor : bureau, zone rails (pas encore inventoriée). */
export const DECOR = [
    { key: 'BUREAU', label: 'Bureau', x: 6.91, z: 0, width: 1.39, depth: 1.5, height: 1.1, kind: 'room' },
    { key: 'RAILS', label: 'Rails', x: 4.15, z: 5.63, width: 4.15, depth: 2.72, height: 0.12, kind: 'rails' },
];

/** Portes (ouvertures dans les murs). wall : 'north' | 'south'. */
export const DOORS = [
    { key: 'PORT_PH', label: 'Petite porte', wall: 'north', from: 8.30, to: 9.68 },
    { key: 'PORT_EXT', label: 'Porte roulante extérieure', wall: 'north', from: 11.05, to: 13.93 },
    { key: 'PORT_AT', label: 'Porte roulante atelier', wall: 'south', from: 8.30, to: 11.05 },
    { key: 'PORT_PS', label: 'Petite porte (atelier rails)', wall: 'south', from: 12.55, to: 13.93 },
];

/** Groupes affichés en cartes sous la vue. */
export const GROUPS = [
    { key: 'nord', label: 'Allées nord', hint: 'D à H — rouleaux et palettes' },
    { key: 'sud', label: 'Allées sud', hint: 'A à C — rouleaux et palettes' },
    { key: 'j', label: 'Rayonnage J', hint: 'Le long du mur est' },
    { key: 'k', label: 'Consommables', hint: 'Étagère K' },
    { key: 'reception', label: 'Réception', hint: 'I1 — arrivages' },
];

/** Code d'emplacement → groupe. */
export const groupOfCode = (code) => {
    for (const r of RACKS) if (r.levels.some(l => l.code === code)) return r.group;
    for (const z of FLOOR_ZONES) if (z.code === code) return z.group;
    return null;
};

/** Tous les codes représentés dans la vue 3D. */
export const MAPPED_CODES = new Set([...RACKS.flatMap(r => r.levels.map(l => l.code)), ...FLOOR_ZONES.map(z => z.code)]);
