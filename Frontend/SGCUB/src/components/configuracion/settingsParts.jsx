import { BUTTON_CLASSES } from './settingsForm'

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

export function SettingsCard({ icon, title, description, actions, children }) {
  return (
    <section className="flex flex-col gap-5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
            <span className="material-symbols-outlined text-[24px]">{icon}</span>
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-on-surface">{title}</h2>
            {description && <p className="mt-0.5 text-base text-on-surface-variant">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
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

export function PrefixedInput({ prefix, suffix, ...props }) {
  return (
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-outline" aria-hidden="true">{prefix}</span>}
      <input {...props} className={`${INPUT_CLASS} ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-8' : ''}`} />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base text-outline" aria-hidden="true">{suffix}</span>}
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
      className="flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="material-symbols-outlined text-[22px]" aria-hidden="true">{icon}</span>
    </button>
  )
}

export function SwitchRow({ label, description, checked, onChange, disabled = false }) {
  return (
    <label className={`flex items-start justify-between gap-4 rounded-lg border border-outline-variant/40 px-4 py-3 ${disabled ? 'opacity-60' : 'cursor-pointer hover:bg-surface-container-low'}`}>
      <span className="min-w-0">
        <span className="block text-base font-semibold text-on-surface">{label}</span>
        {description && <span className="block text-sm text-on-surface-variant">{description}</span>}
      </span>
      <input
        type="checkbox"
        className="mt-1 h-5 w-5 shrink-0 accent-primary cursor-pointer"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
      />
    </label>
  )
}

export function SaveBar({ changes, status, onSave, onReset, saveLabel = 'Guardar cambios' }) {
  return (
    <div className="flex flex-col gap-3 border-t border-outline-variant/30 pt-4">
      {status.error && <Notice tone="error">{status.error}</Notice>}
      {status.message && <Notice tone="success">{status.message}</Notice>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {changes.length > 0 && (
          <button type="button" className={BUTTON_CLASSES.secondary} onClick={onReset} disabled={status.saving}>
            Descartar
          </button>
        )}
        <button type="button" className={BUTTON_CLASSES.primary} onClick={onSave} disabled={!changes.length || status.saving}>
          <span className={`material-symbols-outlined text-[20px] ${status.saving ? 'animate-spin' : ''}`} aria-hidden="true">
            {status.saving ? 'progress_activity' : 'save'}
          </span>
          {status.saving ? 'Guardando...' : saveLabel}
        </button>
      </div>
    </div>
  )
}
