import { useState } from "react";
import { useApp } from "../context/AppContext";
import { formatDate, isOverdue, isToday } from "../utils/helpers";

export default function TaskItem({ task, dragHandlers }) {
  const { state, dispatch } = useApp();
  const { subjects } = state;
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);

  const subject = subjects.find((s) => s.id === task.subjectId);
  const overdue = isOverdue(task.date) && !task.completed;
  const today = isToday(task.date);

  const toggle = () => dispatch({ type: "TOGGLE_TASK", payload: task.id });
  const del = () => dispatch({ type: "DELETE_TASK", payload: task.id });

  const saveEdit = () => {
    if (editText.trim())
      dispatch({
        type: "UPDATE_TASK",
        payload: { id: task.id, changes: { text: editText } },
      });
    setEditing(false);
  };

  const toggleSubtask = (subtaskId) =>
    dispatch({
      type: "TOGGLE_SUBTASK",
      payload: { taskId: task.id, subtaskId },
    });

  const subtasksDone = task.subtasks.filter((s) => s.completed).length;
  const subtasksTotal = task.subtasks.length;

  // We use inline CSS variables to pass the dynamic color down gracefully
  const dynamicColor = subject?.color || "var(--accent)";

  return (
    <div
      className={`task-item-wrap ${task.completed ? "completed" : ""}`}
      {...dragHandlers}
    >
      {/* ── Main Task Row ── */}
      <div className="task-row">
        {/* Subtle Drag Handle */}
        <div className="drag-handle-wrap" title="Drag to reorder">
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
            <circle cx="9" cy="5" r="1"></circle>
            <circle cx="9" cy="12" r="1"></circle>
            <circle cx="9" cy="19" r="1"></circle>
            <circle cx="15" cy="5" r="1"></circle>
            <circle cx="15" cy="12" r="1"></circle>
            <circle cx="15" cy="19" r="1"></circle>
          </svg>
        </div>

        {/* Custom CSS Checkbox */}
        <div className="task-checkbox-wrap">
          <input
            type="checkbox"
            className="custom-checkbox"
            checked={task.completed}
            onChange={toggle}
            style={
              task.completed
                ? { backgroundColor: dynamicColor, borderColor: dynamicColor }
                : {}
            }
          />
        </div>

        {/* Task Content & Metadata */}
        <div
          className="task-content"
          onClick={() => !editing && setExpanded((e) => !e)}
        >
          {editing ? (
            <input
              autoFocus
              className="task-edit-input"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") setEditing(false);
              }}
              onBlur={saveEdit}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="task-title">{task.text}</div>
          )}

          <div className="task-meta">
            {/* Minimal Priority Dot */}
            <span
              className={`priority-dot priority-${task.priority}`}
              title={`${task.priority} priority`}
            />

            {/* Premium Subject Pill */}
            {subject && (
              <span
                className="meta-subject"
                style={{
                  color: dynamicColor,
                  backgroundColor: `${dynamicColor}15`, // Adds 15% opacity to the hex color
                }}
              >
                {subject.name}
              </span>
            )}

            {/* Clean Date Indicator */}
            <span
              className={`task-date ${overdue ? "overdue-text" : today ? "today-text" : ""}`}
            >
              {overdue ? "⚠ " : today ? "◈ Today · " : ""}
              {formatDate(task.date)}
              {task.dueTime && ` · ${task.dueTime}`}
            </span>

            {/* Pomodoro & Subtasks */}
            {/* Pomodoro & Subtasks */}
            {task.estSessions > 0 && (
              <span className="task-est">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 22h14" />
                  <path d="M5 2h14" />
                  <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
                  <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
                </svg>
                {task.estSessions}
              </span>
            )}
            {subtasksTotal > 0 && (
              <span className="task-subtask-count">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                {subtasksDone}/{subtasksTotal}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="task-actions">
          <button
            className="task-action-btn"
            onClick={() => setEditing((e) => !e)}
            title="Edit"
          >
            ✎
          </button>
          <button
            className="task-action-btn danger"
            onClick={del}
            title="Delete"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Expanded Panel ── */}
      {expanded && (
        <div className="task-expanded">
          {/* Progress Bar */}
          {subtasksTotal > 0 && (
            <div className="subtask-progress-wrap">
              <div className="subtask-progress-bar">
                <div
                  className="subtask-progress-fill"
                  style={{
                    width: `${(subtasksDone / subtasksTotal) * 100}%`,
                    background: dynamicColor,
                  }}
                />
              </div>
            </div>
          )}

          {/* Subtasks */}
          <div className="subtask-list">
            {task.subtasks.map((st) => (
              <div
                key={st.id}
                className={`subtask-row ${st.completed ? "subtask-done" : ""}`}
              >
                <input
                  type="checkbox"
                  className="custom-checkbox subtask-checkbox"
                  checked={st.completed}
                  onChange={() => toggleSubtask(st.id)}
                  style={
                    st.completed
                      ? {
                          backgroundColor: dynamicColor,
                          borderColor: dynamicColor,
                        }
                      : {}
                  }
                />
                <span className="subtask-title">{st.text}</span>
              </div>
            ))}
          </div>

          {/* Notes */}
          {task.notes && (
            <div className="task-notes">
              <span className="notes-label">Notes</span>
              <p>{task.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
