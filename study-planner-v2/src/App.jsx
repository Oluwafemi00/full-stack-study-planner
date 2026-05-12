import { useState, useEffect } from "react";
import { useApp } from "./context/AppContext";
import Sidebar from "./components/Sidebar";
import TaskList from "./components/TaskList";
import Pomodoro from "./components/Pomodoro";
import Dashboard from "./components/Dashboard";
import QuickCapture from "./components/QuickCapture";
import SubjectManager from "./components/SubjectManager";
import StudyAssistant from "./components/StudyAssistant";
import UpdateToast from "./components/UpdateToast";
import { isToday } from "./utils/helpers";
import { verifySession } from "./utils/subscription";

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

  // Handle Stripe redirect back to app after checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const subscribed = params.get("subscribed");

    if (sessionId && subscribed === "true") {
      // Clean URL so refresh doesn't re-trigger
      window.history.replaceState({}, "", window.location.pathname);
      // Verify the session with the proxy — stores token in localStorage
      verifySession(sessionId).catch(console.error);
    }
  }, []);

  const viewLabel = view.startsWith("subject:")
    ? (subjects.find((s) => s.id === view.replace("subject:", ""))?.name ??
      "Subject")
    : (VIEW_LABELS[view] ?? "Today");

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
      <header className="mobile-navbar">
        <button
          className="hamburger"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <span />
          <span />
          <span />
        </button>
        <span className="mobile-view-label">{viewLabel}</span>
        <button
          className="mobile-pomo-btn"
          onClick={() => setPomodoroOpen((p) => !p)}
          aria-label="Toggle timer"
        >
          🍅
        </button>
      </header>

      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="main-content">
        <div className="tablet-timer-bar">
          <button
            className="tablet-timer-btn"
            onClick={() => setPomodoroOpen((p) => !p)}
          >
            🍅 {pomodoroOpen ? "Hide Timer" : "Show Timer"}
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
    </div>
  );
}
