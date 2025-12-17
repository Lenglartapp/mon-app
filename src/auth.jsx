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

/** Démo: utilisateurs seed */
export const DEMO_USERS = [
  {
    id: "u1",
    email: "aristide@example.com",
    name: "Aristide LENGLART",
    role: ROLES.ADMIN,
    avatarUrl: "/avatar.jpg",
  },
  {
    id: "u2",
    email: "thomas@example.com",
    name: "Thomas BONNET",
    role: ROLES.ORDONNANCEMENT,
    avatarUrl: "",
    initials: "TB"
  },
  {
    id: "u3",
    email: "pauline@example.com",
    name: "Pauline DURAND",
    role: ROLES.PILOTAGE_PROJET,
    avatarUrl: "",
    initials: "PD"
  },
  {
    id: "u4",
    email: "atelier@example.com",
    name: "Atelier — PRODUCTION",
    role: ROLES.PRODUCTION,
    avatarUrl: "",
    initials: "PROD"
  },
  {
    id: "u5",
    email: "murielle@lenglart.com",
    name: "Murielle BLONDEAU",
    role: ROLES.ADV,
    avatarUrl: "https://i.pravatar.cc/150?u=murielle",
    initials: "MB"
  },
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