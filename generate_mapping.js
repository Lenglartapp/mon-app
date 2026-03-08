import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { RIDEAUX_SCHEMA } from './src/lib/schemas/chiffrage/rideaux.js';
import { RIDEAUX_PROD_SCHEMA } from './src/lib/schemas/production/rideaux.js';

import { STORES_BATEAUX_SCHEMA } from './src/lib/schemas/chiffrage/stores_bateaux.js';
import { STORES_BATEAUX_PROD_SCHEMA } from './src/lib/schemas/production/stores_bateaux.js';

import { STORES_CLASSIQUES_SCHEMA } from './src/lib/schemas/chiffrage/stores_classiques.js';
import { STORES_PROD_SCHEMA } from './src/lib/schemas/production/stores_classiques.js';

import { COUSSINS_SCHEMA } from './src/lib/schemas/chiffrage/coussins.js';
import { COUSSINS_PROD_SCHEMA } from './src/lib/schemas/production/coussins.js';

import { PLAID_SCHEMA } from './src/lib/schemas/chiffrage/plaid.js';
import { PLAID_PROD_SCHEMA } from './src/lib/schemas/production/plaid.js';

import { CACHE_SOMMIER_SCHEMA } from './src/lib/schemas/chiffrage/cache_sommier.js';
import { CACHE_SOMMIER_PROD_SCHEMA } from './src/lib/schemas/production/cache_sommier.js';

import { MOBILIER_SCHEMA } from './src/lib/schemas/chiffrage/mobilier.js';
import { MOBILIER_PROD_SCHEMA } from './src/lib/schemas/production/mobilier.js';

import { TENTURE_MURALE_SCHEMA } from './src/lib/schemas/chiffrage/tenture_murale.js';
import { TENTURE_MURALE_PROD_SCHEMA } from './src/lib/schemas/production/tenture_murale.js';

const MAPPINGS = [
    { name: 'RIDEAUX', chiffrage: RIDEAUX_SCHEMA, prod: RIDEAUX_PROD_SCHEMA },
    { name: 'STORES BATEAUX', chiffrage: STORES_BATEAUX_SCHEMA, prod: STORES_BATEAUX_PROD_SCHEMA },
    { name: 'STORES CLASSIQUES', chiffrage: STORES_CLASSIQUES_SCHEMA, prod: STORES_PROD_SCHEMA },
    { name: 'COUSSINS', chiffrage: COUSSINS_SCHEMA, prod: COUSSINS_PROD_SCHEMA },
    { name: 'PLAID', chiffrage: PLAID_SCHEMA, prod: PLAID_PROD_SCHEMA },
    { name: 'CACHE SOMMIER', chiffrage: CACHE_SOMMIER_SCHEMA, prod: CACHE_SOMMIER_PROD_SCHEMA },
    { name: 'MOBILIER', chiffrage: MOBILIER_SCHEMA, prod: MOBILIER_PROD_SCHEMA },
    { name: 'TENTURE MURALE', chiffrage: TENTURE_MURALE_SCHEMA, prod: TENTURE_MURALE_PROD_SCHEMA },
];

let markdown = `# Mapping Complet : Chiffrage ➡️ Production\n\nCe document détaille, pour chaque tableau de Production, l'origine exacte de la donnée. Si un champ porte le symbole ➡️, c'est qu'il est **automatiquement pré-rempli** avec la valeur saisie lors du devis. Sinon, c'est un champ exclusif à remplir ou calculé dans l'atelier.\n\n`;

for (const mapping of MAPPINGS) {
    markdown += `## 📋 ${mapping.name}\n\n`;

    const chiffrageKeys = new Set();

    if (mapping.chiffrage) {
        mapping.chiffrage.forEach(f => {
            if (f.key) chiffrageKeys.add(f.key);
            if (f.field) chiffrageKeys.add(f.field);
        });
    }

    if (mapping.prod) {
        mapping.prod.forEach(prodField => {
            const key = prodField.key || prodField.field || 'unknown';
            const label = prodField.label || prodField.headerName || key;

            if (chiffrageKeys.has(key)) {
                markdown += `*   **${label}** (\`${key}\`) : ➡️ **Importé depuis le Chiffrage** (Valeur copiée automatiquement)\n`;
            } else {
                markdown += `*   **${label}** (\`${key}\`) : ✍️/⚡ **Exclusif Production** (Champ à saisir ou calculé en Atelier)\n`;
            }
        });
    }

    markdown += `\n---\n\n`;
}

fs.writeFileSync(path.join(__dirname, 'mapping_report.md'), markdown);
console.log('Report generated at mapping_report.md');
