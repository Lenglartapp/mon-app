// src/lib/etiquettes/denominationContext.js
// Pièces présentes dans plusieurs zones du dossier (cf. denomination.js), fournies par la
// section Étiquettes à tous les bandeaux (écran et portails d'impression).
import { createContext } from 'react';

export const MultiZonePiecesContext = createContext(new Set());
