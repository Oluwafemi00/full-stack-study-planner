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

  const PRIORITY_COLORS = {
    high: "var(--red)",
    medium: "var(--amber)",
    low: "var(--green)",
  };

  return (
    <div
      className={`task-item ${task.completed ? "completed" : ""} ${overdue ? "overdue" : ""}`}
      {...dragHandlers}
    >
      {/* Priority stripe */}
      <div
        className="task-priority-stripe"
        style={{ background: PRIORITY_COLORS[task.priority] }}
      />

      <div className="task-main">
        {/* Drag handle */}
        <span className="drag-handle" title="Drag to reorder">
          ⠿
        </span>

        {/* Checkbox */}
        <button
          className={`task-check ${task.completed ? "checked" : ""}`}
          onClick={toggle}
          style={
            task.completed
              ? {
                  borderColor: subject?.color ?? "var(--accent)",
                  background: subject?.color ?? "var(--accent)",
                }
              : {}
          }
        >
          {task.completed && "✓"}
        </button>

        {/* Content */}
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
            <span className="task-text">{task.text}</span>
          )}

          <div className="task-meta">
            {subject && (
              <span
                className="task-subject-tag"
                style={{
                  background: subject.color + "22",
                  color: subject.color,
                  borderColor: subject.color + "44",
                }}
              >
                {subject.name}
              </span>
            )}
            <span
              className={`task-date ${overdue ? "overdue-text" : today ? "today-text" : ""}`}
            >
              {overdue ? "⚠ " : today ? "◈ Today · " : ""}
              {formatDate(task.date)}
              {task.dueTime && ` · ${task.dueTime}`}
            </span>
            {task.estSessions > 0 && (
              <span className="task-est">⏲️ ×{task.estSessions}</span>
            )}
            {subtasksTotal > 0 && (
              <span className="task-subtask-count">
                {subtasksDone}/{subtasksTotal} steps
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
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

      {/* Expanded panel */}
      {expanded && (
        <div className="task-expanded">
          {/* Subtask progress bar */}
          {subtasksTotal > 0 && (
            <div className="subtask-progress-wrap">
              <div className="subtask-progress-bar">
                <div
                  className="subtask-progress-fill"
                  style={{
                    width: `${(subtasksDone / subtasksTotal) * 100}%`,
                    background: subject?.color ?? "var(--accent)",
                  }}
                />
              </div>
            </div>
          )}

          {/* Subtasks */}
          {task.subtasks.map((st) => (
            <div
              key={st.id}
              className={`subtask-row ${st.completed ? "subtask-done" : ""}`}
            >
              <button
                className={`subtask-check ${st.completed ? "checked" : ""}`}
                onClick={() => toggleSubtask(st.id)}
                style={
                  st.completed
                    ? {
                        borderColor: subject?.color ?? "var(--accent)",
                        background: subject?.color ?? "var(--accent)",
                      }
                    : {}
                }
              >
                {st.completed && "✓"}
              </button>
              <span>{st.text}</span>
            </div>
          ))}

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
