import React, { useState, useCallback, useEffect, useRef } from "react";
import { BrowserRouter, useNavigate, useLocation } from "react-router-dom";

// "villa martin" → "villa-martin", gère les accents français
const slugify = (str) =>
  (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Extrait le préfixe court (8 hex chars) depuis un segment comme "800ec8af-big-one"
const extractShortId = (segment) => {
  const m = segment.match(/^([0-9a-f]{8})/i);
  return m ? m[1].toLowerCase() : segment;
};
import { S } from "./lib/constants/ui";
import { ProjectListScreen } from "./screens/ProjectListScreen";
import { ProductionProjectScreen } from "./screens/ProductionProjectScreen";
import ChiffrageRoot from "./screens/ChiffrageRoot.jsx";
import ChiffrageScreen from "./screens/ChiffrageScreen";
import HomeScreen from "./screens/HomeScreen.jsx";
import SettingsScreen from "./screens/SettingsScreen.jsx";
import { ActivityProvider } from "./contexts/activity";
import { AuthProvider, useAuth } from "./auth";
import StocksModule from "./components/modules/Stocks/StocksModule";
import { can } from "./lib/authz";
import LoginScreen from "./screens/LoginScreen";
import PlanningScreen from "./screens/PlanningScreen";
import LogistiqueScreen from "./screens/LogistiqueScreen";
import PerformanceScreen from "./screens/PerformanceScreen";
import { useProjects, useMinutes, useEvents, useStocks } from './hooks/useSupabase';

import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useSyncQueue } from './hooks/useSyncQueue';
import { Bell, WifiOff, RefreshCw, Search } from 'lucide-react';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import NotificationMenu from "./components/NotificationMenu";

import { NotificationProvider, useNotifications } from "./contexts/NotificationContext";
import CommandPalette from "./components/CommandPalette";

// --- Composants UI ---
function UserAvatarMenu({ onSettings }) {
  const { currentUser, logout } = useAuth();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef();

  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const initials = currentUser?.initials || (currentUser?.name || "").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "AL";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Menu utilisateur"
        style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "#1E2447", color: "#fff",
          border: "none", cursor: "pointer",
          fontWeight: 700, fontSize: 13,
          fontFamily: "Roboto, system-ui, sans-serif",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {initials}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 10px)", right: 0,
          background: "#fff", borderRadius: 12,
          border: "1px solid #E6DDD2",
          boxShadow: "0 8px 28px rgba(30,36,71,0.13)",
          minWidth: 200, zIndex: 200, overflow: "hidden",
          fontFamily: "Roboto, system-ui, sans-serif",
        }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #F0EBE3" }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#191919" }}>{currentUser?.name || "Utilisateur"}</div>
            <div style={{ fontSize: 12, color: "#9E8E7E", marginTop: 2, textTransform: "capitalize" }}>{currentUser?.role || ""}</div>
          </div>
          <button
            onClick={() => { setOpen(false); onSettings(); }}
            style={{ width: "100%", padding: "11px 16px", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", fontSize: 14, color: "#191919", display: "flex", alignItems: "center", gap: 10 }}
          >
            Paramètres
          </button>
          <button
            onClick={() => { setOpen(false); if (window.confirm("Se déconnecter ?")) logout(); }}
            style={{ width: "100%", padding: "11px 16px", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", fontSize: 14, color: "#ef4444", display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid #F0EBE3" }}
          >
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}

function AppShell() {
  const { currentUser } = useAuth();

  // --- 1. CHARGEMENT DONNÉES (Supabase) ---
  const { projects, addProject, updateProject, deleteProject, refreshProjects } = useProjects();
  const { minutes, addMinute, updateMinute, deleteMinute } = useMinutes();
  const { events: planningEvents, updateEvent, deleteEvent } = useEvents();
  const { inventory, movements, addMovement, bulkUpdateInventory } = useStocks();

  // Alias pour compatibilité
  const cleanProjects = projects;
  const cleanMinutes = minutes;

  const navigate = useNavigate();
  const location = useLocation();

  // --- 3. STATE UI ---
  const [screen, setScreen] = useState("home");
  const [logoOk, setLogoOk] = useState(true);
  const [currentProject, setCurrentProject] = useState(null);
  const [openMinuteId, setOpenMinuteId] = useState(null);
  const [pendingRowId, setPendingRowId] = useState(null);
  const [pendingProjectId, setPendingProjectId] = useState(null);

  // URL → State : lit l'URL au chargement et à chaque navigation
  useEffect(() => {
    const path = location.pathname;
    const params = new URLSearchParams(location.search);

    if (path === "/" || path === "") {
      setScreen("home");
    } else if (path === "/chiffrage") {
      setScreen("chiffrageRoot");
    } else if (path.startsWith("/chiffrage/")) {
      const segs = path.split("/");
      setOpenMinuteId(extractShortId(segs[2]));
      setScreen("chiffrage");
      if (segs[3]) setPendingRowId(extractShortId(segs[3]));
    } else if (path === "/production") {
      setScreen("prodList");
    } else if (path.startsWith("/production/")) {
      const segs = path.split("/");
      setPendingProjectId(extractShortId(segs[2]));
      if (segs[3]) setPendingRowId(extractShortId(segs[3]));
    } else if (path === "/planning") {
      setScreen("planning");
    } else if (path === "/logistique" || path.startsWith("/logistique/")) {
      setScreen("logistique");
    } else if (path === "/inventaire") {
      setScreen("inventory");
    } else if (path === "/performance") {
      setScreen("performance");
    } else if (path === "/parametres") {
      setScreen("settings");
    }
  }, [location]);

  // document.title pour les écrans sans sous-composant dédié
  useEffect(() => {
    const base = "LENGLART";
    const staticTitles = {
      home:          base,
      prodList:      `Production — ${base}`,
      chiffrageRoot: `Chiffrage — ${base}`,
      planning:      `Planning — ${base}`,
      logistique:    `Logistique — ${base}`,
      inventory:     `Inventaire — ${base}`,
      performance:   `Performance — ${base}`,
      settings:      `Paramètres — ${base}`,
    };
    // project et chiffrage gèrent leur propre title dans leurs composants
    if (screen !== "project" && screen !== "chiffrage") {
      document.title = staticTitles[screen] || base;
    }
  }, [screen]);

  // Résolution différée du projet (attend que cleanProjects soit chargé)
  // pendingProjectId est un short ID (8 hex chars), on cherche par startsWith
  useEffect(() => {
    if (!pendingProjectId || !cleanProjects.length) return;
    const project = cleanProjects.find(p => p.id.toLowerCase().startsWith(pendingProjectId.toLowerCase()));
    if (project) {
      setCurrentProject(project);
      setScreen("project");
      setPendingProjectId(null);
    }
  }, [pendingProjectId, cleanProjects]);

  // Command Palette
  const cmdRef = useRef();
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform);

  // Notifications
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [notifAnchor, setNotifAnchor] = useState(null);
  const handleNotifClick = (event) => setNotifAnchor(event.currentTarget);
  const handleNotifClose = () => setNotifAnchor(null);

  // Navigation interne
  const SCREEN_PATHS = {
    home: "/",
    prodList: "/production",
    chiffrageRoot: "/chiffrage",
    planning: "/planning",
    logistique: "/logistique",
    inventory: "/inventaire",
    performance: "/performance",
    settings: "/parametres",
  };

  const go = (target) => {
    if (target === "chiffrageRoot" && !can(currentUser, "nav.chiffrage")) return;
    if (target === "prodList" && !can(currentUser, "nav.production")) return;
    if (target === "inventory" && !can(currentUser, "nav.inventory")) return;
    if (target === "planning" && !can(currentUser, "planning.view")) return;
    if (target === "logistique" && !can(currentUser, "nav.logistique")) return;
    if (target === "performance" && !can(currentUser, "nav.performance")) return;
    setPendingRowId(null);
    navigate(SCREEN_PATHS[target] || "/");
  };

  // --- FONCTION DE SAUVEGARDE LIGNES (Legacy) ---
  const handleUpdateProjectRows = useCallback((projectId, newRows) => {
    updateProject(projectId, { rows: newRows });
    if (currentProject && String(currentProject.id) === String(projectId)) {
      setCurrentProject((cur) => ({ ...cur, rows: newRows }));
    }
  }, [updateProject, currentProject]);

  // --- FONCTION DE SAUVEGARDE GLOBALE ---
  const handleUpdateProject = useCallback((projectId, updates) => {
    updateProject(projectId, updates);
    if (currentProject && String(currentProject.id) === String(projectId)) {
      setCurrentProject((cur) => ({ ...cur, ...updates }));
    }

    // SYNC: When project archived -> Complete source Minute
    if (updates.status === 'ARCHIVED') {
      const targetProject = cleanProjects.find(p => String(p.id) === String(projectId));
      if (targetProject && targetProject.sourceMinuteId) {
        updateMinute(targetProject.sourceMinuteId, { status: 'ORDER_COMPLETED' });
      }
    }
  }, [updateProject, currentProject, cleanProjects, updateMinute]);

  const handleUpdateEvent = useCallback((event) => {
    updateEvent(event);
  }, [updateEvent]);


  const handleNotificationAction = (action) => {
    if (!action) return;
    setPendingRowId(action.rowId || null);

    if (action.screen === "chiffrage") {
      const target = cleanMinutes.find(m => String(m.id) === String(action.id));
      if (target) {
        const ligneParam = action.rowId ? `?ligne=${action.rowId}` : "";
        navigate(`/chiffrage/${target.id.slice(0,8)}-${slugify(target.name)}${ligneParam}`);
      }
    }
    else if (action.screen === "project") {
      const target = cleanProjects.find(p => String(p.id) === String(action.id));
      if (target) {
        navigate(`/production/${target.id.slice(0,8)}-${slugify(target.name)}`);
      }
    }
  };

  const LOGO_SRC = "/logo.png";

  const isOnline = useNetworkStatus();
  const { pendingCount, isSyncing } = useSyncQueue(refreshProjects);

  if (!currentUser) return <LoginScreen />;

  return (
    <div style={S.page}>
      {!isOnline && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#92400e', color: '#fef3c7',
          padding: '8px 16px', fontSize: 13, fontWeight: 500,
          position: 'sticky', top: 0, zIndex: 9999,
        }}>
          <WifiOff size={15} />
          Mode hors ligne — les données affichées sont celles de votre dernière connexion
          {pendingCount > 0 && (
            <span style={{ marginLeft: 8, opacity: 0.85 }}>
              · {pendingCount} modification{pendingCount > 1 ? 's' : ''} en attente de sync
            </span>
          )}
        </div>
      )}
      {isOnline && isSyncing && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#1d4ed8', color: '#eff6ff',
          padding: '8px 16px', fontSize: 13, fontWeight: 500,
          position: 'sticky', top: 0, zIndex: 9999,
        }}>
          <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
          Synchronisation des modifications hors ligne…
        </div>
      )}
      <header style={{ display: "flex", alignItems: "center", padding: "14px 32px", gap: 16 }}>
        {/* Gauche : logo */}
        <button style={S.brandBtn} onClick={() => navigate("/")} aria-label="Retour à l'accueil">
          {logoOk ? (
            <img src={LOGO_SRC} alt="LENGLART" style={{ height: "clamp(24px, 5vw, 36px)", width: "auto" }} onError={() => setLogoOk(false)} />
          ) : (
            <span style={S.logoText}>LENGLART</span>
          )}
        </button>

        {/* Centre : barre de recherche */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <button
            onClick={() => cmdRef.current?.open()}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "#fff", border: "1px solid #E6DDD2",
              borderRadius: 999, padding: "8px 16px",
              color: "#9B8E82", fontSize: 13, cursor: "pointer",
              fontFamily: "Roboto, system-ui, sans-serif",
              width: "min(480px, 100%)",
              boxShadow: "0 1px 4px rgba(30,36,71,0.06)",
            }}
          >
            <Search size={14} color="#CEAB95" />
            <span style={{ flex: 1, textAlign: "left", color: "#B0A396" }}>Rechercher…</span>
            <kbd style={{
              background: "#F5EFE6", border: "1px solid #E6DDD2",
              borderRadius: 6, padding: "1px 6px",
              fontSize: 11, color: "#B0A396",
              fontFamily: "Roboto, system-ui, sans-serif",
            }}>
              {isMac ? "⌘K" : "Ctrl+K"}
            </kbd>
          </button>
        </div>

        {/* Droite : cloche + avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <IconButton onClick={handleNotifClick} sx={{ color: '#9B8E82' }}>
            <Badge badgeContent={unreadCount} color="error" invisible={unreadCount === 0} sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16 } }}>
              <Bell size={20} />
            </Badge>
          </IconButton>
          <UserAvatarMenu onSettings={() => navigate("/parametres")} />
        </div>
      </header>

      <NotificationMenu
        anchorEl={notifAnchor}
        open={Boolean(notifAnchor)}
        onClose={handleNotifClose}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllRead={markAllAsRead}
        onAction={handleNotificationAction}
      />

      {screen === "home" && (
        <HomeScreen
          onOpenProdList={() => go("prodList")}
          onOpenSettings={() => navigate("/parametres")}
          onOpenChiffrage={() => go("chiffrageRoot")}
          onOpenInventory={() => go("inventory")}
          onOpenPlanning={() => go("planning")}
          onOpenLogistique={() => go("logistique")}
          onOpenPerformance={() => go("performance")}
        />

      )}

      {screen === "prodList" && (
        <ProjectListScreen
          projects={cleanProjects}
          onCreate={addProject}
          onDelete={deleteProject}
          onUpdateProject={handleUpdateProject}
          onOpenProject={(p) => navigate(`/production/${p.id.slice(0,8)}-${slugify(p.name)}`)}
          minutes={can(currentUser, "chiffrage.view") ? cleanMinutes : []}
          onUpdateMinute={updateMinute}
          onBack={() => navigate("/")}
        />
      )}

      {screen === "chiffrageRoot" && (
        <ChiffrageRoot
          minutes={cleanMinutes}
          onCreate={addMinute}
          onDelete={deleteMinute}
          onUpdate={updateMinute}
          onBack={() => navigate("/")}
          onOpenMinute={(id) => {
            const m = cleanMinutes.find(m => String(m.id) === String(id));
            navigate(`/chiffrage/${String(id).slice(0,8)}-${slugify(m?.name)}`);
          }}
        />
      )}

      {screen === "chiffrage" && openMinuteId && (
        <ChiffrageScreen
          minuteId={openMinuteId}
          minutes={cleanMinutes}
          onUpdate={updateMinute}
          onCreate={addMinute}
          onBack={() => navigate("/chiffrage")}
          onOpenMinute={(id) => {
            const m = cleanMinutes.find(m => String(m.id) === String(id));
            navigate(`/chiffrage/${String(id).slice(0,8)}-${slugify(m?.name)}`);
          }}
          highlightRowId={pendingRowId}
        />
      )}

      {screen === "project" && currentProject && (
        <ProductionProjectScreen
          inventory={inventory}
          project={cleanProjects.find(p => String(p.id) === String(currentProject.id)) || currentProject}
          projects={cleanProjects}
          onBack={() => navigate("/production")}
          onUpdateProjectRows={handleUpdateProjectRows}
          onUpdateProject={handleUpdateProject}
          highlightRowId={pendingRowId}
          events={planningEvents}
        />
      )}

      {screen === "settings" && <SettingsScreen onBack={() => navigate("/")} />}

      {screen === "inventory" && (
        <StocksModule
          minutes={cleanMinutes}
          projects={cleanProjects}
          inventory={inventory}
          movements={movements}
          onAddMovement={addMovement}
          onBulkMovement={bulkUpdateInventory}
          onBack={() => navigate("/")}
        />
      )}

      {screen === "planning" && (
        <PlanningScreen
          projects={cleanProjects}
          events={planningEvents}
          onUpdateEvent={updateEvent}
          onDeleteEvent={(id) => deleteEvent(id)}
          onUpdateProject={handleUpdateProject}
          onBack={() => navigate("/")}
        />
      )}

      {screen === "logistique" && (
        <LogistiqueScreen
          projects={cleanProjects}
          onUpdateProject={handleUpdateProject}
          onBack={() => navigate("/")}
        />
      )}

      {screen === "performance" && (
        <PerformanceScreen
          projects={cleanProjects}
          events={planningEvents}
          onBack={() => navigate("/")}
        />
      )}

      <CommandPalette
        ref={cmdRef}
        projects={cleanProjects}
        minutes={cleanMinutes}
        navigate={navigate}
        currentUser={currentUser}
      />

    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ActivityProvider>
          <NotificationProvider>
            <AppShell />
          </NotificationProvider>
        </ActivityProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}