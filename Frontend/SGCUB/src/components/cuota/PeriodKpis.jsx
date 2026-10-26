import { formatCompactMoney, formatCount, formatMoney, formatPercentage } from './cuotaPeriod'

const COLUMN_CLASS = 'min-w-0 flex flex-col xl:px-6 xl:first:pl-0 xl:last:pr-0'
const LABEL_CLASS = 'text-sm font-semibold uppercase tracking-wider text-on-surface-variant'
const VALUE_CLASS = 'mt-1 text-2xl font-bold tabular-nums leading-tight'

const rateTone = (rate) => {
  if (rate >= 70) return 'bg-emerald-600'
  if (rate >= 40) return 'bg-amber-600'
  return 'bg-error'
}

function Amount({ value, className = '' }) {
  return <span className={className} title={formatMoney(value)}>{formatCompactMoney(value)}</span>
}

function Breakdown({ rows }) {
  return (
    <dl className="mt-3 flex flex-col gap-1 text-sm">
      {rows.map(({ label, value, note }) => (
        <div key={label} className="flex items-baseline justify-between gap-3">
          <dt className="text-on-surface-variant">
            {label}
            {note && <span className="block text-xs">{note}</span>}
          </dt>
          <dd className="font-medium text-on-surface tabular-nums text-right">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function KpiColumn({ label, children }) {
  return (
    <div className={COLUMN_CLASS}>
      <h3 className={LABEL_CLASS}>{label}</h3>
      {children}
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
          <div className="h-3 w-full rounded bg-surface-container" />
          <div className="h-3 w-full rounded bg-surface-container" />
        </div>
      ))}
    </div>
  )
}

const partialLeaveNote = (count) => (count > 0 ? `incluye ${formatCount(count)} de baja parcial` : null)

export default function PeriodKpis({ summary, isLoading, error }) {
  if (!summary) {
    if (isLoading) return <KpiSkeleton />
    return <p className="text-sm text-error">{error ? 'No se pudieron cargar los indicadores del período.' : 'Sin datos para el período.'}</p>
  }

  const { totals, members, players } = summary
  const partialLeave = players.partial_leave ?? { generated: 0, unpaid: 0 }
  const rate = totals.collection_rate == null ? null : Number(totals.collection_rate)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 xl:gap-0 xl:divide-x xl:divide-outline-variant/40">
      <KpiColumn label="Cuotas generadas">
        <p className={`${VALUE_CLASS} text-on-surface`}>
          {formatCount(totals.generated)} <span className="text-sm font-medium text-on-surface-variant">totales</span>
        </p>
        <Breakdown rows={[
          { label: 'Socios', value: formatCount(members.generated) },
          { label: 'Jugadores', value: formatCount(players.generated), note: partialLeaveNote(partialLeave.generated) },
        ]}
        />
      </KpiColumn>

      <KpiColumn label="Facturado / Recaudado">
        <p className={VALUE_CLASS}>
          <Amount value={totals.billed} className="text-on-surface" />
          <span className="text-on-surface-variant font-medium"> / </span>
          <Amount value={totals.collected} className="text-emerald-700" />
        </p>
        <Breakdown rows={[
          { label: 'Socios', value: <><Amount value={members.billed} /> / <Amount value={members.collected} /></> },
          { label: 'Jugadores', value: <><Amount value={players.billed} /> / <Amount value={players.collected} /></> },
        ]}
        />
      </KpiColumn>

      <KpiColumn label="Impagas a la fecha">
        <p className={VALUE_CLASS}>
          <Amount value={totals.unpaid_amount} className={totals.unpaid > 0 ? 'text-error' : 'text-on-surface'} />
          <span className="ml-1.5 text-sm font-medium text-on-surface-variant">
            ({formatCount(totals.unpaid)} {totals.unpaid === 1 ? 'impaga' : 'impagas'})
          </span>
        </p>
        <Breakdown rows={[
          { label: 'Socios', value: <>{formatCount(members.unpaid)} (<Amount value={members.unpaid_amount} />)</> },
          {
            label: 'Jugadores',
            value: <>{formatCount(players.unpaid)} (<Amount value={players.unpaid_amount} />)</>,
            note: partialLeaveNote(partialLeave.unpaid),
          },
        ]}
        />
      </KpiColumn>

      <KpiColumn label="Cobrabilidad">
        <p className={`${VALUE_CLASS} text-on-surface`}>{rate == null ? '—' : formatPercentage(rate)}</p>
        <div
          role="progressbar"
          aria-label="Tasa de cobrabilidad"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={rate ?? 0}
          className="mt-3 h-2 rounded-full bg-surface-container-high overflow-hidden"
        >
          <div className={`h-full rounded-full transition-[width] duration-500 ${rateTone(rate ?? 0)}`} style={{ width: `${Math.min(100, rate ?? 0)}%` }} />
        </div>
        <p className="mt-2 text-sm text-on-surface-variant">
          {rate == null
            ? 'Todavía no hay montos facturados en el período.'
            : <>Recaudación efectiva: <Amount value={totals.collected} className="font-medium text-on-surface" /> de <Amount value={totals.billed} className="font-medium text-on-surface" /></>}
        </p>
      </KpiColumn>
    </div>
  )
}
