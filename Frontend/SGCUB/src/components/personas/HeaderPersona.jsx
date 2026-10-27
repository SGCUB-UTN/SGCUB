import PageHeader from '../shared/PageHeader'

const getInitials = (name, surname) =>
  `${name?.trim()?.[0] ?? ''}${surname?.trim()?.[0] ?? ''}`.toUpperCase() || '?'

const STATUS_TONES = {
  positive: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  error: 'bg-error-container text-error border-error/30',
  warning: 'bg-secondary-fixed text-on-secondary-fixed border-secondary/30',
  muted: 'bg-surface-container-high text-on-surface-variant border-outline-variant/40',
}

const toneOf = (item) => item.tone ?? (item.isActive ? 'positive' : 'muted')

const ACTION_GRID_CLASS = 'grid grid-cols-1 gap-2 shrink-0 sm:w-fit [&_button]:w-full [&_button]:justify-center'

export default function PersonHeader({ breadcrumb = [], name, surname, isActive = false, status, statuses, tags = [], metadata = [], statusAction, actions, footer }) {
  const fullName = `${name ?? ''} ${surname ?? ''}`.trim() || 'Sin nombre'
  const statusList = statuses ?? (status ? [status] : [])

  return (
    <>
      <PageHeader breadcrumb={breadcrumb} />

      <div className="bg-surface-container-lowest rounded-xl shadow-sm p-6 mb-6 relative overflow-hidden">
        <div className="absolute inset-y-0 right-0 w-80 bg-gradient-to-l from-primary-fixed/25 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-container to-secondary flex items-center justify-center text-on-primary text-[28px] font-bold shadow-md select-none tracking-tight">
                {getInitials(name, surname)}
              </div>
              {isActive && (
                <span
                  className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-surface-container-lowest bg-emerald-500"
                  title="Activo"
                  aria-label="Activo"
                />
              )}
            </div>

            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-x-3 gap-y-2 flex-wrap">
                <h1 className="text-2xl text-on-surface font-bold tracking-tight">{fullName}</h1>
                {statusList.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {statusList.map((item) => (
                      <span
                        key={item.label}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-sm font-semibold whitespace-nowrap ${STATUS_TONES[toneOf(item)]}`}
                      >
                        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{item.icon ?? (item.isActive ? 'check_circle' : 'block')}</span>
                        {item.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {(metadata.length > 0 || tags.length > 0) && (
                <div className="flex items-center gap-y-1 gap-x-4 flex-wrap text-base text-on-surface-variant">
                  {metadata.map((item, index) => (
                    <div key={item.label} className="flex items-center gap-x-4">
                      {index > 0 && <span className="text-outline-variant" aria-hidden="true">•</span>}
                      <div className="flex items-center gap-1">
                        <span className="text-outline">{item.label}:</span>
                        <span className={item.highlighted ? 'font-mono font-semibold text-primary' : 'text-on-surface font-medium'}>
                          {item.value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {(statusAction || actions) && (
            <div className={ACTION_GRID_CLASS}>
              {actions}
              {statusAction}
            </div>
          )}
        </div>
        {footer && <div className="relative z-10 mt-6 -mx-6 -mb-6">{footer}</div>}
      </div>
    </>
  )
}

export function EditButton({ onClick, children = 'Editar legajo' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 h-10 px-4 !mb-1 bg-surface-container-low hover:bg-surface-container text-on-surface rounded-lg text-base font-semibold border border-outline-variant/40 shadow-sm transition-all cursor-pointer select-none"
    >
      <span className="material-symbols-outlined text-[20px] text-outline">edit</span>
      <span>{children}</span>
    </button>
  )
}

export function PayButton({ onClick, children = 'Registrar pago' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 h-10 px-4 bg-primary text-on-primary hover:bg-primary/90 rounded-lg text-base font-semibold shadow-sm transition-colors cursor-pointer select-none"
    >
      <span className="material-symbols-outlined text-[20px]">payments</span>
      <span>{children}</span>
    </button>
  )
}

const BENEFIT_VARIANTS = {
  outline: { button: 'bg-surface-container-lowest text-primary border-primary/40 hover:bg-primary/5 disabled:hover:bg-surface-container-lowest', icon: '' },
  neutral: { button: 'bg-surface-container-low text-on-surface border-outline-variant/40 hover:bg-surface-container disabled:hover:bg-surface-container-low', icon: 'text-outline' },
}

export function BenefitButton({ onClick, disabled = false, variant = 'outline', children = 'Asignar beca o descuento' }) {
  const style = BENEFIT_VARIANTS[variant]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 h-10 px-4 border rounded-lg text-base font-semibold shadow-sm transition-colors cursor-pointer select-none whitespace-nowrap disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed ${style.button}`}
    >
      <span className={`material-symbols-outlined text-[20px] ${style.icon}`}>sell</span>
      <span>{children}</span>
    </button>
  )
}

export function HeaderNotice({ icon, title, actions, children }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3 px-6 py-4 border-t border-secondary/20 bg-secondary-fixed/30" role="status">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className="material-symbols-outlined text-[22px] text-secondary shrink-0" aria-hidden="true">{icon}</span>
        <p className="text-base text-on-surface">
          <strong className="font-semibold">{title}</strong>
          <span className="text-on-surface-variant"> · {children}</span>
        </p>
      </div>
      {actions && <div className="grid grid-cols-1 sm:flex sm:items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

const DEACTIVATE_VARIANTS = {
  soft: 'bg-error-container/40 shadow-sm',
  outline: 'bg-surface-container-lowest border border-error/40',
}

export function DeactivateButton({ onClick, icon = 'person_off', variant = 'soft', children = 'Dar de baja' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 h-10 px-4 text-error hover:bg-error hover:text-on-error transition-all rounded-lg text-base font-semibold focus:outline-none focus:ring-2 focus:ring-error cursor-pointer ${DEACTIVATE_VARIANTS[variant]}`}
    >
      <span className="material-symbols-outlined text-[20px]">{icon}</span>
      <span>{children}</span>
    </button>
  )
}

export function ActivateButton({ onClick, loading = false, children = 'Dar de alta' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center justify-center gap-1.5 h-10 px-4 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition-all rounded-lg text-base font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
      <span>{loading ? 'Dando de alta...' : children}</span>
    </button>
  )
}
