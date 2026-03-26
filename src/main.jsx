// src/main.jsx
import React from 'react';
import ReactDOM from "react-dom/client";
import "./index.css";

// AG Grid — enregistrement global des modules Community (une seule fois au démarrage)
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
ModuleRegistry.registerModules([AllCommunityModule]);

import App from "./App.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
// 🔁 Pour isoler : passe temporairement <App/> ⇄ <SmokeApp/> si besoin
// import SmokeApp from "./SmokeApp.jsx";

// ====== Garde-fous globaux (voient tout, même hors React) ======
window.addEventListener("error", (e) => {
  console.error("Global error:", e.error || e.message || e);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled promise:", e.reason);
});

// ====== Service Worker Registration for PWA (géré par vite-plugin-pwa) ======
import { registerSW } from 'virtual:pwa-register';
registerSW({ immediate: true });

// ====== Montage ======
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      {/* Pour tester le montage de base, remplace <App /> par <SmokeApp /> */}
    </ErrorBoundary>
  </React.StrictMode>
);