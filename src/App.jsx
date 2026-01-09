import React, { useState, useMemo, useCallback } from "react";
import { BrowserRouter } from "react-router-dom";
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
import { useProjects, useMinutes, useEvents, useStocks } from './hooks/useSupabase';

import { Bell } from 'lucide-react';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import NotificationMenu from "./components/NotificationMenu";

import { NotificationProvider, useNotifications } from "./contexts/NotificationContext";

// --- Composants UI ---
function UserBadge({ onClick }) {
  const { currentUser, logout } = useAuth();
  const hasAvatar = Boolean(currentUser?.avatarUrl);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button style={S.userBtn} onClick={onClick} aria-label="Profil utilisateur" title="Ouvrir mes paramètres">
        <div style={S.avatarBox}>
          {hasAvatar ? (
            <img src={currentUser.avatarUrl} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (<div>{currentUser?.initials || "AL"}</div>)}
        </div>
        <span style={{ fontWeight: 600 }}>{currentUser?.name || "Utilisateur"}</span>
      </button>
      <button onClick={() => { if (window.confirm("Se déconnecter ?")) logout(); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#ef4444', fontWeight: 600, padding: 4 }}>Sortir</button>
    </div>
  );
}

function AppShell() {
  const { currentUser } = useAuth();

  // --- 1. CHARGEMENT DONNÉES (Supabase) ---
  const { projects, addProject, updateProject, deleteProject } = useProjects();
  const { minutes, addMinute, updateMinute, deleteMinute } = useMinutes();
  const { events: planningEvents, updateEvent, deleteEvent } = useEvents();
  const { inventory, movements, addMovement } = useStocks();

  // Alias pour compatibilité
  const cleanProjects = projects;
  const cleanMinutes = minutes;

  // --- 3. STATE UI ---
  const [screen, setScreen] = useState("home");
  const [logoOk, setLogoOk] = useState(true);
  const [currentProject, setCurrentProject] = useState(null);
  const [openMinuteId, setOpenMinuteId] = useState(null);
  const [pendingRowId, setPendingRowId] = useState(null);

  // Notifications
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [notifAnchor, setNotifAnchor] = useState(null);
  const handleNotifClick = (event) => setNotifAnchor(event.currentTarget);
  const handleNotifClose = () => setNotifAnchor(null);

  // Navigation interne
  const go = (target) => {
    if (target === "chiffrageRoot" && !can(currentUser, "nav.chiffrage")) return;
    if (target === "prodList" && !can(currentUser, "nav.production")) return;
    if (target === "inventory" && !can(currentUser, "nav.inventory")) return;
    if (target === "planning" && !can(currentUser, "planning.view")) return;
    setPendingRowId(null);
    setScreen(target);
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
  }, [updateProject, currentProject]);

  const handleUpdateEvent = useCallback((event) => {
    updateEvent(event);
  }, [updateEvent]);


  const handleNotificationAction = (action) => {
    if (!action) return;
    setPendingRowId(action.rowId || null);

    if (action.screen === "chiffrage") {
      const target = cleanMinutes.find(m => String(m.id) === String(action.id));
      if (target) {
        setOpenMinuteId(target.id);
        setScreen("chiffrage");
      }
    }
    else if (action.screen === "project") {
      const target = cleanProjects.find(p => String(p.id) === String(action.id));
      if (target) {
        setCurrentProject(target);
        setScreen("project");
      }
    }
  };

  const LOGO_SRC = "/logo.png";

  if (!currentUser) return <LoginScreen />;

  return (
    <div style={S.page}>
      <header style={S.header}>
        <button style={S.brandBtn} onClick={() => setScreen("home")} aria-label="Retour à l'accueil">
          {logoOk ? (
            <img src={LOGO_SRC} alt="LENGLART" style={{ height: "clamp(24px, 5vw, 36px)", width: "auto" }} onError={() => setLogoOk(false)} />
          ) : (
            <span style={S.logoText}>LENGLART</span>
          )}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <IconButton onClick={handleNotifClick} sx={{ color: '#6B7280' }}>
            <Badge badgeContent={unreadCount} color="error" invisible={unreadCount === 0} sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16 } }}>
              <Bell size={20} />
            </Badge>
          </IconButton>
          <UserBadge onClick={() => setScreen("settings")} />
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
          onOpenSettings={() => setScreen("settings")}
          onOpenChiffrage={() => go("chiffrageRoot")}
          onOpenInventory={() => go("inventory")}
          onOpenPlanning={() => go("planning")}
        />

      )}

      {screen === "prodList" && (
        <ProjectListScreen
          projects={cleanProjects}
          onCreate={addProject}
          onDelete={deleteProject}
          onUpdateProject={handleUpdateProject}
          onOpenProject={(p) => { setCurrentProject(p); setScreen("project"); }}
          minutes={can(currentUser, "chiffrage.view") ? cleanMinutes : []}
          onUpdateMinute={updateMinute}
          onBack={() => setScreen("home")}
        />
      )}

      {screen === "chiffrageRoot" && (
        <ChiffrageRoot
          minutes={cleanMinutes}
          onCreate={addMinute}
          onDelete={deleteMinute}
          onUpdate={updateMinute}
          onBack={() => setScreen("home")}
          onOpenMinute={(id) => { setOpenMinuteId(id); setScreen("chiffrage"); }}
        />
      )}

      {screen === "chiffrage" && openMinuteId && (
        <ChiffrageScreen
          minuteId={openMinuteId}
          minutes={cleanMinutes}
          onUpdate={updateMinute}
          onBack={() => setScreen("chiffrageRoot")}
          highlightRowId={pendingRowId}
        />
      )}

      {screen === "project" && currentProject && (
        <ProductionProjectScreen
          inventory={inventory}
          project={cleanProjects.find(p => String(p.id) === String(currentProject.id)) || currentProject}
          projects={cleanProjects}
          onBack={() => setScreen("prodList")}
          onUpdateProjectRows={handleUpdateProjectRows}
          onUpdateProject={handleUpdateProject}
          highlightRowId={pendingRowId}
          events={planningEvents}
        />
      )}

      {screen === "settings" && <SettingsScreen onBack={() => setScreen("home")} />}

      {screen === "inventory" && (
        <StocksModule
          minutes={cleanMinutes}
          projects={cleanProjects}
          inventory={inventory}
          movements={movements}
          onAddMovement={addMovement}
          onBack={() => setScreen("home")}
        />
      )}

      {screen === "planning" && (
        <PlanningScreen
          projects={cleanProjects}
          events={planningEvents}
          onUpdateEvent={updateEvent}
          onDeleteEvent={(id) => deleteEvent(id)}
          onUpdateProject={handleUpdateProject}
          onBack={() => setScreen("home")}
        />
      )}



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