import { useLayoutEffect, useRef, useState } from 'react'
import { Modal } from '@mantine/core'
import { formatCount, formatMoney, formatPercentage, formatWholeMoney } from '../cuota/cuotaPeriod'
import { formatPeriod } from '../shared/periodFormat'
import { barWidth, countLabel, shareOf } from './cashFormat'

const SERIES_COLORS = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5', 'bg-chart-6']
const OTHER_COLOR = 'bg-outline'

const colorConcepts = (concepts) => concepts.map((concept, index) => ({
  ...concept,
  colorClass: SERIES_COLORS[index] ?? OTHER_COLOR,
}))

function stackSegments(concepts) {
  if (concepts.length <= SERIES_COLORS.length) return concepts
  const rest = concepts.slice(SERIES_COLORS.length)
  return [
    ...concepts.slice(0, SERIES_COLORS.length),
    {
      key: '__otros__',
      label: `Otros (${countLabel(rest.length, 'concepto', 'conceptos')})`,
      amount: rest.reduce((total, concept) => total + concept.amount, 0),
      count: rest.reduce((total, concept) => total + concept.count, 0),
      colorClass: OTHER_COLOR,
    },
  ]
}

function useFittingCount(listRef, count) {
  const [fitting, setFitting] = useState(count)

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return undefined
    const observer = new ResizeObserver(() => {
      const overflowing = [...list.children].findIndex((item) => item.offsetTop + item.offsetHeight > list.clientHeight)
      setFitting(overflowing === -1 ? list.children.length : overflowing)
    })
    observer.observe(list)
    return () => observer.disconnect()
  }, [listRef, count])

  return Math.min(fitting, count)
}

function StackedBar({ segments, total }) {
  const description = segments.map((segment) => `${segment.label} ${formatPercentage(shareOf(segment.amount, total))}`).join(', ')
  return (
    <div className="flex h-3 gap-0.5" role="img" aria-label={`Otros ingresos por concepto: ${description}`}>
      {segments.map((segment) => (
        <div
          key={segment.key}
          className={`basis-0 min-w-1 first:rounded-l-full last:rounded-r-full ${segment.colorClass}`}
          style={{ flexGrow: segment.amount }}
          title={`${segment.label}: ${formatMoney(segment.amount)} (${formatPercentage(shareOf(segment.amount, total))})`}
        />
      ))}
    </div>
  )
}

function ConceptRow({ concept, max, total }) {
  return (
    <li>
      <div className="flex items-baseline gap-2">
        <span className={`w-2.5 h-2.5 shrink-0 rounded-sm ${concept.colorClass}`} aria-hidden="true" />
        <span className="flex-1 min-w-0 text-sm text-on-surface break-words">{concept.label}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-on-surface" title={formatMoney(concept.amount)}>{formatWholeMoney(concept.amount)}</span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-surface-container-high" aria-hidden="true">
        <div className={`h-full rounded-full ${concept.colorClass}`} style={{ width: barWidth(concept.amount, max) }} />
      </div>
      <p className="mt-1 text-xs text-on-surface-variant tabular-nums">
        {countLabel(concept.count, 'recibo', 'recibos')} · {formatPercentage(shareOf(concept.amount, total))} de otros ingresos
      </p>
    </li>
  )
}

function Stat({ label, value, title }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className="text-lg font-bold tabular-nums text-on-surface" title={title}>{value}</p>
    </div>
  )
}

function OtherIncomeModal({ opened, onClose, concepts, otherIncome, period }) {
  const max = Math.max(...concepts.map((concept) => concept.amount))
  return (
    <Modal opened={opened} onClose={onClose} title={`Otros ingresos de ${formatPeriod(period)}`} centered size="lg">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-surface-container-low border border-outline-variant/30">
          <Stat label="Total" value={formatWholeMoney(otherIncome.amount)} title={formatMoney(otherIncome.amount)} />
          <Stat label="Recibos" value={formatCount(otherIncome.count)} />
          <Stat label="Conceptos" value={formatCount(concepts.length)} />
        </div>
        <ol className="flex flex-col gap-4" aria-label="Otros ingresos por concepto, de mayor a menor">
          {concepts.map((concept) => (
            <ConceptRow key={concept.key} concept={concept} max={max} total={otherIncome.amount} />
          ))}
        </ol>
      </div>
    </Modal>
  )
}

export default function OtherIncomeRanking({ concepts, otherIncome, period }) {
  const [opened, setOpened] = useState(false)
  const listRef = useRef(null)
  const colored = colorConcepts(concepts)
  const segments = stackSegments(colored)
  const fitting = useFittingCount(listRef, segments.length)

  if (concepts.length === 0) {
    return <p className="text-sm text-on-surface-variant">No hubo ingresos ajenos a cuotas en {formatPeriod(period)}.</p>
  }

  const hasMore = fitting < segments.length || segments.length < concepts.length

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-on-surface-variant">{countLabel(otherIncome.count, 'recibo', 'recibos')}</span>
        <span className="text-lg font-bold tabular-nums text-on-surface" title={formatMoney(otherIncome.amount)}>{formatWholeMoney(otherIncome.amount)}</span>
      </div>

      <StackedBar segments={segments} total={otherIncome.amount} />

      <ul ref={listRef} className="relative flex-1 min-h-0 overflow-hidden flex flex-col gap-2.5">
        {segments.map((segment, index) => (
          <li key={segment.key} className={`flex items-center gap-2 text-sm ${index < fitting ? '' : 'invisible'}`}>
            <span className={`w-2.5 h-2.5 shrink-0 rounded-sm ${segment.colorClass}`} aria-hidden="true" />
            <span className="flex-1 min-w-0 truncate text-on-surface" title={segment.label}>{segment.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-on-surface" title={formatMoney(segment.amount)}>{formatWholeMoney(segment.amount)}</span>
            <span className="w-12 shrink-0 text-right text-xs tabular-nums text-on-surface-variant">{formatPercentage(shareOf(segment.amount, otherIncome.amount))}</span>
          </li>
        ))}
      </ul>

      {hasMore && (
        <button
          type="button"
          onClick={() => setOpened(true)}
          className="self-end inline-flex items-center gap-0.5 rounded text-xs font-semibold text-primary hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          Ver más
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">chevron_right</span>
        </button>
      )}

      <OtherIncomeModal
        opened={opened}
        onClose={() => setOpened(false)}
        concepts={colored}
        otherIncome={otherIncome}
        period={period}
      />
    </div>
  )
}
