// Date helpers
export function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export function isOverdue(dateStr) {
  return dateStr < todayStr()
}

export function isToday(dateStr) {
  return dateStr === todayStr()
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// Stats helpers
export function getWeeklyStats(sessionHistory) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toDateString()
  })
  return days.map(day => ({
    day: new Date(day).toLocaleDateString('en-GB', { weekday: 'short' }),
    sessions: sessionHistory.filter(s => new Date(s.completedAt).toDateString() === day).length
  }))
}

export function getCompletionRate(tasks) {
  if (!tasks.length) return 0
  return Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100)
}

export function getSubjectBreakdown(sessionHistory, subjects) {
  return subjects.map(sub => ({
    ...sub,
    sessions: sessionHistory.filter(s => s.subjectId === sub.id).length
  })).filter(s => s.sessions > 0).sort((a,b) => b.sessions - a.sessions)
}

// Unique ID
export function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2,7)}`
}

// Sort tasks by priority + date
export function smartSort(tasks) {
  const pMap = { high: 0, medium: 1, low: 2 }
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    if (pMap[a.priority] !== pMap[b.priority]) return pMap[a.priority] - pMap[b.priority]
    return new Date(a.date) - new Date(b.date)
  })
}
