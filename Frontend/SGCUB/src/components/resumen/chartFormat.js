const compactMoney = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', notation: 'compact', maximumFractionDigits: 1 })

// 2500000 -> '$ 2,5 M', for chart axes
export const formatCompactMoney = (amount) => compactMoney.format(Number(amount ?? 0))

// Swatch and stroke classes of the income origin segments, in order: cuotas, main concepts, others
export const SEGMENT_COLORS = [
  { fill: 'bg-primary', stroke: 'stroke-primary' },
  { fill: 'bg-secondary-container', stroke: 'stroke-secondary-container' },
  { fill: 'bg-tertiary', stroke: 'stroke-tertiary' },
  { fill: 'bg-outline-variant', stroke: 'stroke-outline-variant' },
]
