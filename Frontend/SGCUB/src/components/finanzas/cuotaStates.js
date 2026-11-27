export const CUOTA_STATES = {
  EN_FECHA: 'EnFecha',
  VENCIDA_1: 'Vencida1',
  VENCIDA_2: 'Vencida2',
  PAGA: 'Paga',
}

export const OVERDUE_FILTER = 'Vencidas'

const OVERDUE_STATES = [CUOTA_STATES.VENCIDA_1, CUOTA_STATES.VENCIDA_2]

export const CUOTA_STATE_LABELS = {
  [CUOTA_STATES.EN_FECHA]: 'En fecha',
  [CUOTA_STATES.VENCIDA_1]: 'Vencida (1° venc.)',
  [CUOTA_STATES.VENCIDA_2]: 'Vencida (2° venc.)',
  [CUOTA_STATES.PAGA]: 'Paga',
}

const CUOTA_STATE_SHORT_LABELS = {
  [CUOTA_STATES.EN_FECHA]: 'En fecha',
  [CUOTA_STATES.VENCIDA_1]: 'Vencida',
  [CUOTA_STATES.VENCIDA_2]: 'Vencida',
  [CUOTA_STATES.PAGA]: 'Paga',
}

export const CUOTA_STATE_TONES = {
  [CUOTA_STATES.EN_FECHA]: 'info',
  [CUOTA_STATES.VENCIDA_1]: 'alerta',
  [CUOTA_STATES.VENCIDA_2]: 'error',
  [CUOTA_STATES.PAGA]: 'ok',
}

export const CUOTA_STATE_ORDER = {
  [CUOTA_STATES.VENCIDA_2]: 0,
  [CUOTA_STATES.VENCIDA_1]: 1,
  [CUOTA_STATES.EN_FECHA]: 2,
  [CUOTA_STATES.PAGA]: 3,
}

export const cuotaState = (cuota) => cuota?.estado_cuota ?? cuota?.estado

export const isOverdue = (cuota) => OVERDUE_STATES.includes(cuotaState(cuota))

export const matchesStateFilter = (cuota, filter) => (
  filter === OVERDUE_FILTER ? isOverdue(cuota) : cuotaState(cuota) === filter
)

export const cuotaStateLabel = (state) => CUOTA_STATE_LABELS[state] ?? state ?? '—'

export const cuotaStateShortLabel = (state) => CUOTA_STATE_SHORT_LABELS[state] ?? cuotaStateLabel(state)

export const countByState = (cuotas, state) => cuotas.filter((cuota) => cuotaState(cuota) === state).length

export const overdueBreakdown = (first, second) => `${Number(first ?? 0)} en 1° venc. · ${Number(second ?? 0)} en 2° venc.`
