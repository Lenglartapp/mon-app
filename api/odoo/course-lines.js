// GET /api/odoo/course-lines?odooProjectId=NNN
// Lit la « liste de courses » (project.course.line) d'un projet Odoo. Lecture seule.

import { searchRead } from '../_odooClient.js';

const FIELDS = [
  'id', 'sequence', 'reference', 'coloris', 'laize', 'quantite', 'unite_id',
  'fournisseur_id', 'prix_indicatif', 'purchase_order_id', 'statut',
  'date_livraison_estimee', 'date_reception', 'write_date',
];

export default async function handler(req, res) {
  try {
    const odooProjectId = Number(req.query?.odooProjectId);
    if (!odooProjectId) {
      res.status(400).json({ ok: false, error: 'Paramètre "odooProjectId" requis.' });
      return;
    }
    const lines = await searchRead(
      'project.course.line',
      [['project_id', '=', odooProjectId]],
      FIELDS,
      { order: 'sequence' }
    );
    res.status(200).json({ ok: true, lines });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
