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

const AuthCtx = createContext(null);

export const AuthProvider = ({ children }) => {
  const [users, setUsers] = useState([]); // Will be populated from Supabase
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Synchronisation Session Supabase <-> Profil Visuel
  useEffect(() => {
    // 1. Initial Load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        syncUser(session.user);
      } else {
        setLoading(false);
      }
    });

    // 2. Auth State Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        syncUser(session.user);
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    });

    // 3. Fetch All Users (for mentions, etc.)
    fetchUsers();

    return () => subscription.unsubscribe();
  }, []);

  const USERS_KEY = 'df_users';

  const fetchUsers = async () => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (!error && data) {
      const mappedUsers = data.map(u => ({
        ...u,
        name: u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : u.email,
        initials: getInitials(u.first_name, u.last_name),
      }));
      setUsers(mappedUsers);
      localStorage.setItem(USERS_KEY, JSON.stringify(mappedUsers));
    } else {
      // Hors ligne : restaurer depuis le cache
      const cached = localStorage.getItem(USERS_KEY);
      if (cached) setUsers(JSON.parse(cached));
    }
  };

  const getInitials = (firstName, lastName) => {
    if (!firstName && !lastName) return "??";
    const f = firstName ? firstName.charAt(0).toUpperCase() : "";
    const l = lastName ? lastName.charAt(0).toUpperCase() : "";
    return f + l;
  };

  const syncUser = async (supabaseUser) => {
    const PROFILE_KEY = `df_profile_${supabaseUser.id}`;
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', supabaseUser.id)
      .single();

    if (profile && !error) {
      // En ligne : profil récupéré, on met à jour le cache
      const name = profile.first_name || profile.last_name ?
        `${profile.first_name || ''} ${profile.last_name || ''}`.trim() :
        supabaseUser.email;
      const initials = getInitials(profile.first_name, profile.last_name);
      const user = { ...supabaseUser, ...profile, name, initials, role: profile.role || 'user' };
      setCurrentUser(user);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(user));
    } else {
      // Erreur réseau ou hors ligne : on tente le cache local
      const cached = localStorage.getItem(PROFILE_KEY);
      if (cached) {
        setCurrentUser(JSON.parse(cached));
      } else {
        setCurrentUser({ ...supabaseUser, name: supabaseUser.email, role: "user", initials: "??" });
      }
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