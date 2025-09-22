// src/lib/hooks/useLocalStorage.js
import { useState, useEffect } from "react";

export function useLocalStorage(key, initial) {
  const [state, setState] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // on ignore les erreurs (quota plein, navigation privée, etc.)
    }
  }, [key, state]);

  return [state, setState];
}