// src/lib/schemaDrift.js
// -----------------------------------------------------------------------------
// Détection et RÉPARATION des « dérives de schéma » : une colonne envoyée à
// Supabase qui n'existe pas (côté base) — ex. `pinnedIds`. PostgREST rejette
// alors TOUTE la requête avec un 400 (code PGRST204 / 42703). Sans traitement,
// une seule colonne fantôme fait échouer la sauvegarde ENTIÈRE — y compris la
// colonne `rows` — et provoque une perte de données (le blob n'atteint jamais
// la base). Ces helpers permettent de retirer la colonne fautive et de rejouer
// l'écriture pour sauver le reste.
// -----------------------------------------------------------------------------

/** true si l'erreur Supabase est une colonne absente (et NON un échec réseau). */
export const isSchemaDriftError = (error) => {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204') return true; // undefined column / schema cache
  const msg = String(error.message || '').toLowerCase();
  // Un échec réseau ressemble à "failed to fetch" / "networkerror" / "load failed" : on l'EXCLUT.
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed')) return false;
  return /does not exist|could not find|schema cache|column/.test(msg);
};

/**
 * Extrait le nom de la colonne fantôme depuis le message d'erreur.
 *  - PGRST204 : "Could not find the 'pinnedIds' column of 'projects' ..."
 *  - 42703    : `column "pinnedIds" of relation "projects" does not exist`
 * Retourne null si on n'arrive pas à isoler le nom (on ne bouclera alors pas).
 */
export const extractMissingColumn = (error) => {
  const msg = String(error?.message || '');
  const m = msg.match(/'([^']+)' column/) || msg.match(/column ["']([^"']+)["']/);
  return m ? m[1] : null;
};

/**
 * UPDATE Supabase qui, si la base rejette une colonne inexistante, la retire et
 * rejoue — jusqu'à ce que l'écriture passe (ou qu'il ne reste plus rien à écrire).
 * @returns {Promise<{error: any, dropped: string[], body: object}>}
 *   - error : null si l'écriture a fini par passer, sinon l'erreur restante
 *   - dropped : colonnes fantômes retirées
 *   - body : payload réellement retenu (nettoyé des colonnes fantômes)
 */
export const updateStrippingPhantomColumns = async (supabase, table, id, payload) => {
  const dropped = [];
  const body = { ...payload };
  let guard = 0;
  let { error } = await supabase.from(table).update(body).eq('id', id);
  while (error && isSchemaDriftError(error) && guard < 8) {
    const col = extractMissingColumn(error);
    if (!col || !(col in body)) break; // colonne non identifiable → on ne boucle pas indéfiniment
    delete body[col];
    dropped.push(col);
    guard++;
    if (Object.keys(body).length === 0) { error = null; break; } // plus rien à écrire → succès
    ({ error } = await supabase.from(table).update(body).eq('id', id));
  }
  return { error, dropped, body };
};
