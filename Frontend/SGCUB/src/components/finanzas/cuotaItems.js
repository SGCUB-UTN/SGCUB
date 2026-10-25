import { isPaid } from './accountStatement'

export const LATE_FEE_CONCEPT = 'Mora'

export const LATE_FEE_WAIVER_CONCEPT = 'CondonacionMora'

export const SCHOLARSHIP_CONCEPT = 'Beca'

export const DISCOUNT_CONCEPT = 'DescuentoUnico'

const BENEFIT_CONCEPTS = [SCHOLARSHIP_CONCEPT, DISCOUNT_CONCEPT]

const PAID_BLOCKER = 'La cuota está paga'

export const itemLabel = (item) => {
  if (item.es_descuento && (item.motivo || '').startsWith('Nota de crédito NC-X')) {
    return 'Ajuste por Nota de Crédito'
  }
  if (item.es_descuento && (item.motivo || '').startsWith('Saldo a favor aplicado')) {
    return 'Saldo a favor aplicado'
  }
  return item.descripcion ?? item.concepto_nombre ?? item.concepto
}

export const isLateFee = (item) => item.concepto === LATE_FEE_CONCEPT

export const isAdjustment = (item) => item.es_descuento || isLateFee(item)

export const itemTone = (item) => {
  if (item.es_descuento) return { className: 'text-emerald-700', sign: '− ' }
  if (isLateFee(item)) return { className: 'text-error', sign: '+ ' }
  return { className: 'text-on-surface', sign: '' }
}

const hasPayments = (cuota) => Number(cuota.monto_pagado ?? 0) > 0

const unpaidLateFee = (cuota) => Number(cuota.saldo_pendiente ?? 0) - Number(cuota.saldo_sin_recargo ?? cuota.saldo_pendiente ?? 0)

export const removalBlocker = (cuota, item) => {
  if (item.es_descuento && ((item.motivo || '').startsWith('Nota de crédito NC-X') || (item.motivo || '').startsWith('Saldo a favor aplicado'))) {
    return null
  }
  if (isLateFee(item)) {
    if (isPaid(cuota)) return PAID_BLOCKER
    return hasPayments(cuota) && unpaidLateFee(cuota) <= 0 ? 'El recargo ya fue pagado' : ''
  }
  if (BENEFIT_CONCEPTS.includes(item.concepto)) {
    if (isPaid(cuota)) return PAID_BLOCKER
    return hasPayments(cuota) ? 'La cuota tiene pagos aplicados' : ''
  }
  return null
}
