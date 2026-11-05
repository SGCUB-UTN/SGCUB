import { useState } from 'react'
import { formatCount, formatPercentage } from '../cuota/cuotaPeriod'
import { shareOf } from '../finanzas/cashFormat'
import DonutChart from '../shared/DonutChart'
import { legendItemProps } from '../shared/donutLegend'
import ReportCard from './ReportCard'
import { countOf } from './reportCharts'

export default function DistributionDonut({ title, caption, items, colors, centerCaption = 'personas', emptyLabel = 'Sin datos para mostrar' }) {
  const [activeKey, setActiveKey] = useState(null)
  const total = countOf(items)
  const segments = items.map((item) => ({
    key: item.key,
    label: item.label,
    amount: item.count,
    strokeClass: colors[item.key].stroke,
    display: formatCount(item.count),
    share: formatPercentage(shareOf(item.count, total)),
  }))

  return (
    <ReportCard title={title} caption={caption}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <DonutChart
          segments={segments}
          total={total}
          size={136}
          stroke={18}
          centerValue={formatCount(total)}
          caption={centerCaption}
          label={`${title}: ${segments.map((segment) => `${segment.display} ${segment.label}`).join(', ')}`}
          emptyLabel={emptyLabel}
          activeKey={activeKey}
          onActiveChange={setActiveKey}
        />
        {total > 0 ? (
          <ul className="flex-1 min-w-44 flex flex-col gap-1 text-sm">
            {segments.map((segment) => {
              const interaction = legendItemProps(segment.key, activeKey, setActiveKey)
              return (
                <li key={segment.key} {...interaction} className={`${interaction.className} flex items-center gap-2 min-w-0`}>
                  <span className={`w-2.5 h-2.5 shrink-0 rounded-sm ${colors[segment.key].fill}`} aria-hidden="true" />
                  <span className="flex-1 min-w-0 truncate text-on-surface-variant" title={segment.label}>{segment.label}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-on-surface">{segment.display}</span>
                  <span className="w-14 shrink-0 text-right text-xs tabular-nums text-on-surface-variant">{segment.share}</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-on-surface-variant">{emptyLabel}.</p>
        )}
      </div>
    </ReportCard>
  )
}
