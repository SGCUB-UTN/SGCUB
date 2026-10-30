import { useState } from 'react'
import { formatMoney, formatPercentage } from '../cuota/cuotaPeriod'
import { formatPeriod } from '../shared/periodFormat'
import { formatCompactMoney } from './chartFormat'

const CHART_HEIGHT = 220
const BILLED_CLASS = 'bg-primary-fixed'
const COLLECTED_CLASS = 'bg-primary'

const shortMonth = (period) => {
  const [year, month] = period.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')
}

// Rounds the axis top up to 1, 2 or 5 times a power of ten
const niceMax = (value) => {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  return [1, 2, 5, 10].map((step) => step * power).find((candidate) => candidate >= value)
}

const share = (value, max) => `${Math.min((Number(value) / max) * 100, 100)}%`

const describe = (row) => [
  `Mes: ${formatPeriod(row.periodo)}`,
  `Facturado: ${formatMoney(row.facturado)}`,
  `Cobrado: ${formatMoney(row.cobrado)}`,
  `Efectividad: ${row.efectividad == null ? '—' : formatPercentage(row.efectividad)}`,
]

// Tooltips near the edges open towards the inside so they don't overflow the chart
const tooltipPosition = (index, count) => {
  if (index < 2) return 'left-0'
  if (index > count - 3) return 'right-0'
  return 'left-1/2 -translate-x-1/2'
}

function LegendItem({ swatchClass, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded-sm ${swatchClass}`} aria-hidden="true" />
      {label}
    </span>
  )
}

// Overlapping bars per period: what had to come in (billed) behind what actually came in (collected)
export default function CollectionEvolutionChart({ evolution }) {
  const [active, setActive] = useState(null)
  const max = niceMax(Math.max(0, ...evolution.flatMap((row) => [Number(row.facturado), Number(row.cobrado)])))
  const ticks = [max, max / 2, 0]

  return (
    <div className="flex flex-col gap-4">
      <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-on-surface-variant">
        <LegendItem swatchClass={BILLED_CLASS} label="Facturado (debía ingresar)" />
        <LegendItem swatchClass={COLLECTED_CLASS} label="Cobrado (realmente ingresó)" />
      </p>

      <div className="flex gap-2 min-w-0">
        <div className="flex flex-col justify-between shrink-0 text-xs text-on-surface-variant tabular-nums text-right" style={{ height: CHART_HEIGHT }} aria-hidden="true">
          {ticks.map((tick) => <span key={tick} className="-my-1.5">{formatCompactMoney(tick)}</span>)}
        </div>

        <div className="relative flex-1 min-w-0">
          <div className="absolute inset-x-0 top-0 flex flex-col justify-between pointer-events-none" style={{ height: CHART_HEIGHT }} aria-hidden="true">
            {ticks.map((tick) => <div key={tick} className="border-t border-dashed border-outline-variant/50" />)}
          </div>

          <ul className="relative flex" aria-label="Evolución anual de cobranza">
            {evolution.map((row, index) => (
              <li
                key={row.periodo}
                tabIndex={0}
                aria-label={describe(row).join(', ')}
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                className="relative flex-1 min-w-0 flex flex-col items-center gap-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <div className="relative w-full" style={{ height: CHART_HEIGHT }}>
                  <div
                    className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 max-w-10 rounded-t ${BILLED_CLASS} ${active === index ? 'ring-2 ring-primary/30' : ''}`}
                    style={{ height: share(row.facturado, max) }}
                  />
                  <div
                    className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-2/5 max-w-5 rounded-t ${COLLECTED_CLASS}`}
                    style={{ height: share(row.cobrado, max) }}
                  />
                </div>
                <span className={`text-xs uppercase tracking-wide ${active === index ? 'font-bold text-on-surface' : 'text-on-surface-variant'}`}>
                  {shortMonth(row.periodo)}
                </span>

                {active === index && (
                  <div
                    role="tooltip"
                    className={`absolute top-2 z-10 w-max max-w-60 flex flex-col gap-0.5 px-3 py-2 rounded-md border border-outline-variant/40 bg-surface-container-lowest shadow-md text-sm text-on-surface pointer-events-none ${tooltipPosition(index, evolution.length)}`}
                  >
                    {describe(row).map((line, position) => (
                      <span key={line} className={position === 0 ? 'font-semibold' : 'tabular-nums'}>{line}</span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
