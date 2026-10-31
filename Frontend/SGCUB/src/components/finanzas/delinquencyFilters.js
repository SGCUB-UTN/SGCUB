export const PERIOD_TYPES = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'anual', label: 'Anual' },
]

export const SCOPES = [
  { value: 'activos', label: 'Todos los socios' },
  { value: 'categoria', label: 'Categoría' },
]

export const AFFILIATIONS = [
  { value: 'todos', label: 'Socios y jugadores' },
  { value: 'socios', label: 'Solo socios' },
  { value: 'jugadores', label: 'Solo jugadores' },
]

const YEARS_BACK = 4

const currentQuarter = (date) => Math.floor(date.getMonth() / 3) + 1

export const defaultReference = (periodType, today = new Date()) => {
  const year = today.getFullYear()
  if (periodType === 'mensual') return `${year}-${String(today.getMonth() + 1).padStart(2, '0')}`
  if (periodType === 'trimestral') return `${year}-T${currentQuarter(today)}`
  return String(year)
}

export const referenceOptions = (periodType, today = new Date()) => {
  const year = today.getFullYear()
  const years = Array.from({ length: YEARS_BACK + 1 }, (_, index) => year - index)
  if (periodType === 'anual') return years.map((value) => ({ value: String(value), label: String(value) }))
  return years.flatMap((value) => {
    const lastQuarter = value === year ? currentQuarter(today) : 4
    return Array.from({ length: lastQuarter }, (_, index) => lastQuarter - index)
      .map((quarter) => ({ value: `${value}-T${quarter}`, label: `${quarter}° trimestre ${value}` }))
  })
}

export const profilePath = (row) => (
  row.jugador_id
    ? `/padron/jugadores/${row.jugador_id}?tab=financiero`
    : `/padron/socios/${row.socio_id}?tab=financiero`
)
