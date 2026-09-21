// Petit accès à la table de config applicative (app_config). Best-effort : ne casse jamais l'UI.
// Sert notamment à partager la « date de bascule » Odoo entre l'écran (localStorage) et le job de nuit.

import { supabase } from "./supabaseClient";

export async function getConfig(key) {
  try {
    const { data } = await supabase.from("app_config").select("value").eq("key", key).maybeSingle();
    return data?.value ?? null;
  } catch {
    return null;
  }
}

export async function setConfig(key, value) {
  try {
    await supabase.from("app_config").upsert({ key, value, updated_at: new Date().toISOString() });
  } catch {
    /* silencieux : la config serveur est un confort, pas un bloquant */
  }
}
