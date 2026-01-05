// src/contexts/activity.jsx
import React, { createContext, useContext, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Structure exposée :
// { addComment(rowId, text, user, projectId?), addChange(rowId, field, from, to, user, projectId?), getRow(rowId) -> Promise }

const ActivityCtx = createContext(null);

export function ActivityProvider({ children }) {
  // Plus de state local 'byRow' -> on passe par le serveur

  const [lastActivity, setLastActivity] = useState(null);

  const addComment = async (rowId, text, user = "Utilisateur", projectId = null) => {
    console.log("Enregistrement commentaire Supabase par:", user);
    const t = String(text || "").trim();
    if (!rowId || !t) return;

    const entry = {
      type: "comment",
      content: t, // "content" au lieu de "text"
      user_name: String(user),
      row_id: String(rowId),
      project_id: projectId ? String(projectId) : null,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('activity').insert(entry).select().single();
    if (error) {
      console.error("Erreur ajout commentaire:", error);
    } else {
      setLastActivity(data);
    }
  };

  const addChange = async (rowId, field, from, to, user = "Utilisateur", projectId = null) => {
    if (!rowId || !field) return;

    const entry = {
      type: "change",
      field,
      val_from: String(from),
      val_to: String(to),
      user_name: String(user),
      row_id: String(rowId),
      project_id: projectId ? String(projectId) : null,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('activity').insert(entry).select().single();
    if (error) {
      console.error("Erreur ajout changement:", error);
    } else {
      setLastActivity(data);
    }
  };

  const addImage = async (rowId, imageUrl, user = "Utilisateur", projectId = null) => {
    if (!rowId || !imageUrl) return;

    const entry = {
      type: "image",
      content: imageUrl,
      user_name: String(user),
      row_id: String(rowId),
      project_id: projectId ? String(projectId) : null,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('activity').insert(entry).select().single();
    if (error) {
      console.error("Erreur ajout image:", error);
    } else {
      setLastActivity(data);
    }
  };

  // Récupération asynchrone
  const getRow = async (rowId) => {
    if (!rowId) return [];
    const { data, error } = await supabase
      .from('activity')
      .select('*')
      .eq('row_id', String(rowId))
      .order('created_at', { ascending: true }); // Chronologique

    if (error) {
      console.error("Erreur getRow:", error);
      return [];
    }
    // On mappe pour compatibilité
    return data.map(d => ({
      ...d,
      text: d.content || d.text, // Mapping inverse pour l'affichage (ActivitySidebar utilise .text)
      ts: new Date(d.created_at).getTime(),
      user: d.user_name, // Compat
      author: d.user_name, // Compat pour isMe
      from: d.val_from,
      to: d.val_to
    }));
  };

  const value = useMemo(
    () => ({ addComment, addChange, addImage, getRow, lastActivity, setLastActivity }),
    [lastActivity]
  );

  return <ActivityCtx.Provider value={value}>{children}</ActivityCtx.Provider>;
}

export function useActivity() {
  const ctx = useContext(ActivityCtx);
  if (!ctx) throw new Error("useActivity must be used within <ActivityProvider>");
  return ctx;
}