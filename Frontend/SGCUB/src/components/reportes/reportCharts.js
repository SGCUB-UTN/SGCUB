export const NO_DATA_KEY = 'sin_datos'

export const NO_DATA_LABEL = 'Sin datos'

export const NO_DATA_COLOR = { fill: 'bg-outline-variant', stroke: 'stroke-outline-variant' }

export const SERIES_COLORS = [
  { fill: 'bg-chart-1', stroke: 'stroke-chart-1' },
  { fill: 'bg-chart-2', stroke: 'stroke-chart-2' },
  { fill: 'bg-chart-3', stroke: 'stroke-chart-3' },
  { fill: 'bg-chart-4', stroke: 'stroke-chart-4' },
  { fill: 'bg-chart-5', stroke: 'stroke-chart-5' },
  { fill: 'bg-chart-6', stroke: 'stroke-chart-6' },
]

const GOOD = { fill: 'bg-emerald-600', stroke: 'stroke-emerald-600' }
const WARNING = { fill: 'bg-amber-500', stroke: 'stroke-amber-500' }
const CRITICAL = { fill: 'bg-error', stroke: 'stroke-error' }

export const STATUS_COLORS = {
  vaccination: { al_dia: GOOD, pendiente: WARNING, sin_datos: NO_DATA_COLOR },
  documentation: { habilitado: GOOD, inhabilitado: CRITICAL },
}

export const seriesColors = (items) => Object.fromEntries(
  items.map((item, index) => [
    item.key,
    item.key === NO_DATA_KEY ? NO_DATA_COLOR : SERIES_COLORS[index] ?? NO_DATA_COLOR,
  ]),
)

const decimal = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })

export const formatDecimal = (value) => (value == null ? '—' : decimal.format(Number(value)))

export const countOf = (items) => items.reduce((total, item) => total + item.count, 0)

export const peopleLabel = (count) => `${count.toLocaleString('es-AR')} ${count === 1 ? 'persona' : 'personas'}`

export const niceMax = (value) => {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  return [1, 2, 5, 10].map((step) => step * power).find((candidate) => candidate >= value)
}
