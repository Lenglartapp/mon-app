// src/main.jsx
import React from 'react';
import ReactDOM from "react-dom/client";
import "./index.css";

// AG Grid Enterprise
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { AllEnterpriseModule, LicenseManager } from 'ag-grid-enterprise';
LicenseManager.setLicenseKey('Using_this_{AG_Grid}_Enterprise_key_{AG-127260}_in_excess_of_the_licence_granted_is_not_permitted___Please_report_misuse_to_legal@ag-grid.com___For_help_with_changing_this_key_please_contact_info@ag-grid.com___{Lenglart}_is_granted_a_{Single_Application}_Developer_License_for_the_application_{Droitfil}_only_for_{1}_Front-End_JavaScript_developer___All_Front-End_JavaScript_developers_working_on_{Droitfil}_need_to_be_licensed___{Droitfil}_has_not_been_granted_a_Deployment_License_Add-on___This_key_works_with_{AG_Grid}_Enterprise_versions_released_before_{24_April_2027}____[v3]_[01]_MTgwODUyMTIwMDAwMA==d43c1dfca1cacd3e42537e196b6b2780');
ModuleRegistry.registerModules([AllCommunityModule, AllEnterpriseModule]);

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

const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

if (isLocalhost) {
  // En dev/local : on NE veut jamais de service worker. On désinstalle tout SW
  // résiduel (d'un ancien build / preview) et on vide ses caches, sinon il sert
  // du code périmé et casse le hot-reload. → le bug du cache ne peut plus revenir.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {});
  }
  if (window.caches?.keys) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
  }
} else {
  // En production uniquement : enregistrement normal du SW (mode hors-ligne).
  registerSW({ immediate: true });
}

// ====== Montage ======
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      {/* Pour tester le montage de base, remplace <App /> par <SmokeApp /> */}
    </ErrorBoundary>
  </React.StrictMode>
);