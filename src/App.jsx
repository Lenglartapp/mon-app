// src/App.jsx
import React, { useState, useEffect } from "react";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";
import { S } from "./lib/constants/ui";
import { ProjectListScreen } from "./screens/ProjectListScreen";
import { ProductionProjectScreen } from "./screens/ProductionProjectScreen";
import ChiffrageRoot from "./screens/ChiffrageRoot.jsx";
import ChiffrageScreen from "./screens/ChiffrageScreen";
import HomeScreen from "./screens/HomeScreen.jsx";
import SettingsScreen from "./screens/SettingsScreen.jsx";
import { useLocalStorage } from "./lib/hooks/useLocalStorage.js";
import { ActivityProvider } from "./contexts/activity";
import { AuthProvider, useAuth } from "./auth";
import { DEMO_PROJECTS } from "./lib/data/demo";
import StocksModule from "./components/modules/Stocks/StocksModule";
import { can } from "./lib/authz";
import Require from "./components/Require";
import LoginScreen from "./screens/LoginScreen";

import { Bell } from 'lucide-react';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import NotificationMenu from "./components/NotificationMenu";
import { NotificationProvider, useNotifications } from "./contexts/NotificationContext";


// --- Badge utilisateur
function UserBadge({ onClick }) {
  const { currentUser, logout } = useAuth();
  const hasAvatar = Boolean(currentUser?.avatarUrl);

  const handleClick = () => {
    onClick();
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button style={S.userBtn} onClick={handleClick} aria-label="Profil utilisateur" title="Ouvrir mes paramètres">
        <div style={S.avatarBox}>
          {hasAvatar ? (
            <img src={currentUser.avatarUrl} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div>AL</div>
          )}
        </div>
        <span style={{ fontWeight: 600 }}>{currentUser?.name || "Utilisateur"}</span>
      </button>
      <button
        onClick={() => { if (window.confirm("Se déconnecter ?")) logout(); }}
        style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          fontSize: 12, color: '#ef4444', fontWeight: 600, padding: 4
        }}
      >
        Sortir
      </button>
    </div>
  );
}

function AppShell() {
  const { currentUser } = useAuth();

  const [screen, setScreen] = useState("home");
  const [logoOk, setLogoOk] = useState(true);
  const [projects, setProjects] = useState(DEMO_PROJECTS);
  const [current, setCurrent] = useState(null);
  const [quoteMinutes, setQuoteMinutes] = useLocalStorage("chiffrage.minutes", []);
  const [openMinuteId, setOpenMinuteId] = useState(null);
  const [inventoryRows, setInventoryRows] = useLocalStorage("inventory.rows", []);

  // Sync URL -> State (Deep Linking)
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Check for Chiffrage Link: /chiffrage/MINUTE_ID
    const matchChiffrage = location.pathname.match(/\/chiffrage\/([a-zA-Z0-9_-]+)/);
    if (matchChiffrage && matchChiffrage[1]) {
      if (screen !== "chiffrage" || openMinuteId !== matchChiffrage[1]) {
        console.log("Deep link detected (Chiffrage):", matchChiffrage[1]);
        setOpenMinuteId(matchChiffrage[1]);
        setScreen("chiffrage");
      }
      return;
    }

    // 2. Check for Project Link: /project/PROJECT_ID
    const matchProject = location.pathname.match(/\/project\/([a-zA-Z0-9_-]+)/);
    if (matchProject && matchProject[1]) {
      const pId = matchProject[1];
      // Only switch if needed
      if ((screen !== "project") || (current?.id !== pId)) {
        console.log("Deep link detected (Project):", pId);
        // Find project in state
        const targetProject = (projects || []).find(p => String(p.id) === String(pId));
        if (targetProject) {
          setCurrent(targetProject);
          setScreen("project");
        } else {
          console.warn("Project deep link found but project not found in state:", pId);
        }
      }
    }
  }, [location.pathname, projects]);

  // Notifications State (Now from Context)
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const [notifAnchor, setNotifAnchor] = useState(null);
  const handleNotifClick = (event) => setNotifAnchor(event.currentTarget);
  const handleNotifClose = () => setNotifAnchor(null);
  const notifOpen = Boolean(notifAnchor);

  const LOGO_SRC = "/logo.png";

  if (!currentUser) {
    return <LoginScreen />;
  }

  // Navigation protégée
  const go = (target) => {
    if (target === "chiffrageRoot" && !can(currentUser, "chiffrage.view")) return;
    if (target === "prodList" && !can(currentUser, "production.view")) return;
    if (target === "inventory" && !can(currentUser, "inventory.view")) return;
    setScreen(target);
  };

  // Handlers Home
  const onOpenProdList = () => go("prodList");
  const onOpenSettings = () => setScreen("settings");
  const onOpenChiffrage = () => go("chiffrageRoot");
  const onOpenInventory = () => go("inventory");

  // Persistence
  const handleUpdateProjectRows = (projectId, newRows) => {
    setProjects((prev) => (prev || []).map((p) => {
      if (!p) return p;
      return p.id === projectId ? { ...p, rows: newRows } : p;
    }));
    setCurrent((cur) => (cur && cur.id === projectId ? { ...cur, rows: newRows } : cur));
  };

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
          <UserBadge onClick={onOpenSettings} />
        </div>
      </header>

      <NotificationMenu
        anchorEl={notifAnchor}
        open={notifOpen}
        onClose={handleNotifClose}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllRead={markAllAsRead}
      />

      {/* Accueil */}
      {screen === "home" && (
        <HomeScreen
          onOpenProdList={onOpenProdList}
          onOpenSettings={onOpenSettings}
          onOpenChiffrage={onOpenChiffrage}
          onOpenInventory={onOpenInventory}
        />
      )}

      {/* Production : liste */}
      {screen === "prodList" && (
        <ProjectListScreen
          projects={projects}
          setProjects={setProjects}
          onOpenProject={(p) => { setCurrent(p); setScreen("project"); }}
          minutes={
            can(currentUser, "chiffrage.view")
              ? quoteMinutes.map(m => {
                if (!m) return null; // Safety check
                let tables = {};
                try {
                  const raw = localStorage.getItem(`chiffrage.${m.id}.tables`);
                  if (raw) tables = JSON.parse(raw);
                } catch (e) {
                  console.warn("Impossible de lire tables pour minute", m?.id, e);
                }
                return { ...m, tables };
              }).filter(Boolean) // Remove nulls
              : []
          }
        />
      )}

      {/* Chiffrage : liste */}
      {screen === "chiffrageRoot" && (
        <ChiffrageRoot
          minutes={quoteMinutes}
          setMinutes={setQuoteMinutes}
          onBack={() => setScreen("home")}
          onOpenMinute={(id) => { setOpenMinuteId(id); setScreen("chiffrage"); }}
        />
      )}

      {/* Chiffrage : éditeur */}
      {screen === "chiffrage" && openMinuteId && (
        <ChiffrageScreen
          minuteId={openMinuteId}
          minutes={quoteMinutes}
          setMinutes={setQuoteMinutes}
          onBack={() => setScreen("chiffrageRoot")}
        />
      )}

      {/* Projet Production */}
      {screen === "project" && current && (
        <ProductionProjectScreen
          project={current}
          onBack={() => setScreen("prodList")}
          onUpdateProjectRows={(newRows) => handleUpdateProjectRows(current?.id, newRows)}
        />
      )}

      {/* Paramètres */}
      {screen === "settings" && (
        <SettingsScreen onBack={() => setScreen("home")} />
      )}

      {/* Inventaire (Nouveau Module Stocks) */}
      {screen === "inventory" && (
        <StocksModule
          minutes={quoteMinutes}
          projects={projects}
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