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

export const ALL = 'all'

export const INITIAL_FILTERS = { situacion: ALL, perfil: ALL, tipo: ALL, categoria: ALL_CATEGORIES, search: '' }

export const STATE_ORDER = [DOCUMENT_STATES.VENCIDO, DOCUMENT_STATES.FALTANTE, DOCUMENT_STATES.POR_VENCER, DOCUMENT_STATES.VIGENTE]

export const SITUATIONS = {
  INHABILITADA: 'inhabilitada',
  POR_VENCER: 'por_vencer',
  AL_DIA: 'al_dia',
}

export const SITUATION_ORDER = [SITUATIONS.INHABILITADA, SITUATIONS.POR_VENCER, SITUATIONS.AL_DIA]

const byUrgency = (a, b) => (
  STATE_ORDER.indexOf(a.estado) - STATE_ORDER.indexOf(b.estado)
  || String(a.fecha_vencimiento ?? '').localeCompare(String(b.fecha_vencimiento ?? ''))
)

export const personSituation = (persona) => {
  if (!persona.habilitado) return SITUATIONS.INHABILITADA
  return persona.documentos.some((documento) => documento.estado !== DOCUMENT_STATES.VIGENTE)
    ? SITUATIONS.POR_VENCER
    : SITUATIONS.AL_DIA
}

export const personRows = (personas) => personas.map((persona) => ({
  ...persona,
  key: persona.clave,
  categoriasLabel: persona.categorias.map(categoryLabel).join(', '),
  situacion: personSituation(persona),
  pendientes: persona.documentos.filter((documento) => documento.estado !== DOCUMENT_STATES.VIGENTE).sort(byUrgency),
}))

export const situationSortKey = (row) => {
  const [first] = row.pendientes
  return [
    SITUATION_ORDER.indexOf(row.situacion),
    first ? STATE_ORDER.indexOf(first.estado) : STATE_ORDER.length,
    first?.fecha_vencimiento ?? '0000-00-00',
  ].join('-')
}

const GENDER_PREFIX = 'gender:'

const matchesCategory = (row, value) => {
  if (value === ALL_CATEGORIES) return true
  if (value === NO_CATEGORY_VALUE) return row.categorias.length === 0
  if (value.startsWith(GENDER_PREFIX)) return row.categorias.some((categoria) => categoria.genero === value.slice(GENDER_PREFIX.length))
  return row.categorias.some((categoria) => String(categoria.categoria_id) === value)
}

const matchesType = (tipo) => (documento) => tipo === ALL || String(documento.tipo_documento) === tipo

export const matchesFilters = (row, { perfil, tipo, categoria, search }) => (
  (perfil === ALL || row.perfil === perfil)
  && (tipo === ALL || row.documentos.some(matchesType(tipo)))
  && matchesCategory(row, categoria)
  && matchesSearch(search, [row.apellido, row.nombre, row.dni])
)

export const filterRows = (rows, filters) => rows.filter((row) => (
  matchesFilters(row, filters) && (filters.situacion === ALL || row.situacion === filters.situacion)
))

export const reportParams = ({ perfil, tipo, categoria, search }) => ({
  perfil: perfil === ALL ? undefined : perfil,
  tipo: tipo === ALL ? undefined : tipo,
  categoria: categoria === ALL_CATEGORIES ? undefined : categoria,
  q: search.trim() || undefined,
})

export const documentTypeOptions = (rows) => {
  const types = new Map(rows.flatMap((row) => row.documentos.map((documento) => [String(documento.tipo_documento), documento.tipo_documento_nombre])))
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
