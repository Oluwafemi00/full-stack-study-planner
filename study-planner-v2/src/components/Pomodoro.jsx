import { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { formatTime } from "../utils/helpers";

const MODES = ["work", "break", "longBreak"];
const MODE_LABELS = {
  work: "Focus",
  break: "Short Break",
  longBreak: "Long Break",
};

// ── localStorage helpers ──────────────────────────────────────────────────
const POMO_KEY = "spp_pomo";

function savePomo(data) {
  try {
    localStorage.setItem(POMO_KEY, JSON.stringify(data));
  } catch {}
}

function loadPomo() {
  try {
    const raw = localStorage.getItem(POMO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function Pomodoro() {
  const { state, dispatch } = useApp();
  const { settings, tasks, sessionHistory } = state;
  const s = settings;

  const saved = loadPomo();

  // Restore mode and sessionsThisRound from localStorage
  const [mode, setMode] = useState(saved?.mode ?? "work");
  const [sessionsThisRound, setSessions] = useState(
    saved?.sessionsThisRound ?? 0,
  );
  const [linkedTaskId, setLinked] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [localSettings, setLocal] = useState({ ...s });

  const intervalRef = useRef(null);
  const audioCtx = useRef(null);

  const getDuration = useCallback(
    (m, cfg = s) => {
      if (m === "work") return cfg.workDuration * 60;
      if (m === "break") return cfg.breakDuration * 60;
      if (m === "longBreak") return cfg.longBreakDuration * 60;
      return 25 * 60;
    },
    [s],
  );

  // Restore secondsLeft — fall back to full duration if nothing saved
  const [secondsLeft, setSeconds] = useState(() => {
    if (saved?.secondsLeft != null && saved?.mode) {
      return saved.secondsLeft;
    }
    return saved?.mode ? getDuration(saved.mode) : getDuration("work");
  });

  // Timer never restores as running — user must press play after reload
  const [running, setRunning] = useState(false);

  // Save pomo state whenever it changes
  useEffect(() => {
    savePomo({ mode, secondsLeft, sessionsThisRound });
  }, [mode, secondsLeft, sessionsThisRound]);

  // Sync seconds when settings change (only if not running)
  useEffect(() => {
    if (!running) setSeconds(getDuration(mode));
  }, [s.workDuration, s.breakDuration, s.longBreakDuration]);

  // Browser tab title
  useEffect(() => {
    document.title = running
      ? `${formatTime(secondsLeft)} — ${MODE_LABELS[mode]} · Study Planner`
      : "Study Planner Pro";
    return () => {
      document.title = "Study Planner Pro";
    };
  }, [secondsLeft, running, mode]);

  // Chime
  const playChime = useCallback(() => {
    if (!s.soundEnabled) return;
    try {
      if (!audioCtx.current)
        audioCtx.current = new (
          window.AudioContext || window.webkitAudioContext
        )();
      const ctx = audioCtx.current;
      const freqs = [523, 659, 784];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = "sine";
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.2);
        gain.gain.linearRampToValueAtTime(
          0.3,
          ctx.currentTime + i * 0.2 + 0.05,
        );
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + i * 0.2 + 0.6,
        );
        osc.start(ctx.currentTime + i * 0.2);
        osc.stop(ctx.currentTime + i * 0.2 + 0.6);
      });
    } catch {}
  }, [s.soundEnabled]);

  // Session complete
  const onSessionComplete = useCallback(() => {
    playChime();
    if (mode === "work") {
      const newCount = sessionsThisRound + 1;
      setSessions(newCount);
      dispatch({
        type: "LOG_SESSION",
        payload: {
          subjectId:
            tasks.find((t) => t.id === Number(linkedTaskId))?.subjectId ?? null,
          taskId: linkedTaskId ? Number(linkedTaskId) : null,
          mode: "work",
        },
      });
      const nextMode =
        newCount % s.sessionsBeforeLong === 0 ? "longBreak" : "break";
      setMode(nextMode);
      setSeconds(getDuration(nextMode));
      setRunning(s.autoAdvance);
    } else {
      setMode("work");
      setSeconds(getDuration("work"));
      setRunning(s.autoAdvance);
    }
  }, [
    mode,
    sessionsThisRound,
    linkedTaskId,
    s,
    tasks,
    dispatch,
    playChime,
    getDuration,
  ]);

  // Tick
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            onSessionComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, onSessionComplete]);

  const toggle = () => setRunning((r) => !r);

  const reset = () => {
    setRunning(false);
    const duration = getDuration(mode);
    setSeconds(duration);
    savePomo({ mode, secondsLeft: duration, sessionsThisRound });
  };

  const switchMode = (m) => {
    setRunning(false);
    setMode(m);
    const duration = getDuration(m);
    setSeconds(duration);
    savePomo({ mode: m, secondsLeft: duration, sessionsThisRound });
  };

  const saveSettings = () => {
    dispatch({ type: "UPDATE_SETTINGS", payload: localSettings });
    setShowSettings(false);
    setRunning(false);
    setSeconds(getDuration(mode, localSettings));
  };

  // Ring
  const total = getDuration(mode);
  const progress = (total - secondsLeft) / total;
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const dash = circ * progress;
  const modeColor =
    mode === "work"
      ? "var(--accent)"
      : mode === "break"
        ? "var(--green)"
        : "var(--blue)";

  const todaySessions = sessionHistory.filter(
    (s) =>
      new Date(s.completedAt).toDateString() === new Date().toDateString() &&
      s.mode === "work",
  ).length;

  const pendingTasks = tasks.filter((t) => !t.completed);

  return (
    <div className="pomodoro-card">
      {/* Mode tabs */}
      <div className="pomo-mode-tabs">
        {MODES.map((m) => (
          <button
            key={m}
            className={`pomo-tab ${mode === m ? "active" : ""}`}
            onClick={() => switchMode(m)}
            style={
              mode === m ? { borderColor: modeColor, color: modeColor } : {}
            }
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Ring timer */}
      <div className="pomo-ring-wrap">
        <svg width="140" height="140" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth="4"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={modeColor}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            transform="rotate(-90 60 60)"
            style={{ transition: "stroke-dasharray 0.5s ease, stroke 0.4s" }}
          />
        </svg>
        <div className="pomo-time-overlay">
          <div className="pomo-time">{formatTime(secondsLeft)}</div>
          <div className="pomo-mode-label" style={{ color: modeColor }}>
            {MODE_LABELS[mode]}
          </div>
        </div>
      </div>

      {/* Session dots */}
      <div className="pomo-session-dots">
        {Array.from({ length: s.sessionsBeforeLong }).map((_, i) => (
          <span
            key={i}
            className={`session-dot ${i < sessionsThisRound % s.sessionsBeforeLong ? "filled" : ""}`}
            style={
              i < sessionsThisRound % s.sessionsBeforeLong
                ? { background: modeColor }
                : {}
            }
          />
        ))}
      </div>

      {/* Controls */}
      <div className="pomo-controls">
        <button className="pomo-btn-secondary" onClick={reset}>
          ↺
        </button>
        <button
          className="pomo-btn-primary"
          onClick={toggle}
          style={{ background: modeColor }}
        >
          {running ? "⏸" : "▶"}
        </button>
        <button
          className="pomo-btn-secondary"
          onClick={() => setShowSettings(true)}
        >
          ⚙
        </button>
      </div>

      {/* Link task */}
      <div className="pomo-link-task">
        <label className="pomo-link-label">Linked task</label>
        <select
          className="pomo-select"
          value={linkedTaskId}
          onChange={(e) => setLinked(e.target.value)}
        >
          <option value="">— None —</option>
          {pendingTasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.text}
            </option>
          ))}
        </select>
      </div>

      {/* Today stat */}
      <div className="pomo-today-stat">
        <span className="pomo-stat-num">{todaySessions}</span>
        <span className="pomo-stat-label">sessions today</span>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Timer Settings</h3>
              <button
                className="modal-close"
                onClick={() => setShowSettings(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {[
                { key: "workDuration", label: "Focus (min)", min: 1, max: 120 },
                {
                  key: "breakDuration",
                  label: "Short break (min)",
                  min: 1,
                  max: 60,
                },
                {
                  key: "longBreakDuration",
                  label: "Long break (min)",
                  min: 1,
                  max: 60,
                },
                {
                  key: "sessionsBeforeLong",
                  label: "Sessions per round",
                  min: 1,
                  max: 10,
                },
              ].map(({ key, label, min, max }) => (
                <div className="setting-row" key={key}>
                  <label>{label}</label>
                  <input
                    type="number"
                    min={min}
                    max={max}
                    value={localSettings[key]}
                    onChange={(e) =>
                      setLocal((p) => ({ ...p, [key]: Number(e.target.value) }))
                    }
                  />
                </div>
              ))}
              <div className="setting-row">
                <label>Auto-advance</label>
                <input
                  type="checkbox"
                  checked={localSettings.autoAdvance}
                  onChange={(e) =>
                    setLocal((p) => ({ ...p, autoAdvance: e.target.checked }))
                  }
                />
              </div>
              <div className="setting-row">
                <label>Sound</label>
                <input
                  type="checkbox"
                  checked={localSettings.soundEnabled}
                  onChange={(e) =>
                    setLocal((p) => ({ ...p, soundEnabled: e.target.checked }))
                  }
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-ghost"
                onClick={() => setShowSettings(false)}
              >
                Cancel
              </button>
              <button className="btn-primary" onClick={saveSettings}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
