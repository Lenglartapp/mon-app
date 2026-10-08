// GET /api/odoo/quote-data?action=catalog|opportunities|partners[&q=texte]
// Données Odoo nécessaires au module « Créer le devis Odoo » depuis une minute.
// LECTURE SEULE : aucun write ici (la création du devis viendra dans un endpoint dédié).
// Un seul fichier pour plusieurs actions → ménage le quota de fonctions Vercel (plan Hobby).

import { searchRead } from '../_odooClient.js';
import { quoteWriteStatus } from './quote-create.js';

// Articles vendables qui ne sont pas des articles de devis (TVA, acompte, loyer…).
const PARASITES = /^(tva|acompte|loyer|facture oxyg|prise$|\[fact\]|ajustement contrat|service on timesheet|remise|bonus)|\(erreur/i;

async function catalog() {
  const [products, teams, tags, users, analytic, distrib, xmlIds] = await Promise.all([
    searchRead('product.product', [['sale_ok', '=', true]], ['id', 'name', 'uom_id', 'categ_id', 'all_product_tag_ids']),
    searchRead('crm.team', [], ['id', 'name']),
    searchRead('crm.tag', [], ['id', 'name']),
    searchRead('res.users', [['share', '=', false]], ['id', 'name']),
    // Étiquettes analytiques : c'est l'article qui décide de la case du contrôle de gestion
    // Odoo (modèles de distribution analytique, 1 étiquette à 100 % par article).
    searchRead('account.analytic.account', [], ['id', 'name']),
    searchRead('account.analytic.distribution.model', [['product_id', '!=', false]], ['product_id', 'analytic_distribution']),
    // Articles créés par le module ERP (data/product_matiere.xml) : leurs ids diffèrent d'une base
    // à l'autre (préprod / prod) → on les résout par identifiant XML, jamais en dur.
    searchRead('ir.model.data', [['module', '=', 'lenglart_controle_gestion'], ['model', '=', 'product.product']], ['name', 'res_id']),
  ]);
  const xmlIdOf = new Map(xmlIds.map((x) => [x.res_id, x.name]));
  // Étiquettes d'ARTICLE (product.tag) : c'est avec elles que le contrôle de gestion Odoo
  // (module lenglart_controle_gestion) classe chaque coût — pas avec l'analytique.
  const tagIds = [...new Set(products.flatMap((p) => p.all_product_tag_ids || []))];
  const productTags = tagIds.length ? await searchRead('product.tag', [['id', 'in', tagIds]], ['id', 'name']) : [];
  const productTagName = new Map(productTags.map((t) => [t.id, t.name]));
  const accountName = new Map(analytic.map((a) => [String(a.id), (a.name || '').trim()]));
  const tagOf = new Map();
  for (const d of distrib) {
    const names = Object.keys(d.analytic_distribution || {})
      .flatMap((k) => k.split(','))
      .map((id) => accountName.get(id))
      .filter(Boolean);
    if (names.length && !tagOf.has(d.product_id[0])) tagOf.set(d.product_id[0], names[0]);
  }
  return {
    products: products
      .filter((p) => !PARASITES.test((p.name || '').trim()))
      .map((p) => ({
        id: p.id,
        name: p.name,
        uom: p.uom_id ? p.uom_id[1] : '',
        categ: p.categ_id ? p.categ_id[1] : '',
        tag: tagOf.get(p.id) || null,
        cgTags: (p.all_product_tag_ids || []).map((id) => productTagName.get(id)).filter(Boolean),
        xmlId: xmlIdOf.get(p.id) || null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    teams,
    tags,
    users,
    write: quoteWriteStatus(),
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
