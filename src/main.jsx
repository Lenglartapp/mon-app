// src/main.jsx
import React from 'react';
import ReactDOM from "react-dom/client";
import "./index.css";

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

// ====== Service Worker Registration for PWA ======
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
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