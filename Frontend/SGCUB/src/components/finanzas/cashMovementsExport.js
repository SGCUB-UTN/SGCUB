import { formatExportAmount } from '../shared/listExport'
import { formatDate } from '../personas/format'

const signedAmount = (item) => {
  if (item.isAnulado) return formatExportAmount(0)
  return `${item.isPositive ? '' : '-'}${formatExportAmount(item.amount)}`
}

export const CASH_EXPORT_COLUMNS = [
  { header: 'Referencia', value: (item) => item.refCode },
  { header: 'Tipo', value: (item) => item.typeLabel },
  { header: 'Fecha', value: (item) => formatDate(item.date) },
  { header: 'Socio', value: (item) => item.socioLabel },
  { header: 'DNI', value: (item) => item.socio?.dni },
  { header: 'Concepto', value: (item) => item.concept },
  { header: 'Detalle', value: (item) => item.subConcept },
  { header: 'Medio', value: (item) => item.paymentMethod || '—' },
  { header: 'Monto', value: signedAmount },
]

const SCOPE_FILENAMES = {
  todos: 'movimientos-caja',
  cuotas: 'cuotas-caja',
  ingresos: 'otros-caja',
  devoluciones: 'devoluciones-caja',
}

export const cashExportFilename = (scope, period) => `${SCOPE_FILENAMES[scope] ?? SCOPE_FILENAMES.todos}-${period}`
