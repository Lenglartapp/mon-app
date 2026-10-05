// Petit accès à la table de config applicative (app_config). Best-effort : ne casse jamais l'UI.
// Sert notamment à partager la « date de bascule » Odoo entre l'écran et le job de nuit.

import { supabase } from "./supabaseClient";

export async function getConfig(key) {
  try {
    const { data } = await supabase.from("app_config").select("value").eq("key", key).maybeSingle();
    return data?.value ?? null;
  } catch {
    return null;
  }
}

/** @returns {Promise<boolean>} true si la valeur est bien enregistrée. */
export async function setConfig(key, value) {
  try {
    const { error } = await supabase.from("app_config").upsert({ key, value, updated_at: new Date().toISOString() });
    return !error;
  } catch {
    return false;
  }
}
