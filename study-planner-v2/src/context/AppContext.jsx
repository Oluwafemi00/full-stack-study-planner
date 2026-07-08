import { createContext, useContext, useReducer, useEffect } from "react";

const DEFAULT_SUBJECTS = [
  { id: "s1", name: "General Studies", color: "#6366f1" },
];

const DEFAULT_SETTINGS = {
  workDuration: 25,
  breakDuration: 5,
  longBreakDuration: 15,
  sessionsBeforeLong: 4,
  autoAdvance: false,
  soundEnabled: true,
  theme: "dark",
};

function loadState() {
  try {
    const raw = localStorage.getItem("spp_v2");
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function getInitialState() {
  const saved = loadState();
  return {
    subjects: saved?.subjects ?? DEFAULT_SUBJECTS,
    tasks: saved?.tasks ?? [],
    sessionHistory: saved?.sessionHistory ?? [],
    streak: saved?.streak ?? { count: 0, lastDate: null },
    settings: saved?.settings ?? DEFAULT_SETTINGS,
    view: saved?.view ?? "today",
    activeFileId: saved?.activeFileId ?? null, // Added
    files: saved?.files ?? [], // Added: Lightweight metadata array
    filterStatus: "all",
    quickCaptureOpen: false,
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "ADD_TASK": {
      const task = {
        id: Date.now(),
        text: action.payload.text,
        subjectId: action.payload.subjectId || null,
        date: action.payload.date,
        dueTime: action.payload.dueTime || null,
        priority: action.payload.priority || "medium",
        notes: action.payload.notes || "",
        subtasks: action.payload.subtasks || [],
        estSessions: action.payload.estSessions || 1,
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
      return { ...state, tasks: [task, ...state.tasks] };
    }

    case "UPDATE_TASK":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload.id ? { ...t, ...action.payload.changes } : t,
        ),
      };

    case "TOGGLE_TASK": {
      const now = new Date().toISOString();
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload
            ? {
                ...t,
                completed: !t.completed,
                completedAt: !t.completed ? now : null,
              }
            : t,
        ),
      };
    }

    case "DELETE_TASK":
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.payload),
      };

    case "CLEAR_COMPLETED":
      return { ...state, tasks: state.tasks.filter((t) => !t.completed) };

    case "REORDER_TASKS":
      return { ...state, tasks: action.payload };

    case "TOGGLE_SUBTASK": {
      const { taskId, subtaskId } = action.payload;
      return {
        ...state,
        tasks: state.tasks.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            subtasks: t.subtasks.map((s) =>
              s.id === subtaskId ? { ...s, completed: !s.completed } : s,
            ),
          };
        }),
      };
    }

    case "ADD_SUBJECT": {
      const subject = { id: `s${Date.now()}`, ...action.payload };
      return { ...state, subjects: [...state.subjects, subject] };
    }
    case "DELETE_SUBJECT":
      return {
        ...state,
        subjects: state.subjects.filter((s) => s.id !== action.payload),
      };
    case "UPDATE_SUBJECT":
      return {
        ...state,
        subjects: state.subjects.map((s) =>
          s.id === action.payload.id ? { ...s, ...action.payload.changes } : s,
        ),
      };

    case "LOG_SESSION": {
      const todayStr = new Date().toDateString();
      const entry = {
        ...action.payload,
        completedAt: new Date().toISOString(),
      };
      const lastDate = state.streak.lastDate;
      let count = state.streak.count;
      if (lastDate !== todayStr) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        count = lastDate === yesterday.toDateString() ? count + 1 : 1;
      }
      return {
        ...state,
        sessionHistory: [entry, ...state.sessionHistory].slice(0, 500),
        streak: { count, lastDate: todayStr },
      };
    }

    case "UPDATE_SETTINGS":
      return { ...state, settings: { ...state.settings, ...action.payload } };

    case "SET_VIEW":
      return { ...state, view: action.payload };
    case "SET_FILTER":
      return { ...state, filterStatus: action.payload };
    case "SET_QUICK_CAPTURE":
      return { ...state, quickCaptureOpen: action.payload };

    // --- NEW FILE CASES ---
    case "ADD_FILE_META":
      return { ...state, files: [action.payload, ...state.files] };

    case "DELETE_FILE":
      return {
        ...state,
        files: state.files.filter((f) => f.id !== action.payload),
        // If they delete the file they are currently viewing, kick them back
        activeFileId:
          state.activeFileId === action.payload ? null : state.activeFileId,
      };

    case "OPEN_FILE":
      return { ...state, activeFileId: action.payload };

    case "CLOSE_FILE":
      return { ...state, activeFileId: null };

    default:
      return state;
  }
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);

  // Persist to localStorage with a high-performance 500ms debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const { filterStatus, quickCaptureOpen, ...persisted } = state;
      localStorage.setItem("spp_v2", JSON.stringify(persisted));
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [state]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", state.settings.theme);
  }, [state.settings.theme]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        dispatch({ type: "SET_QUICK_CAPTURE", payload: true });
      }
      if (e.key === "Escape") {
        dispatch({ type: "SET_QUICK_CAPTURE", payload: false });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
