// src/lib/utils/catalogRename.js
// -----------------------------------------------------------------------------
// Le lien entre un article de catalogue et une ligne se fait PAR LE NOM :
// `fillFromCatalog` (recomputeRow) retrouve l'article via `item.name === row[champ]`,
// puis réécrit la laize, les raccords et les prix sur la ligne.
//
// Conséquence : renommer un article SANS toucher aux lignes coupe le lien en
// silence. Les lignes gardent l'ancien nom, ne correspondent plus à rien, et
// conservent indéfiniment leur ancienne laize — donc un métrage faux, sans le
// moindre message. Corriger une simple coquille suffit à déclencher ça, et côté
// chiffrage le nom est recalculé automatiquement depuis
// Fournisseur + Référence + Coloris : modifier le fournisseur renomme l'article.
//
// Ce helper propage le renommage sur les lignes pour que le lien tienne.
// -----------------------------------------------------------------------------

/** Tous les champs de ligne qui portent le NOM d'un article de catalogue. */
export const CATALOG_REF_FIELDS = [
  // tissus
  'tissu_deco1', 'tissu_deco2', 'tissu_1', 'tissu_2', 'tissu',
  'doublure', 'interdoublure', 'inter_doublure',
  'toile_finition_1', 'molleton', 'molleton_mousse',
  // passementerie
  'passementerie', 'passementerie1', 'passementerie2',
  'passementerie_1', 'passementerie_2', 'embrasse',
  // mécanismes et accessoires
  'mecanisme', 'mecanisme_bis', 'mecanisme_store', 'mecanisme_fourniture',
  'modele_mecanisme', 'moteur', 'baguette_1', 'baguette_2',
];

/**
 * Renomme un article dans toutes les lignes qui le référencent.
 * @returns {{rows: Array, changed: number}} lignes (nouvelle référence si modifiée) + nb de champs touchés
 */
export const renameCatalogRefs = (rows, oldName, newName) => {
  const from = String(oldName ?? '').trim();
  const to = String(newName ?? '').trim();
  if (!from || !to || from === to) return { rows, changed: 0 };

  let changed = 0;
  const next = (rows || []).map(row => {
    if (!row || typeof row !== 'object') return row;
    let touched = false;
    const copy = { ...row };
    for (const field of CATALOG_REF_FIELDS) {
      if (String(copy[field] ?? '').trim() === from) {
        copy[field] = to;
        touched = true;
        changed++;
      }
    }
    return touched ? copy : row;
  });

  return { rows: changed > 0 ? next : rows, changed };
};

/**
 * Détecte les articles renommés entre deux versions d'un catalogue (appariés par id)
 * et propage chaque renommage sur les lignes.
 */
export const applyCatalogRenames = (rows, oldCatalog, newCatalog) => {
  const before = new Map((oldCatalog || []).filter(a => a?.id).map(a => [a.id, a]));
  let out = rows, total = 0;
  for (const item of (newCatalog || [])) {
    const prev = item?.id ? before.get(item.id) : null;
    if (!prev || prev.name === item.name) continue;
    const { rows: r, changed } = renameCatalogRefs(out, prev.name, item.name);
    out = r; total += changed;
  }
  return { rows: out, changed: total };
};
