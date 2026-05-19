# Study Planner Pro v2

A serious productivity PWA for students, built with React + Vite.

## Tech stack

- React 18 + `useReducer` for state
- Vite + `vite-plugin-pwa` for PWA/offline
- Zero UI libraries — custom CSS design system
- `localStorage` persistence (no backend needed)

## Features

- **Subjects** — colour-coded subject/project grouping
- **Tasks** — priority, due date/time, subtasks, notes, estimated Pomodoro sessions
- **Upgraded Pomodoro** — ring timer, short/long breaks, auto-advance, session history, Web Audio API chimes
- **Dashboard** — streak counter, weekly bar chart, subject breakdown, completion ring
- **Quick Capture** — `Cmd/Ctrl + K` opens a fast-add modal from anywhere
- **Views** — Today, All Tasks, per-subject, Dashboard
- **PWA** — installable on desktop and mobile, works offline

## Project structure

```
src/
├── components/
│   ├── Dashboard.jsx       # Stats, charts, session log
│   ├── Pomodoro.jsx        # Upgraded timer with ring + history
│   ├── QuickCapture.jsx    # Cmd+K modal
│   ├── Sidebar.jsx         # Navigation + subject list
│   ├── SubjectManager.jsx  # Add/delete subjects
│   ├── TaskForm.jsx        # Add task (with subtasks, notes, est. sessions)
│   ├── TaskItem.jsx        # Individual task card
│   └── TaskList.jsx        # List with filter, sort, drag-and-drop
├── context/
│   └── AppContext.jsx      # Global state (useReducer) + localStorage sync
├── utils/
│   └── helpers.js          # Date, stats, sort helpers
├── App.jsx                 # View router
├── index.css               # Full design system
└── main.jsx                # Entry point
```
