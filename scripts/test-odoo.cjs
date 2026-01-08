const xmlrpc = require('xmlrpc');
require('dotenv').config();

const url = process.env.ODOO_URL;
const db = process.env.ODOO_DB;
const username = process.env.ODOO_USER;
const password = process.env.ODOO_KEY;

console.log('--- Configuration Odoo ---');
console.log('URL:', url);
console.log('DB:', db);
console.log('User:', username);

if (!url || !db || !username || !password) {
    console.error('❌ ERREUR: Variables manquantes dans .env');
    process.exit(1);
}

// Nettoyage URL
const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
const common = xmlrpc.createSecureClient(baseUrl + '/xmlrpc/2/common');

console.log(`📡 Connexion à ${baseUrl}...`);

common.methodCall('authenticate', [db, username, password, {}], (error, uid) => {
    if (error) {
        console.error('❌ Erreur technique (Réseau/Serveur):', error.message);
        console.error("Détails:", error);
        return;
    }
    if (!uid) {
        console.error('❌ Echec authentification.');
        console.error('Causes possibles :');
        console.error('1. Le nom de la DB est incorrect (Code "FATAL: database does not exist" côté serveur)');
        console.error('2. Email ou Clé API invalide');
        return;
    }

    console.log(`✅ SUCCÈS ! Connexion établie avec la base "${db}".`);
    console.log(`👤 UID: ${uid}`);
    console.log("Vous êtes prêt pour la suite !");
});
