import { useState } from 'react'
import { formatCount, formatPercentage } from '../cuota/cuotaPeriod'
import { shareOf } from '../finanzas/cashFormat'
import { formatDate } from '../personas/format'
import DonutChart from '../shared/DonutChart'
import { legendItemProps } from '../shared/donutLegend'

const PAID_ON_TIME = { key: 'paid_on_time', fill: 'bg-emerald-600', stroke: 'stroke-emerald-600' }
const PAID_FIRST_SURCHARGE = { key: 'paid_first_surcharge', label: 'Pagas con 1° recargo', fill: 'bg-amber-500', stroke: 'stroke-amber-500' }
const PAID_SECOND_SURCHARGE = { key: 'paid_second_surcharge', label: 'Pagas con 2° recargo', fill: 'bg-orange-700', stroke: 'stroke-orange-700' }
const UNPAID = { key: 'unpaid', label: 'Impagas' }

const SEGMENTS_BY_STAGE = [
  [
    { ...PAID_ON_TIME, label: 'Pagas' },
    { ...UNPAID, fill: 'bg-outline', stroke: 'stroke-outline' },
  ],
  [
    { ...PAID_ON_TIME, label: 'Pagas en 1° instancia' },
    PAID_FIRST_SURCHARGE,
    { ...UNPAID, fill: 'bg-error', stroke: 'stroke-error' },
  ],
  [
    { ...PAID_ON_TIME, label: 'Pagas en 1° instancia' },
    PAID_FIRST_SURCHARGE,
    PAID_SECOND_SURCHARGE,
    { ...UNPAID, fill: 'bg-error', stroke: 'stroke-error' },
  ],
]

function stageNotice(situation) {
  if (situation.generated === 0) return 'Todavía no se generaron las cuotas del período.'
  if (situation.due_dates_passed === 0) {
    return `1° vencimiento el ${formatDate(situation.first_due)}: las impagas todavía no tienen recargo.`
  }
  if (situation.due_dates_passed === 1) {
    return `Pasó el 1° vencimiento (${formatDate(situation.first_due)}): corre el 1° recargo hasta el 2° vencimiento, el ${formatDate(situation.second_due)}.`
  }
  return `Pasó el 2° vencimiento (${formatDate(situation.second_due)}): a las impagas les corre el 2° recargo.`
}

export default function CuotaSituationChart({ situation, label }) {
  const [activeKey, setActiveKey] = useState(null)
  const stage = SEGMENTS_BY_STAGE[Math.min(situation.due_dates_passed, 2)]
  const paid = situation.generated - situation.unpaid
  const segments = stage.map((segment) => ({
    key: segment.key,
    label: segment.label,
    amount: situation[segment.key],
    strokeClass: segment.stroke,
    display: formatCount(situation[segment.key]),
    share: formatPercentage(shareOf(situation[segment.key], situation.generated)),
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row items-center gap-5">
        <DonutChart
          segments={segments}
          total={situation.generated}
          centerValue={formatPercentage(shareOf(paid, situation.generated))}
          caption="pagas"
          label={`${label}: ${stage.map((segment) => `${formatCount(situation[segment.key])} ${segment.label.toLowerCase()}`).join(', ')}`}
          emptyLabel="Sin cuotas generadas en el período"
          activeKey={activeKey}
          onActiveChange={setActiveKey}
        />
        <ul className="flex flex-col gap-1 min-w-0 w-full sm:w-auto text-sm">
          <li className="flex items-center gap-2 pb-1 mb-1 border-b border-outline-variant/30">
            <span className="text-on-surface-variant">Generadas</span>
            <span className="ml-auto pl-3 font-semibold tabular-nums text-on-surface">{formatCount(situation.generated)}</span>
          </li>
          {stage.map((segment) => {
            const interaction = legendItemProps(segment.key, activeKey, setActiveKey)
            return (
              <li key={segment.key} {...interaction} className={`${interaction.className} flex items-center gap-2 min-w-0`}>
                <span className={`w-2.5 h-2.5 shrink-0 rounded-sm ${segment.fill}`} aria-hidden="true" />
                <span className="text-on-surface-variant">{segment.label}</span>
                <span className="ml-auto pl-3 font-semibold tabular-nums text-on-surface">{formatCount(situation[segment.key])}</span>
              </li>
            )
          })}
        </ul>
      </div>
      <p className="text-sm text-on-surface-variant">{stageNotice(situation)}</p>
    </div>
  )
}
