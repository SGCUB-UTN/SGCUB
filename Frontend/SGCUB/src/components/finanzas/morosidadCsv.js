const csvAmount = (amount) => Number(amount ?? 0).toFixed(2).replace('.', ',')

const csvCell = (value) => {
  const text = String(value ?? '')
  return /[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const CSV_COLUMNS = [
  ['Apellido y Nombre', (row) => `${row.apellido}, ${row.nombre}`],
  ['DNI', (row) => row.dni ?? ''],
  ['N° Socio', (row) => row.numero_socio ?? ''],
  ['Tipo', (row) => row.tipo ?? ''],
  ['Categoría', (row) => row.categoria_deportiva ?? ''],
  ['Email', (row) => row.email ?? ''],
  ['Cuotas vencidas', (row) => row.cuotas_vencidas ?? 0],
  ['Monto adeudado', (row) => csvAmount(row.monto_adeudado)],
  ['Capital', (row) => csvAmount(row.capital)],
  ['Recargos', (row) => csvAmount(row.recargos)],
  ['Días de mora', (row) => row.dias_mora ?? 0],
]

export function downloadMorosidadCsv(rows, filename = 'reporte-morosidad.csv') {
  const lines = [
    CSV_COLUMNS.map(([header]) => csvCell(header)).join(';'),
    ...rows.map((row) => CSV_COLUMNS.map(([, value]) => csvCell(value(row))).join(';')),
  ]
  const url = URL.createObjectURL(new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
