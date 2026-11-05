export const ENTITY_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'socios', label: 'Socios' },
  { value: 'jugadores', label: 'Jugadores' },
  { value: 'docentes', label: 'Docentes' },
]

export const STATUS_OPTIONS = [
  { value: 'activos', label: 'Activos' },
  { value: 'inactivos', label: 'Inactivos' },
  { value: 'todos', label: 'Todos' },
]

export const AGE_RANGE_OPTIONS = [
  { value: '0-12', label: '0 a 12' },
  { value: '13-17', label: '13 a 17' },
  { value: '18-25', label: '18 a 25' },
  { value: '26-40', label: '26 a 40' },
  { value: '41-mas', label: '41 o más' },
  { value: 'sin_datos', label: 'Sin fecha de nacimiento' },
]

export const AGE_OF_MAJORITY = 18

export const SENIORITY_OPTIONS = [
  { value: 'menos-1', label: 'Menos de 1 año' },
  { value: '1-2', label: '1 a 2 años' },
  { value: '3-4', label: '3 a 4 años' },
  { value: '5-9', label: '5 a 9 años' },
  { value: '10-mas', label: '10 años o más' },
]

export const VACCINATION_OPTIONS = [
  { value: 'al_dia', label: 'Al día' },
  { value: 'pendiente', label: 'Vacunas pendientes' },
  { value: 'sin_datos', label: 'Sin datos' },
]

export const EDUCATION_OPTIONS = [
  { value: 'primario_en_proceso', label: 'Primario en proceso' },
  { value: 'primario_incompleto', label: 'Primario incompleto' },
  { value: 'primario_completo', label: 'Primario completo' },
  { value: 'secundario_en_proceso', label: 'Secundario en proceso' },
  { value: 'secundario_incompleto', label: 'Secundario incompleto' },
  { value: 'secundario_completo', label: 'Secundario completo' },
  { value: 'universitario_en_proceso', label: 'Universitario en proceso' },
  { value: 'universitario_incompleto', label: 'Universitario incompleto' },
  { value: 'universitario_completo', label: 'Universitario completo' },
  { value: 'sin_datos', label: 'Sin datos' },
]

export const DOCUMENTATION_OPTIONS = [
  { value: 'habilitado', label: 'Habilitados' },
  { value: 'inhabilitado', label: 'Inhabilitados' },
]

export const COVERAGE_OPTIONS = [
  { value: 'con', label: 'Con obra social (cualquiera)' },
  { value: 'sin', label: 'Sin obra social' },
]

export const INITIAL_FILTERS = {
  entity: '',
  status: 'activos',
  age_range: [],
  age_min: '',
  age_max: '',
  seniority: [],
  gender: [],
  locality: [],
  category: [],
  education: [],
  coverage: [],
  health_insurance: [],
  vaccination: [],
  documentation: [],
}

const DETAIL_FILTERS = ['age_range', 'seniority', 'gender', 'locality', 'category', 'education', 'vaccination', 'documentation']

export const activeFilterCount = (filters) => (
  DETAIL_FILTERS.filter((name) => filters[name].length).length
  + Number(filters.age_min !== '' || filters.age_max !== '')
  + Number(filters.coverage.length > 0 || filters.health_insurance.length > 0)
  + Number(filters.entity !== INITIAL_FILTERS.entity)
  + Number(filters.status !== INITIAL_FILTERS.status)
)

export const sameFilters = (first, second) => JSON.stringify(first) === JSON.stringify(second)

export const selectionSummary = (value, options, allLabel) => {
  if (!value.length) return allLabel
  if (value.length === 1) return options.find((option) => option.value === value[0])?.label ?? allLabel
  return `${value.length} seleccionados`
}

export const toggled = (value, item) => (value.includes(item) ? value.filter((current) => current !== item) : [...value, item])
