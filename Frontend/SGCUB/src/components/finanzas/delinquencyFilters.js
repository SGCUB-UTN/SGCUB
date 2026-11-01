export const PERIOD_TYPES = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'anual', label: 'Anual' },
]

export const PLAYERS = 'jugadores'

export const AFFILIATIONS = [
  { value: 'todos', label: 'Todos los socios' },
  { value: 'socios', label: 'Solo socios' },
  { value: PLAYERS, label: 'Solo jugadores' },
]

const YEARS_BACK = 4

const currentQuarter = (date) => Math.floor(date.getMonth() / 3) + 1

export const defaultReference = (periodType, today = new Date()) => {
  const year = today.getFullYear()
  if (periodType === 'mensual') return `${year}-${String(today.getMonth() + 1).padStart(2, '0')}`
  if (periodType === 'trimestral') return `${year}-T${currentQuarter(today)}`
  return String(year)
}

export const QUARTERS = [1, 2, 3, 4].map((quarter) => ({ value: quarter, label: `${quarter}° trimestre` }))

export const yearOptions = (today = new Date()) => {
  const year = today.getFullYear()
  return Array.from({ length: YEARS_BACK + 1 }, (_, index) => String(year - index))
}

export const lastQuarterOf = (year, today = new Date()) => (Number(year) === today.getFullYear() ? currentQuarter(today) : 4)

export const parseQuarterReference = (reference) => {
  const [year, quarter] = String(reference).split('-T')
  return { year, quarter: Number(quarter) }
}

export const quarterReference = (year, quarter) => `${year}-T${Math.min(quarter, lastQuarterOf(year))}`

export const profilePath = (row) => (
  row.jugador_id
    ? `/padron/jugadores/${row.jugador_id}?tab=financiero`
    : `/padron/socios/${row.socio_id}?tab=financiero`
)
