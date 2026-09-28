// src/lib/dbErrors.js
// -----------------------------------------------------------------------------
// Classement des erreurs Supabase/PostgREST pour décider s'il faut RÉESSAYER.
//
//  • PERMANENTE : la base a reçu la requête et la refuse pour une raison qui ne
//    changera pas en réessayant (donnée invalide, contrainte, colonne inconnue,
//    droits). La rejouer en boucle ne fait que marteler la base.
//      - classes Postgres 22xxx (donnée invalide), 23xxx (contrainte), 42xxx (syntaxe/droits)
//      - PGRST1xx / PGRST2xx (requête mal formée / schéma)
//  • TRANSITOIRE : tout le reste (réseau coupé, délai dépassé, base saturée 57014,
//    manque de connexions, 5xx…) → on réessaie plus tard, avec un délai croissant.
// -----------------------------------------------------------------------------

export const isPermanentDbError = (error) => {
  if (!error) return false;
  const code = String(error.code || '');
  return /^(22|23|42)/.test(code) || /^PGRST[12]/.test(code);
};

export const isTransientDbError = (error) => !!error && !isPermanentDbError(error);

/** Délai de reprise exponentiel : 5 s, 10 s, 20 s… plafonné à 5 min. */
export const backoffDelay = (failures) => Math.min(5_000 * 2 ** Math.max(0, failures - 1), 300_000);
