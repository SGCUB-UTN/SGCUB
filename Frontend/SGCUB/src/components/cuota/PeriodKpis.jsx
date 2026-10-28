import { KpiColumn, KpiGrid } from '../shared/Kpi'
import { formatCount, formatMoney, formatPercentage, formatWholeMoney } from './cuotaPeriod'

const plural = (count, singular, pluralForm) => `${formatCount(count)} ${count === 1 ? singular : pluralForm}`

const sumBy = (rows, key) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0)

const COLLECTED_CLASS = 'bg-emerald-600'
const PENDING_CLASS = 'bg-emerald-100'

function AmountKpi({ value, ...props }) {
  return <KpiColumn value={formatWholeMoney(value)} title={formatMoney(value)} {...props} />
}

function LegendItem({ swatchClass, label, amount, caption }) {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className={`w-2.5 h-2.5 shrink-0 rounded-sm ${swatchClass}`} aria-hidden="true" />
      {label}
      <span className="font-semibold text-on-surface tabular-nums" title={formatMoney(amount)}>{formatWholeMoney(amount)}</span>
      <span>({caption})</span>
    </span>
  )
}

function CollectionMeter({ total, collected, pending, rate, collectedCaption, pendingCaption }) {
  const collectedShare = total > 0 ? (collected / total) * 100 : 0
  const rateLabel = rate == null ? '—' : formatPercentage(rate)
  return (
    <div className="min-w-0 h-full flex flex-col sm:col-span-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">Total a cobrar</h3>
        <p className="text-sm text-on-surface-variant">
          <span className="font-bold text-on-surface">{rateLabel}</span> cobrado
        </p>
      </div>
      <div className="mt-1 flex items-center gap-4">
        <p className="text-2xl font-bold tabular-nums leading-tight text-on-surface shrink-0" title={formatMoney(total)}>{formatWholeMoney(total)}</p>
        <div
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(collectedShare)}
          aria-valuetext={`${rateLabel} cobrado`}
          aria-label="Cobranza del período"
          className="flex flex-1 min-w-0 h-3 gap-0.5"
        >
          {collected > 0 && (
            <div
              className={`h-full rounded ${COLLECTED_CLASS}`}
              style={{ width: `${collectedShare}%` }}
              title={`Cobrado: ${formatMoney(collected)} (${rateLabel})`}
            />
          )}
          {(pending > 0 || total <= 0) && (
            <div
              className={`h-full flex-1 rounded ${PENDING_CLASS}`}
              title={`Pendiente: ${formatMoney(pending)}`}
            />
          )}
        </div>
      </div>
      <p className="mt-auto pt-1 flex flex-wrap justify-end gap-x-4 gap-y-1 text-sm text-on-surface-variant">
        <LegendItem swatchClass={COLLECTED_CLASS} label="Cobrado" amount={collected} caption={collectedCaption} />
        <LegendItem swatchClass={PENDING_CLASS} label="Pendiente" amount={pending} caption={pendingCaption} />
      </p>
    </div>
  )
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 animate-pulse" aria-hidden="true">
      {[0, 1].map((index) => (
        <div key={index} className="flex flex-col gap-2">
          <div className="h-3.5 w-28 rounded bg-surface-container-high" />
          <div className="h-7 w-36 rounded bg-surface-container-high" />
          <div className="h-3 w-24 rounded bg-surface-container" />
        </div>
      ))}
      <div className="flex flex-col gap-2 sm:col-span-2">
        <div className="h-3.5 w-28 rounded bg-surface-container-high" />
        <div className="h-7 w-full rounded bg-surface-container-high" />
        <div className="h-3 w-48 rounded bg-surface-container" />
      </div>
    </div>
  )
}

export default function PeriodKpis({ summary, rows, isLoading, error }) {
  if (!summary || !rows) {
    if (isLoading) return <KpiSkeleton />
    return <p className="text-sm text-error">{error ? 'No se pudieron cargar los indicadores del período.' : 'Sin datos para el período.'}</p>
  }

  const { totals } = summary
  const total = Number(totals.billed)
  const collected = Number(totals.collected)
  const pending = Number(totals.unpaid_amount)
  const rate = totals.collection_rate == null ? null : Number(totals.collection_rate)
  const surcharges = sumBy(rows, 'surcharges')
  const surchargedCount = rows.filter((row) => Number(row.surcharges) > 0).length
  const unpaid = rows.filter((row) => !row.paid)

  return (
    <KpiGrid columns={4}>
      <AmountKpi
        label="Monto facturado"
        value={total - surcharges}
        caption={plural(totals.generated, 'cuota emitida', 'cuotas emitidas')}
      />
      <AmountKpi
        label="Recargos aplicados"
        value={surcharges}
        tone={surcharges > 0 ? 'text-error' : 'text-on-surface'}
        caption={plural(surchargedCount, 'cuota con recargo', 'cuotas con recargo')}
      />
      <CollectionMeter
        total={total}
        collected={collected}
        pending={pending}
        rate={rate}
        collectedCaption={plural(totals.generated - totals.unpaid, 'cuota', 'cuotas')}
        pendingCaption={`${plural(unpaid.length, 'cuota', 'cuotas')}`}
      />
    </KpiGrid>
  )
}
