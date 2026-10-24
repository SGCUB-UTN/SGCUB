// Helpers for 'YYYY-MM' periods used by the finance tables.

// '2026-10-04' or '2026-10-04T12:00:00Z' -> '2026-10'
export const periodOf = (date) => (date ? String(date).slice(0, 7) : '')

// '2026-10' -> 'Octubre 2026'
export const formatPeriod = (period) => {
  const [year, month] = String(period ?? '').split('-').map(Number)
  if (!year || !month) return period ?? ''
  const label = new Date(year, month - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// Distinct periods of the given rows, most recent first.
export const periodOptions = (rows, getPeriod) =>
  [...new Set(rows.map(getPeriod).filter(Boolean))].sort().reverse()

export const currentPeriod = (today = new Date()) => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
