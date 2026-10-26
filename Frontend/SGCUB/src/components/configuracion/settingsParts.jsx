import { compactInputClass } from './settingsForm'

export const INPUT_CLASS = 'w-full h-11 px-3 rounded-md border border-outline-variant/60 bg-surface-container-lowest text-base text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-surface-container-low disabled:text-on-surface-variant'

const NOTICE_TONES = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
}

const NOTICE_ICONS = { info: 'info', warning: 'warning', success: 'check_circle', error: 'error' }

export function Notice({ tone = 'info', children }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-base ${NOTICE_TONES[tone]}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="material-symbols-outlined shrink-0 text-[20px]" aria-hidden="true">{NOTICE_ICONS[tone]}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

// A block of a tab, without a box: its header is a band that spans the whole tab panel, edge to edge
// (the negative margins cancel the panel padding: px-6, pt-3 and pb-6)
// flush: the content (a table) spans the whole width and starts right below the header
export function SettingsSection({ icon, title, description, extra, flush = false, children }) {
  return (
    <section className="-mx-6 first:-mt-3 last:-mb-6">
      <header className="border-y border-outline-variant/30 bg-surface-container-low px-6 py-3">
        {/* The actions share the row of the title, on the right; the description goes below */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex min-w-0 items-center gap-2 text-base font-semibold text-on-surface">
            <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">{icon}</span>
            {title}
          </h3>
          {extra}
        </div>
        {description && <p className="mt-0.5 text-xs text-on-surface-variant">{description}</p>}
      </header>
      <div className={flush ? 'flex flex-col' : 'flex flex-col gap-6 px-6 py-6'}>{children}</div>
    </section>
  )
}

// Title of a group of settings inside a section
export function BlockTitle({ children }) {
  return <span className="mb-3 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">{children}</span>
}

// Small field: label on top, the control, an optional help line and the error
export function CompactField({ id, label, hint, help, error, className = '', children }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="block text-xs font-medium text-on-surface">
        {label}
        {hint && <span className="ml-1 font-normal text-outline">{hint}</span>}
      </label>
      {children}
      {help && !error && <p className="text-[11px] text-outline">{help}</p>}
      {error && <p className="text-xs font-medium text-error" role="alert">{error}</p>}
    </div>
  )
}

export function CompactSelect({ invalid = false, small = false, className = '', children, ...props }) {
  return (
    <div className={`relative ${className}`}>
      <select {...props} aria-invalid={invalid || undefined} className={compactInputClass(invalid, 'appearance-none cursor-pointer pr-8', small)}>
        {children}
      </select>
      <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant" aria-hidden="true">
        expand_more
      </span>
    </div>
  )
}

export function StatusPill({ active }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
      {active ? 'Habilitado' : 'Deshabilitado'}
    </span>
  )
}

export function Field({ label, hint, error, htmlFor, children }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-on-surface">{label}</label>
      {children}
      {hint && !error && <p className="text-sm text-on-surface-variant">{hint}</p>}
      {error && <p className="text-sm text-error" role="alert">{error}</p>}
    </div>
  )
}

// Native select that reads clearly as a field: white background, visible border and a chevron
export function SelectInput({ invalid = false, compact = false, children, className = '', ...props }) {
  const sizeClass = compact ? INPUT_CLASS.replace('h-11', 'h-9') : INPUT_CLASS
  return (
    <div className={`relative ${className}`}>
      <select
        {...props}
        aria-invalid={invalid || undefined}
        className={`${sizeClass} appearance-none cursor-pointer pr-10 ${invalid ? 'border-2 border-error' : 'border-outline'}`}
      >
        {children}
      </select>
      <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant" aria-hidden="true">
        expand_more
      </span>
    </div>
  )
}

export function IconButton({ icon, label, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{icon}</span>
    </button>
  )
}
