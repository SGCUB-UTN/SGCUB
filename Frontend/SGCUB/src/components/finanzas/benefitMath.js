import { formatAmount } from '../personas/format'
import { isPaid } from './accountStatement'

const LATE_FEE_CONCEPT = 'Mora'

const LATE_FEE_WAIVER_CONCEPT = 'CondonacionMora'

export const PERCENTAGE = 'porcentaje'

export const FIXED = 'fijo'

export const SCHOLARSHIP_TARGET = 'beca'

export const DISCOUNT_TARGET = 'descuento'

export const todayIso = () => {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

export const roundCents = (value) => Math.round((value + Number.EPSILON) * 100) / 100

const sumItems = (cuota, predicate) => roundCents((cuota?.items ?? [])
  .filter(predicate)
  .reduce((total, item) => total + Number(item.monto ?? 0), 0))

export const discountBase = (cuota) => sumItems(cuota, (item) => !item.es_descuento && item.concepto !== LATE_FEE_CONCEPT)

export const previousBenefits = (cuota) => sumItems(cuota, (item) => item.es_descuento && item.concepto !== LATE_FEE_WAIVER_CONCEPT)

export const remainingWithoutFees = (cuota) => roundCents(Number(cuota?.saldo_sin_recargo ?? 0))

export const isOpen = (cuota) => !isPaid(cuota) && Number(cuota.saldo_pendiente ?? 0) > 0

export const benefitFor = (cuota, mode, value) => {
  const base = discountBase(cuota)
  const amount = mode === PERCENTAGE ? roundCents(base * value / 100) : value
  return roundCents(Math.min(amount, base, remainingWithoutFees(cuota)))
}

export const benefitValueError = (mode, value, maxFixed = null) => {
  if (!(Number.isFinite(value) && value > 0)) return mode === PERCENTAGE ? 'Ingresá un porcentaje.' : 'Ingresá un monto.'
  if (mode === PERCENTAGE && (value < 1 || value > 100)) return 'Debe estar entre 1% y 100%.'
  if (mode === FIXED && maxFixed !== null && value > maxFixed) return `No puede superar lo que falta pagar sin recargo (${formatAmount(maxFixed)}).`
  return ''
}

export const benefitPayload = (mode, value, reason, authorizer) => ({
  modalidad: mode === PERCENTAGE ? 'Porcentaje' : 'MontoFijo',
  valor: value,
  motivo: reason.trim(),
  autorizado_por: authorizer,
})
