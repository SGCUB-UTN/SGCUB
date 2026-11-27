import useEntered from '../../hooks/useEntered'
import { formatPercentage } from '../cuota/cuotaPeriod'
import { shareOf } from '../finanzas/cashFormat'

const SEGMENT_MOTION = '[transition:flex-grow_700ms_ease-out,opacity_150ms] motion-reduce:[transition:none]'

export default function StackedBar({ segments, total, label, activeKey = null, onActiveChange }) {
  const entered = useEntered()
  const description = segments.map((segment) => `${segment.label} ${formatPercentage(shareOf(segment.amount, total))}`).join(', ')
  return (
    <div className="flex h-3 gap-0.5" role="img" aria-label={`${label}: ${description}`}>
      {segments.map((segment) => (
        <div
          key={segment.key}
          className={`basis-0 min-w-1 first:rounded-l-full last:rounded-r-full ${segment.colorClass} ${SEGMENT_MOTION} ${activeKey !== null && activeKey !== segment.key ? 'opacity-35' : ''}`}
          style={{ flexGrow: entered ? segment.amount : 0 }}
          onMouseEnter={() => onActiveChange?.(segment.key)}
          onMouseLeave={() => onActiveChange?.(null)}
        />
      ))}
    </div>
  )
}
