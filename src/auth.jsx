// src/auth.jsx
import React, { createContext, useContext, useState, useMemo } from "react";

/** Rôles disponibles (clé canonique) */
export const ROLES = {
  ADMIN: "admin",
  ORDONNANCEMENT: "ordonnancement",
  PILOTAGE_PROJET: "pilotage_projet",
  PRODUCTION: "production",
  ADV: "adv",
};

/** Démo: utilisateurs seed basés sur l'organisation réelle */
export const DEMO_USERS = [
  // --- PILOTAGE & BUREAU ---
  {
    id: "u1", email: "aristide@lenglart.com", name: "Aristide LENGLART",
    role: ROLES.ADMIN, avatarUrl: "/avatar.jpg", initials: "AL", resourceType: "bureau"
  },
  {
    id: "u2", email: "thomas@lenglart.com", name: "Thomas BONNET",
    role: ROLES.ORDONNANCEMENT, initials: "TB", resourceType: "bureau"
  },
  {
    id: "u3", email: "pauline@lenglart.com", name: "Pauline DURAND",
    role: ROLES.PILOTAGE_PROJET, initials: "PD", resourceType: "bureau"
  },
  {
    id: "u_adv", email: "murielle@lenglart.com", name: "Murielle BLONDEAU",
    role: ROLES.ADV, initials: "MB", resourceType: "bureau"
  },

  // --- RESSOURCES ATELIER (CONFECTION) ---
  {
    id: "res_at1", email: "atelier1@lenglart.com", name: "Atelier — Équipe 1",
    role: ROLES.PRODUCTION, initials: "AT1", resourceType: "conf", color: "#3b82f6"
  },
  {
    id: "res_at2", email: "atelier2@lenglart.com", name: "Atelier — Équipe 2",
    role: ROLES.PRODUCTION, initials: "AT2", resourceType: "conf", color: "#60a5fa"
  },
  {
    id: "res_thierry", email: "thierry@lenglart.com", name: "Thierry (Ordo)",
    role: ROLES.ORDONNANCEMENT, initials: "TH", resourceType: "prepa", color: "#eab308"
  },

  // --- RESSOURCES POSE (INTERNES) ---
  {
    id: "res_guillaume", email: "guillaume@lenglart.com", name: "Guillaume",
    role: ROLES.PRODUCTION, initials: "GUI", resourceType: "pose", color: "#16a34a"
  },
  {
    id: "res_alain", email: "alain@lenglart.com", name: "Alain",
    role: ROLES.PRODUCTION, initials: "ALN", resourceType: "pose", color: "#22c55e"
  },
  {
    id: "res_nicolas", email: "nicolas@lenglart.com", name: "Nicolas",
    role: ROLES.PRODUCTION, initials: "NIC", resourceType: "pose", color: "#4ade80"
  },
  {
    id: "res_samuel", email: "samuel@lenglart.com", name: "Samuel",
    role: ROLES.PRODUCTION, initials: "SAM", resourceType: "pose", color: "#86efac"
  },

  // --- RESSOURCES EXTERNES / INTERIM ---
  {
    id: "res_interim", email: "interim@lenglart.com", name: "Intérim / Renfort",
    role: ROLES.PRODUCTION, initials: "INT", resourceType: "pose", color: "#9ca3af"
  }
];

const AuthCtx = createContext(null);

const uid = () => Math.random().toString(36).slice(2, 10);

export const AuthProvider = ({ children }) => {
  // Liste des utilisateurs (démo)
  const [users, setUsers] = useState(DEMO_USERS);

  // Utilisateur courant: NULL par défaut pour forcer le login screen
  const [currentUser, setCurrentUser] = useState(null);

  const login = (user) => {
    setCurrentUser(user);
  };

  const logout = () => {
    setCurrentUser(null);
  };

  // CRUD (démo)
  const addUser = (payload) => {
    const user = { id: uid(), avatarUrl: "", ...payload };
    setUsers((arr) => [user, ...(arr || [])]);
    return user;
  };

  const updateUser = (id, patch) => {
    setUsers((arr) => (arr || []).map((u) => (u.id === id ? { ...u, ...patch } : u)));
    setCurrentUser((cu) => (cu?.id === id ? { ...cu, ...patch } : cu));
  };

  const removeUser = (id) => {
    setUsers((arr) => (arr || []).filter((u) => u.id !== id));
    setCurrentUser((cu) => (cu?.id === id ? null : cu));
  };

  const resetPasswordDemo = (id) => {
    console.log("Reset password DEMO pour", id);
    alert("Démo: lien de réinitialisation envoyé (factice).");
  };

  const value = useMemo(
    () => ({
      users,
      currentUser,
      login,
      logout,
      setCurrentUser, // Keep for low-level if needed
      addUser,
      updateUser,
      removeUser,
      resetPasswordDemo,
      ROLES,
    }),
    [users, currentUser]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth doit être utilisé à l'intérieur d'AuthProvider");
  return ctx;
};