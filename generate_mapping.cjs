const fs = require('fs');
const path = require('path');

const chiffrageDir = path.join(__dirname, 'src/lib/schemas/chiffrage');
const prodDir = path.join(__dirname, 'src/lib/schemas/production');

const files = [
    'rideaux.js',
    'stores_bateaux.js',
    'stores_classiques.js',
    'coussins.js',
    'plaid.js',
    'cache_sommier.js',
    'mobilier.js',
    'tenture_murale.js'
];

function extractKeys(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8');

    // More robust regex to match objects with a key property
    const regex = /{[^{}]*key:\s*['"]([^'"]+)['"][^{}]*}/g;
    const matches = [...content.matchAll(regex)];

    return matches.map(match => {
        const block = match[0];
        const keyMatch = block.match(/key:\s*['"]([^'"]+)['"]/);
        const labelMatch = block.match(/label:\s*['"]([^'"]+)['"]/);
        return {
            key: keyMatch ? keyMatch[1] : 'unknown',
            label: labelMatch ? labelMatch[1] : 'Inconnu'
        };
    });
}

// Ensure unique keys per schema to clean up duplicates from sub-schemas
function getUniqueFields(fields) {
    const map = new Map();
    fields.forEach(f => {
        if (!map.has(f.key) && f.key !== 'unknown') {
            map.set(f.key, f);
        }
    });
    return Array.from(map.values());
}

let markdown = `# Mapping Complet : Chiffrage ➡️ Production\n\nCe document détaille, pour chaque tableau de Production, l'origine exacte de la donnée. Si un champ porte le symbole ➡️, c'est qu'il est **automatiquement pré-rempli** avec la valeur saisie lors du devis. Sinon, c'est un champ exclusif à remplir ou calculé dans l'atelier.\n\n`;

files.forEach(file => {
    const name = file.replace('.js', '').replace(/_/g, ' ').toUpperCase();
    markdown += `## 📋 ${name}\n\n`;

    const chiffrageFieldsRaw = extractKeys(path.join(chiffrageDir, file));
    const prodFieldsRaw = extractKeys(path.join(prodDir, file));

    const chiffrageFields = getUniqueFields(chiffrageFieldsRaw);
    const prodFields = getUniqueFields(prodFieldsRaw);

    const chiffrageKeys = new Set(chiffrageFields.map(f => f.key));

    prodFields.forEach(prodField => {
        if (chiffrageKeys.has(prodField.key)) {
            markdown += `*   **${prodField.label}** (\`${prodField.key}\`) : ➡️ **Importé depuis le Chiffrage** (Valeur copiée automatiquement)\n`;
        } else {
            markdown += `*   **${prodField.label}** (\`${prodField.key}\`) : ✍️/⚡ **Exclusif Production** (Champ à saisir ou calculé sur la page Atelier)\n`;
        }
    });

    markdown += `\n---\n\n`;
});

fs.writeFileSync(path.join(__dirname, 'mapping_report.md'), markdown);
console.log('Report generated at mapping_report.md');
