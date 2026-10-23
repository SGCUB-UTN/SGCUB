const normalizeState = (state) => String(state ?? '').toLowerCase().replaceAll(' ', '')

export const isPaid = (cuota) => normalizeState(cuota.estado_cuota ?? cuota.estado) === 'paga'

export const cuotaAmount = (cuota) => Number(cuota.monto_total ?? 0)

export const cuotaConcepts = (cuota) => [...new Set((cuota.items ?? []).map((item) => item.concepto_nombre ?? item.concepto).filter(Boolean))].join(', ') || '—'

const DISCOUNT_CONCEPT = 'DescuentoUnico'

export const todayIso = () => {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

// 'upcoming' before its start date, 'finished' after its end date, 'active' otherwise
export const scholarshipState = (beca, today = todayIso()) => {
  if (beca.fecha_aplicacion > today) return 'upcoming'
  if (beca.fecha_fin && beca.fecha_fin < today) return 'finished'
  return 'active'
}

// One-off discounts applied to the given cuotas, most recent first
export const cuotaDiscounts = (cuotas) => cuotas
  .flatMap((cuota) => (cuota.items ?? [])
    .filter((item) => item.es_descuento && item.concepto === DISCOUNT_CONCEPT)
    .map((item) => ({ ...item, periodo: cuota.periodo })))
  .sort((a, b) => String(b.fecha_aplicacion).localeCompare(String(a.fecha_aplicacion)))
