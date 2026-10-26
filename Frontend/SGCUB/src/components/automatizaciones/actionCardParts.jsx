import { useNavigate } from 'react-router-dom'

// Shared building blocks for the manual action cards (category update and recategorization)

const BUTTON_BASE_CLASS = 'inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'

const BUTTON_VARIANTS = {
  primary: 'bg-sky-700 text-white shadow-sm hover:bg-sky-800',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
}

const NOTICE_TONES = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
}

// Always a <button>: Mantine's normalize CSS forces a transparent background on links, which hides the button color
export function ActionButton({ to, variant = 'primary', icon, iconAfter, children, onClick, ...props }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      className={`${BUTTON_BASE_CLASS} ${BUTTON_VARIANTS[variant]}`}
      onClick={to ? () => navigate(to) : onClick}
      {...props}
    >
      {icon && <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{icon}</span>}
      {children}
      {iconAfter && <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{iconAfter}</span>}
    </button>
  )
}

export function ActionNotice({ tone, icon, spin = false, children }) {
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 text-base ${NOTICE_TONES[tone]}`} role="status">
      <span className={`material-symbols-outlined shrink-0 text-[22px] ${spin ? 'animate-spin' : ''}`} aria-hidden="true">{icon}</span>
      <p>{children}</p>
    </div>
  )
}

export function ActionCard({ icon, title, description, children }) {
  return (
    <article className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700" aria-hidden="true">
          <span className="material-symbols-outlined text-[28px]">{icon}</span>
        </span>
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <p className="mt-1 text-base text-slate-600">{description}</p>
        </div>
      </div>
      {children}
    </article>
  )
}

const FOOTER_TONES = {
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-red-200 bg-red-50 text-red-900',
}

export function ActionFooter({ tone = 'warning', icon, children }) {
  return (
    <div className={`mt-4 -mx-5 -mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-b-xl border-t px-5 py-3 text-base sm:-mx-6 sm:-mb-6 sm:px-6 ${FOOTER_TONES[tone]}`} role="status">
      {icon && <span className="material-symbols-outlined shrink-0 text-[22px]" aria-hidden="true">{icon}</span>}
      {children}
    </div>
  )
}

// Data columns (label above, value below) separated by a vertical line; the actions take the height of both rows
export function ActionSummary({ items, actions }) {
  return (
    <div className="flex flex-col pt-4 pl-16 gap-3 sm:flex-row sm:items-center sm:justify-between">
      <dl className="flex flex-wrap gap-y-2 text-base">
        {items.map((item, index) => (
          <div key={item.label} className={index > 0 ? 'border-l border-slate-300 pl-4 ml-4' : ''}>
            <dt className="text-sm text-slate-500">{item.label}</dt>
            <dd className="font-semibold text-slate-900">{item.value}</dd>
          </div>
        ))}
      </dl>
      {actions && <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:self-stretch">{actions}</div>}
    </div>
  )
}