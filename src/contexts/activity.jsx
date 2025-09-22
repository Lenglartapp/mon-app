// src/contexts/activity.jsx
import React, { createContext, useContext, useMemo, useState, useEffect } from "react";
import { uid } from "../lib/utils/uid";

// Structure exposée :
// { addComment(rowId, text, user), addChange(rowId, field, from, to, user), getRow(rowId),
//   lastActivity, setLastActivity }

const ActivityCtx = createContext(null);

export function ActivityProvider({ children }) {
  // Historique par ligne : { [rowId]: ActivityItem[] }
  const [byRow, setByRow] = useState(() => {
    try {
      const raw = localStorage.getItem("activity.byRow");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Compat : tu avais déjà ceci dans ta version
  const [lastActivity, setLastActivity] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem("activity.byRow", JSON.stringify(byRow));
    } catch {}
  }, [byRow]);

  const addComment = (rowId, text, user = "Utilisateur") => {
    const t = String(text || "").trim();
    if (!rowId || !t) return;
    const entry = { id: uid(), ts: Date.now(), type: "comment", text: t, user: String(user) };
    setByRow(prev => ({ ...prev, [rowId]: [ ...(prev[rowId] || []), entry ] }));
    setLastActivity(entry);
  };

  const addChange = (rowId, field, from, to, user = "Utilisateur") => {
    if (!rowId || !field) return;
    const entry = { id: uid(), ts: Date.now(), type: "change", field, from, to, user: String(user) };
    setByRow(prev => ({ ...prev, [rowId]: [ ...(prev[rowId] || []), entry ] }));
    setLastActivity(entry);
  };

  const getRow = (rowId) => byRow[rowId] || [];

  const value = useMemo(
    () => ({ addComment, addChange, getRow, lastActivity, setLastActivity }),
    [byRow, lastActivity]
  );

  return <ActivityCtx.Provider value={value}>{children}</ActivityCtx.Provider>;
}

export function useActivity() {
  const ctx = useContext(ActivityCtx);
  if (!ctx) throw new Error("useActivity must be used within <ActivityProvider>");
  return ctx;
}