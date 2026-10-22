import { isOverdue } from '../finanzas/cuotaStates'
import { isActiveStatus } from './format'

export const socialStatus = (socio, account) => {
  if (!isActiveStatus(socio?.estado_administrativo_nombre)) {
    return { label: 'Socio inactivo', tone: 'muted', icon: 'block' }
  }
  if ((account?.cuotas ?? []).some(isOverdue)) {
    return { label: 'Socio con deuda', tone: 'error', icon: 'error' }
  }
  return { label: 'Socio activo', tone: 'positive', icon: 'check_circle' }
}

export const sportStatus = (jugador) => (isActiveStatus(jugador?.estado?.nombre)
  ? { label: 'Jugador activo', tone: 'positive', icon: 'sports_soccer' }
  : { label: 'Jugador inactivo', tone: 'muted', icon: 'sports_soccer' })

export const categoryTags = (jugador) => [jugador?.categoria, jugador?.categoria_secundaria]
  .filter((categoria) => categoria?.nombre)
  .map((categoria) => ({ label: categoria.nombre, icon: 'groups' }))
