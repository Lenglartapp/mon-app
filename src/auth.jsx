// src/auth.js
import React, { createContext, useContext, useState } from "react";

export const DEMO_USERS = [
  { id: "u1", email: "aristide@example.com", name: "Aristide LENGLART", role: "admin", avatarUrl: "/avatar.jpg" },
  { id: "u2", email: "thomas@example.com",   name: "Thomas BONNET",     role: "user",  avatarUrl: "" },
];

const AuthCtx = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(DEMO_USERS[0]);
  const value = { currentUser, setCurrentUser, users: DEMO_USERS };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth doit être utilisé à l'intérieur d'AuthProvider");
  return ctx;
};