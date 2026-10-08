// Enregistrement des réglages du module « Devis Odoo » dans Droitfil (et plus seulement dans le
// navigateur) :
//   • communs à l'équipe → app_config['odoo_quote_profile'] : recettes (ordre des lignes, articles)
//     et rattachement des autres dépenses ;
//   • propres à la minute → minutes.odoo_quote : { settings, texts, link }
//     (migration db/migrations/2026-10-08_minutes_odoo_quote.sql).
// Écriture ciblée sur la seule colonne odoo_quote (pas de passage par updateMinute : elle ne
// doit jamais écraser lines / settings d'une sauvegarde concurrente).

import { supabase } from '../supabaseClient';
import { getConfig, setConfig } from '../appConfig';

export const SHARED_KEY = 'odoo_quote_profile';
// Parties du réglage communes à l'équipe ; le reste est propre à la minute.
export const SHARED_FIELDS = ['recipes', 'charges'];
export const MINUTE_FIELDS = ['groupBy', 'subGroupBy', 'logistique', 'overrides'];

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj?.[k] !== undefined).map((k) => [k, obj[k]]));

export async function loadSharedProfile() {
  const raw = await getConfig(SHARED_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function saveSharedProfile(config) {
  return setConfig(SHARED_KEY, JSON.stringify(pick(config, SHARED_FIELDS)));
}

/**
 * Écrit minutes.odoo_quote. Renvoie { ok, missingColumn } : missingColumn = la migration n'a pas
 * encore été lancée (PostgREST PGRST204 / colonne inconnue) → l'appelant garde le navigateur.
 */
// Champs de odoo_quote.link tenus par le SERVEUR (api/odoo/order-event.js, création auto du projet) :
// l'écran du devis ne doit jamais les écraser avec sa copie, possiblement plus ancienne.
export const SERVER_LINK_FIELDS = ['state', 'database', 'isProdSource', 'lastEvent', 'confirmedAt', 'project',
  'pendingProject', 'pendingClaimAt', 'droitfilProjectId', 'statusBeforeOrder', 'archivedByOdoo', 'projectStatusBefore'];

export async function saveMinuteQuote(minuteId, odooQuote) {
  if (!minuteId) return { ok: false };
  try {
    const { data: cur } = await supabase.from('minutes').select('odoo_quote').eq('id', minuteId).maybeSingle();
    const dbLink = cur?.odoo_quote?.link;
    if (dbLink && odooQuote?.link && String(dbLink.orderId) === String(odooQuote.link.orderId)) {
      const kept = Object.fromEntries(SERVER_LINK_FIELDS.filter((k) => k in dbLink).map((k) => [k, dbLink[k]]));
      odooQuote = { ...odooQuote, link: { ...odooQuote.link, ...kept } };
    } else if (dbLink && !odooQuote?.link) {
      odooQuote = { ...odooQuote, link: dbLink };
    }
    const { error } = await supabase.from('minutes').update({ odoo_quote: odooQuote }).eq('id', minuteId);
    if (!error) return { ok: true };
    const missingColumn = error.code === 'PGRST204' || /odoo_quote/.test(error.message || '');
    return { ok: false, missingColumn, error: error.message };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export const minuteSettingsOf = (config) => pick(config, MINUTE_FIELDS);
