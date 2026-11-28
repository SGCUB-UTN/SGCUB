import { formatPeriod } from '../shared/periodFormat'

export const NO_CUOTAS = []

export const EXCESS_PARTIAL = 'parcial'
export const EXCESS_CREDIT_NOTE = 'notaCredito'

export const roundCents = (value) => Math.round(value * 100) / 100

export const amountInput = (value) => (value > 0 ? roundCents(value).toFixed(2) : '')

export const emptyPaymentRow = (monto = '') => ({ medio: '', monto, edited: false })

export const isRowComplete = (row) => Boolean(row.medio) && Number(row.monto) > 0

export const mergeMethods = (rows) => {
  const totals = new Map()
  rows.forEach((row) => totals.set(row.medio, roundCents((totals.get(row.medio) ?? 0) + Number(row.monto || 0))))
  return [...totals].map(([medio, monto]) => ({ medio, monto }))
}

export const cuotaDue = (cuota) => roundCents(Number(cuota.saldo_pendiente || 0))

export const isFuture = (cuota, period) => String(cuota.periodo) > period

export const allocate = (cuotas, amount) => {
  let remaining = amount
  return cuotas.map((cuota) => {
    const due = cuotaDue(cuota)
    const applied = roundCents(Math.min(Math.max(remaining, 0), due))
    remaining = roundCents(remaining - applied)
    return { cuota, due, applied }
  })
}

export const fitMethods = (medios, total) => {
  let remaining = roundCents(total)
  return medios
    .map((medio) => {
      const monto = roundCents(Math.min(medio.monto, Math.max(remaining, 0)))
      remaining = roundCents(remaining - monto)
      return { medio: medio.medio, monto: amountInput(monto), edited: true }
    })
    .filter((row) => row.monto)
}

export const excessReason = (reversal) => {
  if (!reversal) return ''
  const period = reversal.lastPeriod ? formatPeriod(reversal.lastPeriod).replace(' de ', ' ') : ''
  if (reversal.otherSocio) {
    const paid = period ? `el pago de ${period}` : `el pago ${reversal.codigo}`
    const wrongSocio = reversal.socioName ? ` a ${reversal.socioName}` : ' a otro socio'
    return `Sobrante: ${paid} se registró por error${wrongSocio}.`
  }
  if (!period) return `Sobrante del pago anulado ${reversal.codigo}`
  return `Sobrante del pago anulado de ${period}.`
}

export const reversalNote = (reversal) => {
  if (!reversal) return ''
  return reversal.otherSocio
    ? `Pago anulado ${reversal.codigo} registrado en el socio correcto`
    : `Vuelve a cobrar el pago anulado ${reversal.codigo}`
}

const monthName = (period) => {
  const [year, month] = String(period).split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('es-AR', { month: 'long' })
}

const joinWords = (words) => (words.length > 1 ? `${words.slice(0, -1).join(', ')} y ${words.at(-1)}` : words[0] ?? '')

export const periodsText = (periods) => {
  const years = []
  periods.forEach((period) => {
    const year = String(period).slice(0, 4)
    const group = years.find((current) => current.year === year)
    if (group) group.months.push(monthName(period))
    else years.push({ year, months: [monthName(period)] })
  })
  return joinWords(years.map((group) => `${joinWords(group.months)} de ${group.year}`))
}

export const firstCuotasTotal = (cuotas, count) => roundCents(cuotas
  .slice(0, count)
  .reduce((total, cuota) => total + cuotaDue(cuota), 0))

export const initialCount = (cuotas, ids, period) => {
  const lastIndex = cuotas.reduce((last, cuota, index) => (ids.includes(cuota.cuota_id) ? index : last), -1)
  return lastIndex >= 0 ? lastIndex + 1 : cuotas.filter((cuota) => !isFuture(cuota, period)).length
}

export const visibleCuotaLines = (lines, period) => {
  const dueLines = lines.filter((line) => !isFuture(line.cuota, period))
  const futureLines = lines.filter((line) => isFuture(line.cuota, period))
  const coveredCount = futureLines.filter((line) => line.applied > 0).length
  return { dueLines, visibleFuture: futureLines.slice(0, Math.max(1, coveredCount)) }
}

export const toggleId = (ids, id) => (ids.includes(id) ? ids.filter((current) => current !== id) : [...ids, id])
