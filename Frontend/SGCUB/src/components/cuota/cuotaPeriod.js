import { getGeneroLabel } from '../categorias/categoriaFormat'
import { cuotaStateLabel } from '../finanzas/cuotaStates'

export const CUOTA_TYPES = {
  MEMBER: 'Socio',
  PLAYER: 'Jugador',
  PARTIAL_LEAVE: 'BajaParcial',
}

export const CUOTA_TYPE_LABELS = {
  [CUOTA_TYPES.MEMBER]: 'Socio',
  [CUOTA_TYPES.PLAYER]: 'Jugador',
  [CUOTA_TYPES.PARTIAL_LEAVE]: 'Jugador (baja parcial)',
}

const CUOTA_TYPE_BADGE_CLASSES = {
  [CUOTA_TYPES.MEMBER]: 'bg-surface-container text-on-surface-variant border-outline-variant/50',
  [CUOTA_TYPES.PLAYER]: 'bg-primary/10 text-primary border-primary/25',
  [CUOTA_TYPES.PARTIAL_LEAVE]: 'bg-surface-container-lowest text-on-surface-variant border-outline border-dashed',
}

export const cuotaTypeLabel = (type) => CUOTA_TYPE_LABELS[type] ?? type ?? '—'

export const cuotaTypeBadgeClass = (type) => CUOTA_TYPE_BADGE_CLASSES[type] ?? CUOTA_TYPE_BADGE_CLASSES[CUOTA_TYPES.MEMBER]

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
const wholeMoney = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const percentage = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })

export const formatMoney = (amount) => money.format(Number(amount ?? 0))

export const formatWholeMoney = (amount) => wholeMoney.format(Number(amount ?? 0))

export const formatPercentage = (value) => `${percentage.format(Number(value ?? 0))} %`

export const formatCount = (count) => Number(count ?? 0).toLocaleString('es-AR')

const pad = (value) => String(value).padStart(2, '0')

const toLocalDate = (value) => {
  if (!value) return null
  if (String(value).includes('T')) return new Date(value)
  const [year, month, day] = String(value).split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const formatDayMonth = (value) => {
  const date = toLocalDate(value)
  return date ? `${pad(date.getDate())}/${pad(date.getMonth() + 1)}` : '—'
}

const formatTime = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`

export const formatDayMonthTime = (value) => {
  const date = toLocalDate(value)
  return date ? `${formatDayMonth(value)} ${formatTime(date)}` : '—'
}

export const formatDateTime = (value) => {
  const date = toLocalDate(value)
  return date ? `${formatDayMonth(value)}/${date.getFullYear()} ${formatTime(date)}` : '—'
}

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

export const isValidPeriod = (value) => PERIOD_PATTERN.test(String(value ?? ''))

export const shiftPeriod = (period, months) => {
  const [year, month] = period.split('-').map(Number)
  const date = new Date(year, month - 1 + months, 1)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

export const memberName = (row) => `${row.apellido ?? ''}, ${row.nombre ?? ''}`.replace(/^, |, $/g, '') || 'Sin nombre'

const CSV_COLUMNS = [
  ['N° socio', (row) => row.numero_socio ?? ''],
  ['Apellido', (row) => row.apellido],
  ['Nombre', (row) => row.nombre],
  ['DNI', (row) => row.dni],
  ['Email', (row) => row.email],
  ['Tipo', (row) => cuotaTypeLabel(row.type)],
  ['Categoría', (row) => row.categoria ?? ''],
  ['Género', (row) => (row.categoria_genero ? getGeneroLabel(row.categoria_genero) : '')],
  ['Estado', (row) => cuotaStateLabel(row.estado_cuota)],
  ['Período', (row) => row.periodo],
  ['Cuota', (row) => csvAmount(row.cuota_amount)],
  ['Recargos', (row) => csvAmount(row.surcharges)],
  ['Saldo pendiente', (row) => csvAmount(row.pending)],
]

const csvAmount = (amount) => Number(amount ?? 0).toFixed(2).replace('.', ',')

const csvCell = (value) => {
  const text = String(value ?? '')
  return /[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function downloadCuotasCsv(rows, period) {
  const lines = [
    CSV_COLUMNS.map(([header]) => csvCell(header)).join(';'),
    ...rows.map((row) => CSV_COLUMNS.map(([, value]) => csvCell(value(row))).join(';')),
  ]
  const url = URL.createObjectURL(new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `cuotas-${period}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
