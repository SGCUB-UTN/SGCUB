import { formatMoney, formatWholeMoney } from '../cuota/cuotaPeriod'

const SIZE = 168
const STROKE = 22
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GAP = 2

function arcsOf(segments, total) {
  let offset = 0
  return segments
    .filter((segment) => Number(segment.amount) > 0)
    .map((segment) => {
      const length = total > 0 ? (Number(segment.amount) / total) * CIRCUMFERENCE : 0
      const arc = { ...segment, length, offset }
      offset += length
      return arc
    })
}

export default function DonutChart({ segments, total, caption, label, emptyLabel }) {
  const arcs = arcsOf(segments, total)
  const gap = arcs.length > 1 ? GAP : 0

  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={total > 0 ? label : emptyLabel}
        className="-rotate-90"
      >
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-surface-container-high" />
        {arcs.map((arc) => (
          <circle
            key={arc.key}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            className={arc.strokeClass}
            strokeDasharray={`${Math.max(arc.length - gap, 0)} ${CIRCUMFERENCE}`}
            strokeDashoffset={-arc.offset}
          >
            <title>{arc.title}</title>
          </circle>
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
        <span className="text-lg font-bold tabular-nums text-on-surface leading-tight" title={formatMoney(total)}>{formatWholeMoney(total)}</span>
        <span className="text-xs text-on-surface-variant">{caption}</span>
      </div>
    </div>
  )
}
