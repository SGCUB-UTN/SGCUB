import { formatDate } from '../personas/format'

const csvAmount = (amount) => Number(amount ?? 0).toFixed(2).replace('.', ',')

const signedAmount = (item) => {
  if (item.isAnulado) return '0,00'
  return `${item.isPositive ? '' : '-'}${csvAmount(item.amount)}`
}

const CSV_COLUMNS = [
  ['Referencia', (item) => item.refCode],
  ['Tipo', (item) => item.typeLabel],
  ['Fecha', (item) => formatDate(item.date)],
  ['Socio', (item) => item.socioLabel],
  ['DNI', (item) => item.socio?.dni],
  ['Concepto', (item) => item.concept],
  ['Detalle', (item) => item.subConcept],
  ['Medio', (item) => (item.kind === 'devolucion' ? item.paymentMethod : '')],
  ['Monto', signedAmount],
]

const csvCell = (value) => {
  const text = String(value ?? '')
  return /[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function downloadCashMovementsCsv(items) {
  const lines = [
    CSV_COLUMNS.map(([header]) => csvCell(header)).join(';'),
    ...items.map((item) => CSV_COLUMNS.map(([, value]) => csvCell(value(item))).join(';')),
  ]
  const url = URL.createObjectURL(new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `movimientos-caja-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
