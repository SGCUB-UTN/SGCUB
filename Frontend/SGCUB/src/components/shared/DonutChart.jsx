import useEntered from '../../hooks/useEntered'
import { formatWholeMoney } from '../cuota/cuotaPeriod'

const GAP = 2
const ACTIVE_GROWTH = 6
const ARC_MOTION = '[transition:stroke-width_150ms,opacity_150ms,stroke-dasharray_700ms_ease-out] motion-reduce:[transition:none]'

function arcsOf(segments, total, circumference) {
  let offset = 0
  return segments
    .filter((segment) => Number(segment.amount) > 0)
    .map((segment) => {
      const length = total > 0 ? (Number(segment.amount) / total) * circumference : 0
      const arc = { ...segment, length, offset }
      offset += length
      return arc
    })
}

export default function DonutChart({
  segments,
  total,
  caption,
  label,
  emptyLabel,
  size = 168,
  stroke = 22,
  centerValue,
  activeKey = null,
  onActiveChange,
  onSelect,
}) {
  const entered = useEntered()
  const radius = (size - stroke - ACTIVE_GROWTH) / 2
  const circumference = 2 * Math.PI * radius
  const arcs = arcsOf(segments, total, circumference)
  const gap = arcs.length > 1 ? GAP : 0
  const active = segments.find((segment) => segment.key === activeKey)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={total > 0 ? label : emptyLabel}
        className="-rotate-90"
      >
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-surface-container-high" />
        {arcs.map((arc) => (
          <circle
            key={arc.key}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            className={`${arc.strokeClass} cursor-pointer ${ARC_MOTION}`}
            style={{
              strokeWidth: arc.key === activeKey ? stroke + ACTIVE_GROWTH : stroke,
              opacity: activeKey !== null && arc.key !== activeKey ? 0.35 : 1,
              strokeDasharray: `${entered ? Math.max(arc.length - gap, 0) : 0} ${circumference}`,
            }}
            strokeDashoffset={-arc.offset}
            onMouseEnter={() => onActiveChange?.(arc.key)}
            onMouseLeave={() => onActiveChange?.(null)}
            onClick={onSelect ? () => onSelect(arc.key) : undefined}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pointer-events-none">
        {active ? (
          <>
            <span className="text-lg font-bold tabular-nums text-on-surface leading-tight">{active.display}</span>
            <span className="max-w-full truncate text-xs font-semibold text-on-surface">{active.label}</span>
            <span className="text-xs tabular-nums text-on-surface-variant">{active.share}</span>
          </>
        ) : (
          <>
            <span className="text-lg font-bold tabular-nums text-on-surface leading-tight">{centerValue ?? formatWholeMoney(total)}</span>
            <span className="text-xs text-on-surface-variant">{caption}</span>
          </>
        )}
      </div>
    </div>
  )
}
