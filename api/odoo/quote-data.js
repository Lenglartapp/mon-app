// GET /api/odoo/quote-data?action=catalog|opportunities|partners[&q=texte]
// Données Odoo nécessaires au module « Créer le devis Odoo » depuis une minute.
// LECTURE SEULE : aucun write ici (la création du devis viendra dans un endpoint dédié).
// Un seul fichier pour plusieurs actions → ménage le quota de fonctions Vercel (plan Hobby).

import { searchRead } from '../_odooClient.js';

// Articles vendables qui ne sont pas des articles de devis (TVA, acompte, loyer…).
const PARASITES = /^(tva|acompte|loyer|facture oxyg|prise$|\[fact\]|ajustement contrat|service on timesheet|remise|frais de port|bonus)/i;

async function catalog() {
  const [products, teams, tags, users] = await Promise.all([
    searchRead('product.product', [['sale_ok', '=', true]], ['id', 'name', 'uom_id', 'categ_id']),
    searchRead('crm.team', [], ['id', 'name']),
    searchRead('crm.tag', [], ['id', 'name']),
    searchRead('res.users', [['share', '=', false]], ['id', 'name']),
  ]);
  return {
    products: products
      .filter((p) => !PARASITES.test((p.name || '').trim()))
      .map((p) => ({
        id: p.id,
        name: p.name,
        uom: p.uom_id ? p.uom_id[1] : '',
        categ: p.categ_id ? p.categ_id[1] : '',
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    teams,
    tags,
    users,
  };
}

async function opportunities(q) {
  const domain = [['type', '=', 'opportunity']];
  if (q) domain.push('|', ['name', 'ilike', q], ['partner_id', 'ilike', q]);
  const rows = await searchRead(
    'crm.lead',
    domain,
    ['id', 'name', 'partner_id', 'team_id', 'user_id', 'stage_id', 'tag_ids', 'order_ids', 'expected_revenue', 'create_date'],
    { limit: 20, order: 'create_date desc' }
  );
  return rows.map((o) => ({
    id: o.id,
    name: o.name,
    partner: o.partner_id ? { id: o.partner_id[0], name: o.partner_id[1] } : null,
    team: o.team_id ? o.team_id[1] : null,
    teamId: o.team_id ? o.team_id[0] : null,
    user: o.user_id ? o.user_id[1] : null,
    stage: o.stage_id ? o.stage_id[1] : null,
    tagIds: o.tag_ids || [],
    nbQuotes: (o.order_ids || []).length,
    revenue: o.expected_revenue,
    createdAt: o.create_date,
  }));
}

async function partners(q) {
  if (!q || q.trim().length < 2) return [];
  const rows = await searchRead(
    'res.partner',
    ['|', ['name', 'ilike', q], ['parent_id', 'ilike', q]],
    ['id', 'name', 'parent_id', 'is_company', 'email', 'city'],
    { limit: 25, order: 'is_company desc, name' }
  );
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    company: p.parent_id ? p.parent_id[1] : null,
    isCompany: p.is_company,
    email: p.email || null,
    city: p.city || null,
  }));
}

export default async function handler(req, res) {
  try {
    const action = req.query?.action;
    const q = (req.query?.q || '').trim();
    let data;
    if (action === 'catalog') data = await catalog();
    else if (action === 'opportunities') data = await opportunities(q);
    else if (action === 'partners') data = await partners(q);
    else {
      res.status(400).json({ ok: false, error: 'Paramètre "action" invalide (catalog | opportunities | partners).' });
      return;
    }
    res.status(200).json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
