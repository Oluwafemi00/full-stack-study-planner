import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";

const NAV = [
  { id: "today", icon: "◈", label: "Today" },
  { id: "all", icon: "⊞", label: "All Tasks" },
  { id: "study-assistant", icon: "◈", label: "Study Assistant", soon: false },
  { id: "dashboard", icon: "◉", label: "Dashboard" },
];

export default function Sidebar({ mobileOpen, onClose }) {
  const { state, dispatch } = useApp();
  const { view, subjects, settings } = state;
  const [showSettings, setShowSettings] = useState(false);

  // Close drawer on Escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && mobileOpen) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mobileOpen, onClose]);

  // Close drawer when view changes on mobile
  const setView = (v) => {
    dispatch({ type: "SET_VIEW", payload: v });
    onClose();
  };

  const toggleTheme = () =>
    dispatch({
      type: "UPDATE_SETTINGS",
      payload: { theme: settings.theme === "dark" ? "light" : "dark" },
    });

  const sidebarContent = (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-mark">SP</span>
        <div>
          <div className="logo-title">Study Planner</div>
          <div className="logo-version">v2.0</div>
        </div>
        {/* Close button — only visible on mobile */}
        <button
          className="sidebar-close-btn"
          onClick={onClose}
          aria-label="Close menu"
        >
          ✕
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">STUDY SPACE</div>
        {NAV.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${view === item.id ? "active" : ""}`}
            onClick={() => setView(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
            {item.soon && <span className="nav-soon-badge">Soon</span>}
          </button>
        ))}

        <div className="nav-section-label" style={{ marginTop: "1.5rem" }}>
          Subjects
        </div>

        {subjects.map((sub) => (
          <button
            key={sub.id}
            className={`nav-item ${view === `subject:${sub.id}` ? "active" : ""}`}
            onClick={() => setView(`subject:${sub.id}`)}
          >
            <span className="subject-dot" style={{ background: sub.color }} />
            <span>{sub.name}</span>
            <span className="nav-count">
              {state.tasks.filter((t) => t.subjectId === sub.id && !t.completed)
                .length || ""}
            </span>
          </button>
        ))}

        <button
          className="nav-item add-subject-btn"
          onClick={() => setView("manage-subjects")}
        >
          <span className="nav-icon">+</span>
          <span>Manage Subjects</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <button className="theme-btn" onClick={toggleTheme}>
          {settings.theme === "dark" ? "○ Light" : "● Dark"}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div className="streak-badge">
            <span className="streak-flame">🔥</span>
            <span>{state.streak.count}d streak</span>
          </div>
          {/* <button
            className="settings-icon-btn"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            ⚙
          </button> */}
        </div>
      </div>

      {/* Settings modal */}
      {/* {showSettings && (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Settings</h3>
              <button
                className="modal-close"
                onClick={() => setShowSettings(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="settings-section">
                <div className="settings-section-label">AI Study Assistant</div>
                <div className="settings-key-status">
                  <span className="ai-indicator" />
                  <span>AI is ready — no setup needed.</span>
                </div>
                <p className="settings-hint">
                  The AI assistant is powered by Google Gemini 1.5 Flash via a
                  secure server proxy. Your data is never stored.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-ghost"
                onClick={() => setShowSettings(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )} */}
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <div className="sidebar-desktop">{sidebarContent}</div>

      {/* Mobile drawer */}
      <div
        className={`sidebar-drawer-overlay ${mobileOpen ? "open" : ""}`}
        onClick={onClose}
      >
        <div className="sidebar-drawer" onClick={(e) => e.stopPropagation()}>
          {sidebarContent}
        </div>
      </div>
    </>
  );
}
