import { CUOTA_STATES, isOverdue } from '../finanzas/cuotaStates'
import { formatCount, formatMoney, formatPercentage, formatWholeMoney } from './cuotaPeriod'

const COLUMN_CLASS = 'min-w-0 flex flex-col xl:px-6 xl:first:pl-0 xl:last:pr-0'
const LABEL_CLASS = 'text-sm font-semibold uppercase tracking-wider text-on-surface-variant'
const VALUE_CLASS = 'mt-1 text-2xl font-bold tabular-nums leading-tight'
const CAPTION_CLASS = 'mt-1 text-sm text-on-surface-variant'

const plural = (count, singular, pluralForm) => `${formatCount(count)} ${count === 1 ? singular : pluralForm}`

const sumBy = (rows, key) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0)

function KpiColumn({ label, value, tone = 'text-on-surface', caption }) {
  return (
    <div className={COLUMN_CLASS}>
      <h3 className={LABEL_CLASS}>{label}</h3>
      <p className={`${VALUE_CLASS} ${tone}`} title={formatMoney(value)}>{formatWholeMoney(value)}</p>
      <p className={CAPTION_CLASS}>{caption}</p>
    </div>
  )
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 animate-pulse" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="flex flex-col gap-2">
          <div className="h-3.5 w-28 rounded bg-surface-container-high" />
          <div className="h-7 w-36 rounded bg-surface-container-high" />
          <div className="h-3 w-24 rounded bg-surface-container" />
        </div>
      ))}
    </div>
  )
}

export default function PeriodKpis({ summary, unpaid, isLoading, error }) {
  if (!summary || !unpaid) {
    if (isLoading) return <KpiSkeleton />
    return <p className="text-sm text-error">{error ? 'No se pudieron cargar los indicadores del período.' : 'Sin datos para el período.'}</p>
  }

  const { totals } = summary
  const rate = totals.collection_rate == null ? null : Number(totals.collection_rate)
  const surcharges = sumBy(unpaid, 'surcharges')
  const pending = Math.max(0, Number(totals.unpaid_amount) - surcharges)
  const upcoming = unpaid.filter((row) => row.estado_cuota === CUOTA_STATES.EN_FECHA).length
  const overdue = unpaid.filter(isOverdue).length

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 xl:gap-0 xl:divide-x xl:divide-outline-variant/40">
      <KpiColumn
        label="Monto facturado"
        value={totals.billed}
        caption={plural(totals.generated, 'cuota emitida', 'cuotas emitidas')}
      />
      <KpiColumn
        label={rate == null ? 'Recaudado' : `Recaudado (${formatPercentage(rate)})`}
        value={totals.collected}
        tone="text-emerald-700"
        caption={plural(totals.generated - totals.unpaid, 'cuota cobrada', 'cuotas cobradas')}
      />
      <KpiColumn
        label="Pendiente de cobro"
        value={pending}
        caption={plural(upcoming, 'cuota a vencer', 'cuotas a vencer')}
      />
      <KpiColumn
        label="Interés por vencimiento"
        value={surcharges}
        tone={surcharges > 0 ? 'text-error' : 'text-on-surface'}
        caption={plural(overdue, 'cuota impaga', 'cuotas impagas')}
      />
    </div>
  )
}
