import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ToastContext } from './toastContext'

const MAX_VISIBLE = 3
const DURATIONS = { success: 5000, info: 5000, error: 8000 }

const TONES = {
  success: { icon: 'check_circle', iconClass: 'bg-emerald-50 text-emerald-700' },
  error: { icon: 'error', iconClass: 'bg-error-container text-error' },
  info: { icon: 'info', iconClass: 'bg-primary-fixed/50 text-primary' },
}

function Toast({ toast, onClose }) {
  const tone = TONES[toast.tone] ?? TONES.info
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return undefined
    const timer = setTimeout(() => onClose(toast.id), toast.duration)
    return () => clearTimeout(timer)
  }, [paused, toast.id, toast.duration, onClose])

  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="toast-enter pointer-events-auto flex items-start gap-3 w-full p-3 pr-2 bg-surface-container-lowest border border-outline-variant/40 rounded-xl shadow-[0_8px_24px_-6px_rgb(11_28_48/0.25)]"
    >
      <span className={`inline-flex items-center justify-center size-9 shrink-0 rounded-full ${tone.iconClass}`} aria-hidden="true">
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{tone.icon}</span>
      </span>
      <div className="flex flex-col gap-0.5 min-w-0 flex-1 pt-1.5">
        <p className="text-base font-semibold text-on-surface leading-snug">{toast.title}</p>
        {toast.description && <p className="text-sm text-on-surface-variant leading-relaxed">{toast.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        aria-label="Cerrar aviso"
        className="inline-flex items-center justify-center size-8 shrink-0 rounded-lg text-outline hover:bg-surface-container-low hover:text-on-surface transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">close</span>
      </button>
    </div>
  )
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const closeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(({ title, description, tone = 'success', duration }) => {
    nextId.current += 1
    const toast = { id: nextId.current, title, description, tone, duration: duration ?? DURATIONS[tone] ?? DURATIONS.info }
    setToasts((current) => [...current, toast].slice(-MAX_VISIBLE))
    return toast.id
  }, [])

  const value = useMemo(() => ({ showToast, closeToast }), [showToast, closeToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 left-4 sm:left-auto z-[1000] flex flex-col items-end gap-2 sm:w-96 pointer-events-none"
      >
        {toasts.map((toast) => <Toast key={toast.id} toast={toast} onClose={closeToast} />)}
      </div>
    </ToastContext.Provider>
  )
}
