import { isOverdue } from '../finanzas/cuotaStates'
import { isActiveStatus } from './format'

const DEACTIVATED = { label: 'De Baja', tone: 'muted', icon: 'block' }
const TEMPORARY_LEAVE = { label: 'Baja temporal', tone: 'warning', icon: 'pause_circle' }
const IN_DEBT = { label: 'Con deuda', tone: 'error', icon: 'error' }

export const memberStatuses = (socio, account, jugador = null) => {
  if (!isActiveStatus(socio?.estado_administrativo_nombre)) return [DEACTIVATED]
  return [
    jugador?.tipo_baja === 'parcial' && TEMPORARY_LEAVE,
    (account?.cuotas ?? []).some(isOverdue) && IN_DEBT,
  ].filter(Boolean)
}

export const teacherStatuses = (isActive) => (isActive ? [] : [DEACTIVATED])

export const categoryTags = (jugador) => [jugador?.categoria, jugador?.categoria_secundaria]
  .filter((categoria) => categoria?.nombre)
  .map((categoria) => ({ label: categoria.nombre, icon: 'groups' }))
