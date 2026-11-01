import { useState } from 'react'
import { formatCount, formatPercentage } from '../cuota/cuotaPeriod'
import DonutChart from '../shared/DonutChart'
import { legendItemProps } from '../shared/donutLegend'
import { shareOf } from './cashFormat'

const SEGMENTS = [
  { key: 'morosos', label: 'Morosos', fill: 'bg-error', stroke: 'stroke-error' },
  { key: 'alDia', label: 'Al día', fill: 'bg-emerald-600', stroke: 'stroke-emerald-600' },
]

export default function PadronStatusChart({ delinquent, roster, percentage }) {
  const [activeKey, setActiveKey] = useState(null)
  const counts = { morosos: delinquent, alDia: Math.max(roster - delinquent, 0) }
  const segments = SEGMENTS.map((segment) => ({
    key: segment.key,
    label: segment.label,
    amount: counts[segment.key],
    strokeClass: segment.stroke,
    display: formatCount(counts[segment.key]),
    share: formatPercentage(shareOf(counts[segment.key], roster)),
  }))

  return (
    <div className="min-w-0 h-full flex flex-col">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">Estado del padrón</h3>
      <div className="mt-2 flex items-center gap-4">
        <DonutChart
          segments={segments}
          total={roster}
          size={120}
          stroke={16}
          centerValue={formatPercentage(percentage)}
          caption="morosidad"
          label={`Estado del padrón: ${formatCount(counts.morosos)} morosos y ${formatCount(counts.alDia)} al día`}
          emptyLabel="Sin socios en el padrón"
          activeKey={activeKey}
          onActiveChange={setActiveKey}
        />

        <ul className="flex flex-col gap-1 min-w-0 text-sm">
          {SEGMENTS.map((segment) => {
            const interaction = legendItemProps(segment.key, activeKey, setActiveKey)
            return (
              <li key={segment.key} {...interaction} className={`${interaction.className} flex items-center gap-2 min-w-0`}>
                <span className={`w-2.5 h-2.5 shrink-0 rounded-sm ${segment.fill}`} aria-hidden="true" />
                <span className="text-on-surface-variant">{segment.label}</span>
                <span className="font-semibold tabular-nums text-on-surface">{formatCount(counts[segment.key])}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
