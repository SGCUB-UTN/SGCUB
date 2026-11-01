import { ALL_CATEGORIES, NO_CATEGORY_VALUE, findGender } from '../shared/categoryFilters'
import { matchesSearch } from '../shared/search'

export const DOCUMENT_STATES = {
  VIGENTE: 'vigente',
  POR_VENCER: 'por_vencer',
  VENCIDO: 'vencido',
  FALTANTE: 'faltante',
}

export const PROFILES = {
  JUGADOR: 'jugador',
  DOCENTE: 'docente',
}

export const PROFILE_LABELS = { [PROFILES.JUGADOR]: 'Jugador activo', [PROFILES.DOCENTE]: 'Docente' }

export const STATE_LABELS = {
  [DOCUMENT_STATES.VIGENTE]: 'Vigente',
  [DOCUMENT_STATES.POR_VENCER]: 'Próximo a vencer',
  [DOCUMENT_STATES.VENCIDO]: 'Vencido',
  [DOCUMENT_STATES.FALTANTE]: 'Faltante',
}

export const categoryLabel = (categoria) => {
  const gender = findGender(categoria.genero)
  return gender ? `${categoria.nombre} (${gender.shortLabel})` : categoria.nombre
}

export const personaName = (persona) => `${persona.apellido}, ${persona.nombre}`

export const documentRows = (personas) => personas.flatMap(({ documentos, ...persona }) => {
  const categoriasLabel = persona.categorias.map(categoryLabel).join(', ')
  return documentos.map((documento) => ({
    ...persona,
    ...documento,
    key: `${persona.clave}-${documento.tipo_documento}`,
    categoriasLabel,
  }))
})

export const ALL = 'all'

export const INITIAL_FILTERS = { estado: ALL, perfil: ALL, tipo: ALL, categoria: ALL_CATEGORIES, search: '' }

export const STATE_ORDER = [DOCUMENT_STATES.VENCIDO, DOCUMENT_STATES.FALTANTE, DOCUMENT_STATES.POR_VENCER, DOCUMENT_STATES.VIGENTE]

const GENDER_PREFIX = 'gender:'

const matchesCategory = (row, value) => {
  if (value === ALL_CATEGORIES) return true
  if (value === NO_CATEGORY_VALUE) return row.categorias.length === 0
  if (value.startsWith(GENDER_PREFIX)) return row.categorias.some((categoria) => categoria.genero === value.slice(GENDER_PREFIX.length))
  return row.categorias.some((categoria) => String(categoria.categoria_id) === value)
}

export const matchesFilters = (row, { perfil, tipo, categoria, search }) => (
  (perfil === ALL || row.perfil === perfil)
  && (tipo === ALL || String(row.tipo_documento) === tipo)
  && matchesCategory(row, categoria)
  && matchesSearch(search, [row.apellido, row.nombre, row.dni])
)

export const filterRows = (rows, filters) => rows.filter((row) => (
  matchesFilters(row, filters) && (filters.estado === ALL || row.estado === filters.estado)
))

export const reportParams = ({ estado, perfil, tipo, categoria, search }) => ({
  estado: estado === ALL ? undefined : estado,
  perfil: perfil === ALL ? undefined : perfil,
  tipo: tipo === ALL ? undefined : tipo,
  categoria: categoria === ALL_CATEGORIES ? undefined : categoria,
  q: search.trim() || undefined,
})

export const documentTypeOptions = (rows) => {
  const types = new Map(rows.map((row) => [String(row.tipo_documento), row.tipo_documento_nombre]))
  return [...types].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

export const categoryOptions = (personas) => {
  const categories = new Map()
  personas.forEach((persona) => persona.categorias.forEach((categoria) => {
    categories.set(categoria.categoria_id, { value: String(categoria.categoria_id), name: categoria.nombre, gender: categoria.genero })
  }))
  return [...categories.values()].sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }))
}

export const daysFromToday = (date) => {
  const [year, month, day] = date.split('-').map(Number)
  const today = new Date()
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000)
}

export const formatDate = (date) => date.split('-').reverse().join('/')
