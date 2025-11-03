// src/App.jsx
import React, { useState } from "react";
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
import InventoryScreen from "./screens/InventoryScreen.jsx";
import { can } from "./lib/authz";
import Require from "./components/Require";

// --- Badge utilisateur
function UserBadge({ onClick }) {
  const { currentUser } = useAuth();
  const hasAvatar = Boolean(currentUser?.avatarUrl);
  return (
    <button style={S.userBtn} onClick={onClick} aria-label="Profil utilisateur" title="Ouvrir mes paramètres">
      <div style={S.avatarBox}>
        {hasAvatar ? (
          <img src={currentUser.avatarUrl} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div>AL</div>
        )}
      </div>
      <span style={{ fontWeight: 600 }}>{currentUser?.name || "Utilisateur"}</span>
    </button>
  );
}

function AppShell() {
  const { currentUser } = useAuth();

  const [screen, setScreen] = useState("home"); // home | prodList | project | chiffrageRoot | chiffrage | settings | inventory
  const [logoOk, setLogoOk] = useState(true);
  const [projects, setProjects] = useState(DEMO_PROJECTS);
  const [current, setCurrent] = useState(null);
  const [quoteMinutes, setQuoteMinutes] = useLocalStorage("chiffrage.minutes", []);
  const [openMinuteId, setOpenMinuteId] = useState(null);
  const [inventoryRows, setInventoryRows] = useLocalStorage("inventory.rows", []);

  const LOGO_SRC = "/logo.png";

  // Navigation protégée (optionnelle — tu peux garder simple aussi)
  const go = (target) => {
    if (target === "chiffrageRoot" && !can(currentUser, "chiffrage.view")) return;
    if (target === "prodList"      && !can(currentUser, "production.view")) return;
    if (target === "inventory"     && !can(currentUser, "inventory.view"))  return;
    // settings: accessible à tous pour profil (le screen gère l’onglet Utilisateurs)
    setScreen(target);
  };

  // Handlers Home
  const onOpenProdList  = () => go("prodList");
  const onOpenSettings  = () => setScreen("settings");
  const onOpenChiffrage = () => go("chiffrageRoot");
  const onOpenInventory = () => go("inventory");

  // 🔴 PERSISTENCE: appelé par ProductionProjectScreen à chaque modif
  const handleUpdateProjectRows = (projectId, newRows) => {
    setProjects((prev) => (prev || []).map((p) => (p.id === projectId ? { ...p, rows: newRows } : p)));
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
        <UserBadge onClick={onOpenSettings} />
      </header>

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
                  let tables = {};
                  try {
                    const raw = localStorage.getItem(`chiffrage.${m.id}.tables`);
                    if (raw) tables = JSON.parse(raw);
                  } catch (e) {
                    console.warn("Impossible de lire tables pour minute", m.id, e);
                  }
                  return { ...m, tables };
                })
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
          onUpdateProjectRows={(newRows) => handleUpdateProjectRows(current.id, newRows)}
        />
      )}

      {/* Paramètres */}
      {screen === "settings" && (
        <SettingsScreen onBack={() => setScreen("home")} />
      )}

      {/* Inventaire */}
      {screen === "inventory" && (
        <InventoryScreen
          minutes={quoteMinutes}
          projects={projects}
          rows={inventoryRows}
          setRows={setInventoryRows}
          onBack={() => setScreen("home")}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ActivityProvider>
        <AppShell />
      </ActivityProvider>
    </AuthProvider>
  );
}