import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { supabase } from "./lib/supabaseClient";

// Session gardée par Supabase sur l'appareil (même expirée). Hors connexion, Supabase ne
// peut pas la renouveler et répond « pas de session » : sans ce qui suit, le poseur qui
// rouvre l'appli sur un chantier sans réseau tombait sur l'écran de connexion.
const storedSessionUserId = () => {
  try {
    const raw = localStorage.getItem(supabase.auth.storageKey);
    const sess = raw ? JSON.parse(raw) : null;
    return sess?.refresh_token ? (sess.user?.id || null) : null;
  } catch { return null; }
};
const cachedProfile = (uid) => {
  try { return JSON.parse(localStorage.getItem(`df_profile_${uid}`) || 'null'); } catch { return null; }
};

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
    // HORS CONNEXION : session expirée qui n'a pas pu être renouvelée faute de réseau
    // (elle reste sur l'appareil) → on reprend le profil gardé sur l'appareil. Supabase
    // renouvellera la session tout seul au retour du réseau (événement TOKEN_REFRESHED).
    const restoreOffline = (error) => {
      const offline = (typeof navigator !== 'undefined' && navigator.onLine === false) || isAuthRetryableFetchError(error);
      const uid = offline ? storedSessionUserId() : null;
      const profile = uid ? cachedProfile(uid) : null;
      if (!profile) return false;
      setCurrentUser(profile);
      return true;
    };

    // 0. Ouverture IMMÉDIATE avec le profil gardé sur l'appareil (si une session y est
    //    gardée) : on n'attend pas le serveur pour afficher l'appli. Sur iPhone en mode
    //    avion, les requêtes attendent au lieu d'échouer → sinon écran blanc.
    //    Si la session s'avère refusée par le serveur, SIGNED_OUT ramène au login.
    const uid0 = storedSessionUserId();
    const profile0 = uid0 ? cachedProfile(uid0) : null;
    if (profile0) { setCurrentUser(profile0); setLoading(false); }

    // 1. Initial Load
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (session?.user) {
        syncUser(session.user);
      } else {
        if (!restoreOffline(error)) setCurrentUser(null);
        setLoading(false);
      }
    });

    // 2. Auth State Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        syncUser(session.user);
        // L'équipe (profiles) n'est lisible qu'une fois connecté (RLS) : on la recharge
        // à la connexion, sinon la liste chargée avant le login resterait vide.
        if (event === 'SIGNED_IN') fetchUsers();
      } else if (event === 'SIGNED_OUT') {
        // Vraie déconnexion (ou session refusée par le serveur) : écran de connexion.
        setCurrentUser(null);
        setLoading(false);
      }
      // INITIAL_SESSION sans session : traité par getSession() ci-dessus (reprise hors ligne).
    });

    // 3. Retour du réseau : on relance le renouvellement de la session tout de suite
    //    (sans attendre le prochain passage automatique de Supabase).
    const onOnline = () => { supabase.auth.getSession().catch(() => {}); };
    window.addEventListener('online', onOnline);

    // 3. Fetch All Users (for mentions, etc.)
    fetchUsers();

    return () => { subscription.unsubscribe(); window.removeEventListener('online', onOnline); };
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
    // Profil déjà gardé sur l'appareil : affiché tout de suite, rafraîchi ci-dessous.
    const known = cachedProfile(supabaseUser.id);
    if (known) {
      setCurrentUser((cur) => (cur?.id === known.id ? cur : known));
      setLoading(false);
    }
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