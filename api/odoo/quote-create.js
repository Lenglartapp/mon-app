// POST /api/odoo/quote-create  { payload, dryRun }
// Envoie l'aperçu de devis construit par Droitfil (src/lib/odoo/quoteBuilder.js) à la méthode
// Odoo `sale.order.droitfil_upsert_devis(payload, dry_run)` (module lenglart_controle_gestion,
// développé côté ERP). Odoo crée ou met à jour le devis BROUILLON lié à la minute
// (droitfil_minute_id) ; dry_run = tout calculé puis annulé (rien n'est créé).
//
// ⚠️ GARDE-FOU tant que le module est en test : refusé si Droitfil pointe sur la PRODUCTION
// Odoo, ou si ODOO_QUOTE_WRITE n'est pas à 1. La simulation (dry_run) suit la même règle.

import { execute } from '../_odooClient.js';

const PROD_HOSTS = ['lenglart-erp-lenglart.odoo.com'];

export function quoteWriteStatus() {
  const url = process.env.ODOO_URL || '';
  const isProd = PROD_HOSTS.some((h) => url.includes(h));
  return {
    enabled: process.env.ODOO_QUOTE_WRITE === '1' && !isProd && !!url,
    isProd,
    target: url.replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'POST attendu.' });
      return;
    }
    const status = quoteWriteStatus();
    if (!status.enabled) {
      res.status(403).json({
        ok: false,
        error: status.isProd
          ? 'Bloqué : Droitfil est branché sur la PRODUCTION Odoo (module en test, préproduction uniquement).'
          : "Création de devis désactivée (ODOO_QUOTE_WRITE n'est pas à 1).",
      });
      return;
    }
    const { payload, dryRun = true } = req.body || {};
    if (!payload?.minute_id) throw new Error('Payload invalide (minute_id manquant).');
    const result = await execute('sale.order', 'droitfil_upsert_devis', [payload], { dry_run: !!dryRun });
    res.status(200).json({ ok: true, target: status.target, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
