// src/auth.js
import React, { createContext, useContext, useState, useMemo } from "react";

/** Rôles disponibles (clé canonique) */
export const ROLES = {
  ADMIN: "admin",
  ORDONNANCEMENT: "ordonnancement",
  PILOTAGE_PROJET: "pilotage_projet",
  PRODUCTION: "production",
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
  },
  {
    id: "u3",
    email: "pauline@example.com",
    name: "Pauline DURAND",
    role: ROLES.PILOTAGE_PROJET,
    avatarUrl: "",
  },
  {
    id: "u4",
    email: "atelier@example.com",
    name: "Atelier — PRODUCTION",
    role: ROLES.PRODUCTION,
    avatarUrl: "",
  },
];

const AuthCtx = createContext(null);

const uid = () => Math.random().toString(36).slice(2, 10);

export const AuthProvider = ({ children }) => {
  // Liste des utilisateurs (démo)
  const [users, setUsers] = useState(DEMO_USERS);

  // Utilisateur courant (par défaut: le 1er = admin)
  const [currentUser, setCurrentUser] = useState(DEMO_USERS[0]);

  // CRUD (démo)
  const addUser = (payload) => {
    const user = { id: uid(), avatarUrl: "", ...payload };
    setUsers((arr) => [user, ...(arr || [])]);
    return user;
  };

  const updateUser = (id, patch) => {
    setUsers((arr) => (arr || []).map((u) => (u.id === id ? { ...u, ...patch } : u)));
    // si on modifie l'utilisateur courant, synchronise aussi
    setCurrentUser((cu) => (cu?.id === id ? { ...cu, ...patch } : cu));
  };

  const removeUser = (id) => {
    setUsers((arr) => (arr || []).filter((u) => u.id !== id));
    // si on supprime l'utilisateur courant, repasse au premier restant
    setCurrentUser((cu) => (cu?.id === id ? (users.find((u) => u.id !== id) || null) : cu));
  };

  // Démo reset mot de passe (no-op visuel)
  const resetPasswordDemo = (id) => {
    console.log("Reset password DEMO pour", id);
    alert("Démo: lien de réinitialisation envoyé (factice).");
  };

  const value = useMemo(
    () => ({
      users,
      currentUser,
      setCurrentUser,
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