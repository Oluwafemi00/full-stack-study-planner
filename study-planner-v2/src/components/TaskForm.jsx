import { useState } from "react";
import { useApp } from "../context/AppContext";
import { uid, todayStr } from "../utils/helpers";

export default function TaskForm({ onClose, defaultSubjectId = "" }) {
  const { state, dispatch } = useApp();
  const { subjects } = state;

  const [text, setText] = useState("");
  const [subjectId, setSubject] = useState(defaultSubjectId);
  const [date, setDate] = useState(todayStr());
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState("medium");
  const [notes, setNotes] = useState("");
  const [estSessions, setEst] = useState(1);
  const [subtaskInput, setSubInput] = useState("");
  const [subtasks, setSubtasks] = useState([]);
  const [showAdvanced, setAdvanced] = useState(false);

  const addSubtask = () => {
    if (!subtaskInput.trim()) return;
    setSubtasks((s) => [
      ...s,
      { id: uid(), text: subtaskInput.trim(), completed: false },
    ]);
    setSubInput("");
  };

  const removeSubtask = (id) =>
    setSubtasks((s) => s.filter((st) => st.id !== id));

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    dispatch({
      type: "ADD_TASK",
      payload: {
        text,
        subjectId,
        date,
        dueTime,
        priority,
        notes,
        estSessions,
        subtasks,
      },
    });
    onClose?.();
  };

  const PRIORITIES = ["low", "medium", "high"];
  const PRIORITY_COLORS = {
    low: "var(--green)",
    medium: "var(--amber)",
    high: "var(--red)",
  };

  return (
    <form className="task-form" onSubmit={submit}>
      <div className="task-form-main">
        <input
          autoFocus
          className="task-input-primary"
          placeholder="What are you studying?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
        />

        <div className="task-form-row">
          <select
            className="form-select"
            value={subjectId}
            onChange={(e) => setSubject(e.target.value)}
          >
            <option value="">No subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <input
            className="form-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />

          <div className="priority-group">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                className={`priority-chip ${priority === p ? "active" : ""}`}
                style={
                  priority === p
                    ? {
                        background: PRIORITY_COLORS[p],
                        borderColor: PRIORITY_COLORS[p],
                        color: "#fff",
                      }
                    : {}
                }
                onClick={() => setPriority(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="toggle-advanced"
          onClick={() => setAdvanced((a) => !a)}
        >
          {showAdvanced ? "↑ Less" : "↓ More options"}
        </button>

        {showAdvanced && (
          <div className="advanced-fields">
            <input
              className="form-input"
              type="time"
              placeholder="Due time (optional)"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
            />

            <div className="est-sessions-row">
              <label>Estimated Study sessions</label>
              <div className="est-stepper">
                <button
                  type="button"
                  onClick={() => setEst((n) => Math.max(1, n - 1))}
                >
                  -
                </button>
                <span>{estSessions}</span>
                <button
                  type="button"
                  onClick={() => setEst((n) => Math.min(20, n + 1))}
                >
                  +
                </button>
              </div>
            </div>

            <textarea
              className="form-textarea"
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />

            <div className="subtasks-section">
              <label className="subtasks-label">Subtasks / checklist</label>
              <div className="subtask-input-row">
                <input
                  className="form-input"
                  placeholder="Add a step..."
                  value={subtaskInput}
                  onChange={(e) => setSubInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && (e.preventDefault(), addSubtask())
                  }
                />
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={addSubtask}
                >
                  Add
                </button>
              </div>
              {subtasks.map((st) => (
                <div key={st.id} className="subtask-chip">
                  <span>{st.text}</span>
                  <button type="button" onClick={() => removeSubtask(st.id)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="task-form-actions">
        {onClose && (
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn-primary">
          Add Task
        </button>
      </div>
    </form>
  );
}
