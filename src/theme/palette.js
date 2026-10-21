import { AUTO_DARK } from './paletteAuto.js';

// Couleurs nommées de Droitfil (mode clair = valeurs historiques, à l'identique ; mode sombre).
// Chaque couleur écrite en dur dans les composants est remplacée par var(--df-…) :
// le mode clair ne change pas d'un pixel, le mode sombre redéfinit les variables.
// Clé = nom de variable (sans --df-), valeur = [clair, sombre].
export const PALETTE = {
    // Fonds
    bg:             ['#FFFFFF', '#191919'], // fond de page, cartes, tableaux
    // Mêmes valeurs que bg en clair, mais distinctes en sombre (posées à la main, jamais par le script) :
    panel:          ['#FFFFFF', '#111111'], // panneaux latéraux (Gérer l'équipe…), plus sombres
    card:           ['#FFFFFF', '#242424'], // cartes posées sur un fond (Programme semaine)
    surface:        ['#F4F4F4', '#242424'], // en-têtes de tableaux, blocs gris, survol
    'surface-2':    ['#F3F4F6', '#272727'],
    'surface-3':    ['#F7F7F5', '#212121'],
    'surface-4':    ['#F9FAFB', '#1E1E1E'],
    'surface-5':    ['#FAFAFA', '#202020'], // en-têtes de fenêtres
    subrow:         ['#FBFAF8', '#1F1F1F'], // lignes de détail dépliées (Programmation)
    'surface-6':    ['#FAFAF9', '#1F1F1F'],
    selected:       ['#EEF4FD', '#1E2433'],
    hover:          ['#EFEFED', '#2C2C2C'], // survol des onglets en pastilles // ligne sélectionnée (bleu ciel)
    // Traits
    border:         ['#E0DED9', '#363636'],
    'border-soft':  ['#E8E6E2', '#2D2D2D'],
    'border-2':     ['#E5E7EB', '#3A3A3A'],
    'border-strong':['#D1D5DB', '#4A4A4A'],
    'border-hover': ['#C9C7C2', '#555555'],
    // Textes
    text:           ['#111827', '#ECECEA'],
    'text-1b':      ['#1F2937', '#E3E3E0'],
    'text-2':       ['#374151', '#D2D2CE'],
    'text-3':       ['#4B5563', '#BABAB6'],
    muted:          ['#6B7280', '#A0A09C'],
    faint:          ['#9CA3AF', '#80807C'],
    'faint-2':      ['#9B9A97', '#878682'],
    // Marque / actions
    primary:        ['#1E2447', '#2F3F73'],
    // Bleu nuit employé comme TEXTE (titres, chiffres, liens) : éclairci en sombre
    'primary-text': ['#1E2447', '#9AAEE8'],
    // Boutons « encre » (fond #111827 en clair) : bleu nuit atténué en sombre, jamais blanc
    ink:            ['#111827', '#2F3F73'], // bleu nuit (boutons principaux, pastille « aujourd'hui »)
    'tone-1':       ['#34508F', '#2B3966'],
    'tone-2':       ['#5B7FC4', '#283458'],
    'tone-3':       ['#A8C2EC', '#252E4A'],
    'tone-4':       ['#D6E4F8', '#222A3E'],
    blue:           ['#2563EB', '#6EA0FF'],
    // États
    'danger-bg':    ['#FEF2F2', '#2E1A1A'],
    'danger-border':['#FEE2E2', '#5A2A2A'],
    danger:         ['#EF4444', '#F07A72'],
    'danger-text':  ['#B91C1C', '#F28B82'],
    'rose-bg':      ['#FFE4E6', '#3D2027'],
    'rose-text':    ['#BE123C', '#F7A1B4'],
    'rose-strong':  ['#9F1239', '#F2A7BA'], // cartes du Programme semaine
    'rose-border':  ['#FECDD3', '#4A2A33'],
    'rose-hover':   ['#FCE7F3', '#3A2230'],
    'rose-soft':    ['#FFF1F2', '#2A1C20'],
    'rose-faint':   ['#FDA4AF', '#9E5A6B'],
    'warn-text':    ['#92400E', '#F5B85C'],
    'warn-bg':      ['#FEFCE8', '#2B2818'],
    'indigo-bg':    ['#EEF2FF', '#23264A'],
    'indigo-bg-2':  ['#EEF0F8', '#222640'],
    'blue-bg':      ['#EFF6FF', '#1C2638'],
    // Textes foncés secondaires (variantes héritées)
    'ink-1':        ['#191919', '#ECECEA'],
    'ink-2':        ['#37352F', '#E6E5E1'],
    'ink-3':        ['#1F2A37', '#DCDFE4'],
    'ink-4':        ['#1E293B', '#D5DAE2'],
    'ink-5':        ['#334155', '#C3C8D0'],
    'blue-strong':  ['#1E3A8A', '#9DB8F5'],
    'navy-2':       ['#2A3260', '#9AA8E0'],
    'navy-3':       ['#26306B', '#9AA8E0'],
    'green-strong': ['#064E3B', '#7DD3B0'],
    // Fonds pâles hérités (statuts, pastilles, encarts)
    'amber-bg':     ['#FEF3C7', '#3A3018'],
    'amber-bg-2':   ['#FDE68A', '#4A3C17'],
    'blue-bg-2':    ['#DBEAFE', '#1E2A44'],
    'blue-bg-3':    ['#E0E7FF', '#252B48'],
    'blue-bg-4':    ['#F0F9FF', '#1A2530'],
    'slate-bg':     ['#F8FAFC', '#1E2024'],
    'slate-border': ['#E2E8F0', '#3A3F47'],
    'slate-bg-2':   ['#E9ECEF', '#2E3033'],
    'slate-bg-3':   ['#F1F2F4', '#2A2C2F'],
    'green-bg':     ['#D1FAE5', '#17332A'],
    'green-bg-2':   ['#DCFCE7', '#183222'],
    'green-bg-3':   ['#A7F3D0', '#1F4A38'],
    'yellow-bg':    ['#FEF9C3', '#33301A'],
    'violet-bg':    ['#F5F3FF', '#29243D'],
    'violet-bg-2':  ['#EDE9FE', '#2E2847'],
    'navy-bg':      ['#E8EAF2', '#2A2D38'],
    'navy-bg-2':    ['#EEF0F5', '#25272E'],
    'navy-bg-3':    ['#F8F9FF', '#1F2028'],
    'warm-bg':      ['#FDF6E7', '#2E2A20'],
    'warm-bg-2':    ['#F0EBE3', '#2C2925'],
    'warm-bg-3':    ['#F3EEF2', '#2B272A'],
    'gray-bg':      ['#EDEDEB', '#2B2B2B'],
    'orange-bg':    ['#FFEDD5', '#3A2A1C'],
    // Intercalaires des variantes de chiffrage (dégradé bleu nuit → bleu clair)
    'variant-light':['#A8B6DA', '#3E4A6E'],
    'variant-fg':   ['#1E2447', '#E6E9F5'],
    // Barre de recherche de l'en-tête (tons beiges)
    'beige-bg':     ['#F5EFE6', '#2A2A2A'],
    'beige-border': ['#E6DDD2', '#3A3A3A'],
    'beige-text':   ['#9B8E82', '#A09C96'],
    'beige-text-2': ['#B0A396', '#8C8883'],
    'beige-icon':   ['#CEAB95', '#8C8883'],
    // Graphiques (Capacité…) : en sombre, courbes éclaircies et aire discrète
    'chart-capa-fill': ['#EEF4FD', '#1E2638'],
    'chart-capa':   ['#A8C2EC', '#4F6CA8'],
    'chart-plan':   ['#1E2447', '#B9CBF2'],
    'chart-charge': ['#5B7FC4', '#7FA0E0'],
    'chart-grid':   ['#E8E6E2', '#2A2A2A'],
    'chart-axis':   ['#6B7280', '#8A8A86'],
    'chart-axis-2': ['#374151', '#B5B5B1'],
    // Étiquettes de filtre (barre de recherche des listes) : fond teinté sourd + texte clair en sombre
    'chip-name-bg':     ['#EEF2FF', '#252A45'], 'chip-name':     ['#3730A3', '#B4BCF5'],
    'chip-client-bg':   ['#FDF4FF', '#33243A'], 'chip-client':   ['#6B21A8', '#D9B3F0'],
    'chip-owner-bg':    ['#FFF7ED', '#3A2A1E'], 'chip-owner':    ['#9A3412', '#F2B58A'],
    'chip-status-bg':   ['#F0FDF4', '#1C3326'], 'chip-status':   ['#166534', '#86D9A8'],
    'chip-adv-bg':      ['#FFFBEB', '#3A3220'],
    'chip-del-hover':   ['#000000', '#FFFFFF'],
    'chip-default-bg':  ['#EDF7ED', '#1E3322'], 'chip-default':  ['#1E4620', '#9BD3A2'],
    'success-bg':   ['#ECFDF5', '#16302A'],
    'success-text': ['#047857', '#5FD3A4'],
};

/** Couleurs historiques → nom de variable (pour le script de conversion). */
// Variantes automatiques (paletteAuto.js) : nommées d'après leur couleur claire, ex. --df-x-991B1B.
for (const [light, dark] of Object.entries(AUTO_DARK)) {
    const key = 'x-' + light.slice(1).toUpperCase();
    if (!Object.values(PALETTE).some(([l]) => l.toUpperCase() === light.toUpperCase())) PALETTE[key] = [light, dark];
}

export const HEX_TO_TOKEN = {};
for (const [k, [light]] of Object.entries(PALETTE)) {
    const hex = light.toUpperCase();
    if (!(hex in HEX_TO_TOKEN)) HEX_TO_TOKEN[hex] = k; // 1re définition gagne (bg avant panel / card)
}

/**
 * Couleur + transparence, compatible avec les couleurs nommées :
 * alpha('#1E2447', '20') → '#1E244720' ; alpha('var(--df-text)', '20') → color-mix(…, 12.5 %).
 */
export const alpha = (color, hexAlpha) => {
    const c = String(color || '');
    if (!c.startsWith('var(')) return c + hexAlpha;
    const pct = Math.round((parseInt(hexAlpha, 16) / 255) * 1000) / 10;
    return `color-mix(in srgb, ${c} ${pct}%, transparent)`;
};
