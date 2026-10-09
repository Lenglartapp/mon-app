// GET /api/odoo/course-lines?odooProjectId=NNN
// Lit la « liste de courses » (project.course.line) d'un projet Odoo. Lecture seule.

import { searchRead, execute } from '../_odooClient.js';

export const COURSE_FIELDS = [
  'id', 'sequence', 'reference', 'coloris', 'laize', 'quantite', 'unite_id',
  'fournisseur_id', 'prix_indicatif', 'purchase_order_id', 'statut', 'type_produit',
  'date_livraison_estimee', 'date_reception', 'write_date',
  // Ajoutés côté Odoo le 2026-10-09 (quantités du dossier, dans l'unité d'achat).
  'quantite_commandee', 'quantite_recue', 'purchase_line_id', 'purchase_uom_id',
];

/** Réceptions réelles (une entrée par mouvement validé) des lignes de courses de ces projets Odoo.
 *  null si la méthode échoue : la synchro retombe alors sur une entrée unique, comme avant. */
export async function readReceptions(odooProjectIds) {
  try {
    const r = await execute('project.course.line', 'droitfil_receptions', [odooProjectIds.map(Number)]);
    return Array.isArray(r) ? r : null;
  } catch (e) {
    console.warn('[course-lines] droitfil_receptions indisponible :', e.message);
    return null;
  }
}
const FIELDS = COURSE_FIELDS;

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
    const receptions = await readReceptions([odooProjectId]);
    res.status(200).json({ ok: true, lines, receptions });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
