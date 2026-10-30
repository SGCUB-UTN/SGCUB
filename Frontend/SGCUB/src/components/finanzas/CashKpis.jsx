import { formatMoney, formatPercentage, formatWholeMoney } from '../cuota/cuotaPeriod'
import DonutChart from '../shared/DonutChart'
import SectionHeading from '../shared/SectionHeading'
import { PANEL_BODY_CLASS, PANEL_CLASS, PANEL_HEADING_CLASS } from '../shared/panel'
import { countLabel, shareOf } from './cashFormat'
import cashSummary from './cashSummary'
import OtherIncomeRanking from './OtherIncomeRanking'

const CORRECTIONS_PANEL_CLASS = 'min-w-0 bg-surface-container-low border border-outline-variant/50 rounded-lg overflow-hidden'

function CardBody({ isLoading, error, children }) {
  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-on-surface-variant" role="status">
        <span className="material-symbols-outlined animate-spin text-[20px]" aria-hidden="true">progress_activity</span>
        Cargando movimientos del mes...
      </p>
    )
  }
  if (error) return <p className="text-sm text-error" role="alert">No se pudieron cargar los movimientos de caja.</p>
  return children
}

function KpiCard({ id, icon, title, className = PANEL_CLASS, contained = false, children }) {
  return (
    <div role="region" className={`${className} flex flex-col`} aria-labelledby={id}>
      <SectionHeading id={id} icon={icon} title={title} className={PANEL_HEADING_CLASS} />
      {contained ? (
        <div className="relative flex-1 min-h-0">
          <div className={`${PANEL_BODY_CLASS} lg:absolute lg:inset-0`}>{children}</div>
        </div>
      ) : (
        <div className={`${PANEL_BODY_CLASS} flex flex-1 flex-col`}>{children}</div>
      )}
    </div>
  )
}

function LegendRow({ swatchClass, label, amount, count, total }) {
  return (
    <li className="flex items-start gap-2.5 min-w-0">
      <span className={`mt-1.5 w-2.5 h-2.5 shrink-0 rounded-sm ${swatchClass}`} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-on-surface truncate">{label}</span>
          <span className="text-sm font-semibold tabular-nums text-on-surface" title={formatMoney(amount)}>{formatWholeMoney(amount)}</span>
        </div>
        <p className="text-xs text-on-surface-variant tabular-nums">
          {countLabel(count, 'recibo', 'recibos')} · {formatPercentage(shareOf(amount, total))}
        </p>
      </div>
    </li>
  )
}

function IncomeComposition({ summary }) {
  const total = summary.income.amount
  const parts = [
    { key: 'cuotas', label: 'Cobro de cuotas', ...summary.cuotas, swatchClass: 'bg-primary', strokeClass: 'stroke-primary' },
    { key: 'otros', label: 'Otros ingresos', ...summary.otherIncome, swatchClass: 'bg-chart-income', strokeClass: 'stroke-chart-income' },
  ]
  const segments = parts.map((part) => ({
    ...part,
    title: `${part.label}: ${formatMoney(part.amount)} (${formatPercentage(shareOf(part.amount, total))})`,
  }))
  const description = parts.map((part) => `${part.label} ${formatPercentage(shareOf(part.amount, total))}`).join(', ')

  return (
    <div className="flex flex-col items-center gap-5">
      <DonutChart
        segments={segments}
        total={total}
        caption="Total ingresado"
        label={`Composición del ingreso: ${description}`}
        emptyLabel="Sin ingresos en el período"
      />
      <ul className="w-full flex flex-col gap-3">
        {parts.map((part) => (
          <LegendRow key={part.key} swatchClass={part.swatchClass} label={part.label} amount={part.amount} count={part.count} total={total} />
        ))}
      </ul>
    </div>
  )
}

function CorrectionRow({ icon, label, amount, count, caption, negative, base }) {
  const prefix = negative && amount > 0 ? '− ' : ''
  return (
    <li className="flex flex-1 items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span className="material-symbols-outlined text-[20px] text-on-surface-variant" aria-hidden="true">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-on-surface truncate">{label}</span>
          <span className="text-sm font-semibold tabular-nums text-on-surface" title={`${prefix}${formatMoney(amount)}`}>
            {prefix}{formatWholeMoney(amount)}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-on-surface-variant tabular-nums">
          {countLabel(count, ...caption)} · {formatPercentage(shareOf(amount, base))} de lo cobrado
        </p>
      </div>
    </li>
  )
}

function Corrections({ summary }) {
  const base = summary.income.amount + summary.annulled.amount

  return (
    <ul className="flex flex-1 flex-col divide-y divide-outline-variant/40">
      <CorrectionRow
        icon="request_quote"
        label="Notas de crédito"
        {...summary.creditNotes}
        caption={['emitida', 'emitidas']}
        negative
        base={base}
      />
      <CorrectionRow
        icon="currency_exchange"
        label="Devoluciones manuales"
        {...summary.manualRefunds}
        caption={['registrada', 'registradas']}
        negative
        base={base}
      />
      <CorrectionRow
        icon="block"
        label="Anulados"
        {...summary.annulled}
        caption={['comprobante anulado', 'comprobantes anulados']}
        base={base}
      />
    </ul>
  )
}

export default function CashKpis({ period, comprobantes, devoluciones, isLoading, error }) {
  const summary = cashSummary(comprobantes, devoluciones)
  const status = { isLoading, error }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <KpiCard id="income-composition-title" icon="donut_large" title="Composición del ingreso">
        <CardBody {...status}>
          <IncomeComposition summary={summary} />
        </CardBody>
      </KpiCard>

      <KpiCard id="other-income-title" icon="leaderboard" title="Tipos de otros ingresos" contained>
        <CardBody {...status}>
          <OtherIncomeRanking concepts={summary.concepts} otherIncome={summary.otherIncome} period={period} />
        </CardBody>
      </KpiCard>

      <KpiCard id="corrections-title" icon="undo" title="Correcciones y anulaciones" className={CORRECTIONS_PANEL_CLASS}>
        <CardBody {...status}>
          <Corrections summary={summary} />
        </CardBody>
      </KpiCard>
    </div>
  )
}
