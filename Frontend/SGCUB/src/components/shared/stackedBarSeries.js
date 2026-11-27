import { countLabel } from '../finanzas/cashFormat'

const SERIES_COLORS = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5', 'bg-chart-6']
const OTHER_COLOR = 'bg-outline'
export const OTHERS_KEY = '__otros__'

export const colorSeries = (items) => items.map((item, index) => ({
  ...item,
  colorClass: SERIES_COLORS[index] ?? OTHER_COLOR,
}))

export const segmentKeyOf = (item, index) => (index < SERIES_COLORS.length ? item.key : OTHERS_KEY)

export function stackSegments(items, unit = ['concepto', 'conceptos']) {
  if (items.length <= SERIES_COLORS.length) return items
  const rest = items.slice(SERIES_COLORS.length)
  return [
    ...items.slice(0, SERIES_COLORS.length),
    {
      key: OTHERS_KEY,
      label: `Otros (${countLabel(rest.length, ...unit)})`,
      amount: rest.reduce((total, item) => total + item.amount, 0),
      count: rest.reduce((total, item) => total + item.count, 0),
      colorClass: OTHER_COLOR,
    },
  ]
}
