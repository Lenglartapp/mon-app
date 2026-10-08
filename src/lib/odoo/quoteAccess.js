// Accès au module « Devis Odoo » pendant la phase de test : Aristide et Audry uniquement
// (décision du 2026-10-08, avant la présentation à l'équipe). Partagé entre l'écran (bouton,
// pastille) et le serveur (api/odoo/quote-*), qui revérifie l'utilisateur à chaque appel.
// Pour ouvrir à tous les commerciaux : remplacer ce contrôle par un contrôle de rôle.

export const ODOO_QUOTE_USER_IDS = [
  'efeda64d-2476-48d2-9242-ea153471659c', // Aristide Lenglart
  '845a2459-dbe9-424d-af3f-10ae558e7307', // Audry Papin
];

export const canUseOdooQuote = (userId) => ODOO_QUOTE_USER_IDS.includes(String(userId || ''));
