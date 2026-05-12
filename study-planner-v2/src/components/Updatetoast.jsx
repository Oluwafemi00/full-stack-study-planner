import { useState, useEffect } from "react";

export default function UpdateToast() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [showOffline, setShowOffline] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    // New SW version is waiting to activate
    const onUpdate = () => setShowUpdate(true);

    // App is now cached and ready for offline use
    const onOffline = () => {
      setShowOffline(true);
      // Auto-dismiss offline ready toast after 4 seconds
      setTimeout(() => setShowOffline(false), 4000);
    };

    window.addEventListener("sw:update-available", onUpdate);
    window.addEventListener("sw:offline-ready", onOffline);
    return () => {
      window.removeEventListener("sw:update-available", onUpdate);
      window.removeEventListener("sw:offline-ready", onOffline);
    };
  }, []);

  // Tell the waiting SW to skip waiting and take control,
  // then reload so the user gets the new version immediately
  async function applyUpdate() {
    setUpdating(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.waiting) {
        // Post message tells the SW to call self.skipWaiting()
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
        // Wait for the new SW to take control then reload
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => {
            window.location.reload();
          },
          { once: true },
        );
      } else {
        // Fallback — just reload
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  }

  function dismissUpdate() {
    setShowUpdate(false);
  }

  return (
    <>
      {/* Update available toast */}
      {showUpdate && (
        <div className="update-toast update-toast--update" role="alert">
          <div className="update-toast-left">
            <span className="update-toast-icon">↑</span>
            <div>
              <p className="update-toast-title">Update available</p>
              <p className="update-toast-sub">
                A new version of Study Planner is ready.
              </p>
            </div>
          </div>
          <div className="update-toast-actions">
            <button
              className="update-toast-btn-primary"
              onClick={applyUpdate}
              disabled={updating}
            >
              {updating ? "Updating…" : "Update now"}
            </button>
            <button className="update-toast-btn-ghost" onClick={dismissUpdate}>
              Later
            </button>
          </div>
        </div>
      )}

      {/* Offline ready toast */}
      {showOffline && (
        <div className="update-toast update-toast--offline" role="status">
          <span className="update-toast-icon">✓</span>
          <p className="update-toast-title">Ready to use offline</p>
        </div>
      )}
    </>
  );
}
