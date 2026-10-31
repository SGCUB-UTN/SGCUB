import { formatCount, formatPercentage } from '../cuota/cuotaPeriod'

const SIZE = 120
const STROKE = 16
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GAP = 2

const SEGMENTS = [
  { key: 'morosos', label: 'Morosos', fill: 'bg-error', stroke: 'stroke-error' },
  { key: 'alDia', label: 'Al día', fill: 'bg-emerald-600', stroke: 'stroke-emerald-600' },
]

function segmentsOf(counts, total) {
  let offset = 0
  return SEGMENTS
    .filter((segment) => counts[segment.key] > 0)
    .map((segment) => {
      const length = total > 0 ? (counts[segment.key] / total) * CIRCUMFERENCE : 0
      const drawn = { ...segment, count: counts[segment.key], length, offset }
      offset += length
      return drawn
    })
}

export default function PadronStatusChart({ delinquent, roster, percentage }) {
  const counts = { morosos: delinquent, alDia: Math.max(roster - delinquent, 0) }
  const segments = segmentsOf(counts, roster)
  const percentageLabel = formatPercentage(percentage)

  return (
    <div className="min-w-0 h-full flex flex-col">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">Estado del padrón</h3>
      <div className="mt-2 flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="img"
            aria-label={`Estado del padrón: ${formatCount(counts.morosos)} morosos y ${formatCount(counts.alDia)} al día`}
            className="-rotate-90"
          >
            <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-surface-container-high" />
            {segments.map((segment) => (
              <circle
                key={segment.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                strokeWidth={STROKE}
                className={segment.stroke}
                strokeDasharray={`${Math.max(segment.length - (segments.length > 1 ? GAP : 0), 0)} ${CIRCUMFERENCE}`}
                strokeDashoffset={-segment.offset}
              >
                <title>{`${segment.label}: ${formatCount(segment.count)}`}</title>
              </circle>
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-lg font-bold tabular-nums leading-tight text-on-surface">{percentageLabel}</span>
            <span className="text-xs text-on-surface-variant">morosidad</span>
          </div>
        </div>

        <ul className="flex flex-col gap-2 min-w-0 text-sm">
          {SEGMENTS.map((segment) => (
            <li key={segment.key} className="flex items-center gap-2 min-w-0">
              <span className={`w-2.5 h-2.5 shrink-0 rounded-sm ${segment.fill}`} aria-hidden="true" />
              <span className="text-on-surface-variant">{segment.label}</span>
              <span className="font-semibold tabular-nums text-on-surface">{formatCount(counts[segment.key])}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
