import { useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import TaskForm from './TaskForm'

export default function QuickCapture() {
  const { state, dispatch } = useApp()
  const overlayRef = useRef(null)

  if (!state.quickCaptureOpen) return null

  const close = () => dispatch({ type: 'SET_QUICK_CAPTURE', payload: false })

  return (
    <div
      className="modal-backdrop quick-capture-backdrop"
      ref={overlayRef}
      onClick={e => e.target === overlayRef.current && close()}
    >
      <div className="quick-capture-modal">
        <div className="quick-capture-header">
          <span className="quick-capture-title">Quick Capture</span>
          <kbd className="shortcut-hint">Esc to close</kbd>
        </div>
        <TaskForm onClose={close} />
      </div>
    </div>
  )
}
