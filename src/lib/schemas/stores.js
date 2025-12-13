
// src/lib/schemas/stores.js
// Schéma spécifique pour le module "Stores"

import { CHIFFRAGE_SCHEMA } from "./chiffrage";

// Clone base schema to modify it
const BASE = JSON.parse(JSON.stringify(CHIFFRAGE_SCHEMA));

export const STORES_SCHEMA = BASE.map(col => {
    // 1. MODIFIER LA LISTE DÉROULANTE "PRODUIT" (STORES ONLY)
    if (col.key === 'produit') {
        return {
            ...col,
            options: [
                'Store Bateau',
                'Store Enrouleur',
                'Store Vénitien',
                'Store Californien',
                'Store Velum',
                'Canishade',
                'Autre'
            ]
        };
    }

    // 2. MODIFIER "TYPE MÉCANISME" (STORES ONLY)
    if (col.key === 'type_mecanisme') {
        return {
            ...col,
            options: [
                'Store Bateau',
                'Store Enrouleur',
                'Store Vénitien',
                'Store Californien',
                'Store Velum',
                'Canishade'
            ]
        };
    }

    // 3. CHAMP "TYPE DE CONFECTION" : TEXTE LIBRE
    if (col.key === 'type_confection') {
        const { options, ...rest } = col;
        return {
            ...rest,
            type: 'text'
        };
    }

    // 4. LOGIQUE DE CALCUL (MÉTRAGES) : Désactiver formules ML
    const manualMLFields = [
        'ml_tissu_deco1', 'ml_tissu_deco2',
        'ml_doublure', 'ml_inter',
        'ml_passementerie1', 'ml_passementerie2'
    ];

    if (manualMLFields.includes(col.key)) {
        return {
            ...col,
            type: 'number',
            formula: undefined, // Remove formula
            editable: true
        };
    }

    return col;
});
