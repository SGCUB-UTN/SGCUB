import { DOCUMENT_STATES, PROFILE_LABELS, SITUATIONS, personaName } from './padronDocumental'

export const SITUATION_LABELS = {
  [SITUATIONS.INHABILITADA]: 'Inhabilitado',
  [SITUATIONS.POR_VENCER]: 'Por vencer',
  [SITUATIONS.AL_DIA]: 'Al día',
}

export const PENDING_STATE_LABELS = {
  [DOCUMENT_STATES.VENCIDO]: 'Vencido',
  [DOCUMENT_STATES.FALTANTE]: 'Faltante',
  [DOCUMENT_STATES.POR_VENCER]: 'Por vencer',
}

const pendingCell = (row) => row.pendientes
  .map((documento) => `${documento.tipo_documento_nombre} (${PENDING_STATE_LABELS[documento.estado]})`)
  .join(', ')

const CSV_COLUMNS = [
  ['Apellido y nombre', (row) => personaName(row)],
  ['DNI', (row) => row.dni],
  ['Perfil', (row) => PROFILE_LABELS[row.perfil]],
  ['Categoría', (row) => row.categoriasLabel],
  ['Situación', (row) => SITUATION_LABELS[row.situacion]],
  ['Documentación pendiente', pendingCell],
]

export const DOCUMENTAL_EXPORT_COLUMNS = CSV_COLUMNS.map(([header, value]) => ({ header, value }))

const SITUATION_SLUGS = {
  [SITUATIONS.INHABILITADA]: 'inhabilitados',
  [SITUATIONS.POR_VENCER]: 'por-vencer',
  [SITUATIONS.AL_DIA]: 'al-dia',
}

const csvCell = (value) => {
  const text = String(value ?? '')
  return /[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const BOM = String.fromCharCode(0xfeff)

const today = () => new Date().toLocaleDateString('sv-SE')

export function downloadDocumentalCsv(rows, situacion) {
  const slug = SITUATION_SLUGS[situacion]
  const prefix = slug ? `reporte-documental-${slug}` : 'reporte-documental'
  const lines = [
    CSV_COLUMNS.map(([header]) => csvCell(header)).join(';'),
    ...rows.map((row) => CSV_COLUMNS.map(([, value]) => csvCell(value(row))).join(';')),
  ]
  const url = URL.createObjectURL(new Blob([BOM, lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${prefix}-${today()}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
