import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { supabase } from "./lib/supabaseClient";

/** Rôles disponibles (clé canonique) */
export const ROLES = {
  ADMIN: "admin",
  ORDONNANCEMENT: "ordonnancement",
  PILOTAGE_PROJET: "pilotage_projet",
  PRODUCTION: "production",
  ADV: "adv",
};

/** Démo: utilisateurs seed basés sur l'organisation réelle 
 * IDs mis à jour avec Supabase pour Aristide et Thomas
 */
export const DEMO_USERS = [
  // --- PILOTAGE & BUREAU ---
  {
    id: "efeda64d-2476-48d2-9242-ea153471659c", // UUID RÉEL SUPABASE
    email: "aristide.lenglart@lenglart.com",
    name: "Aristide LENGLART",
    role: ROLES.ADMIN,
    avatarUrl: "/avatar.jpg",
    initials: "AL",
    resourceType: "bureau"
  },
  {
    id: "399e495b-fc14-42f6-9864-10748f4c8001", // UUID RÉEL SUPABASE
    email: "thomas.bonnet@lenglart.com",
    name: "Thomas BONNET",
    role: ROLES.ORDONNANCEMENT,
    initials: "TB",
    resourceType: "bureau"
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

export const AuthProvider = ({ children }) => {
  const [users] = useState(DEMO_USERS);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Synchronisation Session Supabase <-> Profil Visuel
  useEffect(() => {
    // 1. Vérification au chargement (Refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        syncUser(session.user);
      } else {
        setLoading(false);
      }
    });

    // 2. Écoute des changements (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        syncUser(session.user);
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const syncUser = (supabaseUser) => {
    // On cherche le profil visuel correspondant à l'UUID connecté
    const demoProfile = DEMO_USERS.find(u => u.id === supabaseUser.id);

    if (demoProfile) {
      // ✅ CORRECT : demoProfile écrase les champs techniques de supabaseUser
      setCurrentUser({ ...supabaseUser, ...demoProfile });
    } else {
      // Fallback pour un user non listé (sécurité)
      setCurrentUser({
        ...supabaseUser,
        role: "user",
        initials: "??",
      });
    }
    setLoading(false);
  };

  const login = async (email, password) => {
    // VRAIE CONNEXION SUPABASE
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  const value = useMemo(() => ({
    users, currentUser, loading, login, logout, ROLES
  }), [users, currentUser, loading]);

  return <AuthCtx.Provider value={value}>{!loading && children}</AuthCtx.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth doit être utilisé à l'intérieur d'AuthProvider");
  return ctx;
};