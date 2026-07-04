import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { AppProvider } from "./context/AppContext.jsx";
import { SpeedInsights } from "@vercel/speed-insights/react";
import "./index.css";

// Register service worker with update detection
// useRegisterSW gives us callbacks for when a new SW is waiting
async function registerSW() {
  if ("serviceWorker" in navigator) {
    try {
      // vite-plugin-pwa generates this virtual module at build time
      const { registerSW } = await import("virtual:pwa-register");

      registerSW({
        // Called when a new service worker is installed and waiting
        onNeedRefresh() {
          // Dispatch a custom event — UpdateToast listens for this
          window.dispatchEvent(new CustomEvent("sw:update-available"));
        },
        // Called when the app is ready to work offline
        onOfflineReady() {
          window.dispatchEvent(new CustomEvent("sw:offline-ready"));
        },
        // Called on SW registration error
        onRegisterError(error) {
          console.error("SW registration error:", error);
        },
      });
    } catch {
      // virtual:pwa-register only exists after vite build — safe to ignore in dev
    }
  }
}

registerSW();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>,
);
