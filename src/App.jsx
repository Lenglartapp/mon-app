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
import InventoryScreen from "./screens/InventoryScreen.jsx";

// 🔐 ACL
import { can } from "./lib/authz";
import Require from "./components/Require";

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

// ── Contenu réel de l’app (besoin de useAuth ici)
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

  // Handlers Home
  const onOpenProdList  = () => setScreen("prodList");
  const onOpenSettings  = () => setScreen("settings");
  const onOpenChiffrage = () => setScreen("chiffrageRoot");
  const onOpenInventory = () => setScreen("inventory");

  return (
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

        {/* Badge utilisateur */}
        <UserBadge onClick={onOpenSettings} />
      </header>

      {/* === Accueil === */}
      {screen === "home" && (
        <HomeScreen
          onOpenProdList={onOpenProdList}
          onOpenSettings={onOpenSettings}
          onOpenChiffrage={onOpenChiffrage}
          onOpenInventory={onOpenInventory}
        />
      )}

      {/* === Liste Production (protégée) === */}
      {screen === "prodList" && (
        <Require perm="production.view">
          <ProjectListScreen
            projects={projects}
            setProjects={setProjects}
            onOpenProject={(p) => { setCurrent(p); setScreen("project"); }}
            // minutes dispo seulement si droit chiffrage.view
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
        </Require>
      )}

      {/* === Chiffrage : LISTE (protégée) === */}
      {screen === "chiffrageRoot" && (
        <Require perm="chiffrage.view">
          <ChiffrageRoot
            minutes={quoteMinutes}
            setMinutes={setQuoteMinutes}
            onBack={() => setScreen("home")}
            onOpenMinute={(id) => {
              setOpenMinuteId(id);
              setScreen("chiffrage");
            }}
          />
        </Require>
      )}

      {/* === Chiffrage : ÉDITEUR (protégée) === */}
      {screen === "chiffrage" && openMinuteId && (
        <Require perm="chiffrage.view">
          <ChiffrageScreen
            minuteId={openMinuteId}
            minutes={quoteMinutes}
            setMinutes={setQuoteMinutes}
            onBack={() => setScreen("chiffrageRoot")}
          />
        </Require>
      )}

      {/* === Projet Production (protégée) === */}
      {screen === "project" && current && (
        <Require perm="production.view">
          <ProductionProjectScreen
            project={current}
            onBack={() => setScreen("prodList")}
          />
        </Require>
      )}

      {/* === Paramètres (accessible à tous — l’onglet Utilisateurs est restreint en interne) === */}
      {screen === "settings" && (
        <SettingsScreen onBack={() => setScreen("home")} />
      )}

      {/* === Inventaire (protégée) === */}
      {screen === "inventory" && (
        <Require perm="inventory.view">
          <InventoryScreen
            minutes={quoteMinutes}
            projects={projects}
            rows={inventoryRows}
            setRows={setInventoryRows}
            onBack={() => setScreen("home")}
          />
        </Require>
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