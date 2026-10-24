import { isOverdue } from './cuotaStates'

export const buildCuotaBadges = (account) => {
  if (!account) return undefined
  const overdue = (account.cuotas ?? []).filter(isOverdue).length
  if (overdue > 0) return [{ label: overdue, tono: 'error', icon: 'error', hideDot: true, title: 'Vencidas' }]
  return { tono: 'ok', icon: 'check', hideDot: true, title: 'Al día' }
}
