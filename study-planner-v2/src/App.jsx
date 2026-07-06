import { useState, useEffect } from "react";
import { useApp } from "./context/AppContext";
import Sidebar from "./components/Sidebar";
import TaskList from "./components/TaskList";
import Pomodoro from "./components/Pomodoro";
import Dashboard from "./components/Dashboard";
import QuickCapture from "./components/QuickCapture";
import SubjectManager from "./components/SubjectManager";
import StudyAssistant from "./components/StudyAssistant";
import BottomNav from "./components/BottomNav";
import UpdateToast from "./components/UpdateToast";
import FeedbackWidget from "./components/FeedbackWidget";
import { isToday } from "./utils/helpers";
import { initGA, trackPage } from "./utils/analytics";

const VIEW_LABELS = {
  today: "Today",
  all: "All Tasks",
  dashboard: "Dashboard",
  "manage-subjects": "Subjects",
  "study-assistant": "Study Assistant",
};

export default function App() {
  const { state } = useApp();
  const { view, subjects } = state;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pomodoroOpen, setPomodoroOpen] = useState(false);

  useEffect(() => {
    initGA();

    trackPage("app_open");
  }, []);

  useEffect(() => {
    trackPage(view);
  }, [view]);

  const viewLabel = view.startsWith("subject:")
    ? (subjects.find((s) => s.id === view.replace("subject:", ""))?.name ??
      "Subject")
    : (VIEW_LABELS[view] ?? "Today");

  useEffect(() => {
    if (view.startsWith("subject:")) {
      const subjectId = view.replace("subject:", "");
      const subject = subjects.find((s) => s.id === subjectId);

      trackPage(`subject_${subject?.name || "unknown"}`);
    } else {
      trackPage(view);
    }
  }, [view, subjects]);

  const renderMain = () => {
    if (view === "today")
      return <TaskList title="Today" filterFn={(t) => isToday(t.date)} />;
    if (view === "all")
      return <TaskList title="All Tasks" filterFn={() => true} />;
    if (view === "dashboard") return <Dashboard />;
    if (view === "manage-subjects") return <SubjectManager />;
    if (view === "study-assistant") return <StudyAssistant />;
    if (view.startsWith("subject:")) {
      const subjectId = view.replace("subject:", "");
      const subject = subjects.find((s) => s.id === subjectId);
      return (
        <TaskList
          title={subject?.name ?? "Subject"}
          filterFn={(t) => t.subjectId === subjectId}
        />
      );
    }
    return <TaskList title="Today" filterFn={(t) => isToday(t.date)} />;
  };

  return (
    <div className="app-layout">
      {/* PWA update toast — sits above everything */}
      <UpdateToast />

      {/* Mobile top navbar */}
      {/* Mobile top navbar */}
      <header className="mobile-navbar">
        {/* New App Logo replacing viewLabel */}
        <div
          className="mobile-logo-wrap"
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Hexagon shape */}
            <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
            {/* Inner checkmark */}
            <path d="M9 12l2 2 4-4" />
          </svg>
          <span
            style={{
              fontFamily: "var(--serif)",
              fontSize: "1.05rem",
              color: "var(--text)",
              letterSpacing: "-0.02em",
            }}
          >
            Study Planner
          </span>
        </div>

        <button
          className="mobile-pomo-btn"
          onClick={() => setPomodoroOpen((p) => !p)}
          aria-label="Toggle timer"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
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
      </header>
      <BottomNav />
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="main-content">
        <div className="tablet-timer-bar">
          <button
            className="tablet-timer-btn"
            onClick={() => setPomodoroOpen((p) => !p)}
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
            {pomodoroOpen ? "Hide Timer" : "Set Timer"}
          </button>
        </div>
        <div className="main-inner">{renderMain()}</div>
      </main>

      <aside className={`right-panel ${pomodoroOpen ? "pomo-sheet-open" : ""}`}>
        <div className="right-panel-header">
          <span className="right-panel-title">Pomodoro Timer</span>
          <button
            className="right-panel-close"
            onClick={() => setPomodoroOpen(false)}
          >
            ✕
          </button>
        </div>
        <Pomodoro />
      </aside>

      <QuickCapture />
      <FeedbackWidget />
    </div>
  );
}
