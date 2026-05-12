import { useApp } from '../context/AppContext'
import { getWeeklyStats, getSubjectBreakdown, getCompletionRate } from '../utils/helpers'

export default function Dashboard() {
  const { state } = useApp()
  const { tasks, sessionHistory, streak, subjects } = state

  const weeklyStats   = getWeeklyStats(sessionHistory)
  const subjectBreak  = getSubjectBreakdown(sessionHistory, subjects)
  const completionRate= getCompletionRate(tasks)
  const maxSessions   = Math.max(...weeklyStats.map(d => d.sessions), 1)

  const todaySessions = sessionHistory.filter(
    s => new Date(s.completedAt).toDateString() === new Date().toDateString() && s.mode === 'work'
  ).length

  const totalSessions = sessionHistory.filter(s => s.mode === 'work').length
  const thisWeekSessions = weeklyStats.reduce((a, d) => a + d.sessions, 0)

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2 className="list-title">Dashboard</h2>
        <p className="dashboard-sub">Your study overview at a glance</p>
      </div>

      {/* Top stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-num">{streak.count}</div>
          <div className="stat-label">Day streak 🔥</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{todaySessions}</div>
          <div className="stat-label">Sessions today</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{thisWeekSessions}</div>
          <div className="stat-label">This week</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{completionRate}%</div>
          <div className="stat-label">Completion rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{totalSessions}</div>
          <div className="stat-label">Total sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{tasks.filter(t => !t.completed).length}</div>
          <div className="stat-label">Tasks pending</div>
        </div>
      </div>

      {/* Weekly bar chart */}
      <div className="chart-card">
        <h3 className="chart-title">Sessions this week</h3>
        <div className="bar-chart">
          {weeklyStats.map((d, i) => (
            <div key={i} className="bar-col">
              <div className="bar-wrap">
                <div
                  className="bar-fill"
                  style={{ height: `${(d.sessions / maxSessions) * 100}%` }}
                  title={`${d.sessions} sessions`}
                />
              </div>
              <span className="bar-label">{d.day}</span>
              {d.sessions > 0 && <span className="bar-count">{d.sessions}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Subject breakdown */}
      {subjectBreak.length > 0 && (
        <div className="chart-card">
          <h3 className="chart-title">Sessions by subject</h3>
          <div className="subject-breakdown">
            {subjectBreak.map(sub => (
              <div key={sub.id} className="subject-bar-row">
                <div className="subject-bar-label">
                  <span className="subject-dot" style={{ background: sub.color }} />
                  <span>{sub.name}</span>
                </div>
                <div className="subject-bar-track">
                  <div
                    className="subject-bar-fill"
                    style={{
                      width: `${(sub.sessions / subjectBreak[0].sessions) * 100}%`,
                      background: sub.color
                    }}
                  />
                </div>
                <span className="subject-bar-count">{sub.sessions}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completion ring */}
      <div className="chart-card completion-ring-card">
        <h3 className="chart-title">Task completion</h3>
        <div className="completion-ring-wrap">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" strokeWidth="10" />
            <circle
              cx="60" cy="60" r="50"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${(completionRate / 100) * 314} 314`}
              transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
          </svg>
          <div className="ring-label">
            <span className="ring-pct">{completionRate}%</span>
            <span className="ring-sub">complete</span>
          </div>
        </div>
        <div className="completion-detail">
          <span>{tasks.filter(t => t.completed).length} done</span>
          <span>·</span>
          <span>{tasks.filter(t => !t.completed).length} remaining</span>
        </div>
      </div>

      {/* Recent sessions */}
      {sessionHistory.length > 0 && (
        <div className="chart-card">
          <h3 className="chart-title">Recent sessions</h3>
          <div className="session-log">
            {sessionHistory.slice(0, 8).map((s, i) => {
              const sub = subjects.find(sub => sub.id === s.subjectId)
              const task = state.tasks.find(t => t.id === s.taskId)
              const time = new Date(s.completedAt)
              return (
                <div key={i} className="session-log-row">
                  <span
                    className="session-log-dot"
                    style={{ background: sub?.color ?? 'var(--accent)' }}
                  />
                  <span className="session-log-time">
                    {time.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    {' · '}
                    {time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="session-log-label">
                    {task?.text ? task.text : sub ? sub.name : 'Free session'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
