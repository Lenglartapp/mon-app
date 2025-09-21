// src/contexts/activity.jsx
import React, { createContext, useContext, useState } from "react";

export const ActivityCtx = createContext(null);

export function ActivityProvider({ children }) {
  // garde TOUT ce que tu avais dans App.jsx (states, actions…)
  const [lastActivity, setLastActivity] = useState(null);
  const value = { lastActivity, setLastActivity }; // ← complète si tu as d'autres champs

  return <ActivityCtx.Provider value={value}>{children}</ActivityCtx.Provider>;
}

export function useActivity() {
  const ctx = useContext(ActivityCtx);
  if (!ctx) throw new Error("useActivity must be used within <ActivityProvider>");
  return ctx;
}