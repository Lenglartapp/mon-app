// src/lib/rowsMerge.js
// -----------------------------------------------------------------------------
// Fusion « à trois » des lignes d'un projet (`rows`) au retour du réseau.
//
//   base   = dernière version reçue du serveur par CE téléphone
//   local  = version modifiée sur le téléphone (hors ligne)
//   server = version actuelle en base (le bureau a pu la modifier entre-temps)
//
// On ne rejoue que ce que le téléphone a réellement changé par rapport à `base`,
// champ par champ ; tout le reste vient du serveur. Les listes d'objets avec `id`
// (commentaires, photos…) sont fusionnées élément par élément : un commentaire
// ajouté au bureau et une photo ajoutée sur chantier sont tous deux gardés.
// Sans base fiable (lignes sans id…), on renvoie `null` : l'appelant garde alors
// l'ancien comportement (écriture de la version locale).
// -----------------------------------------------------------------------------

// Comparaison profonde indépendante de l'ordre des clés (Postgres JSONB les réordonne).
const stable = (v) => {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
};
const same = (a, b) => stable(a) === stable(b);

const hasIds = (arr) => Array.isArray(arr) && arr.every((x) => x && typeof x === 'object' && x.id != null);
const byId = (arr) => new Map(arr.map((x) => [String(x.id), x]));

/**
 * Fusion de deux listes d'objets à `id` (lignes, commentaires, photos).
 * @param {(b, l, s) => any} mergeItem fusion d'un élément présent des deux côtés
 */
function mergeById(base, local, server, mergeItem) {
  const B = byId(base), L = byId(local), S = byId(server);
  const out = [];
  const placed = new Set();

  for (const s of server) {
    const id = String(s.id);
    const l = L.get(id), b = B.get(id);
    if (!l) {
      // Absent localement : supprimé sur le téléphone (s'il était dans la base),
      // sinon ajouté au bureau → on le garde.
      if (!b) out.push(s);
    } else {
      out.push(mergeItem(b, l, s));
    }
    placed.add(id);
  }

  // Éléments locaux absents du serveur : ajoutés sur le téléphone, ou supprimés au
  // bureau. Une suppression au bureau l'emporte, sauf si le téléphone a modifié
  // l'élément entre-temps (on ne jette jamais une saisie de chantier).
  local.forEach((l, idx) => {
    const id = String(l.id);
    if (placed.has(id)) return;
    const b = B.get(id);
    if (b && same(b, l)) return;
    // Placé juste après son voisin local précédent déjà présent.
    let at = 0;
    for (let k = idx - 1; k >= 0; k--) {
      const prevId = String(local[k].id);
      const pos = out.findIndex((x) => String(x.id) === prevId);
      if (pos >= 0) { at = pos + 1; break; }
    }
    out.splice(at, 0, l);
    placed.add(id);
  });
  return out;
}

/** Fusion d'une ligne, champ par champ. */
export function mergeRow(b, l, s) {
  if (!b) return { ...s, ...l };
  const out = {};
  const keys = new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(s)]);
  for (const k of keys) {
    const bv = b[k], lv = l[k], sv = s[k];
    let v;
    if (same(lv, bv)) v = sv;                      // pas touché sur le téléphone → serveur
    else if (same(sv, bv)) v = lv;                 // pas touché au bureau → téléphone
    else if (hasIds(bv || []) && hasIds(lv || []) && hasIds(sv || [])) {
      v = mergeById(bv || [], lv || [], sv || [], (eb, el, es) => (same(el, eb) ? es : el));
    } else v = lv;                                 // modifié des deux côtés → la saisie terrain gagne
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * @returns {object[]|null} lignes fusionnées, ou null si la fusion n'est pas sûre.
 */
export function mergeRows(base, local, server) {
  if (!Array.isArray(base) || !Array.isArray(local) || !Array.isArray(server)) return null;
  if (!hasIds(base) || !hasIds(local) || !hasIds(server)) return null;
  return mergeById(base, local, server, mergeRow);
}
