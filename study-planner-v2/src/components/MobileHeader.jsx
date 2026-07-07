import { useState, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";

export default function MobileHeader({ onToggleTimer }) {
  const { state, dispatch } = useApp();
  const { view, subjects, settings, streak } = state;

  // Dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const toggleTheme = () =>
    dispatch({
      type: "UPDATE_SETTINGS",
      payload: { theme: settings.theme === "dark" ? "light" : "dark" },
    });

  const handleSelect = (newView) => {
    dispatch({ type: "SET_VIEW", payload: newView });
    setDropdownOpen(false); // Close menu after selection
  };

  // Close dropdown if user clicks outside of it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Determine what label and color to show on the trigger button
  let activeLabel = "All Tasks";
  let activeColor = null;

  if (view === "manage-subjects") {
    activeLabel = "Manage Subjects";
  } else if (view.startsWith("subject:")) {
    const activeSub = subjects.find((s) => `subject:${s.id}` === view);
    if (activeSub) {
      activeLabel = activeSub.name;
      activeColor = activeSub.color || "var(--accent)";
    }
  }

  return (
    <header className="mobile-header">
      {/* ── Top Row: App Branding, Streak, Timer, and Theme ── */}
      <div className="mobile-header-top">
        <div className="mobile-brand">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span>Study Planner</span>
        </div>

        <div className="mobile-header-actions">
          <div className="streak-badge">
            <span className="streak-flame">🔥</span>
            <span>{streak.count}d streak</span>
          </div>

          {/* Theme Toggle Button (Dynamically swaps Sun and Moon SVGs) */}
          <button
            className="icon-btn"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {settings.theme === "dark" ? (
              /* Sun Icon */
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              /* Moon Icon */
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          {/* Timer Button */}
          <button
            className="icon-btn"
            onClick={onToggleTimer}
            aria-label="Toggle timer"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v4l2 2" />
              <line x1="10" y1="2" x2="14" y2="2" />
              <line x1="12" y1="2" x2="12" y2="5" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Bottom Row: Custom Dropdown ── */}
      <div className="mobile-subject-dropdown" ref={dropdownRef}>
        <button
          className={`dropdown-trigger ${dropdownOpen ? "open" : ""}`}
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          <div className="dropdown-trigger-content">
            {activeColor && (
              <span
                className="subject-dot"
                style={{ backgroundColor: activeColor }}
              ></span>
            )}
            <span>{activeLabel}</span>
          </div>
          <svg
            className="dropdown-chevron"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        {dropdownOpen && (
          <div className="dropdown-menu">
            <button
              className={`dropdown-item ${view === "all" ? "active" : ""}`}
              onClick={() => handleSelect("all")}
            >
              All Tasks
            </button>

            {subjects.map((sub) => (
              <button
                key={sub.id}
                className={`dropdown-item ${view === `subject:${sub.id}` ? "active" : ""}`}
                onClick={() => handleSelect(`subject:${sub.id}`)}
              >
                <span
                  className="subject-dot"
                  style={{ backgroundColor: sub.color || "var(--accent)" }}
                ></span>
                {sub.name}
              </button>
            ))}

            <div className="dropdown-divider"></div>

            <button
              className={`dropdown-item manage-btn ${view === "manage-subjects" ? "active" : ""}`}
              onClick={() => handleSelect("manage-subjects")}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Manage Subjects
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
