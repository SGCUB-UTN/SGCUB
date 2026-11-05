import { useLayoutEffect, useRef, useState } from 'react'
import { formatCount } from '../cuota/cuotaPeriod'
import { formatPeriod, formatShortPeriod } from '../shared/periodFormat'
import SegmentedControl from '../shared/SegmentedControl'
import ReportCard from './ReportCard'
import { niceMax } from './reportCharts'

const HEIGHT = 220
const PADDING = { top: 12, right: 16, bottom: 28, left: 36 }
const MIN_LABEL_SPACING = 44
const SERIES = [
  { key: 'joins', label: 'Altas', stroke: 'stroke-chart-1', fill: 'bg-chart-1' },
  { key: 'leaves', label: 'Bajas', stroke: 'stroke-chart-2', fill: 'bg-chart-2' },
]
const VIEWS = [
  { value: 'monthly', label: 'Últimos 12 meses' },
  { value: 'yearly', label: 'Últimos 10 años' },
]

const pointsOf = (evolution, view) => (view === 'monthly'
  ? evolution.monthly.map((row) => ({ ...row, key: row.period, axis: formatShortPeriod(row.period).split(' ')[0], label: formatPeriod(row.period) }))
  : evolution.yearly.map((row) => ({ ...row, key: String(row.year), axis: String(row.year), label: String(row.year) })))

function useWidth(ref) {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return width
}

function LegendSwatch({ series, total }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-4 h-0.5 rounded-full ${series.fill}`} aria-hidden="true" />
      {series.label}
      <span className="font-semibold tabular-nums text-on-surface">{formatCount(total)}</span>
    </span>
  )
}

function Tooltip({ point, x, width }) {
  const alignRight = x > width / 2
  return (
    <div
      role="tooltip"
      className="absolute top-0 z-10 w-max flex flex-col gap-1 px-3 py-2 rounded-md border border-outline-variant/40 bg-surface-container-lowest shadow-md text-sm pointer-events-none"
      style={alignRight ? { right: width - x + 12 } : { left: x + 12 }}
    >
      <span className="font-semibold text-on-surface">{point.label}</span>
      {SERIES.map((series) => (
        <span key={series.key} className="flex items-center gap-2">
          <span className={`w-3 h-0.5 rounded-full ${series.fill}`} aria-hidden="true" />
          <span className="font-semibold tabular-nums text-on-surface">{formatCount(point[series.key])}</span>
          <span className="text-on-surface-variant">{series.label}</span>
        </span>
      ))}
    </div>
  )
}

export default function MembershipEvolutionChart({ evolution }) {
  const [view, setView] = useState('monthly')
  const [active, setActive] = useState(null)
  const containerRef = useRef(null)
  const width = useWidth(containerRef)
  const points = pointsOf(evolution, view)
  const max = niceMax(Math.max(0, ...points.flatMap((point) => SERIES.map((series) => point[series.key]))))
  const ticks = Number.isInteger(max / 2) ? [0, max / 2, max] : [0, max]
  const innerWidth = Math.max(width - PADDING.left - PADDING.right, 0)
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom
  const step = points.length > 1 ? innerWidth / (points.length - 1) : 0
  const labelEvery = Math.max(1, Math.ceil(MIN_LABEL_SPACING / Math.max(step, 1)))
  const xOf = (index) => PADDING.left + index * step
  const yOf = (value) => PADDING.top + innerHeight - (value / max) * innerHeight
  const pathOf = (key) => points.map((point, index) => `${index ? 'L' : 'M'}${xOf(index)},${yOf(point[key])}`).join(' ')
  const totals = Object.fromEntries(SERIES.map((series) => [series.key, points.reduce((total, point) => total + point[series.key], 0)]))
  const activePoint = active === null ? null : points[active]

  return (
    <ReportCard
      title="Evolución de altas y bajas"
      caption="Incluye activos e inactivos según los demás filtros. Las bajas figuran desde que se registra su fecha."
      actions={(
        <SegmentedControl
          label="Período"
          options={VIEWS}
          value={view}
          onChange={(next) => {
            setView(next)
            setActive(null)
          }}
        />
      )}
    >
      <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-on-surface-variant">
        {SERIES.map((series) => <LegendSwatch key={series.key} series={series} total={totals[series.key]} />)}
      </p>

      <div ref={containerRef} className="relative w-full" style={{ height: HEIGHT }} onMouseLeave={() => setActive(null)}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} aria-hidden="true" className="block">
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={PADDING.left} x2={width - PADDING.right} y1={yOf(tick)} y2={yOf(tick)} strokeDasharray={tick ? '3 3' : undefined} className="stroke-outline-variant/60" />
                <text x={PADDING.left - 8} y={yOf(tick)} dy="0.32em" textAnchor="end" className="fill-on-surface-variant text-xs tabular-nums">
                  {formatCount(tick)}
                </text>
              </g>
            ))}
            {points.map((point, index) => (index % labelEvery === 0 || index === points.length - 1) && (
              <text
                key={point.key}
                x={xOf(index)}
                y={HEIGHT - 8}
                textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
                className={`text-xs ${active === index ? 'fill-on-surface font-bold' : 'fill-on-surface-variant'}`}
              >
                {point.axis}
              </text>
            ))}
            {activePoint && (
              <line x1={xOf(active)} x2={xOf(active)} y1={PADDING.top} y2={PADDING.top + innerHeight} className="stroke-outline" strokeDasharray="3 3" />
            )}
            {SERIES.map((series) => (
              <path key={series.key} d={pathOf(series.key)} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className={series.stroke} />
            ))}
            {activePoint && SERIES.map((series) => (
              <circle
                key={series.key}
                cx={xOf(active)}
                cy={yOf(activePoint[series.key])}
                r={4}
                strokeWidth={2}
                className={`${series.stroke} fill-surface-container-lowest`}
              />
            ))}
            {points.map((point, index) => (
              <rect
                key={point.key}
                x={xOf(index) - step / 2}
                y={0}
                width={Math.max(step, 1)}
                height={HEIGHT}
                fill="transparent"
                onMouseEnter={() => setActive(index)}
              />
            ))}
          </svg>
        )}
        {activePoint && <Tooltip point={activePoint} x={xOf(active)} width={width} />}
      </div>

      <table className="sr-only">
        <caption>Altas y bajas por {view === 'monthly' ? 'mes' : 'año'}</caption>
        <thead>
          <tr>
            <th scope="col">Período</th>
            {SERIES.map((series) => <th key={series.key} scope="col">{series.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.key}>
              <th scope="row">{point.label}</th>
              {SERIES.map((series) => <td key={series.key}>{point[series.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </ReportCard>
  )
}
