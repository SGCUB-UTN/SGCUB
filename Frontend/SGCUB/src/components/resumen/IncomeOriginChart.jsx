import { formatMoney, formatPercentage, formatWholeMoney } from '../cuota/cuotaPeriod'
import { SEGMENT_COLORS } from './chartFormat'

const SIZE = 168
const STROKE = 22
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
// Space between segments, in the same units as the circumference
const GAP = 2

function segmentsOf(origin, total) {
  let offset = 0
  return origin
    .map((segment, index) => ({ ...segment, color: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }))
    .filter((segment) => Number(segment.monto) > 0)
    .map((segment) => {
      const length = total > 0 ? (Number(segment.monto) / total) * CIRCUMFERENCE : 0
      const drawn = { ...segment, length, offset }
      offset += length
      return drawn
    })
}

// Ring chart of where the month's income came from: cuotas, the main concepts and the rest grouped
export default function IncomeOriginChart({ income }) {
  const total = Number(income.total)
  const segments = segmentsOf(income.origen, total)
  const description = segments.map((segment) => `${segment.nombre} ${formatPercentage(segment.porcentaje)}`).join(', ')

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={total > 0 ? `Origen de los ingresos: ${description}` : 'Sin ingresos en el período'}
          className="-rotate-90"
        >
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-surface-container-high" />
          {segments.map((segment) => (
            <circle
              key={segment.nombre}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              className={segment.color.stroke}
              strokeDasharray={`${Math.max(segment.length - (segments.length > 1 ? GAP : 0), 0)} ${CIRCUMFERENCE}`}
              strokeDashoffset={-segment.offset}
            >
              <title>{`${segment.nombre}: ${formatMoney(segment.monto)} (${formatPercentage(segment.porcentaje)})`}</title>
            </circle>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <span className="text-lg font-bold tabular-nums text-on-surface leading-tight" title={formatMoney(total)}>{formatWholeMoney(total)}</span>
          <span className="text-xs text-on-surface-variant">Total ingresado</span>
        </div>
      </div>

      <ul className="flex flex-col gap-2 min-w-0 w-full">
        {income.origen.map((segment, index) => (
          <li key={segment.nombre} className="flex items-center gap-2 min-w-0 text-sm">
            <span className={`w-2.5 h-2.5 shrink-0 rounded-sm ${SEGMENT_COLORS[index % SEGMENT_COLORS.length].fill}`} aria-hidden="true" />
            <span className="flex-1 min-w-0 truncate text-on-surface" title={segment.nombre}>{segment.nombre}</span>
            <span className="shrink-0 font-semibold tabular-nums text-on-surface">{formatPercentage(segment.porcentaje)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
