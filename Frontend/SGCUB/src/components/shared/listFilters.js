import { accountDebt } from '../finanzas/accountDebt'

export const FILTER_CLASS = 'bg-surface-container-low border border-outline-variant/40 rounded text-on-surface font-body-sm text-sm font-medium focus:outline-none focus:border-primary cursor-pointer'

export const ALL = 'todos'

export const SEARCH_WIDTH = 'sm:w-64 sm:flex-none'

export const FILTER_WIDTH = 'sm:w-40'

export const ACCOUNT_FILTERS = [
  { value: ALL, label: 'Cuenta' },
  { value: 'al_dia', label: 'Al día' },
  { value: 'con_deuda', label: 'Con deuda' },
  { value: 'con_vencidas', label: 'Con vencidas' },
]

export const matchesAccountFilter = (cuenta, value) => {
  if (value === ALL) return true
  const debt = accountDebt(cuenta)
  if (value === 'al_dia') return debt <= 0
  if (value === 'con_deuda') return debt > 0
  return (cuenta?.cuotas_vencidas ?? 0) > 0
}

export const DOCUMENTATION_FILTERS = [
  { value: ALL, label: 'Documentación' },
  { value: 'vigente', label: 'Al día' },
  { value: 'por_vencer', label: 'Por vencer' },
  { value: 'vencido', label: 'Vencida' },
  { value: 'faltante', label: 'Incompleta' },
]

export const matchesDocumentationFilter = (documentacion, value) => value === ALL || documentacion?.estado === value

export const filterLabel = (options, value, prefix) => {
  if (value === ALL) return null
  const label = options.find((option) => option.value === value)?.label
  return label && prefix ? `${prefix}: ${label}` : label
}
