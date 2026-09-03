// src/lib/utils/schemaDefaults.js
// -----------------------------------------------------------------------------
// Les schémas déclarent `defaultValue` sur certaines colonnes depuis longtemps,
// mais RIEN ne le lisait : c'était du métadonnée morte. Ce helper l'applique à la
// création d'une ligne, pour que les champs concernés arrivent pré-remplis.
// Ne remplit que les valeurs ABSENTES (undefined / null / "") : une valeur déjà
// posée par l'appelant n'est jamais écrasée.
// -----------------------------------------------------------------------------
export const applySchemaDefaults = (row, schema) => {
  const out = { ...row };
  (schema || []).forEach(col => {
    const key = col?.key || col?.field;
    if (!key || col.defaultValue === undefined) return;
    const cur = out[key];
    if (cur === undefined || cur === null || cur === '') out[key] = col.defaultValue;
  });
  return out;
};
