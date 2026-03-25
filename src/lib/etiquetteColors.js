// src/lib/etiquetteColors.js
// Palette couleurs pour les bandeaux d'étiquettes + utilitaires de contraste

export const ETIQUETTE_COLOR_PALETTE = [
  { id: "bleu_ciel",     hex: "#E6E6FF", label: "Bleu ciel" },
  { id: "majorelle",     hex: "#1B3269", label: "Bleu Majorelle" },
  { id: "coton",         hex: "#FAF5EE", label: "Coton" },
  { id: "cuivre",        hex: "#BB7051", label: "Terre de Cuivre" },
  { id: "noir",          hex: "#191919", label: "Noir" },
  { id: "foret",         hex: "#2E6F40", label: "Vert forêt" },
  { id: "terracotta",    hex: "#9E3A26", label: "Terracotta" },
  { id: "sienne",        hex: "#701F0E", label: "Sienne" },
  { id: "sauge",         hex: "#BBB791", label: "Sauge" },
  { id: "rose_pastel",   hex: "#FFC5D3", label: "Rose pastel" },
  { id: "mandarine",     hex: "#FFA800", label: "Mandarine" },
];

export const DEFAULT_HEADER_COLOR = "#191919";

/**
 * Renvoie #FFFFFF (blanc) ou #111827 (noir) selon la luminance du fond.
 * Seuil 0.45 : si le fond est clair → texte noir, sinon → texte blanc.
 */
export function getContrastColor(hex) {
  if (!hex || !hex.startsWith("#")) return "#FFFFFF";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.45 ? "#111827" : "#FFFFFF";
}

/**
 * Retourne un objet de styles dérivés pour le header à partir de la couleur de fond.
 * Le texte est strictement blanc ou noir — aucune couleur tierce.
 */
export function getHeaderStyles(bgColor = DEFAULT_HEADER_COLOR) {
  const bg = bgColor || DEFAULT_HEADER_COLOR;
  const text = getContrastColor(bg);
  const isDark = text === "#FFFFFF";
  return {
    bg,
    textMain: text,
    textMuted: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)",
    badgeBg:   isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.10)",
    badgeText: text,
  };
}
