import { useState } from 'react'
import { useApp } from '../context/AppContext'

const PALETTE = [
  '#6366f1','#06b6d4','#10b981','#f59e0b','#ef4444',
  '#8b5cf6','#ec4899','#f97316','#84cc16','#14b8a6'
]

export default function SubjectManager() {
  const { state, dispatch } = useApp()
  const { subjects, tasks } = state

  const [newName,  setNewName]  = useState('')
  const [newColor, setNewColor] = useState(PALETTE[0])

  const addSubject = () => {
    if (!newName.trim()) return
    dispatch({ type: 'ADD_SUBJECT', payload: { name: newName.trim(), color: newColor } })
    setNewName('')
    setNewColor(PALETTE[0])
  }

  const del = (id) => {
    const count = tasks.filter(t => t.subjectId === id).length
    if (count > 0 && !window.confirm(`This subject has ${count} task(s). Delete anyway?`)) return
    dispatch({ type: 'DELETE_SUBJECT', payload: id })
  }

  return (
    <div className="subject-manager">
      <div className="dashboard-header">
        <h2 className="list-title">Manage Subjects</h2>
        <p className="dashboard-sub">Organise your tasks by subject or project</p>
      </div>

      {/* Add new */}
      <div className="subject-add-card">
        <h3 className="chart-title">Add Subject</h3>
        <div className="subject-add-row">
          <input
            className="form-input"
            placeholder="Subject name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSubject()}
          />
          <div className="color-palette">
            {PALETTE.map(c => (
              <button
                key={c}
                className={`color-swatch ${newColor === c ? 'selected' : ''}`}
                style={{ background: c }}
                onClick={() => setNewColor(c)}
              />
            ))}
          </div>
          <button className="btn-primary" onClick={addSubject}>Add</button>
        </div>
      </div>

      {/* Subject list */}
      <div className="chart-card">
        <h3 className="chart-title">Your subjects</h3>
        {subjects.length === 0 ? (
          <p className="text-dim">No subjects yet.</p>
        ) : (
          <div className="subject-list">
            {subjects.map(sub => {
              const taskCount = tasks.filter(t => t.subjectId === sub.id).length
              const done      = tasks.filter(t => t.subjectId === sub.id && t.completed).length
              return (
                <div key={sub.id} className="subject-list-row">
                  <div className="subject-list-left">
                    <span className="subject-dot lg" style={{ background: sub.color }} />
                    <div>
                      <div className="subject-list-name">{sub.name}</div>
                      <div className="subject-list-meta">{taskCount} tasks · {done} completed</div>
                    </div>
                  </div>
                  <button className="task-action-btn danger" onClick={() => del(sub.id)}>Delete</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
