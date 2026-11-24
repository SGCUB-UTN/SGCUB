import { formatMoney, formatWholeMoney } from '../cuota/cuotaPeriod'
import { accountDebt } from './accountDebt'

const PAY_BUTTON_CLASS = 'inline-flex items-center gap-1 h-8 px-2.5 shrink-0 rounded-md border border-primary/30 text-sm font-semibold text-primary hover:bg-primary hover:text-on-primary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-primary'

const overdueLabel = (count) => (count === 1 ? '1 vencida' : `${count} vencidas`)

export default function AccountStatus({ cuenta }) {
  if (!cuenta) return <span className="text-on-surface-variant">—</span>

  const debt = accountDebt(cuenta)
  if (debt <= 0) return <span className="text-on-surface-variant">Al día</span>

  const overdue = cuenta.cuotas_vencidas ?? 0
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span className={`font-semibold tabular-nums ${overdue > 0 ? 'text-error' : 'text-on-surface'}`} title={formatMoney(debt)}>
        {formatWholeMoney(debt)}
      </span>
      {overdue > 0 && <span className="text-sm text-error tabular-nums">{overdueLabel(overdue)}</span>}
    </span>
  )
}

export function PayButton({ onPay, label, disabledReason }) {
  return (
    <span title={disabledReason} className="inline-flex">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onPay()
        }}
        disabled={Boolean(disabledReason)}
        aria-label={disabledReason ? `${label}. ${disabledReason}` : label}
        className={PAY_BUTTON_CLASS}
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">payments</span>
        Pagar
      </button>
    </span>
  )
}
