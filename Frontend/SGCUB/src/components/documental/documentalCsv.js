import { DOCUMENT_STATES, PROFILE_LABELS, STATE_LABELS, formatDate, personaName } from './padronDocumental'

const CSV_COLUMNS = [
  ['Apellido y nombre', (row) => personaName(row)],
  ['DNI', (row) => row.dni],
  ['Perfil', (row) => PROFILE_LABELS[row.perfil]],
  ['Categoría', (row) => row.categoriasLabel],
  ['Documento', (row) => row.tipo_documento_nombre],
  ['Obligatorio', (row) => (row.obligatorio ? 'Sí' : 'No')],
  ['Estado', (row) => STATE_LABELS[row.estado]],
  ['Vencimiento', (row) => (row.fecha_vencimiento ? formatDate(row.fecha_vencimiento) : '')],
]

const STATE_SLUGS = {
  [DOCUMENT_STATES.VENCIDO]: 'vencidos',
  [DOCUMENT_STATES.POR_VENCER]: 'por-vencer',
  [DOCUMENT_STATES.FALTANTE]: 'faltantes',
  [DOCUMENT_STATES.VIGENTE]: 'vigentes',
}

const csvCell = (value) => {
  const text = String(value ?? '')
  return /[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const today = () => new Date().toLocaleDateString('sv-SE')

export function downloadDocumentalCsv(rows, estado) {
  const slug = STATE_SLUGS[estado]
  const prefix = slug ? `reporte-documental-${slug}` : 'reporte-documental'
  const lines = [
    CSV_COLUMNS.map(([header]) => csvCell(header)).join(';'),
    ...rows.map((row) => CSV_COLUMNS.map(([, value]) => csvCell(value(row))).join(';')),
  ]
  const url = URL.createObjectURL(new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${prefix}-${today()}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
