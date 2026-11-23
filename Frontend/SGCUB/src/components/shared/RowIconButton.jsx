const BASE_CLASS = 'inline-flex items-center justify-center size-9 rounded-md border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 aria-disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:hover:bg-transparent'

const TONES = {
  whatsapp: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
  primary: 'border-primary/40 text-primary hover:bg-primary/5',
  neutral: 'border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-low',
  danger: 'border-error/30 text-error hover:bg-error-container/40',
}

export default function RowIconButton({ tone = 'neutral', label, disabledReason, busy = false, onClick, children }) {
  const disabled = Boolean(disabledReason) || busy
  return (
    <button
      type="button"
      aria-label={disabledReason ? `${label}: ${disabledReason}` : label}
      aria-disabled={disabled || undefined}
      title={disabledReason || label}
      onClick={(event) => {
        event.stopPropagation()
        if (!disabled) onClick()
      }}
      onKeyDown={(event) => event.stopPropagation()}
      className={`${BASE_CLASS} ${TONES[tone]}`}
    >
      {busy
        ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }} aria-hidden="true">progress_activity</span>
        : children}
    </button>
  )
}

export function RowIcon({ name }) {
  return <span className="material-symbols-outlined" style={{ fontSize: 20 }} aria-hidden="true">{name}</span>
}
