import { useState } from 'react'
import useEntered from '../../hooks/useEntered'
import { formatCount, formatPercentage } from '../cuota/cuotaPeriod'
import { shareOf } from '../finanzas/cashFormat'
import { ROW_HOVER, WIDTH_MOTION, grown } from '../shared/chartMotion'
import { TEXT_BUTTON_CLASS } from '../shared/textButton'
import ReportCard from './ReportCard'
import { NO_DATA_KEY, NO_DATA_LABEL, countOf } from './reportCharts'

const isNoData = (item) => item.key === NO_DATA_KEY || item.key === NO_DATA_LABEL

export default function DistributionBars({
  title,
  caption,
  items,
  total = countOf(items),
  limit = null,
  hideEmpty = false,
  emptyLabel = 'Sin datos para mostrar.',
  className = '',
}) {
  const entered = useEntered()
  const [expanded, setExpanded] = useState(false)
  const rows = hideEmpty ? items.filter((item) => item.count > 0) : items
  const visible = limit && !expanded ? rows.slice(0, limit) : rows
  const max = Math.max(0, ...rows.map((item) => item.count))
  const hidden = rows.length - visible.length

  return (
    <ReportCard title={title} caption={caption} className={className}>
      {countOf(rows) === 0 ? (
        <p className="text-sm text-on-surface-variant">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-0.5">
            {visible.map((item) => {
              const share = formatPercentage(shareOf(item.count, total))
              return (
                <li
                  key={item.key}
                  aria-label={`${item.label}: ${formatCount(item.count)} (${share})`}
                  className={`grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-x-3 ${ROW_HOVER}`}
                >
                  <span className={`text-sm truncate ${isNoData(item) ? 'text-on-surface-variant italic' : 'text-on-surface'}`} title={item.label}>
                    {item.label}
                  </span>
                  <div className="h-2 rounded bg-surface-container-high" aria-hidden="true">
                    <div
                      className={`h-full rounded ${isNoData(item) ? 'bg-outline-variant' : 'bg-primary'} ${WIDTH_MOTION}`}
                      style={{ width: grown(entered, `${shareOf(item.count, max)}%`) }}
                    />
                  </div>
                  <span className="text-sm tabular-nums text-right whitespace-nowrap" aria-hidden="true">
                    <span className="font-semibold text-on-surface">{formatCount(item.count)}</span>
                    <span className="inline-block w-14 text-xs text-on-surface-variant">{share}</span>
                  </span>
                </li>
              )
            })}
          </ul>
          {(hidden > 0 || expanded) && (
            <button type="button" onClick={() => setExpanded((current) => !current)} className={`${TEXT_BUTTON_CLASS} self-end text-xs`}>
              {expanded ? 'Ver menos' : `Ver todas (${rows.length})`}
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{expanded ? 'expand_less' : 'expand_more'}</span>
            </button>
          )}
        </div>
      )}
    </ReportCard>
  )
}
