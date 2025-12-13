
// src/lib/schemas/decors.js
// Schéma spécifique pour le module "Décors de lit" et Tapissier

import { CHIFFRAGE_SCHEMA } from "./chiffrage";

// Clone base schema to modify it
// Deep copy to avoid mutating original
const BASE = JSON.parse(JSON.stringify(CHIFFRAGE_SCHEMA));

export const DECORS_SCHEMA = BASE.map(col => {
    // 1. MODIFIER LA LISTE DÉROULANTE "PRODUIT"
    if (col.key === 'produit') {
        return {
            ...col,
            options: ['Cache-Sommier', 'Coussins', 'Plaid', 'Tête de Lit', 'Tenture Murale', 'Autre']
        };
    }

    // 2. CHAMP "TYPE DE CONFECTION" : TEXTE LIBRE
    if (col.key === 'type_confection') {
        const { options, ...rest } = col;
        return {
            ...rest,
            type: 'text' // Was 'select'
        };
    }

    // 3. LOGIQUE DE CALCUL (MÉTRAGES) : Désactiver formules ML
    // Liste des champs ML à transformer en INPUT NUMBER
    const manualMLFields = ['ml_tissu_deco1', 'ml_tissu_deco2', 'ml_passementerie1', 'ml_passementerie2'];

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
