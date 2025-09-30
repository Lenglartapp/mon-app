// src/App.jsx
import React, { useState } from "react";
import { COLORS, S } from "./lib/constants/ui";
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

// --- Badge utilisateur (nom + avatar), cliquable vers Paramètres
function UserBadge({ onClick }) {
  const { currentUser } = useAuth();
  const hasAvatar = Boolean(currentUser?.avatarUrl);

  return (
    <button
      style={S.userBtn}
      onClick={onClick}
      aria-label="Profil utilisateur"
      title="Ouvrir mes paramètres"
    >
      <div style={S.avatarBox}>
        {hasAvatar ? (
          <img
            src={currentUser.avatarUrl}
            alt="Avatar"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div>AL</div>
        )}
      </div>
      <span style={{ fontWeight: 600 }}>{currentUser?.name || "Utilisateur"}</span>
    </button>
  );
}

export default function App() {
  const [screen, setScreen] = useState("home"); // home | prodList | project | chiffrageRoot | chiffrage | settings
  const [logoOk, setLogoOk] = useState(true);
  const [projects, setProjects] = useState(DEMO_PROJECTS);
  const [current, setCurrent] = useState(null);
  const [quoteMinutes, setQuoteMinutes] = useLocalStorage("chiffrage.minutes", []);
  const [openMinuteId, setOpenMinuteId] = useState(null);

  const LOGO_SRC = "/logo.png";

  return (
    <AuthProvider>
      <ActivityProvider>
        <div style={S.page}>
          <header style={S.header}>
            <button
              style={S.brandBtn}
              onClick={() => setScreen("home")}
              aria-label="Retour à l'accueil"
            >
              {logoOk ? (
                <img
                  src={LOGO_SRC}
                  alt="LENGLART"
                  style={{ height: "clamp(24px, 5vw, 36px)", width: "auto" }}
                  onError={() => setLogoOk(false)}
                />
              ) : (
                <span style={S.logoText}>LENGLART</span>
              )}
            </button>

            {/* Badge utilisateur (nom + avatar) */}
            <UserBadge onClick={() => setScreen("settings")} />
          </header>

          {/* === Accueil === */}
          {screen === "home" && (
            <HomeScreen
              onOpenProdList={() => setScreen("prodList")}
              onOpenSettings={() => setScreen("settings")}
              onOpenChiffrage={() => setScreen("chiffrageRoot")}
            />
          )}

          {/* === Liste Production === */}
          {screen === "prodList" && (
            <ProjectListScreen
  projects={projects}
  setProjects={setProjects}
  onOpenProject={(p) => { setCurrent(p); setScreen("project"); }}
  minutes={quoteMinutes.map(m => {
    let tables = {};
    try {
      const raw = localStorage.getItem(`chiffrage.${m.id}.tables`);
      if (raw) tables = JSON.parse(raw);
    } catch (e) {
      console.warn("Impossible de lire tables pour minute", m.id, e);
    }
    return { ...m, tables };
  })}
/>
          )}

          {/* === Chiffrage : LISTE === */}
          {screen === "chiffrageRoot" && (
            <ChiffrageRoot
              minutes={quoteMinutes}
              setMinutes={setQuoteMinutes}
              onBack={() => setScreen("home")}
              onOpenMinute={(id) => {
                setOpenMinuteId(id);
                setScreen("chiffrage");
              }}
            />
          )}

          {/* === Chiffrage : ÉDITEUR === */}
          {screen === "chiffrage" && openMinuteId && (
            <ChiffrageScreen
              minuteId={openMinuteId}
              minutes={quoteMinutes}
              setMinutes={setQuoteMinutes}
              onBack={() => setScreen("chiffrageRoot")}
            />
          )}

          {/* === Projet Production === */}
          {screen === "project" && current && (
            <ProductionProjectScreen
              project={current}
              onBack={() => setScreen("prodList")}
            />
          )}

          {/* === Paramètres === */}
          {screen === "settings" && (
            <SettingsScreen onBack={() => setScreen("home")} />
          )}
        </div>
      </ActivityProvider>
    </AuthProvider>
  );
}