import { useState, useRef } from "react";
import { useApp } from "../context/AppContext";
import TaskItem from "./TaskItem";
import TaskForm from "./TaskForm";
import { smartSort, todayStr, isToday } from "../utils/helpers";

export default function TaskList({ title, filterFn }) {
  const { state, dispatch } = useApp();
  const { tasks, filterStatus } = state;
  const [showForm, setShowForm] = useState(false);
  const [sortMode, setSortMode] = useState("manual"); // 'manual' | 'smart'
  const dragId = useRef(null);

  // Apply view filter
  let filtered = tasks.filter(filterFn ?? (() => true));

  // Apply status filter
  if (filterStatus === "pending")
    filtered = filtered.filter((t) => !t.completed);
  if (filterStatus === "completed")
    filtered = filtered.filter((t) => t.completed);

  // Apply sort
  if (sortMode === "smart") filtered = smartSort(filtered);

  const pending = filtered.filter((t) => !t.completed).length;
  const completed = filtered.filter((t) => t.completed).length;

  // Drag and drop
  const handleDragStart = (id) => {
    dragId.current = id;
  };
  const handleDrop = (targetId) => {
    if (!dragId.current || dragId.current === targetId) return;
    const all = [...tasks];
    const fromI = all.findIndex((t) => t.id === dragId.current);
    const toI = all.findIndex((t) => t.id === targetId);
    const [moved] = all.splice(fromI, 1);
    all.splice(toI, 0, moved);
    dispatch({ type: "REORDER_TASKS", payload: all });
    dragId.current = null;
  };

  const clearCompleted = () => {
    if (window.confirm("Clear all completed tasks?"))
      dispatch({ type: "CLEAR_COMPLETED" });
  };

  return (
    <div className="task-list-panel">
      {/* Header */}
      <div className="list-header">
        <div className="list-title-row">
          <h2 className="list-title">{title}</h2>
          <div className="list-counts">
            <span className="count-badge pending">{pending} pending</span>
            {completed > 0 && (
              <span className="count-badge done">{completed} done</span>
            )}
          </div>
        </div>

        <div className="list-controls">
          {/* Status filter */}
          <div className="filter-tabs">
            {["all", "pending", "completed"].map((f) => (
              <button
                key={f}
                className={`filter-tab ${filterStatus === f ? "active" : ""}`}
                onClick={() => dispatch({ type: "SET_FILTER", payload: f })}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Sort toggle */}
          <button
            className={`sort-btn ${sortMode === "smart" ? "active" : ""}`}
            onClick={() =>
              setSortMode((s) => (s === "smart" ? "manual" : "smart"))
            }
            title="Smart sort by priority + date"
          >
            ✦ Smart sort
          </button>
        </div>
      </div>

      {/* Add task */}
      {showForm ? (
        <div className="add-task-form-wrap">
          <TaskForm onClose={() => setShowForm(false)} />
        </div>
      ) : (
        <button className="add-task-trigger" onClick={() => setShowForm(true)}>
          <span className="add-icon">+</span>
          <span>Add task</span>
          <kbd className="shortcut-hint">⌘K</kbd>
        </button>
      )}

      {/* Task items */}
      <div className="task-items">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">◎</div>
            <p>
              {filterStatus === "completed"
                ? "Complete a task to start building your progress."
                : "You're all caught up - Ready to plan your next study session?."}
            </p>
          </div>
        ) : (
          filtered.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              dragHandlers={{
                draggable: sortMode === "manual",
                onDragStart: () => handleDragStart(task.id),
                onDragOver: (e) => e.preventDefault(),
                onDrop: () => handleDrop(task.id),
              }}
            />
          ))
        )}
      </div>

      {/* Footer actions */}
      {completed > 0 && (
        <div className="list-footer">
          <button className="btn-danger-ghost" onClick={clearCompleted}>
            Clear {completed} completed
          </button>
          <button className="btn-ghost" onClick={() => window.print()}>
            Export PDF
          </button>
        </div>
      )}
    </div>
  );
}
