// Piezas visuales compartidas por las pestañas de la ficha de persona.

export function RecordSection({ title, color = 'bg-primary-container', extra, children }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between pb-1 border-b border-surface-container mb-4">
        <div className="flex items-center gap-2">
          <span className={`w-1 h-5 rounded ${color}`} />
          <h2 className="text-xl text-on-surface font-bold tracking-tight">{title}</h2>
        </div>
        {extra}
      </div>
      {children}
    </section>
  )
}

export function TabHeader({ title, description, actions }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-surface-container ">
      <div className="flex flex-col gap-1 ">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-1 h-5 bg-primary-container rounded " />
          <h2 className="text-xl text-on-surface font-bold tracking-tight">{title}</h2>
        </div>
        {description && <p className="text-base text-on-surface-variant">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </div>
  )
}

export function Field({ label, value, icon, iconClass = 'text-outline', help, className = '' }) {
  const isEmpty = value === null || value === undefined || value === ''
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-base text-on-surface-variant font-semibold">{label}</span>
      <div className="relative flex items-center w-full min-h-10 px-3 py-2 bg-surface-container-low rounded-lg text-base text-on-surface">
        {icon && <span className={`material-symbols-outlined text-base mr-2 ${iconClass}`}>{icon}</span>}
        <span className={`truncate ${isEmpty ? 'text-outline' : ''}`}>{isEmpty ? 'No registrado' : value}</span>
      </div>
      {help && <span className="text-xs text-on-surface-variant font-medium">{help}</span>}
    </div>
  )
}

const TONOS_KPI = {
  neutral: { caja: 'bg-surface-container-low border-outline-variant/30', text: 'text-on-surface', label: 'text-on-surface-variant', icon: 'bg-surface-container-highest text-primary' },
  ok: { caja: 'bg-emerald-50/70 border-emerald-200/80', text: 'text-emerald-700', label: 'text-emerald-800', icon: 'bg-emerald-100 text-emerald-700' },
  alert: { caja: 'bg-amber-50/70 border-amber-200/80', text: 'text-amber-700', label: 'text-amber-800', icon: 'bg-amber-100 text-amber-700' },
  error: { caja: 'bg-error-container/40 border-error/20', text: 'text-error', label: 'text-on-error-container', icon: 'bg-error-container text-error' },
}

export function KPI({ label, value, icon, tone = 'neutral' }) {
  const style = TONOS_KPI[tone] ?? TONOS_KPI.neutral
  return (
    <div className={`p-4 rounded-xl border flex items-center justify-between gap-2 ${style.caja}`}>
      <div className="flex flex-col min-w-0">
        <span className={`text-sm font-medium ${style.label}`}>{label}</span>
        <span className={`text-lg leading-9 font-bold mt-0.5 truncate ${style.text}`}>{value}</span>
      </div>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${style.icon}`}>
        <span className="material-symbols-outlined text-lg">{icon}</span>
      </div>
    </div>
  )
}

export function EmptyState({ icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-12 px-4 border border-dashed border-outline-variant/50 rounded-xl">
      <span className="material-symbols-outlined text-xl text-outline">{icon}</span>
      <p className="text-lg font-semibold text-on-surface">{title}</p>
      {description && <p className="text-xl text-on-surface-variant max-w-md">{description}</p>}
    </div>
  )
}

export function PrimaryButton({ icon, children, ...props }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 h-10 px-4 bg-primary text-on-primary hover:bg-on-primary-container rounded-lg text-base font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
      {...props}
    >
      {icon && <span className="material-symbols-outlined text-[20px]">{icon}</span>}
      <span>{children}</span>
    </button>
  )
}

export function SecondaryButton({ icon, children, ...props }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 h-10 px-4 bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/40 rounded-lg text-base font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-surface-container-low"
      {...props}
    >
      {icon && <span className="material-symbols-outlined text-[20px]">{icon}</span>}
      <span>{children}</span>
    </button>
  )
}
