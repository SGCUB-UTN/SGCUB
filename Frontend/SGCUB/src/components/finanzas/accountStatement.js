const normalizeState = (state) => String(state ?? '').toLowerCase().replaceAll(' ', '')

export const isPaid = (cuota) => normalizeState(cuota.estado_cuota ?? cuota.estado) === 'paga'

export const cuotaAmount = (cuota) => Number(cuota.monto_total ?? 0)

export const cuotaConcepts = (cuota) => [...new Set((cuota.items ?? []).map((item) => item.concepto_nombre ?? item.concepto).filter(Boolean))].join(', ') || '—'

const DISCOUNT_CONCEPT = 'DescuentoUnico'

export const todayIso = () => {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

export const SCHOLARSHIP_STATES = {
  APPLIED: 'Aplicada',
  FINISHED: 'Finalizada',
  CANCELLED: 'Cancelada',
}

export const scholarshipState = (beca, today = todayIso()) => {
  if (beca.estado === SCHOLARSHIP_STATES.APPLIED && beca.fecha_fin && beca.fecha_fin < today) return SCHOLARSHIP_STATES.FINISHED
  return beca.estado ?? SCHOLARSHIP_STATES.APPLIED
}

export const isActiveScholarship = (beca, today = todayIso()) => (
  scholarshipState(beca, today) === SCHOLARSHIP_STATES.APPLIED && beca.fecha_aplicacion <= today
)

export const cuotaDiscounts = (cuotas) => cuotas
  .flatMap((cuota) => [...(cuota.items ?? []), ...(cuota.items_anulados ?? [])]
    .filter((item) => item.es_descuento && item.concepto === DISCOUNT_CONCEPT)
    .map((item) => ({ item, cuota })))
  .sort((a, b) => String(b.item.fecha_aplicacion).localeCompare(String(a.item.fecha_aplicacion)))
