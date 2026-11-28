import { useState } from 'react'
import useEntered from '../../hooks/useEntered'
import { formatMoney, formatPercentage } from '../cuota/cuotaPeriod'
import DataTable from '../shared/DataTable'
import { HEIGHT_MOTION, grown } from '../shared/chartMotion'
import { formatPeriod } from '../shared/periodFormat'
import { formatCompactMoney } from './chartFormat'

const CHART_HEIGHT = 220
const STAGGER_MS = 20
const COLLECTED_DELAY_MS = 60
const BILLED_CLASS = 'bg-emerald-100 ring-1 ring-inset ring-emerald-200'
const COLLECTED_CLASS = 'bg-emerald-600'

const shortMonth = (period) => {
  const [year, month] = period.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')
}

const niceMax = (value) => {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  return [1, 2, 5, 10].map((step) => step * power).find((candidate) => candidate >= value)
}

const share = (value, max) => `${Math.min((Number(value) / max) * 100, 100)}%`

const rateText = (row) => (row.efectividad == null ? '—' : formatPercentage(row.efectividad))

const describe = (row, selected) => [
  `${formatPeriod(row.periodo)}${selected ? ' (mes elegido)' : ''}`,
  `Total a cobrar: ${formatMoney(row.facturado)}`,
  `Cobrado: ${formatMoney(row.cobrado)}`,
  `${rateText(row)} cobrado`,
]

const tooltipPosition = (index, count) => (index < count / 2 ? 'left-full ml-2' : 'right-full mr-2')

const tooltipRows = (row) => [
  { key: 'billed', swatchClass: BILLED_CLASS, label: 'Total a cobrar', value: formatMoney(row.facturado) },
  { key: 'collected', swatchClass: COLLECTED_CLASS, label: 'Cobrado', value: formatMoney(row.cobrado) },
  { key: 'rate', label: 'cobrado', value: rateText(row) },
]

function ChartTooltip({ row, position }) {
  return (
    <div
      role="tooltip"
      className={`absolute top-2 z-10 w-max flex flex-col gap-1.5 px-3 py-2 rounded-md border border-outline-variant/40 bg-surface-container-lowest shadow-md text-sm pointer-events-none ${position}`}
    >
      <span className="font-semibold text-on-surface">{formatPeriod(row.periodo)}</span>
      <div className="grid grid-cols-[auto_auto_auto] items-center gap-x-2 gap-y-1">
        {tooltipRows(row).map((item) => (
          <div key={item.key} className="contents">
            <span className={`w-3 h-3 rounded-sm ${item.swatchClass ?? ''}`} aria-hidden="true" />
            <span className="font-semibold tabular-nums text-on-surface">{item.value}</span>
            <span className="text-on-surface-variant">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LegendItem({ swatchClass, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded-sm ${swatchClass}`} aria-hidden="true" />
      {label}
    </span>
  )
}

export function CollectionEvolutionTable({ evolution, period }) {
  const rows = [...evolution].reverse()
  return (
    <DataTable
      headerCase="title"
      headers={(
        <>
          <th className="py-3 px-4" scope="col">Mes</th>
          <th className="py-3 px-4 text-right" scope="col">Total a cobrar</th>
          <th className="py-3 px-4 text-right" scope="col">Cobrado</th>
          <th className="py-3 px-4 text-right" scope="col">% cobrado</th>
        </>
      )}
    >
      {rows.map((row) => {
        const selected = row.periodo === period
        return (
          <tr key={row.periodo} aria-current={selected ? 'date' : undefined} className={selected ? 'bg-surface-container-low font-semibold' : ''}>
            <th scope="row" className="py-2.5 px-4 text-left font-medium text-on-surface whitespace-nowrap">{formatPeriod(row.periodo)}</th>
            <td className="py-2.5 px-4 text-right tabular-nums whitespace-nowrap text-on-surface">{formatMoney(row.facturado)}</td>
            <td className="py-2.5 px-4 text-right tabular-nums whitespace-nowrap text-on-surface">{formatMoney(row.cobrado)}</td>
            <td className="py-2.5 px-4 text-right tabular-nums whitespace-nowrap text-on-surface-variant">{rateText(row)}</td>
          </tr>
        )
      })}
    </DataTable>
  )
}

export default function CollectionEvolutionChart({ evolution, period }) {
  const [active, setActive] = useState(null)
  const entered = useEntered()
  const max = niceMax(Math.max(0, ...evolution.flatMap((row) => [Number(row.facturado), Number(row.cobrado)])))
  const ticks = [max, max / 2, 0]

  return (
    <div className="flex flex-col gap-4">
      <p className="flex flex-wrap gap-x-5 gap-y-1 text-base text-on-surface-variant">
        <LegendItem swatchClass={BILLED_CLASS} label="Total a cobrar" />
        <LegendItem swatchClass={COLLECTED_CLASS} label="Cobrado hasta hoy" />
      </p>

      <div className="flex gap-2 min-w-0">
        <div className="flex flex-col justify-between shrink-0 text-sm text-on-surface-variant tabular-nums text-right" style={{ height: CHART_HEIGHT }} aria-hidden="true">
          {ticks.map((tick) => <span key={tick} className="-my-2">{formatCompactMoney(tick)}</span>)}
        </div>

        <div className="relative flex-1 min-w-0">
          <div className="absolute inset-x-0 top-0 flex flex-col justify-between pointer-events-none" style={{ height: CHART_HEIGHT }} aria-hidden="true">
            {ticks.map((tick) => <div key={tick} className="border-t border-dashed border-outline-variant/50" />)}
          </div>

          <ul className="relative flex" aria-label="Evolución anual de cobranza de cuotas">
            {evolution.map((row, index) => {
              const selected = row.periodo === period
              return (
                <li
                  key={row.periodo}
                  tabIndex={0}
                  aria-label={describe(row, selected).join(', ')}
                  aria-current={selected ? 'date' : undefined}
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  className="relative flex-1 min-w-0 flex flex-col items-center gap-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  <div className="relative w-full" style={{ height: CHART_HEIGHT }}>
                    <div
                      className={`absolute inset-0 rounded-md transition-opacity duration-150 ${selected ? 'bg-surface-container-low' : 'bg-primary/5'} ${active === index || selected ? 'opacity-100' : 'opacity-0'}`}
                      aria-hidden="true"
                    />
                    <div className={`absolute inset-0 transition-opacity duration-150 ${active !== null && active !== index ? 'opacity-40' : 'opacity-100'}`}>
                      <div
                        className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 max-w-10 rounded-t ${BILLED_CLASS} ${HEIGHT_MOTION}`}
                        style={{ height: grown(entered, share(row.facturado, max)), transitionDelay: `${index * STAGGER_MS}ms` }}
                      />
                      <div
                        className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-2/5 max-w-5 rounded-t ${COLLECTED_CLASS} ${HEIGHT_MOTION}`}
                        style={{ height: grown(entered, share(row.cobrado, max)), transitionDelay: `${index * STAGGER_MS + COLLECTED_DELAY_MS}ms` }}
                      />
                    </div>
                  </div>
                  <span className={`text-sm uppercase tracking-wide border-b-2 ${selected ? 'border-primary font-bold text-on-surface' : `border-transparent ${active === index ? 'font-bold text-on-surface' : 'text-on-surface-variant'}`}`}>
                    {shortMonth(row.periodo)}
                  </span>

                  {active === index && <ChartTooltip row={row} position={tooltipPosition(index, evolution.length)} />}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
